// Card used on the dashboard to surface unresolved business alerts.
// Stays visible until the issue is resolved (mark as resolved, take action, etc).

import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  AlertTriangle,
  Package,
  Handshake,
  Building2,
  Wallet,
  ChevronRight,
  CheckCircle2,
  Calendar,
} from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { AppNotification, NotificationIcon } from '@/database/notifications';
import {
  resolveNotificationTitle,
  resolveNotificationMessage,
} from '@/utils/notification-display';
import { AppText } from '@/components/ui';
interface DashboardAlertCardProps {
  notification: AppNotification;
  onPress?: () => void;
  onResolve?: () => void;
  onDismiss?: () => void;
  index?: number;
}

const iconFor = (name: NotificationIcon, color: string, size = 22) => {
  switch (name) {
    case 'package': return <Package size={size} color={color} />;
    case 'cart': return <ChevronRight size={size} color={color} />;
    case 'wallet': return <Wallet size={size} color={color} />;
    case 'handshake': return <Handshake size={size} color={color} />;
    case 'building': return <Building2 size={size} color={color} />;
    case 'alert-triangle': return <AlertTriangle size={size} color={color} />;
    case 'check-circle': return <CheckCircle2 size={size} color={color} />;
    case 'calendar': return <Calendar size={size} color={color} />;
    default: return <AlertTriangle size={size} color={color} />;
  }
};

export const DashboardAlertCard: React.FC<DashboardAlertCardProps> = React.memo(({
  notification,
  onPress,
  onResolve,
  onDismiss,
  index = 0,
}) => {
  const { colors, t } = useSettings();

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

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(500)}>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: priorityColor + '40',
            borderLeftColor: priorityColor,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={!onPress}
      >
        <View style={[styles.iconBox, { backgroundColor: priorityBg }]}>
          {iconFor(notification.icon, priorityColor)}
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <AppText variant="body" weight="bold" style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {resolveNotificationTitle(notification, t)}
            </AppText>
            {notification.priority === 'critical' && (
              <View style={[styles.criticalTag, { backgroundColor: priorityColor }]}>
                <AppText variant="micro" weight="bold" shrink={false} style={styles.criticalTagText} numberOfLines={1}>!</AppText>
              </View>
            )}
          </View>
          <AppText variant="body-sm" weight="medium" style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
            {resolveNotificationMessage(notification, t)}
          </AppText>

          {(onResolve || onDismiss) && (
            <View style={styles.actionRow}>
              {onResolve && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.text + '10' }]}
                  onPress={onResolve}
                >
                  <CheckCircle2 size={14} color={colors.text} />
                  <AppText variant="caption" weight="bold" style={[styles.actionText, { color: colors.text }]} numberOfLines={1}>{t('notif.resolve')}</AppText>
                </TouchableOpacity>
              )}
              {onDismiss && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: 'transparent' }]}
                  onPress={onDismiss}
                >
                  <AppText variant="caption" weight="bold" style={[styles.actionText, { color: colors.textSecondary }]} numberOfLines={1}>{t('notif.dismiss')}</AppText>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {onPress && (
          <ChevronRight size={18} color={colors.border} style={{ marginTop: 4 }} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

DashboardAlertCard.displayName = 'DashboardAlertCard';

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 12,
    gap: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {

    fontFamily: Fonts.bold,
    flex: 1,
  },
  message: {

    fontFamily: Fonts.medium,
    lineHeight: 18,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  actionText: {

    fontFamily: Fonts.bold,
  },
  criticalTag: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  criticalTagText: {
    color: '#FFF',

    fontFamily: Fonts.bold,
    lineHeight: 12,
  },
});
