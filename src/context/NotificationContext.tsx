// Central notification state
// Wires the SQLite data layer to a React context so any screen can read
// unread counts, list notifications, mark read, dismiss, etc.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AppNotification,
  getNotifications,
  getUnreadCount,
  getUnresolvedCount,
  markAsRead,
  markAllAsRead,
  markAsDismissed,
  markAsResolved,
  clearAllNotifications,
  deleteOldNotifications,
  cleanupExpiredNotifications,
  getActiveReminders,
  ScheduledReminder,
  snoozeReminder,
  updateReminderStatus,
  deleteReminder,
  getAllPreferences,
  NotificationPreferences,
  setPreference,
} from '@/database/notifications';
import { runAllNotificationChecks } from '@/services/notificationService';
import { useToast } from './ToastContext';
import { useSettings } from './SettingsContext';

interface NotificationContextProps {
  notifications: AppNotification[];
  unreadCount: number;
  unresolvedCount: number;
  reminders: ScheduledReminder[];
  preferences: NotificationPreferences[];
  loading: boolean;
  refresh: () => Promise<void>;
  refreshByCategory: (category: string) => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: number) => Promise<void>;
  resolve: (id: number) => Promise<void>;
  clearAll: () => Promise<void>;
  snoozeReminderById: (id: number, minutes: number) => Promise<void>;
  completeReminder: (id: number) => Promise<void>;
  removeReminder: (id: number) => Promise<void>;
  updatePreference: (key: string, prefs: Partial<NotificationPreferences>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { showToast } = useToast();
  const { t, notifications: notificationSettings } = useSettings();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [reminders, setReminders] = useState<ScheduledReminder[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences[]>([]);
  const [loading, setLoading] = useState(true);
  const lastRefresh = useRef(0);

  const refresh = useCallback(async () => {
    // Throttle to once every 500ms minimum
    const now = Date.now();
    if (now - lastRefresh.current < 500) return;
    lastRefresh.current = now;

    try {
      setLoading(true);
      // 1. Run business checks that may create new notifications
      //    (per-category toggles gate which checks run)
      runAllNotificationChecks(notificationSettings);

      // 2. Read fresh data
      const list = getNotifications({ limit: 200 });
      const unread = getUnreadCount();
      const unresolved = getUnresolvedCount();
      const rem = getActiveReminders();
      const prefs = getAllPreferences();

      setNotifications(list);
      setUnreadCount(unread);
      setUnresolvedCount(unresolved);
      setReminders(rem);
      setPreferences(prefs);
    } catch (e) {
      console.error('Notification refresh error:', e);
    } finally {
      setLoading(false);
    }
  }, [notificationSettings]);

  const refreshByCategory = useCallback(async (category: string) => {
    const list = getNotifications({ category: category as any, limit: 200 });
    setNotifications(list);
  }, []);

  // Auto-refresh on mount and on a slow interval
  useEffect(() => {
    refresh();
    cleanupExpiredNotifications();
    deleteOldNotifications(60);

    const id = setInterval(() => {
      refresh();
    }, 60_000); // every minute

    return () => clearInterval(id);
  }, [refresh]);

  const markRead = useCallback(async (id: number) => {
    markAsRead(id);
    await refresh();
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    markAllAsRead();
    showToast({ title: t('toast.notif_marked_read'), message: t('toast.notif_marked_read_desc'), type: 'success' });
    await refresh();
  }, [refresh, showToast]);

  const dismiss = useCallback(async (id: number) => {
    markAsDismissed(id);
    await refresh();
  }, [refresh]);

  const resolve = useCallback(async (id: number) => {
    markAsResolved(id);
    showToast({ title: t('toast.notif_resolved'), message: t('toast.notif_resolved_desc'), type: 'success' });
    await refresh();
  }, [refresh, showToast]);

  const clearAll = useCallback(async () => {
    clearAllNotifications();
    showToast({ title: t('toast.notif_cleared'), message: t('toast.notif_cleared_desc'), type: 'info' });
    await refresh();
  }, [refresh, showToast]);

  const snoozeReminderById = useCallback(async (id: number, minutes: number) => {
    snoozeReminder(id, minutes);
    showToast({ title: t('toast.reminder_snoozed'), message: t('toast.reminder_snoozed_desc', { minutes: String(minutes) }), type: 'info' });
    await refresh();
  }, [refresh, showToast]);

  const completeReminder = useCallback(async (id: number) => {
    updateReminderStatus(id, 'completed');
    showToast({ title: t('toast.reminder_completed'), message: t('toast.reminder_completed_desc'), type: 'success' });
    await refresh();
  }, [refresh, showToast]);

  const removeReminder = useCallback(async (id: number) => {
    deleteReminder(id);
    showToast({ title: t('toast.reminder_removed'), message: t('toast.reminder_removed_desc'), type: 'info' });
    await refresh();
  }, [refresh, showToast]);

  const updatePreference = useCallback(async (
    key: string,
    prefs: Partial<NotificationPreferences>,
  ) => {
    const current = preferences.find((p) => p.key === key);
    setPreference({ ...(current || { key, sound: 'default', vibration: true, enabled: true }), ...prefs, key });
    await refresh();
  }, [preferences, refresh]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        unresolvedCount,
        reminders,
        preferences,
        loading,
        refresh,
        refreshByCategory,
        markRead,
        markAllRead,
        dismiss,
        resolve,
        clearAll,
        snoozeReminderById,
        completeReminder,
        removeReminder,
        updatePreference,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationCenter = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationCenter must be used within a NotificationProvider');
  }
  return context;
};