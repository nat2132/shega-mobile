// Hook that wires business events to the notification system
// Call this once in a top-level component (e.g. AppShell) so events
// like "sale completed" auto-create notifications.
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
import { getAllPreferences } from '@/database/notifications';
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

type Translator = (key: string, params?: Record<string, string>) => string;

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

    // Respect the global "Push Notifications" preference â€” when off,
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

    // â†’â†’ Morning motivation â€” kickstart the day for sales â†’â†’
    // Gated by the "Daily Summary" toggle (daily) + quiet hours.
    if (settings?.daily !== false && !isInQuietHours(8, 0, quietStart, quietEnd)) {
      const morningTitle = t
        ? t('notif.push.morning_title')
        : 'Good morning!';
      const morningBody = t
        ? t('notif.push.morning_body')
        : 'Start your day strong â€” record your first sale and keep your business growing.';
      await scheduleRepeatingPush(8, 0, morningTitle, morningBody, '/(tabs)/sales-hub', shouldPlaySound);
    }

// â†’ Evening reminder to review today's summary at 6:00 PM â†’ (daily)
    if (settings?.daily !== false && !isInQuietHours(18, 0, quietStart, quietEnd)) {
      const summaryTitle = t
        ? t('notif.push.summary_title')
        : "Check Today's Summary";
      const summaryBody = t
        ? t('notif.push.summary_body')
        : 'Review your sales and profit for today.';
      await scheduleRepeatingPush(18, 0, summaryTitle, summaryBody, '/(tabs)/summary', shouldPlaySound);
    }

    
  } catch {
    // Expo Go on Android silently fails â€” expected
  }
};

export const useNotificationTriggers = () => {
  const { refresh, preferences } = useNotificationCenter();
  const { notifications: notificationSettings, t, language, featureFlags } = useSettings();
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
  // only re-runs when a preference actually changes â€” not on every data refresh.
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

  // Weekly supplier call check â€” throttled to once every 7 days
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
    runAllNotificationChecks(notificationSettings, featureFlags.customersEnabled);
    refresh();
    runWeeklySupplierChecks();
    // Re-schedule push reminders so toggle changes take effect immediately
    schedulePushReminders(notificationSettings, tRef.current);

    intervalRef.current = setInterval(() => {
      runAllNotificationChecks(notificationSettings, featureFlags.customersEnabled);
      refresh();
    }, 120_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, runWeeklySupplierChecks, notificationSettings, language, prefsSignature, featureFlags.customersEnabled]);

  return {
    refresh,
    refreshNotifications,
    getAlertSummary: getDashboardAlertSummary,
    runWeeklySupplierChecks,
  };
};