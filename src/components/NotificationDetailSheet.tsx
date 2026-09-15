// Notification detail bottom sheet.
// Provides quick action buttons (view, resolve, remind later, etc).

import React from 'react';
import { StyleSheet, View} from 'react-native';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  BellOff,
  Building2,
  Calendar,
  CheckCircle,
  Handshake,
  Info,
  Package,
  Shield,
  Truck,
  Wallet,
  X,
  PhoneCall,
  TrendingUp,
  Repeat,
  Percent,
  Receipt,
  Megaphone,
} from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { formatTime, formatDate } from '@/utils/date-utils';
import {
  AppNotification,
  NotificationIcon,
} from '@/database/notifications';

import { AppText } from '@/components/ui';
import {
  resolveNotificationTitle,
  resolveNotificationMessage,
} from '@/utils/notification-display';
interface NotificationDetailSheetProps {
  notification: AppNotification | null;
  onClose: () => void;
  onView?: (n: AppNotification) => void;
  onResolve?: (n: AppNotification) => void;
  onDismiss?: (n: AppNotification) => void;
  onRemindLater?: (n: AppNotification) => void;
  onSnooze?: (n: AppNotification, minutes: number) => void;
  onMarkComplete?: (n: AppNotification) => void;
  onCallSupplier?: (n: AppNotification) => void;
}

const iconFor = (name: NotificationIcon, color: string, size = 36) => {
  switch (name) {
    case 'package': return <Package size={size} color={color} />;
    case 'cart': return <CheckCircle size={size} color={color} />;
    case 'wallet': return <Wallet size={size} color={color} />;
    case 'handshake': return <Handshake size={size} color={color} />;
    case 'building': return <Building2 size={size} color={color} />;
    case 'alert-triangle': return <AlertTriangle size={size} color={color} />;
    case 'check-circle': return <CheckCircle2 size={size} color={color} />;
    case 'info': return <Info size={size} color={color} />;
    case 'bell': return <BellOff size={size} color={color} />;
    case 'shield': return <Shield size={size} color={color} />;
    case 'truck': return <Truck size={size} color={color} />;
    case 'calendar': return <Calendar size={size} color={color} />;
    case 'trending-up': return <TrendingUp size={size} color={color} />;
    case 'repeat': return <Repeat size={size} color={color} />;
    case 'percent': return <Percent size={size} color={color} />;
    case 'receipt': return <Receipt size={size} color={color} />;
    case 'megaphone': return <Megaphone size={size} color={color} />;
    case 'clock': return <Clock size={size} color={color} />;
    default: return <Info size={size} color={color} />;
  }
};

export const NotificationDetailSheet: React.FC<NotificationDetailSheetProps> = ({
  notification,
  onClose,
  onView,
  onResolve,
  onDismiss,
  onRemindLater,
  onSnooze,
  onMarkComplete,
  onCallSupplier,
}) => {
  const { colors, timeSystem, language, calendarType, t } = useSettings();

  if (!notification) return null;

  const priorityColor =
    notification.priority === 'critical' ? '#FF3B30' :
    notification.priority === 'high' ? '#FF9500' :
    notification.priority === 'low' ? '#34C759' :
    '#007AFF';

  const priorityBg =
    notification.priority === 'critical' ? '#FF3B3015' :
    notification.priority === 'high' ? '#FF950015' :
    notification.priority === 'low' ? '#34C75915' :
    '#007AFF15';

  const actions: {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'destructive';
    icon?: React.ReactNode;
  }[] = [];

  if (onView) {
    actions.push({
      label: t('notif.view_details'),
      variant: 'primary',
      icon: <Eye size={16} color={colors.background} />,
      onPress: () => { onView(notification); onClose(); },
    });
  }

  // For supplier-call notifications, expose a primary "Call Supplier" action
  if (onCallSupplier && (notification.type === 'supplier_call_price_change' || notification.type === 'supplier_call_review')) {
    const phone = (notification.data as any)?.supplierPhone;
    if (phone) {
      actions.unshift({
        label: `${t('notif.call_supplier')} ${phone}`,
        variant: 'primary',
        icon: <PhoneCall size={16} color={colors.background} />,
        onPress: () => {
          onCallSupplier(notification);
          onClose();
        },
      });
    }
  }

  if (onResolve) {
    actions.push({
      label: t('notif.resolve'),
      variant: 'secondary',
      icon: <CheckCircle2 size={16} color={colors.text} />,
      onPress: () => { onResolve(notification); onClose(); },
    });
  }

  if (onSnooze) {
    actions.push({
      label: t('notif.snooze_1h'),
      variant: 'secondary',
      icon: <Clock size={16} color={colors.text} />,
      onPress: () => { onSnooze(notification, 60); onClose(); },
    });
    actions.push({
      label: t('notif.snooze_tomorrow'),
      variant: 'secondary',
      icon: <Clock size={16} color={colors.text} />,
      onPress: () => { onSnooze(notification, 60 * 24); onClose(); },
    });
  }

  if (onMarkComplete) {
    actions.push({
      label: t('notif.mark_complete'),
      variant: 'primary',
      icon: <CheckCircle2 size={16} color={colors.background} />,
      onPress: () => { onMarkComplete(notification); onClose(); },
    });
  }

  if (onDismiss) {
    actions.push({
      label: t('notif.dismiss'),
      variant: 'secondary',
      icon: <X size={16} color={colors.text} />,
      onPress: () => { onDismiss(notification); onClose(); },
    });
  }

  return (
    <BottomSheet
      visible={!!notification}
      onClose={onClose}
      title={resolveNotificationTitle(notification, t)}
      subtitle={`${formatDate(new Date(notification.createdAt), calendarType, language)}, ${formatTime(notification.createdAt, timeSystem, language)}`}
      actions={actions}
    >
      <View style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: priorityBg }]}>
          {iconFor(notification.icon, priorityColor)}
        </View>
        <AppText variant="body" weight="medium" numberOfLines={3} style={[styles.message, { color: colors.text }]}>{resolveNotificationMessage(notification, t)}</AppText>

        <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.metaRow}>
            <AppText variant="caption" weight="bold" numberOfLines={1} style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('notif.category')}</AppText>
            <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.metaValue, { color: colors.text }]}>{t(`notif.cat.${notification.category}`)}</AppText>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metaRow}>
            <AppText variant="caption" weight="bold" numberOfLines={1} style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('notif.priority')}</AppText>
            <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.metaValue, { color: priorityColor }]}>
              {t(`notif.priority_${notification.priority}`)}
            </AppText>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metaRow}>
            <AppText variant="caption" weight="bold" numberOfLines={1} style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('notif.status')}</AppText>
            <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.metaValue, { color: colors.text }]}>
              {notification.isResolved ? t('notif.resolved') : notification.isRead ? t('notif.read') : t('notif.unread')}
            </AppText>
          </View>
          {(() => {
            const phone = (notification.data as any)?.supplierPhone;
            if (!phone) return null;
            return (
              <>
                <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
                <View style={styles.metaRow}>
                  <AppText variant="caption" weight="bold" numberOfLines={1} style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('notif.supplier_phone')}</AppText>
                  <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.metaValue, { color: colors.primary }]}>{phone}</AppText>
                </View>
              </>
            );
          })()}
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  message: {

    fontFamily: Fonts.medium,
    lineHeight: 22,
    textAlign: 'center',
  },
  metaCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  metaLabel: {

    fontFamily: Fonts.medium,
  },
  metaValue: {

    fontFamily: Fonts.bold,
  },
  metaDivider: {
    height: 1,
  },
});