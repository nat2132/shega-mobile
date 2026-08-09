// Low-level expo-notifications delivery helpers shared by the reminder screen
// actions (snooze / complete / remove) and push reminder scheduling.
// Kept isolated so DB rows can carry a cancelable OS notification identifier.

let Notifications: any;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = {
    cancelScheduledNotificationAsync: async () => {},
    scheduleNotificationAsync: async () => null,
    SchedulableTriggerInputTypes: {
      TIME_INTERVAL: 'timeInterval',
      DAILY: 'daily',
      WEEKLY: 'weekly',
      MONTHLY: 'monthly',
      YEARLY: 'yearly',
    },
  };
}

export const cancelScheduledNotification = async (notificationId?: string | null): Promise<void> => {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Expo Go on Android silently fails — expected
  }
};

// Schedule a one-shot local push at the given time. Returns the OS identifier,
// or null when scheduling fails (Expo Go on Android).
export const scheduleOneShotPush = async (
  fireAt: Date,
  title: string,
  body: string,
  link: string,
  sound: boolean,
): Promise<string | null> => {
  try {
    const seconds = Math.max(60, Math.round((fireAt.getTime() - Date.now()) / 1000));
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound, data: { link } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
      },
    });
  } catch {
    return null;
  }
};