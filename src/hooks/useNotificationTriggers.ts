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
import { useNotifications as useLegacyCount } from '@/hooks/useNotifications';
let Notifications: any;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = {
    cancelAllScheduledNotificationsAsync: async () => {},
    scheduleNotificationAsync: async () => 'noop',
    SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
  };
}

const WEEKLY_KEY = 'lastWeeklySupplierCheck';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const schedulePushReminders = async (settings?: NotificationGate) => {
  try {
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo && Platform.OS === 'android') return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const scheduledDates: Date[] = [];

    // →→ Daily recurring reminder at 8:00 AM (gated by Daily Summary toggle) →→
    if (settings?.daily !== false) {
      const daily = new Date(now);
      daily.setHours(8, 0, 0, 0);
      if (daily <= now) daily.setDate(daily.getDate() + 1);
      scheduledDates.push(daily);
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
            title: 'Shega OS Reminder',
            body: 'You have pending updates. Open the app to review.',
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
  const { notifications: notificationSettings } = useSettings();
  const { refreshNotifications } = useLegacyCount();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep latest settings in a ref so the weekly check callback stays stable
  const settingsRef = useRef(notificationSettings);
  useEffect(() => { settingsRef.current = notificationSettings; }, [notificationSettings]);

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
    schedulePushReminders(notificationSettings);

    intervalRef.current = setInterval(() => {
      runAllNotificationChecks(notificationSettings);
      refresh();
    }, 120_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, runWeeklySupplierChecks, notificationSettings]);

  return {
    refresh,
    refreshNotifications,
    getAlertSummary: getDashboardAlertSummary,
    runWeeklySupplierChecks,
  };
};