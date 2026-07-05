// Reminder history screen
// Lists all scheduled reminders with snooze / complete / delete actions.

import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ChevronLeft,
  Clock,
  Trash2,
  Check,
  RefreshCw,
  Bell,
  BellOff,
} from 'lucide-react-native';
import { playNice } from '@/services/soundService';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useNotificationCenter } from '@/context/NotificationContext';
import { useDialog } from '@/context/DialogContext';
import { ScheduledReminder } from '@/database/notifications';
import { formatTime } from '@/utils/date-utils';
import { AppText} from '@/components/ui';
import { getNotifGlass } from './glass-notifications';

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerSub: {
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
  },
  refreshBtn: {
    marginLeft: 'auto',
    padding: 8,
  },
  list: {
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  cardBody: {
    fontFamily: Fonts.medium,
    lineHeight: 18,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontFamily: Fonts.medium,
  },
  dot: {
    marginHorizontal: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 5,
  },
  actionText: {
    fontFamily: Fonts.bold,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontFamily: Fonts.bold,
  },
  emptySub: {
    fontFamily: Fonts.medium,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});

const ReminderRow = React.memo(({
  reminder,
  index,
  onSnooze,
  onComplete,
  onRemove,
}: {
  reminder: ScheduledReminder;
  index: number;
  onSnooze: (r: ScheduledReminder) => void;
  onComplete: (r: ScheduledReminder) => void;
  onRemove: (r: ScheduledReminder) => void;
}) => {
  const { colors, t, timeSystem, language } = useSettings();
  const G = getNotifGlass(colors);
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const monthDay = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    // Time portion respects the user's selected time system.
    const timePart = formatTime(iso, timeSystem, language);
    return `${monthDay}, ${timePart}`;
  };
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(500)}
      layout={Layout.springify()}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: G.bgCard,
            borderColor: reminder.status === 'snoozed' ? colors.warning : G.border,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: G.bgCard }]}>
            <Bell size={18} color={G.fg} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <AppText variant="body" weight="bold" style={[styles.cardTitle, { color: G.fg }]} numberOfLines={2}>
              {reminder.title}
            </AppText>
            {reminder.body && (
              <AppText variant="body-sm" weight="medium" style={[styles.cardBody, { color: G.fgSecondary }]} numberOfLines={2}>
                {reminder.body}
              </AppText>
            )}
            <View style={styles.metaRow}>
              <Clock size={12} color={G.fgSecondary} />
              <AppText variant="caption" weight="medium" style={[styles.metaText, { color: G.fgSecondary }]} numberOfLines={1}>
                {reminder.status === 'snoozed' && reminder.snoozedUntil
                  ? t('notif.snoozed_to', { date: formatDate(reminder.snoozedUntil) })
                  : t('notif.due_at', { date: formatDate(reminder.triggerAt) })}
              </AppText>
              {reminder.repeatInterval && (
                <>
                  <AppText variant="body" weight="medium" shrink={false} style={[styles.dot, { color: G.fgSecondary }]}>•</AppText>
                  <AppText variant="caption" weight="medium" style={[styles.metaText, { color: G.fgSecondary }]} numberOfLines={1}>
                    {reminder.repeatInterval}
                  </AppText>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: G.fg + '10' }]}
            onPress={() => onSnooze(reminder)}
          >
            <Clock size={14} color={G.fg} />
            <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.actionText, { color: G.fg }]} numberOfLines={1}>{t('notif.snooze')}</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success + '15' }]}
            onPress={() => onComplete(reminder)}
          >
            <Check size={14} color={colors.success} />
            <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.actionText, { color: colors.success }]} numberOfLines={1}>{t('notif.complete')}</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.error + '15' }]}
            onPress={() => onRemove(reminder)}
          >
            <Trash2 size={14} color={colors.error} />
            <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.actionText, { color: colors.error }]} numberOfLines={1}>{t('notif.remove')}</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});
ReminderRow.displayName = 'ReminderRow';

const ReminderHistoryScreen: React.FC = () => {
  const { colors, t } = useSettings();
  const G = getNotifGlass(colors);
  const dialog = useDialog();
  const router = useRouter();
  const {
    reminders,
    refresh,
    snoozeReminderById,
    completeReminder,
    removeReminder,
  } = useNotificationCenter();

  const handleSnooze = async (r: ScheduledReminder) => {
    await dialog.choose({
      title: 'Snooze Reminder',
      message: r.title,
      cancelText: 'Cancel',
      choices: [
        { label: '15 min', onPress: () => snoozeReminderById(r.id, 15) },
        { label: '1 hour', onPress: () => snoozeReminderById(r.id, 60) },
        { label: 'Tomorrow', onPress: () => snoozeReminderById(r.id, 60 * 24) },
        { label: 'Next week', onPress: () => snoozeReminderById(r.id, 60 * 24 * 7) },
      ],
    });
  };

  const handleComplete = async (r: ScheduledReminder) => {
    const ok = await dialog.confirm({
      title: 'Mark as Complete',
      message: r.title,
      confirmText: 'Complete',
      cancelText: 'Cancel',
    });
    if (ok) {
      completeReminder(r.id);
    }
  };

  const handleRemove = async (r: ScheduledReminder) => {
    const ok = await dialog.confirm({
      title: 'Remove Reminder',
      message: `Are you sure you want to remove "${r.title}"?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      playNice();
      removeReminder(r.id);
    }
  };

  const renderItem = useCallback(({ item, index }: { item: ScheduledReminder; index: number }) => (
    <ReminderRow
      reminder={item}
      index={index}
      onSnooze={handleSnooze}
      onComplete={handleComplete}
      onRemove={handleRemove}
    />
  ), [handleSnooze, handleComplete, handleRemove]);

  const keyExtractor = useCallback((item: ScheduledReminder) => String(item.id), []);

  const glowStyles = useMemo(() => ({
    glowTopRight: {
      position: 'absolute' as const,
      top: -100,
      right: -100,
      width: 300,
      height: 300,
      borderRadius: 150,
      backgroundColor: G.mutedLight,
      opacity: 0.4,
      pointerEvents: 'none' as const,
    },
    glowBottomLeft: {
      position: 'absolute' as const,
      bottom: -80,
      left: -120,
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: G.mutedLight,
      opacity: 0.25,
      pointerEvents: 'none' as const,
    },
    glowCenter: {
      position: 'absolute' as const,
      top: 300,
      alignSelf: 'center' as const,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: G.mutedLight,
      opacity: 0.15,
      pointerEvents: 'none' as const,
    },
  }), [G]);

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Ambient glow washes */}
      <View style={glowStyles.glowTopRight} />
      <View style={glowStyles.glowBottomLeft} />
      <View style={glowStyles.glowCenter} />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={G.fg} />
          </TouchableOpacity>
          <View>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: G.fgSecondary }]} numberOfLines={1}>
              {t('notif.reminder_history') || 'Reminder History'}
            </AppText>
            <AppText variant="title" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>
              {t('notif.scheduled') || 'Scheduled Reminders'}
            </AppText>
          </View>
          <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
            <RefreshCw size={20} color={G.fg} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={reminders}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: G.fg + '08' }]}>
              <BellOff size={36} color={G.fgSecondary} />
            </View>
            <AppText variant="title" weight="bold" align="center" style={[styles.emptyTitle, { color: G.fg }]} numberOfLines={2}>
              {t('notif.no_reminders') || 'No Reminders'}
            </AppText>
            <AppText variant="body" weight="medium" align="center" style={[styles.emptySub, { color: G.fgSecondary }]} numberOfLines={3}>
              {t('notif.no_reminders_sub') || 'Reminders you set will appear here.'}
            </AppText>
          </View>
        }
      />
    </View>
  );
};

export default ReminderHistoryScreen;