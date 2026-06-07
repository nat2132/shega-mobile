// Dashboard alerts strip
// Shows the most critical unresolved notifications right on the dashboard
// so the user can act on them quickly.

import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Bell, ChevronRight, X } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useNotificationCenter } from '@/context/NotificationContext';
import { useNavigationIntent } from '@/context/NavigationIntentContext';
import { DashboardAlertCard } from './DashboardAlertCard';
import { AppNotification } from '@/database/notifications';
import { NotificationDetailSheet } from './NotificationDetailSheet';
import { AppText } from '@/components/ui';
export const DashboardAlerts: React.FC = () => {
  const { colors, t } = useSettings();
  const { notifications, dismiss, resolve, refresh } = useNotificationCenter();
  const { publishIntent } = useNavigationIntent();
  const router = useRouter();
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Show only the highest-priority unresolved notifications
  const visible = notifications
    .filter((n: AppNotification) => !n.isResolved && n.requiresAction)
    .sort((a: AppNotification, b: AppNotification) => {
      const pOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
      return pOrder[a.priority] - pOrder[b.priority];
    })
    .slice(0, 4);

  if (visible.length === 0 || collapsed) return null;

  return (
    <Animated.View
      entering={FadeInUp.delay(200).duration(600)}
      exiting={FadeOut.duration(300)}
      style={styles.container}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Bell size={16} color={colors.error || '#FF3B30'} />
          <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {t('dashboard.alerts_title')}
          </AppText>
          <View style={[styles.countPill, { backgroundColor: colors.error || '#FF3B30' }]}>
            <AppText variant="micro" weight="bold" shrink={false} style={[styles.countText, { color: '#FFF' }]} numberOfLines={1}>{visible.length}</AppText>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setCollapsed(true)} hitSlop={10}>
            <X size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/notifications' as any)}
            style={styles.viewAllBtn}
          >
            <AppText variant="body-sm" weight="bold" style={[styles.viewAllText, { color: colors.primary }]} numberOfLines={1}>
              {t('common.view_all')}
            </AppText>
            <ChevronRight size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.list}>
        {visible.map((n: AppNotification, idx: number) => (
          <DashboardAlertCard
            key={n.id}
            notification={n}
            index={idx}
            onPress={() => setSelected(n)}
            onResolve={async () => {
              await resolve(n.id);
            }}
            onDismiss={async () => {
              await dismiss(n.id);
            }}
          />
        ))}
      </View>

      <NotificationDetailSheet
        notification={selected}
        onClose={() => setSelected(null)}
        onView={(n) => {
          if (!n.deepLink) return;
          const intentKind = (n.data as any)?.intent;
          if (intentKind === 'collect_payments') {
            const customerName = (n.data as any)?.customerName;
            publishIntent({ kind: 'collect_payments', customerName, at: Date.now() });
          } else if (intentKind === 'subscription') {
            publishIntent({ kind: 'subscription', at: Date.now() });
          }
          router.replace(n.deepLink as any);
        }}
        onResolve={async (n) => {
          await resolve(n.id);
        }}
        onDismiss={async (n) => {
          await dismiss(n.id);
        }}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {

    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {

    fontFamily: Fonts.bold,
    lineHeight: 14,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {

    fontFamily: Fonts.bold,
  },
  list: {},
});
