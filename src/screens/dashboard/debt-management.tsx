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
import { AppText } from '@/components/AppText';
import { AppListItem } from '@/components/AppListItem';
import { SafeFlatList } from '@/components/SafeFlatList';
import { SkeletonList } from '@/components/Skeleton';

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
  const router = useRouter();

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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.headerWrap}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'))}
          style={[styles.backBtn, { backgroundColor: colors.text + '10' }]}
          hitSlop={10}
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText
            variant="micro" weight="bold" transform="uppercase"
            style={[styles.eyebrow, { color: colors.textSecondary }]} numberOfLines={1}
          >
            {t('debt.eyebrow')}
          </AppText>
          <AppText
            variant="display" weight="extrabold"
            style={[styles.title, { color: colors.text }]} numberOfLines={2}
          >
            {t('debt.title')}
          </AppText>
        </View>
      </View>

      {/* Summary */}
      {loading ? (
        <View style={styles.summaryWrap}>
          <SummarySkeleton colors={colors} />
        </View>
      ) : summary ? (
        <DebtSummaryHeader summary={summary} />
      ) : null}

      {/* Search + sort/filter row */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder={t('debt.search_placeholder')}
            placeholderTextColor={colors.textSecondary + '80'}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
              <Feather name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.sortBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSort((s) =>
              s === 'amount_desc' ? 'amount_asc' : s === 'amount_asc' ? 'oldest' : 'amount_desc',
            );
          }}
          activeOpacity={0.7}
        >
          <Feather name="sliders" size={16} color={colors.text} />
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
                { backgroundColor: active ? colors.text : colors.card, borderColor: active ? colors.text : colors.border },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(f);
              }}
              activeOpacity={0.7}
            >
              <AppText
                variant="caption" weight="bold" shrink={false}
                style={{ color: active ? colors.background : colors.text }} numberOfLines={1}
              >
                {t(`debt.filter.${f}`)} ({count})
              </AppText>
            </TouchableOpacity>
          );
        })}
        <View style={{ flex: 1 }} />
        <AppText
          variant="caption" weight="medium" shrink={false}
          style={{ color: colors.textSecondary }} numberOfLines={1}
        >
          {t('debt.sort_label', { mode: t(`debt.sort.${sort}`) })}
        </AppText>
      </View>

      {/* List */}
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
          }
          ListEmptyComponent={
            <Animated.View entering={FadeIn.duration(500)} style={styles.emptyWrap}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.success + '15' }]}>
                <Feather name="check-circle" size={36} color={colors.success} />
              </View>
              <AppText variant="title" weight="bold" align="center" style={{ color: colors.text, marginTop: 16 }} numberOfLines={2}>
                {t('debt.empty_title')}
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: colors.textSecondary, marginTop: 8 }} numberOfLines={3}>
                {t('debt.empty_sub')}
              </AppText>
            </Animated.View>
          }
        />
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Summary header
// ─────────────────────────────────────────────────────────────────────

const DebtSummaryHeader: React.FC<{ summary: DebtSummary }> = ({ summary }) => {
  const { colors, t } = useSettings();
  return (
    <Animated.View
      entering={FadeInDown.duration(500)}
      style={[
        styles.summaryCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.summaryTopRow}>
        <View>
          <AppText
            variant="micro" weight="bold" transform="uppercase"
            style={{ color: colors.textSecondary }} numberOfLines={1}
          >
            {t('debt.summary.total_owed')}
          </AppText>
          <AppText
            variant="display-lg" weight="extrabold" shrink={false}
            style={{ color: colors.text, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
          >
            {summary.totalOwed.toLocaleString()} {t('common.etb')}
          </AppText>
        </View>
        <View style={[styles.summaryIconBox, { backgroundColor: colors.primary + '18' }]}>
          <FontAwesome5 name="hand-holding-usd" size={22} color={colors.primary} />
        </View>
      </View>

      <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

      <View style={styles.summaryBottomRow}>
        <View style={styles.summaryStat}>
          <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }} numberOfLines={1}>
            {t('debt.summary.debtors')}
          </AppText>
          <AppText variant="title-sm" weight="bold" shrink={false} style={{ color: colors.text }} numberOfLines={1}>
            {summary.debtorCount}
          </AppText>
        </View>
        <View style={[styles.summaryStatDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryStat}>
          <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }} numberOfLines={1}>
            {t('debt.summary.overdue_count')}
          </AppText>
          <AppText variant="title-sm" weight="bold" shrink={false} style={{ color: summary.overdueCount > 0 ? '#FF3B30' : colors.text }} numberOfLines={1}>
            {summary.overdueCount}
          </AppText>
        </View>
        <View style={[styles.summaryStatDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryStat}>
          <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }} numberOfLines={1}>
            {t('debt.summary.overdue_amount')}
          </AppText>
          <AppText
            variant="title-sm" weight="bold" shrink={false}
            style={{ color: summary.overdueAmount > 0 ? '#FF3B30' : colors.text }} numberOfLines={1}
            adjustsFontSizeToFit minimumFontScale={0.7}
          >
            {summary.overdueAmount.toLocaleString()}
          </AppText>
        </View>
      </View>
    </Animated.View>
  );
};

const SummarySkeleton: React.FC<{ colors: any }> = ({ colors }) => (
  <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={[styles.summaryTopRow]}>
      <View style={{ flex: 1 }}>
        <View style={{ width: 90, height: 12, borderRadius: 4, backgroundColor: colors.text + '10' }} />
        <View style={{ width: 140, height: 28, borderRadius: 6, backgroundColor: colors.text + '10', marginTop: 8 }} />
      </View>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.text + '10' }} />
    </View>
    <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
    <View style={styles.summaryBottomRow}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flex: 1, gap: 6 }}>
          <View style={{ width: 60, height: 10, borderRadius: 3, backgroundColor: colors.text + '10' }} />
          <View style={{ width: 40, height: 16, borderRadius: 4, backgroundColor: colors.text + '10' }} />
        </View>
      ))}
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────
// Customer row
// ─────────────────────────────────────────────────────────────────────

const DebtCustomerRow: React.FC<{
  item: DebtCustomer;
  index: number;
  onPress: (c: DebtCustomer) => void;
}> = React.memo(({ item, index, onPress }) => {
  const { colors, t, calendarType, language } = useSettings();
  const daysToDue = daysBetween(item.earliestDue);
  const isOverdue = daysToDue !== null && daysToDue < 0;
  const accent = isOverdue ? '#FF3B30' : colors.primary;
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
        rightText={`${item.oweAmount.toLocaleString()} ${t('common.etb')}`}
        rightColor={isOverdue ? '#FF3B30' : colors.text}
        onPress={() => onPress(item)}
        background={colors.card}
        style={{
          borderColor: isOverdue ? '#FF3B3040' : colors.border,
          borderWidth: 1,
          borderLeftWidth: 4,
          borderLeftColor: accent,
          borderRadius: BorderRadius.lg,
          marginBottom: 10,
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backBtn, { backgroundColor: colors.text + '10' }]}
          hitSlop={10}
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText
            variant="micro" weight="bold" transform="uppercase"
            style={{ color: colors.textSecondary }} numberOfLines={1}
          >
            {t('debt.detail.eyebrow')}
          </AppText>
          <AppText
            variant="title" weight="bold"
            style={{ color: colors.text }} numberOfLines={1}
          >
            {customer.customerName}
          </AppText>
        </View>
        {customer.customerPhone ? (
          <TouchableOpacity
            style={[styles.callBtn, { backgroundColor: '#34C75918' }]}
            onPress={handleCall}
            hitSlop={6}
          >
            <Feather name="phone" size={18} color="#34C759" />
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
            tintColor={colors.text}
          />
        }
      >
        {/* Customer summary card */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.detailStatRow}>
            <View style={styles.detailStat}>
              <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }} numberOfLines={1}>
                {t('debt.detail.outstanding')}
              </AppText>
              <AppText
                variant="display" weight="extrabold" shrink={false}
                style={{ color: '#FF3B30', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
              >
                {customer.oweAmount.toLocaleString()} {t('common.etb')}
              </AppText>
            </View>
            <View style={styles.detailStatDivider} />
            <View style={styles.detailStat}>
              <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }} numberOfLines={1}>
                {t('debt.detail.lifetime_paid')}
              </AppText>
              <AppText
                variant="title-sm" weight="bold" shrink={false}
                style={{ color: '#34C759', marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
              >
                {totalPaid.toLocaleString()} {t('common.etb')}
              </AppText>
            </View>
            <View style={styles.detailStatDivider} />
            <View style={styles.detailStat}>
              <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }} numberOfLines={1}>
                {t('debt.detail.sales_count')}
              </AppText>
              <AppText
                variant="title-sm" weight="bold" shrink={false}
                style={{ color: colors.text, marginTop: 4 }} numberOfLines={1}
              >
                {customer.totalDebts}
              </AppText>
            </View>
          </View>

          <View style={styles.detailActionsRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.text }]}
              onPress={handlePayAll}
              activeOpacity={0.85}
            >
              <Feather name="check-circle" size={16} color={colors.background} />
              <AppText
                variant="body-sm" weight="bold" shrink={false}
                style={{ color: colors.background }} numberOfLines={1}
              >
                {t('debt.action.pay_all')}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: selectedSaleIds.length > 0 ? '#FF9500' : colors.text + '10',
                  borderColor: selectedSaleIds.length > 0 ? '#FF9500' : colors.border,
                },
              ]}
              onPress={handlePaySelected}
              disabled={selectedSaleIds.length === 0}
              activeOpacity={0.85}
            >
              <Feather name="check-square" size={16} color={selectedSaleIds.length > 0 ? '#FFF' : colors.text} />
              <AppText
                variant="body-sm" weight="bold" shrink={false}
                style={{ color: selectedSaleIds.length > 0 ? '#FFF' : colors.text }} numberOfLines={1}
              >
                {selectedSaleIds.length > 0
                  ? t('debt.action.pay_selected', { count: String(selectedSaleIds.length) })
                  : t('debt.action.select_to_pay')}
              </AppText>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.lossBtn, { borderColor: '#FF3B3050' }]}
            onPress={handleMarkLoss}
            activeOpacity={0.85}
          >
            <Feather name="x-circle" size={14} color="#FF3B30" />
            <AppText
              variant="caption" weight="bold" shrink={false}
              style={{ color: '#FF3B30' }} numberOfLines={1}
            >
              {t('debt.action.write_off')}
            </AppText>
          </TouchableOpacity>
        </Animated.View>

        {/* Tabs */}
        <View style={[styles.tabsRow, { borderBottomColor: colors.border }]}>
          {(['items', 'history'] as DetailTab[]).map((tabKey) => {
            const active = tab === tabKey;
            return (
              <TouchableOpacity
                key={tabKey}
                style={[
                  styles.tabBtn,
                  active && { borderBottomColor: colors.text, borderBottomWidth: 2 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTab(tabKey);
                }}
                activeOpacity={0.7}
              >
                <AppText
                  variant="body-sm" weight="bold" shrink={false}
                  style={{ color: active ? colors.text : colors.textSecondary }} numberOfLines={1}
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
                          backgroundColor: colors.card,
                          borderColor: isSelected
                            ? '#FF9500'
                            : isItemOverdue
                              ? '#FF3B3050'
                              : colors.border,
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
                                backgroundColor: isSelected ? '#FF9500' : 'transparent',
                                borderColor: isSelected ? '#FF9500' : colors.border,
                              },
                            ]}
                          >
                            {isSelected && <Feather name="check" size={12} color="#FFF" />}
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <AppText
                            variant="body" weight="bold"
                            style={{ color: colors.text }} numberOfLines={2}
                          >
                            {it.itemName || t('debt.detail.unnamed_item')}
                          </AppText>
                          <View style={styles.saleMetaRow}>
                            <AppText
                              variant="caption" weight="medium" shrink={false}
                              style={{ color: colors.textSecondary }} numberOfLines={1}
                            >
                              {it.quantity} {it.unit || ''}
                            </AppText>
                            <AppText
                              variant="caption" weight="medium" shrink={false}
                              style={{ color: colors.textSecondary }} numberOfLines={1}
                            >
                              {t('debt.detail.sale_date', { date: formatDateSafe(it.createdAt, calendarType, language) })}
                            </AppText>
                          </View>
                        </View>
                        <View style={[
                          styles.statusPill,
                          {
                            backgroundColor: isItemPaid
                              ? '#34C75915'
                              : isItemOverdue
                                ? '#FF3B3015'
                                : '#FF950015',
                          },
                        ]}>
                          <AppText
                            variant="micro" weight="bold" shrink={false}
                            style={{
                              color: isItemPaid ? '#34C759' : isItemOverdue ? '#FF3B30' : '#FF9500',
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

                      <View style={[styles.saleDivider, { backgroundColor: colors.border }]} />

                      <View style={styles.saleStatRow}>
                        <View style={styles.saleStat}>
                          <AppText
                            variant="micro" weight="medium"
                            style={{ color: colors.textSecondary }} numberOfLines={1}
                          >
                            {t('debt.detail.total')}
                          </AppText>
                          <AppText
                            variant="body-sm" weight="bold" shrink={false}
                            style={{ color: colors.text }} numberOfLines={1}
                          >
                            {it.totalPrice.toLocaleString()}
                          </AppText>
                        </View>
                        <View style={styles.saleStat}>
                          <AppText
                            variant="micro" weight="medium"
                            style={{ color: colors.textSecondary }} numberOfLines={1}
                          >
                            {t('debt.detail.paid')}
                          </AppText>
                          <AppText
                            variant="body-sm" weight="bold" shrink={false}
                            style={{ color: '#34C759' }} numberOfLines={1}
                          >
                            {paid.toLocaleString()}
                          </AppText>
                        </View>
                        <View style={styles.saleStat}>
                          <AppText
                            variant="micro" weight="medium"
                            style={{ color: colors.textSecondary }} numberOfLines={1}
                          >
                            {t('debt.detail.left')}
                          </AppText>
                          <AppText
                            variant="body-sm" weight="bold" shrink={false}
                            style={{ color: isItemPaid ? colors.textSecondary : '#FF9500' }} numberOfLines={1}
                          >
                            {remaining.toLocaleString()}
                          </AppText>
                        </View>
                        <View style={styles.saleStat}>
                          <AppText
                            variant="micro" weight="medium"
                            style={{ color: colors.textSecondary }} numberOfLines={1}
                          >
                            {t('debt.detail.due')}
                          </AppText>
                          <AppText
                            variant="body-sm" weight="medium" shrink={false}
                            style={{ color: isItemOverdue ? '#FF3B30' : colors.text }} numberOfLines={1}
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
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.historyIconBox}>
                      {isLoss ? (
                        <Feather name="x-circle" size={18} color="#FF3B30" />
                      ) : isFull ? (
                        <Feather name="check-circle" size={18} color="#34C759" />
                      ) : (
                        <Feather name="check-square" size={18} color="#FF9500" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText
                        variant="body-sm" weight="bold"
                        style={{ color: colors.text }} numberOfLines={2}
                      >
                        {isLoss
                          ? t('debt.history.write_off')
                          : isFull
                            ? t('debt.history.full_payment')
                            : t('debt.history.partial_payment')}
                      </AppText>
                      <AppText
                        variant="caption" weight="medium"
                        style={{ color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}
                      >
                        {formatDateSafe(evt.createdAt, calendarType, language)}
                      </AppText>
                    </View>
                    <AppText
                      variant="body" weight="bold" shrink={false}
                      style={{ color: isLoss ? '#FF3B30' : '#34C759' }} numberOfLines={1}
                    >
                      {isLoss ? '−' : '+'}{evt.amount.toLocaleString()} {t('common.etb')}
                    </AppText>
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
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.emptyWrap}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.text + '08' }]}>
        <Feather name={icon} size={32} color={colors.textSecondary} />
      </View>
      <AppText variant="title-sm" weight="bold" align="center" style={{ color: colors.text, marginTop: 12 }} numberOfLines={2}>
        {title}
      </AppText>
      <AppText variant="body-sm" weight="medium" align="center" style={{ color: colors.textSecondary, marginTop: 6 }} numberOfLines={3}>
        {sub}
      </AppText>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
    backgroundColor: '#FF3B3008',
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
  },
  historyIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
});

export default DebtManagementScreen;
