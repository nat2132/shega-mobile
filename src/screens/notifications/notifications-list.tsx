// Notification center
// Persistent list of all in-app notifications with:
// - Read / unread grouping
// - Mark as read (single + bulk)
// - Category filter chips
// - Search
// - Tap to open detail bottom sheet
// - Deep link routing on view

import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Linking,
} from 'react-native';
import {
  Activity,
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  Package,
  Handshake,
  Wallet,
  Building2,
  ShoppingBag,
  Truck,
  Shield,
  Info,
  Trash2,
  X,
  Search,
  Calendar,
  PhoneCall,
  TrendingUp,
  Repeat,
  Clock,
  Megaphone,
  Percent,
  Receipt,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { playNice } from '@/services/soundService';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useNotificationCenter } from '@/context/NotificationContext';
import { useDialog } from '@/context/DialogContext';
import { useNavigationIntent } from '@/context/NavigationIntentContext';
import {
  AppNotification,
  NotificationCategory,
  NotificationIcon,
} from '@/database/notifications';
import { NotificationDetailSheet } from '@/components/NotificationDetailSheet';
import { useDebounce } from '@/hooks/useDebounce';
import { SkeletonList } from '@/components/Skeleton';
import {
  resolveNotificationTitle,
  resolveNotificationMessage,
} from '@/utils/notification-display';
import { AppText, AppNumber} from '@/components/ui';
import { getNotifGlass } from './glass-notifications';
import { useTutorial, TutorialTarget, TutorialButton } from '@/tutorials';
import { notificationsTutorial } from '@/tutorials/definitions';
const iconFor = (name: NotificationIcon, color: string, size = 20) => {
  switch (name) {
    case 'package': return <Package size={size} color={color} />;
    case 'cart': return <ShoppingBag size={size} color={color} />;
    case 'wallet': return <Wallet size={size} color={color} />;
    case 'handshake': return <Handshake size={size} color={color} />;
    case 'building': return <Building2 size={size} color={color} />;
    case 'alert-triangle': return <Bell size={size} color={color} />;
    case 'check-circle': return <Check size={size} color={color} />;
    case 'info': return <Info size={size} color={color} />;
    case 'shield': return <Shield size={size} color={color} />;
    case 'truck': return <Truck size={size} color={color} />;
    case 'calendar': return <Calendar size={size} color={color} />;
    case 'trending-up': return <TrendingUp size={size} color={color} />;
    case 'repeat': return <Repeat size={size} color={color} />;
    case 'clock': return <Clock size={size} color={color} />;
    case 'megaphone': return <Megaphone size={size} color={color} />;
    case 'percent': return <Percent size={size} color={color} />;
    case 'receipt': return <Receipt size={size} color={color} />;
    default: return <Bell size={size} color={color} />;
  }
};

const categoryColor = (cat: NotificationCategory) => {
  switch (cat) {
    case 'inventory': return '#FF9500';
    case 'sales': return '#34C759';
    case 'expense': return '#FF3B30';
    case 'budget': return '#AF52DE';
    case 'recurring': return '#FF9500';
    case 'customer': return '#5856D6';
    case 'supplier': return '#8E8E93';
    case 'system': return '#007AFF';
    case 'reminder': return '#FFCC00';
    case 'report': return '#5AC8FA';
    case 'security': return '#FF2D55';
    default: return '#8E8E93';
  }
};

const formatRelativeTime = (iso: string, t: (key: string, params?: Record<string, string>) => string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t('notif.just_now');
  if (minutes < 60) return t('notif.m_ago', { n: String(minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notif.h_ago', { n: String(hours) });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('notif.d_ago', { n: String(days) });
  return new Date(iso).toLocaleDateString();
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerNode: {
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
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
  headerCount: {
    fontFamily: Fonts.bold,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.medium,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: Fonts.bold,
  },
  bulkRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  bulkText: {
    fontFamily: Fonts.semibold,
  },
  listContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  notificationNode: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  infoArea: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  nodeTitle: {
    flex: 1,
  },
  timeLabel: {
    fontFamily: Fonts.medium,
    marginLeft: 8,
  },
  nodeMessage: {
    fontFamily: Fonts.medium,
    lineHeight: 18,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryPillText: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: Fonts.bold,
    marginTop: 20,
  },
  emptySub: {
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginTop: 8,
  },
});

const CATEGORIES: { key: 'all' | NotificationCategory; labelKey: string }[] = [
  { key: 'all', labelKey: 'common.all' },
  { key: 'budget', labelKey: 'notif.cat.budget' },
  { key: 'expense', labelKey: 'notif.cat.expense' },
  { key: 'recurring', labelKey: 'notif.cat.recurring' },
  { key: 'reminder', labelKey: 'notif.cat.reminder' },
  { key: 'inventory', labelKey: 'notif.cat.inventory' },
  { key: 'sales', labelKey: 'notif.cat.sales' },
  { key: 'customer', labelKey: 'notif.cat.customer' },
  { key: 'supplier', labelKey: 'notif.cat.supplier' },
  { key: 'system', labelKey: 'notif.cat.system' },
];

// Memoized row component for a single notification. The whole
// rendering (icon, title, time, message, category pill, priority dot,
// unread dot, supplier-call button) is encapsulated here so the
// parent FlatList can skip re-rendering rows when other rows change
// state.
const NotificationRow = React.memo(({
  item,
  index,
  onPress,
}: {
  item: AppNotification;
  index: number;
  onPress: (n: AppNotification) => void;
}) => {
  const { colors, t } = useSettings();
  const G = getNotifGlass(colors);
  const dialog = useDialog();
  const { markRead } = useNotificationCenter();
  const iconColor = categoryColor(item.category);

  const handleCallSupplier = useCallback(async (e: any) => {
    e.stopPropagation?.();
    const phone = String((item.data as any).supplierPhone).replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${phone}`).catch(async () => {
      await dialog.alert({ title: t('common.error'), message: t('form.could_not_call'), iconType: 'danger' });
    });
    if (!item.isRead) markRead(item.id);
  }, [item, markRead, t, dialog]);

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(500)}
      layout={Layout.springify()}
    >
      <TouchableOpacity
        style={[
          styles.notificationNode,
          {
            backgroundColor: G.bgCard,
            borderColor: item.isRead ? G.border : iconColor + '40',
            borderLeftColor: item.isRead ? G.border : iconColor,
          },
          !item.isRead && { backgroundColor: iconColor + '08' },
        ]}
        activeOpacity={0.7}
        onPress={() => onPress(item)}
      >
        <View style={[styles.iconBox, { backgroundColor: G.bgCard }]}>
          {iconFor(item.icon, iconColor)}
        </View>
        <View style={styles.infoArea}>
          <View style={styles.topRow}>
            <AppText
              variant="body"
              weight={item.isRead ? 'semibold' : 'bold'}
              style={[
                styles.nodeTitle,
                { color: G.fg },
              ]}
              numberOfLines={1}
            >
              {resolveNotificationTitle(item, t)}
            </AppText>
            <AppText variant="caption" weight="medium" style={[styles.timeLabel, { color: G.fgSecondary }]} numberOfLines={1}>
              {formatRelativeTime(item.createdAt, t)}
            </AppText>
          </View>
          <AppText variant="body-sm" weight="medium" style={[styles.nodeMessage, { color: G.fgSecondary }]} numberOfLines={2}>
            {resolveNotificationMessage(item, t)}
          </AppText>
          <View style={styles.metaRow}>
            <View style={[styles.categoryPill, { backgroundColor: iconColor + '15' }]}>
              <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.categoryPillText, { color: iconColor }]} numberOfLines={1}>
                {t(`notif.cat.${item.category}`)}
              </AppText>
            </View>
            {item.priority === 'critical' || item.priority === 'high' ? (
              <View
                style={[
                  styles.priorityDot,
                  { backgroundColor: item.priority === 'critical' ? '#FF3B30' : '#FF9500' },
                ]}
              />
            ) : null}
            {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: iconColor }]} />}
          </View>
          {(item.type === 'supplier_call_price_change' || item.type === 'supplier_call_review') && (item.data as any)?.supplierPhone ? (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                gap: 6,
                marginTop: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: colors.primary + '18',
              }}
              onPress={handleCallSupplier}
            >
              <PhoneCall size={14} color={colors.primary} />
              <AppText variant="caption" weight="bold" shrink={false} style={{ color: colors.primary }} numberOfLines={1}>
                {t('notif.call_now')}
              </AppText>
            </TouchableOpacity>
          ) : null}
          {(item.type === 'budget_created' || item.type === 'budget_approaching_limit' || item.type === 'budget_limit_reached' || item.type === 'budget_category_exceeded') ? (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                gap: 6,
                marginTop: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: iconColor + '18',
              }}
              onPress={() => onPress(item)}
            >
              <Info size={14} color={iconColor} />
              <AppText variant="caption" weight="bold" shrink={false} style={{ color: iconColor }} numberOfLines={1}>
                {t('notif.view_budget')}
              </AppText>
            </TouchableOpacity>
          ) : null}
          {item.type === 'recurring_due' || item.type === 'recurring_due_tomorrow' ? (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                gap: 6,
                marginTop: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: colors.success + '18',
              }}
              onPress={() => onPress(item)}
            >
              <Check size={14} color={colors.success} />
              <AppText variant="caption" weight="bold" shrink={false} style={{ color: colors.success }} numberOfLines={1}>
                {t('notif.mark_paid')}
              </AppText>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});
NotificationRow.displayName = 'NotificationRow';

export const NotificationsListScreen: React.FC = () => {
  const { colors, t } = useSettings();
  const G = getNotifGlass(colors);
  const dialog = useDialog();
  const router = useRouter();
  const tutorial = useTutorial({ tutorial: notificationsTutorial });
  const {
    notifications,
    unreadCount,
    refresh,
    markRead,
    markAllRead,
    dismiss,
    resolve,
    clearAll,
    loading,
  } = useNotificationCenter();
  const { publishIntent } = useNavigationIntent();
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | NotificationCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 250);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleItemPress = useCallback(async (n: AppNotification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!n.isRead) {
      await markRead(n.id);
    }
    setSelected(n);
  }, [markRead]);

  const handleView = useCallback((n: AppNotification) => {
    if (!n.deepLink) return;
    try {
      const intentKind = (n.data as any)?.intent;
      if (intentKind === 'collect_payments') {
        const customerName = (n.data as any)?.customerName;
        publishIntent({ kind: 'collect_payments', customerName, at: Date.now() });
      } else if (intentKind === 'subscription') {
        publishIntent({ kind: 'subscription', at: Date.now() });
      }
      router.replace(n.deepLink as any);
    } catch {
      router.replace('/(tabs)/dashboard' as any);
    }
  }, [publishIntent, router]);

  const filtered = useMemo(() => {
    let list = notifications;
    if (activeCategory !== 'all') {
      list = list.filter((n) => n.category === activeCategory);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((n) => {
        const title = resolveNotificationTitle(n, t).toLowerCase();
        const message = resolveNotificationMessage(n, t).toLowerCase();
        return (
          title.includes(q) ||
          message.includes(q) ||
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [notifications, activeCategory, debouncedSearch, t]);

  // Render is wrapped in a memoized component below (NotificationRow)
  // so the FlatList can skip re-rendering rows when only the
  // search/category state changes.
  const renderItem = useCallback(({ item, index }: { item: AppNotification; index: number }) => (
    <NotificationRow
      item={item}
      index={index}
      onPress={handleItemPress}
    />
  ), [handleItemPress]);

  const keyExtractor = useCallback((item: AppNotification) => `notif-${item.id}`, []);

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
      top: '40%' as const,
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
      <TutorialTarget id="nt-header">
      <View style={styles.headerNode}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/dashboard' as any);
              }
            }}
            style={{ marginRight: 15, padding: 4 }}
          >
            <ChevronLeft size={28} color={G.fg} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: G.fgSecondary }]} numberOfLines={1}>
              {t('notif.diagnostics')}
            </AppText>
            <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>
              {t('notif.sys_pulse')}
              {unreadCount > 0 && (
                <AppText variant="display" weight="bold" shrink={false} style={[styles.headerCount, { color: colors.primary }]} numberOfLines={1}>
                  {' '}(<AppNumber value={unreadCount} size="display" color={colors.primary} />)
                </AppText>
              )}
            </AppText>
          </View>
          <TutorialButton tutorialId="notifications" screenName={t('screen.notifications')} />
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <Search size={18} color={G.fgSecondary} />
          <TextInput
            style={[styles.searchInput, { color: G.fg }]}
            placeholder={t('notif.search_placeholder')}
            placeholderTextColor={G.fgSecondary + '80'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={G.fgSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            const accent = cat.key === 'all' ? G.fg : categoryColor(cat.key);
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? accent : G.bgCard,
                    borderColor: isActive ? accent : G.border,
                  },
                ]}
                onPress={() => setActiveCategory(cat.key)}
                activeOpacity={0.7}
              >
                <AppText
                  variant="body-sm"
                  weight="bold"
                  shrink={false}
                  style={[
                    styles.chipText,
                    { color: isActive ? G.bg : G.fg },
                  ]}
                  numberOfLines={1}
                >
                  {t(cat.labelKey)}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Bulk action row */}
        <TutorialTarget id="nt-actions">
        {filtered.length > 0 && (
          <View style={styles.bulkRow}>
            <TouchableOpacity
              style={[styles.bulkBtn, { backgroundColor: G.bgCard, borderColor: G.border }]}
              onPress={markAllRead}
            >
              <CheckCheck size={14} color={G.fg} />
              <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.bulkText, { color: G.fg }]} numberOfLines={1}>{t('notif.mark_all_read')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, { backgroundColor: G.bgCard, borderColor: G.border }]}
              onPress={clearAll}
            >
              <Trash2 size={14} color={G.fgSecondary} />
              <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.bulkText, { color: G.fgSecondary }]} numberOfLines={1}>{t('notif.clear_all')}</AppText>
            </TouchableOpacity>
          </View>
        )}
        </TutorialTarget>
      </View>
      </TutorialTarget>

      {/* List */}
      <TutorialTarget id="nt-list">
      {loading ? (
        <SkeletonList
          count={6}
          showAvatar
          style={styles.listContent}
        />
      ) : (
        <Animated.FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          itemLayoutAnimation={Layout.springify()}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={true}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={G.fg} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: G.bgCard }]}>
                <Activity size={48} color={G.success} strokeWidth={1} />
              </View>
              <AppText variant="title" weight="bold" align="center" style={[styles.emptyTitle, { color: G.fg }]} numberOfLines={2}>
                {t('notif.pulse_nominal')}
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={[styles.emptySub, { color: G.fgSecondary }]} numberOfLines={3}>
                {t('notif.empty_sub')}
              </AppText>
            </View>
          }
        />
      )}
      </TutorialTarget>

      {/* Detail bottom sheet */}
      <NotificationDetailSheet
        notification={selected}
        onClose={() => setSelected(null)}
        onView={handleView}
        onResolve={(n) => { resolve(n.id); }}
        onDismiss={(n) => { playNice(); dismiss(n.id); }}
        onCallSupplier={async (n) => {
          const phone = (n.data as any)?.supplierPhone;
          if (phone) {
            const cleaned = String(phone).replace(/[^0-9+]/g, '');
            Linking.openURL(`tel:${cleaned}`).catch(async () => {
              await dialog.alert({ title: t('common.error'), message: t('form.could_not_call'), iconType: 'danger' });
            });
            resolve(n.id);
          }
        }}
      />
    </View>
  );
};

export default NotificationsListScreen;