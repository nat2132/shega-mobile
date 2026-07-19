// Debt Management screen
//
// A consolidated hub for managing customer credit (debts). Replaces the
// previous scattered debt UI (the read-only debt-list.tsx list, the
// hardcoded debt-list-con.tsx mockup, and the inline 'Collect Payments'
// modal in sales.tsx) with one feature-rich screen.
//
// Features:
//   - Sticky summary header (total owed, debtor count, overdue count/amount)
//   - Sortable, filterable, searchable list of customers with debt
//   - Per-customer detail with two tabs:
//       * Items: per-sale breakdown (qty, due, paid, remaining) with checkboxes
//       * History: full payment history (full / partial / write-off)
//   - Full / partial payment flow with confirmation dialogs
//   - Mark-as-loss with confirmation
//   - Quick-call customer (uses Linking.openURL)
//
// i18n: every user-facing string is wrapped in t() with a `debt.*` key
// and the en/am/om/ti dictionaries in SettingsContext.tsx. Hardcoded
// English is forbidden here — see constraint in README.

import { BorderRadius, Fonts } from '@/constants/theme';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import {
  getCustomerPaymentHistory,
  getCustomerTotalPaid,
  getDebtCustomers,
  getDebtSales,
  getDebtSummary,
  markDebtAsLoss,
  processDebtPayment,
} from '@/database/db';
import { formatDate } from '@/utils/date-utils';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { playNice, playBad } from '@/services/soundService';
import { useRouter } from 'expo-router';
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { AppNumber } from '@/components/ui';
import { AppText } from '@/components/AppText';
import { AppListItem } from '@/components/AppListItem';
import { SafeFlatList } from '@/components/SafeFlatList';
import { SkeletonList } from '@/components/Skeleton';
import { getDashGlass } from './glass-dashboard';
import { useTutorial, TutorialTarget, TutorialButton } from '@/tutorials';
import { debtManagementTutorial } from '@/tutorials/definitions';

type FilterMode = 'all' | 'overdue' | 'active';
type SortMode = 'amount_desc' | 'amount_asc' | 'oldest';
type DetailTab = 'items' | 'history';

interface DebtSummary {
  totalOwed: number;
  debtorCount: number;
  overdueCount: number;
  overdueAmount: number;
}

interface DebtCustomer {
  customerName: string;
  customerPhone?: string | null;
  oweAmount: number;
  lastBorrowed?: string;
  earliestDue?: string | null;
  totalDebts: number;
}

interface DebtSale {
  id: number;
  itemId?: number;
  itemName?: string;
  quantity: number;
  unit?: string;
  totalPrice: number;
  paidAmount?: number;
  paymentStatus?: string;
  dueDate?: string | null;
  createdAt?: string;
  baseUnit?: string;
}

interface PaymentEvent {
  id: number;
  saleId?: number | null;
  customerName: string;
  customerPhone?: string | null;
  amount: number;
  type: 'full' | 'partial' | 'loss';
  note?: string | null;
  createdAt: string;
}

// Format an ISO date (or fallback) using the active calendar. Falls back
// to a simple locale string when the date is missing.
const formatDateSafe = (
  iso: string | null | undefined,
  calendarType: 'ethiopian' | 'gregorian',
  language: string,
): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return formatDate(d, calendarType, language);
};

// Days between two dates (positive = future, negative = past). Returns
// null when either input is missing.
const daysBetween = (target: string | null | undefined): number | null => {
  if (!target) return null;
  const t = new Date(target).getTime();
  if (isNaN(t)) return null;
  const now = Date.now();
  return Math.round((t - now) / (24 * 60 * 60 * 1000));
};

// ─────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────

const DebtManagementScreen: React.FC = () => {
  const { colors, t, calendarType, language } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const router = useRouter();
  const tutorial = useTutorial({ tutorial: debtManagementTutorial });

  const [summary, setSummary] = useState<DebtSummary | null>(null);
  const [customers, setCustomers] = useState<DebtCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sort, setSort] = useState<SortMode>('amount_desc');
  const [selected, setSelected] = useState<DebtCustomer | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, list] = await Promise.all([getDebtSummary(), getDebtCustomers()]);
      setSummary(s);
      setCustomers((list as DebtCustomer[]) || []);
    } catch (e) {
      console.error('Debt management load error:', e);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await load();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await load();
    setRefreshing(false);
  }, [load]);

  // Apply search + filter + sort
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = customers;
    if (q) {
      list = list.filter((c) =>
        c.customerName.toLowerCase().includes(q) ||
        (c.customerPhone || '').toLowerCase().includes(q),
      );
    }
    if (filter === 'overdue') {
      list = list.filter((c) => c.earliestDue && new Date(c.earliestDue) < new Date());
    } else if (filter === 'active') {
      list = list.filter((c) => !c.earliestDue || new Date(c.earliestDue) >= new Date());
    }
    const sorted = [...list];
    if (sort === 'amount_desc') {
      sorted.sort((a, b) => (b.oweAmount || 0) - (a.oweAmount || 0));
    } else if (sort === 'amount_asc') {
      sorted.sort((a, b) => (a.oweAmount || 0) - (b.oweAmount || 0));
    } else if (sort === 'oldest') {
      sorted.sort((a, b) => {
        const at = a.lastBorrowed ? new Date(a.lastBorrowed).getTime() : 0;
        const bt = b.lastBorrowed ? new Date(b.lastBorrowed).getTime() : 0;
        return at - bt;
      });
    }
    return sorted;
  }, [customers, search, filter, sort]);

  const debtKeyExtractor = useCallback((item: DebtCustomer) => `${item.customerName}-${item.customerPhone || ''}`, []);
  const debtRenderItem = useCallback(({ item, index }: { item: DebtCustomer; index: number }) => (
    <DebtCustomerRow
      item={item}
      index={index}
      onPress={(c) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelected(c);
      }}
    />
  ), []);

  // ── Render ──

  if (selected) {
    return (
      <DebtDetailScreen
        customer={selected}
        onBack={() => setSelected(null)}
        onChanged={load}
        calendarType={calendarType}
        language={language}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: G.bg }]}>
      <View style={{ position: 'absolute', top: -60, left: -20, width: 180, height: 180, borderRadius: 90, backgroundColor: G.mutedLight, opacity: 0.3 }} />
      <View style={{ position: 'absolute', bottom: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: G.mutedLight, opacity: 0.2 }} />
      {/* Header */}
      <TutorialTarget id="dm-header">
      <View style={styles.headerWrap}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'))}
          style={[styles.backBtn, { backgroundColor: G.fg + '10' }]}
          hitSlop={10}
        >
          <Feather name="chevron-left" size={24} color={G.fg} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText
            variant="micro" weight="bold" transform="uppercase"
            style={[styles.eyebrow, { color: G.fgSecondary }]} numberOfLines={1}
          >
            {t('debt.eyebrow')}
          </AppText>
          <AppText
            variant="display" weight="extrabold"
            style={[styles.title, { color: G.fg }]} numberOfLines={2}
          >
            {t('debt.title')}
          </AppText>
        </View>
        <TutorialButton tutorialId="debt-management" screenName={t('screen.debt_management')} />
      </View>
      </TutorialTarget>

      {/* Summary */}
      <TutorialTarget id="dm-summary">
      {loading ? (
        <View style={styles.summaryWrap}>
          <SummarySkeleton colors={colors} />
        </View>
      ) : summary ? (
        <DebtSummaryHeader summary={summary} />
      ) : null}
      </TutorialTarget>

      {/* Search + sort/filter row */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <Feather name="search" size={16} color={G.fgSecondary} />
          <TextInput
            style={[styles.searchInput, { color: G.fg }]}
            value={search}
            onChangeText={setSearch}
            placeholder={t('debt.search_placeholder')}
            placeholderTextColor={G.fgSecondary + '80'}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
              <Feather name="x" size={16} color={G.fgSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.sortBtn, { backgroundColor: G.bgCard, borderColor: G.border }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSort((s) =>
              s === 'amount_desc' ? 'amount_asc' : s === 'amount_asc' ? 'oldest' : 'amount_desc',
            );
          }}
          activeOpacity={0.7}
        >
          <Feather name="sliders" size={16} color={G.fg} />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={styles.chipsRow}>
        {(['all', 'overdue', 'active'] as FilterMode[]).map((f) => {
          const active = filter === f;
          const count =
            f === 'all' ? customers.length
            : f === 'overdue' ? customers.filter((c) => c.earliestDue && new Date(c.earliestDue) < new Date()).length
            : customers.filter((c) => !c.earliestDue || new Date(c.earliestDue) >= new Date()).length;
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.chip,
                { backgroundColor: active ? G.fg : G.bgCard, borderColor: active ? G.fg : G.border },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(f);
              }}
              activeOpacity={0.7}
            >
              <AppText
                variant="caption" weight="bold" shrink={false}
                style={{ color: active ? G.bg : G.fg }} numberOfLines={1}
              >
                {t(`debt.filter.${f}`)} ({count})
              </AppText>
            </TouchableOpacity>
          );
        })}
        <View style={{ flex: 1 }} />
        <AppText
          variant="caption" weight="medium" shrink={false}
          style={{ color: G.fgSecondary }} numberOfLines={1}
        >
          {t('debt.sort_label', { mode: t(`debt.sort.${sort}`) })}
        </AppText>
      </View>

      {/* List */}
      <TutorialTarget id="dm-actions">
      {loading ? (
        <SkeletonList count={6} showAvatar style={{ marginTop: 8 }} />
      ) : (
        <SafeFlatList
          data={visible}
          keyExtractor={debtKeyExtractor}
          renderItem={debtRenderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={G.fg} />
          }
          ListEmptyComponent={
            <Animated.View entering={FadeIn.duration(500)} style={styles.emptyWrap}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.success + '15' }]}>
                <Feather name="check-circle" size={36} color={colors.success} />
              </View>
              <AppText variant="title" weight="bold" align="center" style={{ color: G.fg, marginTop: 16 }} numberOfLines={2}>
                {t('debt.empty_title')}
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.fgSecondary, marginTop: 8 }} numberOfLines={3}>
                {t('debt.empty_sub')}
              </AppText>
            </Animated.View>
          }
        />
      )}
      </TutorialTarget>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Summary header
// ─────────────────────────────────────────────────────────────────────

const DebtSummaryHeader: React.FC<{ summary: DebtSummary }> = ({ summary }) => {
  const { colors, t } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  return (
    <Animated.View
      entering={FadeInDown.duration(500)}
      style={[
        styles.summaryCard,
        { backgroundColor: G.bgCard, borderColor: G.border },
      ]}
    >
      <View style={styles.summaryTopRow}>
        <View>
          <AppText
            variant="micro" weight="bold" transform="uppercase"
            style={{ color: G.fgSecondary }} numberOfLines={1}
          >
            {t('debt.summary.total_owed')}
          </AppText>
          <AppNumber value={summary.totalOwed} size="heading-lg" showCurrency numberOfLines={1} />
        </View>
        <View style={[styles.summaryIconBox, { backgroundColor: colors.primary + '18' }]}>
          <FontAwesome5 name="hand-holding-usd" size={22} color={colors.primary} />
        </View>
      </View>

      <View style={[styles.summaryDivider, { backgroundColor: G.border }]} />

      <View style={styles.summaryBottomRow}>
        <View style={styles.summaryStat}>
          <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>
            {t('debt.summary.debtors')}
          </AppText>
          <AppNumber value={summary.debtorCount} size="title-sm" color={G.fg} numberOfLines={1} />
        </View>
        <View style={[styles.summaryStatDivider, { backgroundColor: G.border }]} />
        <View style={styles.summaryStat}>
          <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>
            {t('debt.summary.overdue_count')}
          </AppText>
          <AppNumber value={summary.overdueCount} size="title-sm" color={summary.overdueCount > 0 ? colors.error : G.fg} numberOfLines={1} />
        </View>
        <View style={[styles.summaryStatDivider, { backgroundColor: G.border }]} />
        <View style={styles.summaryStat}>
          <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>
            {t('debt.summary.overdue_amount')}
          </AppText>
          <AppNumber value={summary.overdueAmount} size="title-sm" color={summary.overdueAmount > 0 ? colors.error : G.fg} numberOfLines={1} />
        </View>
      </View>
    </Animated.View>
  );
};

const SummarySkeleton: React.FC<{ colors: any }> = ({ colors }) => {
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  return (
    <View style={[styles.summaryCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
      <View style={styles.summaryTopRow}>
      <View style={{ flex: 1 }}>
        <View style={{ width: 90, height: 12, borderRadius: 4, backgroundColor: G.fg + '10' }} />
        <View style={{ width: 140, height: 28, borderRadius: 6, backgroundColor: G.fg + '10', marginTop: 8 }} />
      </View>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: G.fg + '10' }} />
    </View>
    <View style={[styles.summaryDivider, { backgroundColor: G.border }]} />
    <View style={styles.summaryBottomRow}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flex: 1, gap: 6 }}>
          <View style={{ width: 60, height: 10, borderRadius: 3, backgroundColor: G.fg + '10' }} />
          <View style={{ width: 40, height: 16, borderRadius: 4, backgroundColor: G.fg + '10' }} />
        </View>
      ))}
    </View>
  </View>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Customer row
// ─────────────────────────────────────────────────────────────────────

const DebtCustomerRow: React.FC<{
  item: DebtCustomer;
  index: number;
  onPress: (c: DebtCustomer) => void;
}> = React.memo(({ item, index, onPress }) => {
  const { colors, t, calendarType, language } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const daysToDue = daysBetween(item.earliestDue);
  const isOverdue = daysToDue !== null && daysToDue < 0;
  const accent = isOverdue ? colors.error : colors.primary;
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(400)}
      layout={Layout.springify()}
    >
      <AppListItem
        left={
          <View style={[styles.avatar, { backgroundColor: accent + '15' }]}>
            <Feather name="user" size={20} color={accent} />
          </View>
        }
        title={item.customerName}
        subtitle={
          isOverdue
            ? t('debt.days_overdue', { days: String(Math.abs(daysToDue || 0)) })
            : item.earliestDue
              ? t('debt.due_on', { date: formatDateSafe(item.earliestDue, calendarType, language) })
              : t('debt.open_balance')
        }
        titleMaxLines={2}
        subtitleMaxLines={1}
        right={
          <AppNumber value={item.oweAmount} size="body" showCurrency color={isOverdue ? colors.error : G.fg} numberOfLines={1} />
        }
        onPress={() => onPress(item)}
        background={G.bgCard}
        style={{
          borderColor: isOverdue ? colors.error + '40' : G.border,
          borderWidth: 1,
          borderLeftWidth: 4,
          borderLeftColor: accent,
          borderRadius: BorderRadius.lg,
          marginBottom: 10,
          overflow: 'hidden',
        }}
      />
    </Animated.View>
  );
});
DebtCustomerRow.displayName = 'DebtCustomerRow';

// ─────────────────────────────────────────────────────────────────────
// Detail screen (with Items / History tabs)
// ─────────────────────────────────────────────────────────────────────

const DebtDetailScreen: React.FC<{
  customer: DebtCustomer;
  onBack: () => void;
  onChanged: () => Promise<void> | void;
  calendarType: 'ethiopian' | 'gregorian';
  language: string;
}> = ({ customer, onBack, onChanged, calendarType, language }) => {
  const { colors, t } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const [tab, setTab] = useState<DetailTab>('items');
  const [items, setItems] = useState<DebtSale[]>([]);
  const [history, setHistory] = useState<PaymentEvent[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedSaleIds, setSelectedSaleIds] = useState<number[]>([]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    const [sales, hist, paid] = await Promise.all([
      getDebtSales(customer.customerName),
      Promise.resolve(getCustomerPaymentHistory(customer.customerName)),
      Promise.resolve(getCustomerTotalPaid(customer.customerName)),
    ]);
    setItems((sales as DebtSale[]) || []);
    setHistory((hist as PaymentEvent[]) || []);
    setTotalPaid(paid);
    setLoading(false);
  }, [customer.customerName]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // After a payment, refresh
  const refreshAfterChange = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadDetail();
    await onChanged();
    setSelectedSaleIds([]);
  }, [loadDetail, onChanged]);

  // Total currently selected for partial payment
  const selectedTotal = useMemo(() => {
    return items
      .filter((it) => selectedSaleIds.includes(it.id))
      .reduce((sum, it) => sum + Math.max(0, (it.totalPrice || 0) - (it.paidAmount || 0)), 0);
  }, [items, selectedSaleIds]);

  // Pay-all flow
  const handlePayAll = () => {
    Alert.alert(
      t('debt.pay_all_title'),
      t('debt.pay_all_msg', {
        name: customer.customerName,
        amount: customer.oweAmount.toLocaleString(),
        currency: t('common.etb'),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('debt.action.pay'),
          onPress: async () => {
            const ok = processDebtPayment(customer.customerName, customer.oweAmount, 'full', {
              customerPhone: customer.customerPhone ?? undefined,
            });
            if (ok) {
              playNice();
              await refreshAfterChange();
            }
          },
        },
      ],
    );
  };

  // Pay-selected flow
  const handlePaySelected = () => {
    if (selectedSaleIds.length === 0) {
      Alert.alert(t('debt.select_items_title'), t('debt.select_items_msg'));
      return;
    }
    if (selectedTotal <= 0) return;
    Alert.alert(
      t('debt.pay_selected_title'),
      t('debt.pay_selected_msg', {
        count: String(selectedSaleIds.length),
        amount: selectedTotal.toLocaleString(),
        currency: t('common.etb'),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('debt.action.pay'),
          onPress: async () => {
            // For each selected sale, mark its remaining balance as paid
            for (const id of selectedSaleIds) {
              const sale = items.find((s) => s.id === id);
              if (!sale) continue;
              const remaining = Math.max(0, (sale.totalPrice || 0) - (sale.paidAmount || 0));
              if (remaining > 0) {
                processDebtPayment(customer.customerName, remaining, 'partial', {
                  customerPhone: customer.customerPhone ?? undefined,
                  saleId: sale.id,
                });
              }
            }
            playNice();
            await refreshAfterChange();
          },
        },
      ],
    );
  };

  // Mark-as-loss flow
  const handleMarkLoss = () => {
    Alert.alert(
      t('debt.mark_loss_title'),
      t('debt.mark_loss_msg', {
        name: customer.customerName,
        amount: customer.oweAmount.toLocaleString(),
        currency: t('common.etb'),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('debt.action.write_off'),
          style: 'destructive',
          onPress: async () => {
            const ok = markDebtAsLoss(customer.customerName, {
              customerPhone: customer.customerPhone ?? undefined,
            });
            if (ok) {
              playBad();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await refreshAfterChange();
            }
          },
        },
      ],
    );
  };

  const toggleSale = (id: number) => {
    setSelectedSaleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCall = () => {
    if (!customer.customerPhone) {
      Alert.alert(t('debt.no_phone_title'), t('debt.no_phone_msg'));
      return;
    }
    const cleaned = String(customer.customerPhone).replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleaned}`).catch(() => {
      Alert.alert(t('common.error'), t('debt.call_failed'));
    });
  };

  // Render
  return (
    <View style={[styles.root, { backgroundColor: G.bg }]}>
      <View style={{ position: 'absolute', top: -80, left: -30, width: 200, height: 200, borderRadius: 100, backgroundColor: G.mutedLight, opacity: 0.25 }} />
      <View style={{ position: 'absolute', bottom: -60, right: -20, width: 180, height: 180, borderRadius: 90, backgroundColor: G.mutedLight, opacity: 0.15 }} />
      {/* Top header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backBtn, { backgroundColor: G.fg + '10' }]}
          hitSlop={10}
        >
          <Feather name="chevron-left" size={24} color={G.fg} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText
            variant="micro" weight="bold" transform="uppercase"
            style={{ color: G.fgSecondary }} numberOfLines={1}
          >
            {t('debt.detail.eyebrow')}
          </AppText>
          <AppText
            variant="title" weight="bold"
            style={{ color: G.fg }} numberOfLines={1}
          >
            {customer.customerName}
          </AppText>
        </View>
        {customer.customerPhone ? (
          <TouchableOpacity
            style={[styles.callBtn, { backgroundColor: colors.success + '18' }]}
            onPress={handleCall}
            hitSlop={6}
          >
            <Feather name="phone" size={18} color={colors.success} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.detailScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadDetail}
            tintColor={G.fg}
          />
        }
      >
        {/* Customer summary card */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          style={[styles.detailCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
        >
          <View style={styles.detailStatRow}>
            <View style={styles.detailStat}>
              <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>
                {t('debt.detail.outstanding')}
              </AppText>
              <AppNumber value={customer.oweAmount} size="heading-lg" showCurrency color={colors.error} numberOfLines={1} />
            </View>
            <View style={styles.detailStatDivider} />
            <View style={styles.detailStat}>
              <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>
                {t('debt.detail.lifetime_paid')}
              </AppText>
              <AppNumber value={totalPaid} size="title-sm" showCurrency color={colors.success} numberOfLines={1} />
            </View>
            <View style={styles.detailStatDivider} />
            <View style={styles.detailStat}>
              <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>
                {t('debt.detail.sales_count')}
              </AppText>
              <AppNumber value={customer.totalDebts} size="title-sm" color={G.fg} numberOfLines={1} />
            </View>
          </View>

          <View style={styles.detailActionsRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: G.fg }]}
              onPress={handlePayAll}
              activeOpacity={0.85}
            >
              <Feather name="check-circle" size={16} color={G.bg} />
              <AppText
                variant="body-sm" weight="bold" shrink={false}
                style={{ color: G.bg }} numberOfLines={1}
              >
                {t('debt.action.pay_all')}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: selectedSaleIds.length > 0 ? colors.warning : G.fg + '10',
                  borderColor: selectedSaleIds.length > 0 ? colors.warning : G.border,
                },
              ]}
              onPress={handlePaySelected}
              disabled={selectedSaleIds.length === 0}
              activeOpacity={0.85}
            >
              <Feather name="check-square" size={16} color={selectedSaleIds.length > 0 ? G.fg : G.fg} />
              <AppText
                variant="body-sm" weight="bold" shrink={false}
                style={{ color: selectedSaleIds.length > 0 ? G.fg : G.fg }} numberOfLines={1}
              >
                {selectedSaleIds.length > 0
                  ? t('debt.action.pay_selected', { count: String(selectedSaleIds.length) })
                  : t('debt.action.select_to_pay')}
              </AppText>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.lossBtn, { backgroundColor: colors.error + '08', borderColor: colors.error + '50' }]}
            onPress={handleMarkLoss}
            activeOpacity={0.85}
          >
            <Feather name="x-circle" size={14} color={colors.error} />
            <AppText
              variant="caption" weight="bold" shrink={false}
              style={{ color: colors.error }} numberOfLines={1}
            >
              {t('debt.action.write_off')}
            </AppText>
          </TouchableOpacity>
        </Animated.View>

        {/* Tabs */}
        <View style={[styles.tabsRow, { borderBottomColor: G.border }]}>
          {(['items', 'history'] as DetailTab[]).map((tabKey) => {
            const active = tab === tabKey;
            return (
              <TouchableOpacity
                key={tabKey}
                style={[
                  styles.tabBtn,
                  active && { borderBottomColor: G.fg, borderBottomWidth: 2 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTab(tabKey);
                }}
                activeOpacity={0.7}
              >
                <AppText
                  variant="body-sm" weight="bold" shrink={false}
                  style={{ color: active ? G.fg : G.fgSecondary }} numberOfLines={1}
                >
                  {tabKey === 'items'
                    ? t('debt.tabs.items', { count: String(items.length) })
                    : t('debt.tabs.history', { count: String(history.length) })}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab body */}
        {tab === 'items' ? (
          loading ? (
            <View style={{ marginTop: 12 }}>
              <SkeletonList count={3} showAvatar={false} />
            </View>
          ) : items.length === 0 ? (
            <EmptyDetail
              icon="package"
              title={t('debt.detail.no_items_title')}
              sub={t('debt.detail.no_items_sub')}
            />
          ) : (
            <View style={{ marginTop: 4 }}>
              {items.map((it, idx) => {
                const paid = it.paidAmount || 0;
                const remaining = Math.max(0, (it.totalPrice || 0) - paid);
                const isSelected = selectedSaleIds.includes(it.id);
                const isItemOverdue = it.dueDate && new Date(it.dueDate) < new Date();
                const isItemPaid = it.paymentStatus === 'Paid' || remaining <= 0;
                return (
                  <Animated.View
                    key={it.id}
                    entering={FadeInDown.delay(Math.min(idx, 6) * 40).duration(400)}
                  >
                    <TouchableOpacity
                      activeOpacity={isItemPaid ? 1 : 0.85}
                      onPress={() => !isItemPaid && toggleSale(it.id)}
                      style={[
                        styles.saleCard,
                        {
                          backgroundColor: G.bgCard,
                        borderColor: isSelected
                          ? colors.warning
                          : isItemOverdue
                            ? colors.error + '50'
                            : G.border,
                          borderWidth: isSelected ? 2 : 1,
                          opacity: isItemPaid ? 0.6 : 1,
                        },
                      ]}
                    >
                      <View style={styles.saleTopRow}>
                        {!isItemPaid && (
                          <View
                            style={[
                              styles.checkbox,
                              {
                                backgroundColor: isSelected ? colors.warning : 'transparent',
                                borderColor: isSelected ? colors.warning : G.border,
                              },
                            ]}
                          >
                            {isSelected && <Feather name="check" size={12} color={G.fg} />}
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <AppText
                            variant="body" weight="bold"
                            style={{ color: G.fg }} numberOfLines={2}
                          >
                            {it.itemName || t('debt.detail.unnamed_item')}
                          </AppText>
                          <View style={styles.saleMetaRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                              <AppNumber value={it.quantity} size="caption" color={G.fgSecondary} numberOfLines={1} />
                              <AppText
                                variant="caption" weight="medium" shrink={false}
                                style={{ color: G.fgSecondary }} numberOfLines={1}
                              >
                                {it.unit || ''}
                              </AppText>
                            </View>
                            <AppText
                              variant="caption" weight="medium" shrink={false}
                              style={{ color: G.fgSecondary }} numberOfLines={1}
                            >
                              {t('debt.detail.sale_date', { date: formatDateSafe(it.createdAt, calendarType, language) })}
                            </AppText>
                          </View>
                        </View>
                        <View style={[
                          styles.statusPill,
                          {
                            backgroundColor: isItemPaid
                              ? colors.success + '15'
                              : isItemOverdue
                                ? colors.error + '15'
                                : colors.warning + '15',
                          },
                        ]}>
                          <AppText
                            variant="micro" weight="bold" shrink={false}
                            style={{
                              color: isItemPaid ? colors.success : isItemOverdue ? colors.error : colors.warning,
                            }} numberOfLines={1}
                          >
                            {isItemPaid
                              ? t('debt.status.paid')
                              : isItemOverdue
                                ? t('debt.status.overdue')
                                : t('debt.status.unpaid')}
                          </AppText>
                        </View>
                      </View>

                      <View style={[styles.saleDivider, { backgroundColor: G.border }]} />

                      <View style={styles.saleStatRow}>
                        <View style={styles.saleStat}>
                          <AppText
                            variant="micro" weight="medium"
                            style={{ color: G.fgSecondary }} numberOfLines={1}
                          >
                            {t('debt.detail.total')}
                          </AppText>
                          <AppNumber value={it.totalPrice} size="body-sm" showCurrency numberOfLines={1} />
                        </View>
                        <View style={styles.saleStat}>
                          <AppText
                            variant="micro" weight="medium"
                            style={{ color: G.fgSecondary }} numberOfLines={1}
                          >
                            {t('debt.detail.paid')}
                          </AppText>
                          <AppNumber value={paid} size="body-sm" showCurrency color={colors.success} numberOfLines={1} />
                        </View>
                        <View style={styles.saleStat}>
                          <AppText
                            variant="micro" weight="medium"
                            style={{ color: G.fgSecondary }} numberOfLines={1}
                          >
                            {t('debt.detail.left')}
                          </AppText>
                          <AppNumber value={remaining} size="body-sm" showCurrency color={isItemPaid ? G.fgSecondary : colors.warning} numberOfLines={1} />
                        </View>
                        <View style={styles.saleStat}>
                          <AppText
                            variant="micro" weight="medium"
                            style={{ color: G.fgSecondary }} numberOfLines={1}
                          >
                            {t('debt.detail.due')}
                          </AppText>
                          <AppText
                            variant="body-sm" weight="medium" shrink={false}
                            style={{ color: isItemOverdue ? colors.error : G.fg }} numberOfLines={1}
                          >
                            {it.dueDate
                              ? formatDateSafe(it.dueDate, calendarType, language)
                              : t('debt.detail.no_due_date')}
                          </AppText>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          )
        ) : loading ? (
          <View style={{ marginTop: 12 }}>
            <SkeletonList count={3} showAvatar={false} />
          </View>
        ) : history.length === 0 ? (
          <EmptyDetail
            icon="clock"
            title={t('debt.history.empty_title')}
            sub={t('debt.history.empty_sub')}
          />
        ) : (
          <View style={{ marginTop: 4 }}>
            {history.map((evt, idx) => {
              const isLoss = evt.type === 'loss';
              const isFull = evt.type === 'full';
              return (
                <Animated.View
                  key={evt.id}
                  entering={FadeInDown.delay(Math.min(idx, 6) * 35).duration(400)}
                >
                  <View
                    style={[
                      styles.historyCard,
                      { backgroundColor: G.bgCard, borderColor: G.border },
                    ]}
                  >
                    <View style={styles.historyIconBox}>
                      {isLoss ? (
                        <Feather name="x-circle" size={18} color={colors.error} />
                      ) : isFull ? (
                        <Feather name="check-circle" size={18} color={colors.success} />
                      ) : (
                        <Feather name="check-square" size={18} color={colors.warning} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText
                        variant="body-sm" weight="bold"
                        style={{ color: G.fg }} numberOfLines={2}
                      >
                        {isLoss
                          ? t('debt.history.write_off')
                          : isFull
                            ? t('debt.history.full_payment')
                            : t('debt.history.partial_payment')}
                      </AppText>
                      <AppText
                        variant="caption" weight="medium"
                        style={{ color: G.fgSecondary, marginTop: 2 }} numberOfLines={1}
                      >
                        {formatDateSafe(evt.createdAt, calendarType, language)}
                      </AppText>
                    </View>
                    <AppNumber value={isLoss ? -evt.amount : evt.amount} size="body" suffix={" " + t('common.etb')} showSign numberOfLines={1} />
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Empty placeholder
// ─────────────────────────────────────────────────────────────────────

const EmptyDetail: React.FC<{ icon: 'package' | 'clock'; title: string; sub: string }> = ({
  icon, title, sub,
}) => {
  const { colors } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.emptyWrap}>
      <View style={[styles.emptyIconCircle, { backgroundColor: G.fg + '08' }]}>
        <Feather name={icon} size={32} color={G.fgSecondary} />
      </View>
      <AppText variant="title-sm" weight="bold" align="center" style={{ color: G.fg, marginTop: 12 }} numberOfLines={2}>
        {title}
      </AppText>
      <AppText variant="body-sm" weight="medium" align="center" style={{ color: G.fgSecondary, marginTop: 6 }} numberOfLines={3}>
        {sub}
      </AppText>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

const createStyles = (G: any) => StyleSheet.create({
  root: { flex: 1 },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 16,
    gap: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyebrow: { letterSpacing: 1.2, marginBottom: 4 },
  title: { letterSpacing: -0.5 },

  // Summary
  summaryWrap: { marginHorizontal: 20, marginBottom: 8 },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryDivider: {
    height: 1,
    marginVertical: 14,
  },
  summaryBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryStat: {
    flex: 1,
    paddingHorizontal: 4,
  },
  summaryStatDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 6,
  },

  // Search + sort row
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  sortBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  // Filter chips
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Detail
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 12,
    gap: 14,
  },
  detailScroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  detailCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
  },
  detailStatRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailStat: {
    flex: 1,
    paddingHorizontal: 2,
  },
  detailStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'transparent',
  },
  detailActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  lossBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },

  // Sale card
  saleCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  saleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  saleDivider: {
    height: 1,
    marginVertical: 10,
  },
  saleStatRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saleStat: {
    flex: 1,
  },

  // History
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
    overflow: 'hidden',
  },
  historyIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: G.bgCard,
  },
});

export default DebtManagementScreen;
