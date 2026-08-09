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
) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { link },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch {}
};

// Schedule a recurring template reminder at the template's saved reminder time,
// recurring with the template's own frequency (not always daily).
const scheduleTemplateReminder = async (
  tmpl: any,
  title: string,
  body: string,
  link: string,
) => {
  const [hRaw, mRaw] = String(tmpl.reminderTime).split(':').map(Number);
  if (!Number.isFinite(hRaw) || hRaw < 0 || hRaw > 23) return;
  const minute = Number.isFinite(mRaw) ? Math.min(Math.max(mRaw, 0), 59) : 0;
  const start = tmpl.startDate ? new Date(String(tmpl.startDate).replace(/-/g, '/')) : new Date();
  if (isNaN(start.getTime())) return;

  const base = {
    type: Notifications.SchedulableTriggerInputTypes.DAILY as string,
    hour: hRaw,
    minute,
  };
  switch (String(tmpl.frequency || '').toLowerCase()) {
    case 'weekly': {
      // Expo weekdays: 1 = Sunday ... 7 = Saturday
      const weekday = (start.getDay() + 6) % 7 + 1;
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true, data: { link } },
        trigger: { ...base, type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday },
      });
      break;
    }
    case 'monthly': {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true, data: { link } },
        trigger: { ...base, type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: start.getDate() },
      });
      break;
    }
    case 'yearly': {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true, data: { link } },
        trigger: { ...base, type: Notifications.SchedulableTriggerInputTypes.YEARLY, month: start.getMonth(), day: start.getDate() },
      });
      break;
    }
    default: {
      await scheduleRepeatingPush(hRaw, minute, title, body, link);
    }
  }
};

type Translator = (key: string, params?: Record<string, string>) => string;

const schedulePushReminders = async (
  settings?: NotificationGate,
  t?: Translator,
) => {
  try {
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo && Platform.OS === 'android') return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const scheduledDates: Date[] = [];

    // →→ Morning motivation — kickstart the day for sales →→
    // Gated by the "Daily Summary" toggle (daily).
    if (settings?.daily !== false) {
      const morningTitle = t
        ? t('notif.push.morning_title')
        : 'Good morning!';
      const morningBody = t
        ? t('notif.push.morning_body')
        : 'Start your day strong — record your first sale and keep your business growing.';
      await scheduleRepeatingPush(8, 0, morningTitle, morningBody, '/(tabs)/sales-hub');
    }

// → Evening reminder to review today's summary at 6:00 PM → (daily)
    if (settings?.daily !== false) {
      const summaryTitle = t
        ? t('notif.push.summary_title')
        : "Check Today's Summary";
      const summaryBody = t
        ? t('notif.push.summary_body')
        : 'Review your sales, expenses, and profit for today.';
      await scheduleRepeatingPush(18, 0, summaryTitle, summaryBody, '/(tabs)/summary');
    }

    // →→ Recurring expense reminders at the per-template reminder time →→
    // Gated by the "Recurring" toggle (recurring).
    if (settings?.recurring !== false) {
      const templates = getRecurringTemplates(true) as any[];
      const reminderTitle = t ? t('notif.push.recurring_title') : 'Recurring Expense Due';
      templates
        .filter((tmpl: any) => tmpl.reminderTime)
        .forEach((tmpl: any) => {
          const reminderBody = t
            ? t('notif.push.recurring_body', { name: tmpl.name })
            : `${tmpl.name} is due. Tap to review.`;
          scheduleTemplateReminder(tmpl, reminderTitle, reminderBody, '/(tabs)/expense');
        });
    }

    // →→ Weekly spending summary every Monday at 9:00 AM (gated by Weekly Summary toggle) →→
    if (settings?.weeklySummary !== false) {
      const weekly = new Date(now);
      weekly.setHours(9, 0, 0, 0);
      const daysUntilMonday = (8 - weekly.getDay()) % 7 || 7;
      weekly.setDate(weekly.getDate() + daysUntilMonday);
      if (weekly <= now) weekly.setDate(weekly.getDate() + 7);
      scheduledDates.push(weekly);
    }

    // →→ Monthly budget review on the 1st at 10:00 AM (gated by Monthly Summary toggle) →→
    if (settings?.monthlySummary !== false) {
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
            sound: true,
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
  const { refresh } = useNotificationCenter();
  const { notifications: notificationSettings, t, language } = useSettings();
  const { refreshNotifications } = useLegacyCount();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep latest settings in a ref so the weekly check callback stays stable
  const settingsRef = useRef(notificationSettings);
  useEffect(() => { settingsRef.current = notificationSettings; }, [notificationSettings]);
  // Keep latest translator in a ref so scheduling uses the current language
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t, language]);

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
  }, [refresh, runWeeklySupplierChecks, notificationSettings, language]);

  return {
    refresh,
    refreshNotifications,
    getAlertSummary: getDashboardAlertSummary,
    runWeeklySupplierChecks,
  };
};