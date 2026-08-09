// Hook that wires business events to the notification system
// Call this once in a top-level component (e.g. AppShell) so events
// like "sale completed" or "expense recorded" auto-create notifications.
// Also schedules local push notifications for recurring reminders.

import { useEffect, useRef , useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useNotificationCenter } from '@/context/NotificationContext';
import { useSettings } from '@/context/SettingsContext';
import { useFocusEffect } from 'expo-router';

import {
  runAllNotificationChecks,
  NotificationGate,
  getDashboardAlertSummary,
  checkSupplierPriceChanges,
  checkSupplierPeriodicReview,
} from '@/services/notificationService';
import { getRecurringTemplates } from '@/database/db';
import {
  getAllPreferences,
  createReminder,
  getReminderByTemplate,
  getRecurringReminders,
  updateReminderNotificationId,
  resetReminderToPending,
  updateReminderStatus,
} from '@/database/notifications';
import { useNotifications as useLegacyCount } from '@/hooks/useNotifications';
let Notifications: any;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = {
    cancelAllScheduledNotificationsAsync: async () => {},
    scheduleNotificationAsync: async () => 'noop',
    SchedulableTriggerInputTypes: {
      TIME_INTERVAL: 'timeInterval',
      DAILY: 'daily',
      WEEKLY: 'weekly',
      MONTHLY: 'monthly',
      YEARLY: 'yearly',
    },
  };
}

const WEEKLY_KEY = 'lastWeeklySupplierCheck';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const scheduleRepeatingPush = async (
  hour: number,
  minute: number,
  title: string,
  body: string,
  link: string,
  sound: boolean = true,
) => {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound,
        data: { link },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
};

// Schedule a recurring template reminder at the template's saved reminder time,
// recurring with the template's own frequency (not always daily).
// Returns the OS notification identifier so the reminder row can cancel it.
const scheduleTemplateReminder = async (
  tmpl: any,
  title: string,
  body: string,
  link: string,
  sound: boolean = true,
): Promise<string | null> => {
  const [hRaw, mRaw] = String(tmpl.reminderTime).split(':').map(Number);
  if (!Number.isFinite(hRaw) || hRaw < 0 || hRaw > 23) return null;
  const minute = Number.isFinite(mRaw) ? Math.min(Math.max(mRaw, 0), 59) : 0;
  const start = tmpl.startDate ? new Date(String(tmpl.startDate).replace(/-/g, '/')) : new Date();
  if (isNaN(start.getTime())) return null;

  const base = {
    type: Notifications.SchedulableTriggerInputTypes.DAILY as string,
    hour: hRaw,
    minute,
  };
  try {
    switch (String(tmpl.frequency || '').toLowerCase()) {
      case 'weekly': {
        // Expo weekdays: 1 = Sunday ... 7 = Saturday
        const weekday = (start.getDay() + 6) % 7 + 1;
        const id = await Notifications.scheduleNotificationAsync({
          content: { title, body, sound, data: { link } },
          trigger: { ...base, type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday },
        });
        return typeof id === 'string' ? id : null;
      }
      case 'monthly': {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title, body, sound, data: { link } },
          trigger: { ...base, type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: start.getDate() },
        });
        return typeof id === 'string' ? id : null;
      }
      case 'yearly': {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title, body, sound, data: { link } },
          trigger: { ...base, type: Notifications.SchedulableTriggerInputTypes.YEARLY, month: start.getMonth(), day: start.getDate() },
        });
        return typeof id === 'string' ? id : null;
      }
      default: {
        return await scheduleRepeatingPush(hRaw, minute, title, body, link, sound);
      }
    }
  } catch {
    return null;
  }
};

type Translator = (key: string, params?: Record<string, string>) => string;

// Returns the ISO time of the template reminder's next occurrence, given its
// reminder time (HH:MM) and frequency, so the reminder screen shows a real date.
const nextOccurrence = (tmpl: any): Date => {
  const [hRaw, mRaw] = String(tmpl.reminderTime || '8:00').split(':').map(Number);
  const hour = Number.isFinite(hRaw) && hRaw >= 0 && hRaw <= 23 ? hRaw : 8;
  const minute = Number.isFinite(mRaw) ? Math.min(Math.max(mRaw, 0), 59) : 0;
  const now = new Date();
  const start = tmpl.startDate ? new Date(String(tmpl.startDate).replace(/-/g, '/')) : new Date(now);
  if (isNaN(start.getTime())) return start;

  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);
  if (candidate <= now) candidate.setDate(candidate.getDate() + 1);

  switch (String(tmpl.frequency || '').toLowerCase()) {
    case 'weekly': {
      while (candidate.getDay() !== start.getDay()) candidate.setDate(candidate.getDate() + 1);
      if (candidate <= now) candidate.setDate(candidate.getDate() + 7);
      break;
    }
    case 'monthly': {
      candidate.setDate(start.getDate());
      if (candidate <= now) candidate.setMonth(candidate.getMonth() + 1);
      break;
    }
    case 'yearly': {
      candidate.setMonth(start.getMonth(), start.getDate());
      if (candidate <= now) candidate.setFullYear(candidate.getFullYear() + 1);
      break;
    }
    default:
      break;
  }
  return candidate;
};

// Returns true when the given time-of-day (HH:MM) falls inside quiet hours.
const isInQuietHours = (hour: number, minute: number, quietStart?: string | null, quietEnd?: string | null): boolean => {
  if (!quietStart || !quietEnd) return false;
  const [sh, sm] = quietStart.split(':').map(Number);
  const [eh, em] = quietEnd.split(':').map(Number);
  if (!Number.isFinite(sh) || !Number.isFinite(eh)) return false;
  const cur = hour * 60 + minute;
  const start = sh * 60 + (Number.isFinite(sm) ? sm : 0);
  const end = eh * 60 + (Number.isFinite(em) ? em : 0);
  if (start <= end) {
    return cur >= start && cur <= end;
  }
  return cur >= start || cur <= end;
};

const schedulePushReminders = async (
  settings?: NotificationGate,
  t?: Translator,
) => {
  try {
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo && Platform.OS === 'android') return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    // Respect the global "Push Notifications" preference — when off,
    // no scheduled push reminders are (kept) active.
    const prefs = getAllPreferences();
    const pushPref = prefs.find((p) => p.key === 'push');
    if (pushPref && !pushPref.enabled) return;
    const quietPref = prefs.find((p) => p.key === 'quiet_hours');
    const quietStart = quietPref?.quietStart;
    const quietEnd = quietPref?.quietEnd;
    const soundPref = prefs.find((p) => p.key === 'sound');
    const shouldPlaySound = soundPref ? soundPref.enabled : true;

    // Apply vibration preference to the Android default channel so scheduled
    // pushes honor the toggle even when no device alert fires.
    const vibrationPref = prefs.find((p) => p.key === 'vibration');
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: vibrationPref && !vibrationPref.enabled ? [] : [0, 250, 250, 250],
          lightColor: '#5555557C',
        });
      } catch {
        // ignore channel update failures
      }
    }

    const now = new Date();
    const scheduledDates: Date[] = [];

    // →→ Morning motivation — kickstart the day for sales →→
    // Gated by the "Daily Summary" toggle (daily) + quiet hours.
    if (settings?.daily !== false && !isInQuietHours(8, 0, quietStart, quietEnd)) {
      const morningTitle = t
        ? t('notif.push.morning_title')
        : 'Good morning!';
      const morningBody = t
        ? t('notif.push.morning_body')
        : 'Start your day strong — record your first sale and keep your business growing.';
      await scheduleRepeatingPush(8, 0, morningTitle, morningBody, '/(tabs)/sales-hub', shouldPlaySound);
    }

// → Evening reminder to review today's summary at 6:00 PM → (daily)
    if (settings?.daily !== false && !isInQuietHours(18, 0, quietStart, quietEnd)) {
      const summaryTitle = t
        ? t('notif.push.summary_title')
        : "Check Today's Summary";
      const summaryBody = t
        ? t('notif.push.summary_body')
        : 'Review your sales, expenses, and profit for today.';
      await scheduleRepeatingPush(18, 0, summaryTitle, summaryBody, '/(tabs)/summary', shouldPlaySound);
    }

    // →→ Recurring expense reminders at the per-template reminder time →→
    // Gated by the "Recurring" toggle (recurring) + quiet hours.
    if (settings?.recurring !== false) {
      const templates = getRecurringTemplates(true) as any[];
      const reminderTitle = t ? t('notif.push.recurring_title') : 'Recurring Expense Due';
      for (const tmpl of templates) {
        if (!tmpl.reminderTime) continue;
        const [rhRaw, rmRaw] = String(tmpl.reminderTime).split(':').map(Number);
        const reminderBody = t
          ? t('notif.push.recurring_body', { name: tmpl.name })
          : `${tmpl.name} is due. Tap to review.`;

        // Skip past-snooze rows: a snoozed reminder stays snoozed until its
        // snoozedUntil fires again, at which point it resumes repeating here.
        const existing = getReminderByTemplate(tmpl.id);
        if (
          existing &&
          existing.status === 'snoozed' &&
          existing.snoozedUntil &&
          new Date(existing.snoozedUntil).getTime() > Date.now()
        ) {
          continue;
        }
        if (existing && (existing.status === 'completed' || existing.status === 'cancelled')) {
          continue;
        }

        // Respect quiet hours for the template's reminder time.
        if (isInQuietHours(rhRaw, Number.isFinite(rmRaw) ? rmRaw : 0, quietStart, quietEnd)) {
          continue;
        }

        // Snoozed-but-elapsed rows resume as a normal pending reminder.
        const resumed = existing && existing.status === 'snoozed';

        // (Re)schedule the recurring OS push and mirror it as a DB row so the
        // reminder screen can list it, snooze it, complete it, or remove it.
        const notificationId = await scheduleTemplateReminder(
          tmpl,
          reminderTitle,
          reminderBody,
          '/(tabs)/expense',
          shouldPlaySound,
        );
        if (existing) {
          if (resumed) {
            resetReminderToPending(existing.id, notificationId);
          } else {
            updateReminderNotificationId(existing.id, notificationId);
          }
        } else {
          createReminder({
            type: 'recurring',
            refId: tmpl.id,
            title: reminderTitle,
            body: reminderBody,
            triggerAt: nextOccurrence(tmpl).toISOString(),
            repeatInterval: (String(tmpl.frequency || 'daily') as 'daily' | 'weekly' | 'monthly' | 'yearly'),
          });
          const row = getReminderByTemplate(tmpl.id);
          if (row) updateReminderNotificationId(row.id, notificationId);
        }
      }
    } else {
      // Recurring toggle is off — drop any mirrored rows so the screen clears.
      try {
        const rows = getRecurringReminders();
        for (const row of rows) updateReminderStatus(row.id, 'cancelled');
      } catch {}
    }

    // →→ Weekly spending summary every Monday at 9:00 AM (gated by Weekly Summary toggle + quiet hours) →→
    if (settings?.weeklySummary !== false && !isInQuietHours(9, 0, quietStart, quietEnd)) {
      const weekly = new Date(now);
      weekly.setHours(9, 0, 0, 0);
      const daysUntilMonday = (8 - weekly.getDay()) % 7 || 7;
      weekly.setDate(weekly.getDate() + daysUntilMonday);
      if (weekly <= now) weekly.setDate(weekly.getDate() + 7);
      scheduledDates.push(weekly);
    }

    // →→ Monthly budget review on the 1st at 10:00 AM (gated by Monthly Summary toggle + quiet hours) →→
    if (settings?.monthlySummary !== false && !isInQuietHours(10, 0, quietStart, quietEnd)) {
      const monthly = new Date(now.getFullYear(), now.getMonth() + 1, 1, 10, 0, 0, 0);
      if (monthly <= now) monthly.setMonth(monthly.getMonth() + 1);
      scheduledDates.push(monthly);
    }

    for (const triggerDate of scheduledDates) {
      const secondsFromNow = Math.max(60, Math.round((triggerDate.getTime() - Date.now()) / 1000));
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: t ? t('notif.push.weekly_title') : 'Shega OS Reminder',
            body: t
              ? t('notif.push.weekly_body')
              : 'You have pending updates. Open the app to review.',
            sound: shouldPlaySound,
            data: { link: '/(tabs)/dashboard' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: secondsFromNow,
          },
        });
      } catch {}
    }
  } catch {
    // Expo Go on Android silently fails — expected
  }
};

export const useNotificationTriggers = () => {
  const { refresh, preferences } = useNotificationCenter();
  const { notifications: notificationSettings, t, language } = useSettings();
  const { refreshNotifications } = useLegacyCount();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep latest settings in a ref so the weekly check callback stays stable
  const settingsRef = useRef(notificationSettings);
  useEffect(() => { settingsRef.current = notificationSettings; }, [notificationSettings]);
  // Keep latest translator in a ref so scheduling uses the current language
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t, language]);

  // Stable signature of the global per-key preferences (push / sound / vibration /
  // quiet hours). Compares values, not array identity, so push reminder scheduling
  // only re-runs when a preference actually changes — not on every data refresh.
  const prefsSignature = preferences
    .map((p) => `${p.key}:${p.enabled}:${p.quietStart ?? ''}:${p.quietEnd ?? ''}:${p.vibration}`)
    .sort()
    .join('|');

  // Refresh notifications when the dashboard regains focus
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshNotifications();
    }, [refresh, refreshNotifications]),
  );

  // Weekly supplier call check — throttled to once every 7 days
  const runWeeklySupplierChecks = useCallback(async () => {
    if (settingsRef.current.credit === false) return;
    try {
      const last = await SecureStore.getItemAsync(WEEKLY_KEY);
      const lastTs = last ? parseInt(last, 10) : 0;
      if (Date.now() - lastTs < WEEK_MS) return;
      checkSupplierPriceChanges();
      checkSupplierPeriodicReview();
      await SecureStore.setItemAsync(WEEKLY_KEY, String(Date.now()));
    } catch {
      checkSupplierPriceChanges();
      checkSupplierPeriodicReview();
    }
  }, []);

  // Initial run + periodic background checks + push reminder scheduling
  useEffect(() => {
    runAllNotificationChecks(notificationSettings);
    refresh();
    runWeeklySupplierChecks();
    // Re-schedule push reminders so toggle changes take effect immediately
    schedulePushReminders(notificationSettings, tRef.current);

    intervalRef.current = setInterval(() => {
      runAllNotificationChecks(notificationSettings);
      refresh();
    }, 120_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, runWeeklySupplierChecks, notificationSettings, language, prefsSignature]);

  return {
    refresh,
    refreshNotifications,
    getAlertSummary: getDashboardAlertSummary,
    runWeeklySupplierChecks,
  };
};