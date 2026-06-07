// Helpers to render a notification's title/message using the current language.
// Each notification record (created by `notificationService`) stores translation
// keys in `data.titleKey` and `data.messageKey` plus the interpolation parameters
// needed to render the message (item name, amount, etc.). If the keys are missing
// (old records), the function falls back to the persisted `title`/`message` field.

import { AppNotification } from '@/database/notifications';

export type Translator = (key: string, params?: Record<string, string>) => string;

const paramsFrom = (data: any): Record<string, string> => {
  if (!data || typeof data !== 'object') return {};
  const out: Record<string, string> = {};
  Object.keys(data).forEach((k) => {
    if (k === 'titleKey' || k === 'messageKey') return;
    const v = data[k];
    if (v === null || v === undefined) return;
    out[k] = String(v);
  });
  return out;
};

export const resolveNotificationTitle = (
  n: AppNotification,
  t: Translator,
): string => {
  const data = n.data || {};
  const titleKey = data.titleKey as string | undefined;
  if (titleKey) {
    return t(titleKey, paramsFrom(data));
  }
  return n.title;
};

export const resolveNotificationMessage = (
  n: AppNotification,
  t: Translator,
): string => {
  const data = n.data || {};
  const messageKey = data.messageKey as string | undefined;
  if (messageKey) {
    return t(messageKey, paramsFrom(data));
  }
  return n.message;
};
