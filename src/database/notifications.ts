// Notification data layer
// Provides typed CRUD operations over the `notifications`, `scheduled_reminders`,
// and `notification_preferences` SQLite tables.

import { getDB } from './db';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationCategory =
  | 'inventory'
  | 'sales'
  | 'expense'
  | 'budget'
  | 'recurring'
  | 'customer'
  | 'supplier'
  | 'system'
  | 'reminder'
  | 'report'
  | 'security'
  | 'general';

export type NotificationIcon =
  | 'package'
  | 'cart'
  | 'wallet'
  | 'handshake'
  | 'building'
  | 'alert-triangle'
  | 'check-circle'
  | 'info'
  | 'bell'
  | 'shield'
  | 'truck'
  | 'calendar'
  | 'trending-up'
  | 'repeat'
  | 'clock'
  | 'megaphone'
  | 'percent'
  | 'receipt';

export interface AppNotification {
  id: number;
  type: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  icon: NotificationIcon;
  deepLink?: string | null;
  data?: any;
  isRead: boolean;
  isDismissed: boolean;
  isResolved: boolean;
  requiresAction: boolean;
  groupKey?: string | null;
  createdAt: string;
  readAt?: string | null;
  expiresAt?: string | null;
}

export interface ScheduledReminder {
  id: number;
  type: string;
  refId?: number | null;
  title: string;
  body?: string | null;
  triggerAt: string;
  repeatInterval?: string | null;
  status: 'pending' | 'fired' | 'snoozed' | 'completed' | 'cancelled';
  notificationId?: string | null;
  snoozedUntil?: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  key: string;
  enabled: boolean;
  quietStart?: string | null;
  quietEnd?: string | null;
  sound: string;
  vibration: boolean;
}

const mapRow = (row: any): AppNotification => ({
  id: row.id,
  type: row.type,
  category: (row.category as NotificationCategory) || 'general',
  priority: (row.priority as NotificationPriority) || 'normal',
  title: row.title,
  message: row.message,
  icon: (row.icon as NotificationIcon) || 'bell',
  deepLink: row.deepLink,
  data: row.data ? JSON.parse(row.data) : null,
  isRead: row.isRead === 1,
  isDismissed: row.isDismissed === 1,
  isResolved: row.isResolved === 1,
  requiresAction: row.requiresAction === 1,
  groupKey: row.groupKey,
  createdAt: row.createdAt,
  readAt: row.readAt,
  expiresAt: row.expiresAt,
});

export interface CreateNotificationInput {
  type: string;
  category: NotificationCategory;
  title: string;
  message: string;
  icon?: NotificationIcon;
  deepLink?: string;
  data?: any;
  priority?: NotificationPriority;
  groupKey?: string;
  requiresAction?: boolean;
  expiresAt?: string;
}

export const createNotification = (
  input: CreateNotificationInput,
): AppNotification | null => {
  try {
    const database = getDB();
    if (input.groupKey) {
      const existing = database.getFirstSync<{ id: number }>(
        'SELECT id FROM notifications WHERE groupKey = ? AND isResolved = 0 ORDER BY id DESC LIMIT 1',
        [input.groupKey],
      );
      if (existing) {
        // Same active alert already exists — refresh its content (message,
        // interpolation params, priority, etc.) so stale placeholders/buggy
        // values self-heal without resetting the user's read/resolved state.
        database.prepareSync(
          `UPDATE notifications
             SET type = ?, category = ?, priority = ?, title = ?, message = ?,
                 icon = ?, deepLink = ?, data = ?, requiresAction = ?, expiresAt = ?
           WHERE id = ?`,
        ).executeSync([
          input.type,
          input.category,
          input.priority || 'normal',
          input.title,
          input.message,
          input.icon || 'bell',
          input.deepLink || null,
          input.data ? JSON.stringify(input.data) : null,
          input.requiresAction ? 1 : 0,
          input.expiresAt || null,
          existing.id,
        ]);
        return getNotificationById(existing.id);
      }
    }
    const result = database.prepareSync(
      `INSERT INTO notifications
        (type, category, priority, title, message, icon, deepLink, data, groupKey, requiresAction, expiresAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).executeSync([
      input.type,
      input.category,
      input.priority || 'normal',
      input.title,
      input.message,
      input.icon || 'bell',
      input.deepLink || null,
      input.data ? JSON.stringify(input.data) : null,
      input.groupKey || null,
      input.requiresAction ? 1 : 0,
      input.expiresAt || null,
    ]) as any;

    return getNotificationById(result.lastInsertRowId as number);
  } catch (error) {
    console.error('createNotification error:', error);
    return null;
  }
};

export const hasActiveNotificationByGroupKey = (groupKey: string): boolean => {
  try {
    const database = getDB();
    const row = database.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM notifications WHERE groupKey = ? AND isResolved = 0',
      [groupKey],
    );
    return (row?.count || 0) > 0;
  } catch {
    return false;
  }
};

export const getNotificationById = (id: number): AppNotification | null => {
  try {
    const database = getDB();
    const row = database.getFirstSync('SELECT * FROM notifications WHERE id = ?', [id]) as any;
    return row ? mapRow(row) : null;
  } catch (error) {
    console.error('getNotificationById error:', error);
    return null;
  }
};

export interface NotificationFilter {
  category?: NotificationCategory | 'all';
  unreadOnly?: boolean;
  unresolvedOnly?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export const getNotifications = (filter: NotificationFilter = {}): AppNotification[] => {
  try {
    const database = getDB();
    const conditions: string[] = ['isDismissed = 0'];
    const params: any[] = [];

    if (filter.category && filter.category !== 'all') {
      conditions.push('category = ?');
      params.push(filter.category);
    }
    if (filter.unreadOnly) {
      conditions.push('isRead = 0');
    }
    if (filter.unresolvedOnly) {
      conditions.push('isResolved = 0');
    }
    if (filter.search) {
      conditions.push('(title LIKE ? OR message LIKE ?)');
      params.push(`%${filter.search}%`, `%${filter.search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit || 100;
    const offset = filter.offset || 0;
    const rows = database.getAllSync(
      `SELECT * FROM notifications ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ) as any[];
    return rows.map(mapRow);
  } catch (error) {
    console.error('getNotifications error:', error);
    return [];
  }
};

export const getUnreadCount = (): number => {
  try {
    const database = getDB();
    const row = database.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM notifications WHERE isRead = 0 AND isDismissed = 0',
    );
    return row?.count || 0;
  } catch {
    return 0;
  }
};

export const getUnresolvedCount = (): number => {
  try {
    const database = getDB();
    const row = database.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM notifications WHERE isResolved = 0 AND requiresAction = 1',
    );
    return row?.count || 0;
  } catch {
    return 0;
  }
};

export const markAsRead = (id: number): boolean => {
  try {
    const database = getDB();
    database.runSync(
      `UPDATE notifications SET isRead = 1, readAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [id],
    );
    return true;
  } catch (error) {
    console.error('markAsRead error:', error);
    return false;
  }
};

export const markAllAsRead = (): boolean => {
  try {
    const database = getDB();
    database.runSync(
      `UPDATE notifications SET isRead = 1, readAt = CURRENT_TIMESTAMP WHERE isRead = 0`,
    );
    return true;
  } catch (error) {
    console.error('markAllAsRead error:', error);
    return false;
  }
};

export const markAsDismissed = (id: number): boolean => {
  try {
    const database = getDB();
    database.runSync('UPDATE notifications SET isDismissed = 1 WHERE id = ?', [id]);
    return true;
  } catch {
    return false;
  }
};

export const markAsResolved = (id: number): boolean => {
  try {
    const database = getDB();
    database.runSync(
      `UPDATE notifications SET isResolved = 1, isRead = 1, readAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [id],
    );
    return true;
  } catch {
    return false;
  }
};

export const clearAllNotifications = (): boolean => {
  try {
    const database = getDB();
    database.runSync('UPDATE notifications SET isDismissed = 1');
    return true;
  } catch {
    return false;
  }
};

export const deleteOldNotifications = (olderThanDays: number = 30): number => {
  try {
    const database = getDB();
    const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
    const result = database.runSync(
      'DELETE FROM notifications WHERE createdAt < ? AND isRead = 1',
      [cutoff],
    );
    return (result as any).changes || 0;
  } catch {
    return 0;
  }
};

// â”€â”€ Scheduled Reminders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const createReminder = (input: {
  type: string;
  refId?: number;
  title: string;
  body?: string;
  triggerAt: string;
  repeatInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}): ScheduledReminder | null => {
  try {
    const database = getDB();
    const result = database.prepareSync(
      `INSERT INTO scheduled_reminders (type, refId, title, body, triggerAt, repeatInterval)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).executeSync([
      input.type,
      input.refId || null,
      input.title,
      input.body || null,
      input.triggerAt,
      input.repeatInterval || null,
    ]) as any;
    return getReminderById(result.lastInsertRowId as number);
  } catch (error) {
    console.error('createReminder error:', error);
    return null;
  }
};

export const getReminderById = (id: number): ScheduledReminder | null => {
  try {
    const database = getDB();
    const row = database.getFirstSync('SELECT * FROM scheduled_reminders WHERE id = ?', [id]) as any;
    if (!row) return null;
    return row as ScheduledReminder;
  } catch {
    return null;
  }
};

// Finds the reminder row that mirrors a recurring expense template's push.
export const getReminderByTemplate = (templateId: number): ScheduledReminder | null => {
  try {
    const database = getDB();
    const row = database.getFirstSync(
      `SELECT * FROM scheduled_reminders WHERE type = 'recurring' AND refId = ?`,
      [templateId],
    ) as any;
    if (!row) return null;
    return row as ScheduledReminder;
  } catch {
    return null;
  }
};

export const getRecurringReminders = (): ScheduledReminder[] => {
  try {
    const database = getDB();
    const rows = database.getAllSync(
      `SELECT * FROM scheduled_reminders WHERE type = 'recurring'`,
    ) as any[];
    return rows as ScheduledReminder[];
  } catch {
    return [];
  }
};

export const updateReminderNotificationId = (id: number, notificationId: string | null): boolean => {
  try {
    const database = getDB();
    database.runSync(
      'UPDATE scheduled_reminders SET notificationId = ? WHERE id = ?',
      [notificationId, id],
    );
    return true;
  } catch {
    return false;
  }
};

export const resetReminderToPending = (id: number, notificationId: string | null): boolean => {
  try {
    const database = getDB();
    database.runSync(
      `UPDATE scheduled_reminders SET status = 'pending', snoozedUntil = NULL, notificationId = ?
       WHERE id = ?`,
      [notificationId, id],
    );
    return true;
  } catch {
    return false;
  }
};

export const getDueReminders = (): ScheduledReminder[] => {
  try {
    const database = getDB();
    const now = new Date().toISOString();
    const rows = database.getAllSync(
      `SELECT * FROM scheduled_reminders
       WHERE status = 'pending' AND (snoozedUntil IS NULL OR snoozedUntil <= ?)
         AND triggerAt <= ?`,
      [now, now],
    ) as any[];
    return rows as ScheduledReminder[];
  } catch {
    return [];
  }
};

export const getActiveReminders = (): ScheduledReminder[] => {
  try {
    const database = getDB();
    const rows = database.getAllSync(
      `SELECT * FROM scheduled_reminders WHERE status IN ('pending', 'snoozed') ORDER BY triggerAt ASC`,
    ) as any[];
    return rows as ScheduledReminder[];
  } catch {
    return [];
  }
};

export const updateReminderStatus = (id: number, status: ScheduledReminder['status']): boolean => {
  try {
    const database = getDB();
    database.runSync('UPDATE scheduled_reminders SET status = ? WHERE id = ?', [status, id]);
    return true;
  } catch {
    return false;
  }
};

export const snoozeReminder = (id: number, minutes: number): boolean => {
  try {
    const database = getDB();
    const newTime = new Date(Date.now() + minutes * 60_000).toISOString();
    database.runSync(
      `UPDATE scheduled_reminders SET snoozedUntil = ?, status = 'snoozed' WHERE id = ?`,
      [newTime, id],
    );
    return true;
  } catch {
    return false;
  }
};

export const deleteReminder = (id: number): boolean => {
  try {
    const database = getDB();
    database.runSync('DELETE FROM scheduled_reminders WHERE id = ?', [id]);
    return true;
  } catch {
    return false;
  }
};

// â”€â”€ Preferences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const getPreference = (key: string): NotificationPreferences | null => {
  try {
    const database = getDB();
    const row = database.getFirstSync('SELECT * FROM notification_preferences WHERE key = ?', [key]) as any;
    if (!row) return null;
    return {
      key: row.key,
      enabled: row.enabled === 1,
      quietStart: row.quietStart,
      quietEnd: row.quietEnd,
      sound: row.sound || 'default',
      vibration: row.vibration === 1,
    };
  } catch {
    return null;
  }
};

export const getAllPreferences = (): NotificationPreferences[] => {
  try {
    const database = getDB();
    const rows = database.getAllSync('SELECT * FROM notification_preferences') as any[];
    return rows.map((row) => ({
      key: row.key,
      enabled: row.enabled === 1,
      quietStart: row.quietStart,
      quietEnd: row.quietEnd,
      sound: row.sound || 'default',
      vibration: row.vibration === 1,
    }));
  } catch {
    return [];
  }
};

export const setPreference = (pref: Partial<NotificationPreferences> & { key: string }): boolean => {
  try {
    const database = getDB();
    database.runSync(
      `INSERT OR REPLACE INTO notification_preferences
        (key, enabled, quietStart, quietEnd, sound, vibration)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        pref.key,
        pref.enabled === false ? 0 : 1,
        pref.quietStart || null,
        pref.quietEnd || null,
        pref.sound || 'default',
        pref.vibration === false ? 0 : 1,
      ],
    );
    return true;
  } catch (error) {
    console.error('setPreference error:', error);
    return false;
  }
};

// â”€â”€ Cleanup utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const cleanupExpiredNotifications = (): number => {
  try {
    const database = getDB();
    const now = new Date().toISOString();
    const result = database.runSync(
      'DELETE FROM notifications WHERE expiresAt IS NOT NULL AND expiresAt < ?',
      [now],
    );
    return (result as any).changes || 0;
  } catch {
    return 0;
  }
};