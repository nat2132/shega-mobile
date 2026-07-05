// Local notification hook
// - Sets up notification handler (foreground alerts, sounds, badges)
// - Handles deep linking from notification taps
// - Fires device-level local notifications for unresolved business alerts
// - Provides helpers for scheduling/cancelling local notifications

import { useState, useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useNotificationCenter } from '@/context/NotificationContext';
import { getNotifications, getUnresolvedCount, getAllPreferences } from '@/database/notifications';

const NOTIFIED_KEY = 'lastDeviceNotifiedAt';
const CHECK_INTERVAL = 120_000;

export interface LocalNotificationState {
  notification?: any;
  deepLink?: string | null;
}

export interface LocalNotificationInput {
  title: string;
  body: string;
  data?: any;
  triggerSeconds?: number;
  sound?: boolean;
  categoryId?: string;
}

let cachedHandlerSet = false;

const setupHandlerOnce = () => {
  if (cachedHandlerSet) return;
  try {
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo && Platform.OS === 'android') return;
    Notifications.setNotificationHandler({
      handleNotification: async () =>
        ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        } as Notifications.NotificationBehavior),
    });
    cachedHandlerSet = true;
  } catch {
    // ignore
  }
};

export const useLocalNotifications = (): LocalNotificationState & {
  scheduleLocal: (input: LocalNotificationInput) => Promise<string | null>;
  cancelAllScheduled: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
} => {
  const [notification, setNotification] = useState<any | undefined>();
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const router = useRouter();
  const { markRead, refresh } = useNotificationCenter();

  const scheduleLocal = async (input: LocalNotificationInput) => {
    try {
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo && Platform.OS === 'android') return null;
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: input.title,
          body: input.body,
          data: input.data || {},
          sound: input.sound !== false,
          categoryIdentifier: input.categoryId,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: input.triggerSeconds || 0,
        },
      });
      return id;
    } catch (e) {
      console.error('scheduleLocal error:', e);
      return null;
    }
  };

  const cancelAllScheduled = async () => {
    try {
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo && Platform.OS === 'android') return;
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // ignore
    }
  };

  const dismissNotification = async (id: string) => {
    try {
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo && Platform.OS === 'android') return;
      await Notifications.dismissNotificationAsync(id);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    setupHandlerOnce();
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo && Platform.OS === 'android') {
      console.log('Skipping local notification setup: Not supported in Expo Go on Android.');
      return;
    }

    // Android channels (required for local notification display)
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#5555557C',
      });
      Notifications.setNotificationChannelAsync('inventory', {
        name: 'Inventory Alerts',
        importance: Notifications.AndroidImportance.HIGH,
      });
      Notifications.setNotificationChannelAsync('payments', {
        name: 'Payment Reminders',
        importance: Notifications.AndroidImportance.HIGH,
      });
      Notifications.setNotificationChannelAsync('reports', {
        name: 'Reports',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    // Request notification permissions
    (async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      if (existingStatus !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    })();

    // Foreground listener — refresh in-app notification list on arrival
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notif: any) => {
        setNotification(notif);
        refresh();
      },
    );

    // Notification tap listener — deep link navigation + mark as read
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        const data = response?.notification?.request?.content?.data || {};
        const link = data?.deepLink || data?.link;
        if (link) {
          setDeepLink(link);
          try {
            router.push(link as any);
          } catch (e) {
            console.warn('Deep link navigation failed:', e);
          }
        }
        const notifId = data?.notifId;
        if (typeof notifId === 'number') {
          markRead(notifId);
        }
      },
    );

    // →→ Poll for unresolved DB notifications and fire device alerts →→
    const fireDeviceAlert = async () => {
      try {
        // 1. Check global notifications toggle
        const allPrefs = getAllPreferences();
        const pushPref = allPrefs.find(p => p.key === 'push');
        if (pushPref && !pushPref.enabled) return;

        const unresolved = getUnresolvedCount();
        if (unresolved === 0) return;

        // 2. Check quiet hours
        const quietPref = allPrefs.find(p => p.key === 'quiet_hours');
        if (quietPref?.quietStart && quietPref?.quietEnd) {
          const now = new Date();
          const cur = now.getHours() * 60 + now.getMinutes();
          const [sh, sm] = quietPref.quietStart.split(':').map(Number);
          const [eh, em] = quietPref.quietEnd.split(':').map(Number);
          const start = sh * 60 + sm;
          const end = eh * 60 + em;
          if (start <= end) {
            if (cur >= start && cur <= end) return;
          } else {
            if (cur >= start || cur <= end) return;
          }
        }

        const lastNotified = await SecureStore.getItemAsync(NOTIFIED_KEY);
        const lastTs = lastNotified ? parseInt(lastNotified, 10) : 0;

        // Throttle to once every 5 minutes to avoid spam
        if (Date.now() - lastTs < 300_000) return;

        const latest = getNotifications({ unresolvedOnly: true, limit: 5 });
        if (latest.length === 0) return;

        // 3. Check sound preference
        const soundPref = allPrefs.find(p => p.key === 'sound');
        const shouldPlaySound = soundPref ? soundPref.enabled : true;

        const highest = latest.reduce((a, b) => {
          const rank: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
          return (rank[a.priority] ?? 3) < (rank[b.priority] ?? 3) ? a : b;
        });

        await Notifications.scheduleNotificationAsync({
          content: {
            title: unresolved > 1 ? `${unresolved} Alerts` : highest.title,
            body: unresolved > 1
              ? `${unresolved} unresolved alert${unresolved > 1 ? 's' : ''}. Tap to view.`
              : highest.message,
            data: { deepLink: '/notifications' },
            sound: shouldPlaySound,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1,
          },
        });

        await SecureStore.setItemAsync(NOTIFIED_KEY, String(Date.now()));
      } catch {
        // ignore
      }
    };

    fireDeviceAlert();
    const interval = setInterval(fireDeviceAlert, CHECK_INTERVAL);

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
      clearInterval(interval);
    };
  }, [router, refresh, markRead]);

  return {
    notification,
    deepLink,
    scheduleLocal,
    cancelAllScheduled,
    dismissNotification,
  };
};