// Hook that wires business events to the notification system
// Call this once in a top-level component (e.g. AppShell) so events
// like "sale completed" or "expense recorded" auto-create notifications.

import { useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useNotificationCenter } from '@/context/NotificationContext';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  runAllNotificationChecks,
  getDashboardAlertSummary,
  checkSupplierPriceChanges,
  checkSupplierPeriodicReview,
} from '@/services/notificationService';
import { useNotifications as useLegacyCount } from '@/hooks/useNotifications';

const WEEKLY_KEY = 'lastWeeklySupplierCheck';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const useNotificationTriggers = () => {
  const { refresh } = useNotificationCenter();
  const { refreshNotifications } = useLegacyCount();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh notifications when the dashboard regains focus
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshNotifications();
    }, [refresh, refreshNotifications]),
  );

  // Weekly supplier call check — throttled to once every 7 days
  const runWeeklySupplierChecks = useCallback(async () => {
    try {
      const last = await SecureStore.getItemAsync(WEEKLY_KEY);
      const lastTs = last ? parseInt(last, 10) : 0;
      if (Date.now() - lastTs < WEEK_MS) return;
      checkSupplierPriceChanges();
      checkSupplierPeriodicReview();
      await SecureStore.setItemAsync(WEEKLY_KEY, String(Date.now()));
    } catch (e) {
      // If storage fails, fall back to running the check
      checkSupplierPriceChanges();
      checkSupplierPeriodicReview();
    }
  }, []);

  // Initial run + periodic background checks (every 2 minutes for time-sensitive
  // items like low stock; supplier checks are throttled to once per week)
  useEffect(() => {
    runAllNotificationChecks();
    refresh();
    runWeeklySupplierChecks();

    intervalRef.current = setInterval(() => {
      runAllNotificationChecks();
      refresh();
    }, 120_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, runWeeklySupplierChecks]);

  return {
    refresh,
    refreshNotifications,
    getAlertSummary: getDashboardAlertSummary,
    runWeeklySupplierChecks,
  };
};
