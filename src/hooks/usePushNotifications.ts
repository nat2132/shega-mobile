// Push notification hook
// - Registers for Expo push token
// - Handles foreground + background notifications
// - Implements deep linking (taps navigate to a target route)
// - Supports notification grouping
// - Provides helpers for scheduling local notifications

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useNotificationCenter } from '@/context/NotificationContext';

export interface PushNotificationState {
  expoPushToken?: any;
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
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    cachedHandlerSet = true;
  } catch (e) {
    // ignore
  }
};

export const usePushNotifications = (): PushNotificationState & {
  scheduleLocal: (input: LocalNotificationInput) => Promise<string | null>;
  cancelAllScheduled: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
} => {
  const [expoPushToken, setExpoPushToken] = useState<any | undefined>();
  const [notification, setNotification] = useState<any | undefined>();
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const router = useRouter();
  const { markRead, refresh } = useNotificationCenter();

  const scheduleLocal = useCallback(async (input: LocalNotificationInput) => {
    try {
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo && Platform.OS === 'android') return null;
      const Notifications = require('expo-notifications');
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
  }, []);

  const cancelAllScheduled = useCallback(async () => {
    try {
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo && Platform.OS === 'android') return;
      const Notifications = require('expo-notifications');
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (e) {
      // ignore
    }
  }, []);

  const dismissNotification = useCallback(async (id: string) => {
    try {
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo && Platform.OS === 'android') return;
      const Notifications = require('expo-notifications');
      await Notifications.dismissNotificationAsync(id);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    setupHandlerOnce();
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo && Platform.OS === 'android') {
      console.log('Skipping push notifications setup: Not supported in Expo Go on Android.');
      return;
    }

    const Notifications = require('expo-notifications');

    registerForPushNotificationsAsync().then((token) => {
      setExpoPushToken(token);
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notif: any) => {
        setNotification(notif);
        // Refresh in-app notification list so it shows the latest
        refresh();
      },
    );

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

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [router, refresh, markRead]);

  return {
    expoPushToken,
    notification,
    deepLink,
    scheduleLocal,
    cancelAllScheduled,
    dismissNotification,
  };
};

async function registerForPushNotificationsAsync() {
  let token;
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo && Platform.OS === 'android') return undefined;
  const Notifications = require('expo-notifications');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
    await Notifications.setNotificationChannelAsync('inventory', {
      name: 'Inventory Alerts',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Payment Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('reports', {
      name: 'Reports',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    try {
      if (isExpoGo) {
        return undefined;
      }
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      token = await Notifications.getExpoPushTokenAsync({ projectId });
      console.log('Expo Push Token:', token);
    } catch (e) {
      console.log('Error getting push token:', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
