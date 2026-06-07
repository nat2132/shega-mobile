import { CustomDatePicker } from '@/components/CustomDatePicker';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import {
    getDashboardStats,
    getFilteredExpenses,
    getUpcomingExpenses
} from '@/database/db';
import { formatDate } from '@/utils/date-utils';
import { exportToCSV } from '@/utils/export';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
    ArrowUpDown,
    Calendar,
    CalendarDays,
    ChevronLeft,
    Clock,
    Download,
    Filter,
    Search,
    TrendingDown,
    Wallet,
    AlertTriangle
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
    FlatList,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
  FadeIn,
    FadeInDown,
    FadeInUp,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import ExpenseDetailsScreen from './expense-details';
import { useDebounce } from '@/hooks/useDebounce';
import { AppText, AppListItem, AppRow, AppButton, AppCard } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
const getAmountFontSize = (amount: number): number => {
  const digits = Math.abs(amount).toFixed(0).length;
  if (digits <= 4) return 16;
  if (digits <= 6) return 14;
  if (digits <= 8) return 12;
  return 10;
};

const BillsAndTransactions = () => {
  const { colors, calendarType, language, t, theme } = useSettings();
  const [activeTab, setActiveTab] = useState('Transactions');
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSort, setSelectedSort] = useState('Date (Newest)');
  const [dateFilterPeriod, setDateFilterPeriod] = useState<string>('');
  const [dateFilterLabel, setDateFilterLabel] = useState('All');
  const [isBarExpanded, setIsBarExpanded] = useState(false);
  
  // Modals
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);

  const { width } = Dimensions.get('window');
  const expandedWidth = useSharedValue(56);
  useEffect(() => {
    expandedWidth.value = withSpring(isBarExpanded ? width - 40 : 56, { damping: 15, stiffness: 100 });
  }, [isBarExpanded, width]);

  const expandStyle = useAnimatedStyle(() => ({
    width: expandedWidth.value,
  }));

  const debouncedSearch = useDebounce(searchQuery, 250);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const allTrans = await getFilteredExpenses({
         search: debouncedSearch,
         date: selectedDate,
         sortBy: selectedSort === 'Highest Amount' ? 'Highest Amount' : (selectedSort === 'Lowest Amount' ? 'Lowest Amount' : undefined),
         limit: 100
      });
      const allUpcoming = await getUpcomingExpenses();
      setTransactions(allTrans);
      setUpcoming(allUpcoming);

      const dashboardStats = getDashboardStats();
      if (dashboardStats) setStats(dashboardStats.today);
    } catch (error) {
      console.error('Error loading expense list:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedDate, selectedSort]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDownload = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    exportToCSV(filteredData, 'Capital_Ledger_Export');
  };

  const filteredData = useMemo(() => {
    const list = activeTab === 'Transactions' ? transactions : upcoming;
    if (!debouncedSearch.trim()) return list;
    const q = debouncedSearch.toLowerCase();
    return list.filter((item: any) => item.name.toLowerCase().includes(q));
  }, [activeTab, transactions, upcoming, debouncedSearch]);

  const nearestUpcoming = useMemo(() => {
    if (upcoming.length === 0) return null;
    return upcoming.reduce((nearest, current) => {
      if (!nearest) return current;
      const nearestDate = new Date(nearest.nextBillingDate).getTime();
      const currentDate = new Date(current.nextBillingDate).getTime();
      return currentDate < nearestDate ? current : nearest;
    }, null);
  }, [upcoming]);

  const renderExpenseCard = useCallback(({ item, index }: { item: any; index: number }) => (
    <ExpenseCardRow
      item={item}
      index={index}
      activeTab={activeTab}
      onPress={setSelectedExpense}
    />
  ), [activeTab]);

const ExpenseCardRow = React.memo(({
  item,
  index,
  activeTab,
  onPress,
}: {
  item: any;
  index: number;
  activeTab: string;
  onPress: (i: any) => void;
}) => {
  const { colors, calendarType, language, t } = useSettings();
  const isOverdue = item.isOverdue === 1 || item.isOverdue === true;
  const overdueDays = item.overdueDays || 0;
  const isRecurringPending = item.isRecurring === 1 && item.paymentStatus === 'pending';

  // Icon lives in a fixed-size column; the icon-coloured box is
  // built via the `left` slot of AppListItem. We compose the value
  // column out of an amount (heading-lg) and a status pill.
  const amountPrefix = activeTab === 'Transactions' ? '-' : '';
  const amount = `${amountPrefix} ${typeof item.amount === 'number' ? item.amount.toLocaleString() : 0} ${t('common.etb')}`;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 50).duration(400)}>
      <AppListItem
        left={
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: isOverdue
                ? '#FF3B30'
                : isRecurringPending
                  ? colors.primary
                  : colors.text,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {isOverdue ? (
              <AlertTriangle color="#FFF" size={20} />
            ) : activeTab === 'Transactions' ? (
              <Wallet color={colors.background} size={20} />
            ) : (
              <CalendarDays color={colors.background} size={20} />
            )}
          </View>
        }
        title={item.name || t('common.untitled')}
        subtitle={
          activeTab === 'Transactions'
            ? (item.date ? formatDate(new Date(item.date), calendarType, language) : t('common.n_a'))
            : `${t('expense.due')}: ${item.nextBillingDate ? formatDate(new Date(item.nextBillingDate), calendarType, language) : t('common.n_a')}${isOverdue ? ` (${t('expense.overdue_days', { days: String(overdueDays) })})` : ''}`
        }
        rightText={amount}
        rightColor={isOverdue ? '#FF3B30' : colors.text}
        rightMaxLines={1}
        onPress={() => onPress(item)}
        padding={Spacing.md}
        style={{
          borderRadius: 24,
          borderWidth: 1,
          borderColor: isOverdue ? '#FF3B3040' : colors.border,
          borderLeftWidth: isOverdue ? 3 : 1,
          borderLeftColor: isOverdue ? '#FF3B30' : colors.border,
          marginBottom: Spacing.lg,
        }}
      />
    </Animated.View>
  );
});
ExpenseCardRow.displayName = 'ExpenseCardRow';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Integrated Header */}
      <View style={styles.header}>
        <View style={styles.headerMain}>
           <TouchableOpacity 
             onPress={() => Haptics.selectionAsync()}
             style={[styles.backBtn, { borderColor: colors.border }]}
           >
             <ChevronLeft color={colors.text} size={24} />
           </TouchableOpacity>
           <View style={{ flex: 1, marginLeft: 15 }}>
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>{t('expense.capital_bills')}</AppText>
              <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('expense.capital_ledger')}</AppText>
           </View>
           <TouchableOpacity onPress={handleDownload} style={[styles.downloadBtn, { backgroundColor: colors.text }]}>
             <Download size={20} color={colors.background} />
           </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'Transactions' && [styles.activeTab, { backgroundColor: colors.text }]]} 
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab('Transactions'); }}
          >
            <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'Transactions' && { color: colors.background }]} numberOfLines={1}>{t('expense.executed')}</AppText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'Upcoming' && [styles.activeTab, { backgroundColor: colors.text }]]} 
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab('Upcoming'); }}
          >
            <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'Upcoming' && { color: colors.background }]} numberOfLines={1}>{t('expense.upcoming')}</AppText>
          </TouchableOpacity>
        </View>

        {/* Expense Summary Stats */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.statsRow}>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <TrendingDown size={16} color="#FF3B30" />
             <View style={{ marginLeft: 10 }}>
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('expense.disbursed_today')}</AppText>
                <AppText variant="body-lg" weight="bold" style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>{stats?.expenses?.toLocaleString() || 0} {t('common.etb')}</AppText>
             </View>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <Clock size={16} color={colors.primary} />
             <View style={{ marginLeft: 10 }}>
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('expense.active_bills')}</AppText>
                <AppText variant="body" weight="bold" style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>{t('expense.scheduled', { count: String(upcoming.length) })}</AppText>
             </View>
          </View>
        </Animated.View>
      </View>

      {/* Ledger List */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={renderExpenseCard}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <View>
            {/* Nearest Upcoming Payment Card */}
            {activeTab === 'Upcoming' && nearestUpcoming && (
              <Animated.View entering={FadeInDown.delay(50)} style={[styles.upcomingCard, { backgroundColor: colors.card, borderColor: colors.primary + '40' }]}>
                <View style={styles.upcomingCardRow}>
                  <View style={[styles.upcomingIconBox, { backgroundColor: colors.primary + '20' }]}>
                    <AlertTriangle size={24} color={colors.primary} />
                  </View>
                  <View style={styles.upcomingInfo}>
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.upcomingLabel, { color: colors.textSecondary }]} numberOfLines={1}>Next Payment</AppText>
                    <AppText variant="body" weight="bold" style={[styles.upcomingName, { color: colors.text }]} numberOfLines={1}>{nearestUpcoming.name}</AppText>
                    <AppText variant="caption" weight="semibold" style={[styles.upcomingDue, { color: colors.primary }]} numberOfLines={2}>
                      Due: {nearestUpcoming.nextBillingDate ? formatDate(new Date(nearestUpcoming.nextBillingDate), calendarType, language) : 'N/A'}
                    </AppText>
                  </View>
                  <View style={styles.upcomingAmountBox}>
                    <AppText variant="body-lg" weight="bold" style={[styles.upcomingAmount, { color: colors.text }]} numberOfLines={1}>
                      {typeof nearestUpcoming.amount === 'number' ? nearestUpcoming.amount.toLocaleString() : 0}
                    </AppText>
                    <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.upcomingCurr, { color: colors.textSecondary }]} numberOfLines={1}>{t('common.etb')}</AppText>
                  </View>
                </View>
              </Animated.View>
            )}
            <View style={styles.searchSection}>
              <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Search size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder={t('expense.search_outflows')}
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Wallet size={64} color={colors.border} />
            <AppText variant="body" weight="bold" style={[styles.emptyText, { color: colors.textSecondary }]} numberOfLines={2}>{t('expense.no_outflows')}</AppText>
          </View>
        }
      />

      {/* Expanding Smart Filter FAB */}
      <View style={styles.dockedBarWrapper}>
        <Animated.View style={[expandStyle, { height: 56, borderRadius: 28, overflow: 'hidden' }]}>
          <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint={theme === 'light' ? 'light' : 'dark'} style={[styles.dockedBar, { borderColor: colors.border, paddingHorizontal: isBarExpanded ? 10 : 0 }]}>
            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1, paddingRight: 10 }}>
                <TouchableOpacity
                  style={[styles.filterPill, selectedDate ? { backgroundColor: colors.text } : null]}
                  onPress={() => { setDateModalVisible(true); setIsBarExpanded(false); }}
                >
                  <Calendar size={18} color={selectedDate ? colors.background : colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterPill, selectedSort !== 'Date (Newest)' ? { backgroundColor: colors.text } : null]}
                  onPress={() => { setSortModalVisible(true); setIsBarExpanded(false); }}
                >
                  <ArrowUpDown size={18} color={selectedSort !== 'Date (Newest)' ? colors.background : colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}
            <TouchableOpacity
              style={[styles.dockMainBtn, { backgroundColor: isBarExpanded ? colors.primary : colors.text }]}
              onPress={() => setIsBarExpanded(!isBarExpanded)}
            >
              <Filter size={24} color={colors.background} />
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </View>

      {/* EXPENSE DETAILS MODAL */}
      <Modal visible={!!selectedExpense} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedExpense(null)} />
          <Animated.View entering={FadeInUp} style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
             <View style={styles.modalHandleRow}>
               <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
             </View>
             {selectedExpense && (
               <ExpenseDetailsScreen 
                 expense={selectedExpense} 
                 onClose={() => {
                   setSelectedExpense(null);
                   loadData();
                 }} 
               />
             )}
          </Animated.View>
        </View>
      </Modal>

      <CustomDatePicker
        visible={dateModalVisible}
        onClose={() => setDateModalVisible(false)}
        initialDate={selectedDate}
        onSelectDate={(date) => setSelectedDate(date)}
      />

      <Modal visible={sortModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlayCenter} onPress={() => setSortModalVisible(false)}>
          <View style={[styles.sortMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {['form.date_newest', 'form.amount_highest', 'form.amount_lowest', 'form.name_az'].map((optionKey, idx) => (
              <TouchableOpacity key={idx} style={[styles.sortOption, { borderBottomColor: colors.border }]} onPress={() => { setSelectedSort(t(optionKey)); setSortModalVisible(false); }}>
                <AppText variant="body" weight="bold" style={[styles.sortText, { color: selectedSort === t(optionKey) ? colors.primary : colors.text }]} numberOfLines={1}>{t(optionKey)}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 25, paddingBottom: 20 },
  headerMain: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  backBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerSub: { fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerTitle: { fontSize: 32, fontFamily: Fonts.bold, letterSpacing: -1 },
  downloadBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  tabContainer: { flexDirection: 'row', padding: 4, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  activeTab: { elevation: 2 },
  tabText: { fontSize: 13, fontFamily: Fonts.bold },
  statsRow: { flexDirection: 'row', gap: 12 },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, borderWidth: 1 },
  statLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  statValue: { fontSize: 14, fontFamily: Fonts.bold },
  // Upcoming Payment Card
  upcomingCard: {
    marginHorizontal: 25,
    marginBottom: 15,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  upcomingCardRow: { flexDirection: 'row', alignItems: 'center' },
  upcomingIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  upcomingInfo: { flex: 1, marginRight: 12 },
  upcomingLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  upcomingName: { fontSize: 17, fontFamily: Fonts.bold, marginBottom: 4 },
  upcomingDue: { fontSize: 12, fontFamily: Fonts.semibold },
  upcomingAmountBox: { alignItems: 'flex-end' },
  upcomingAmount: { fontSize: 20, fontFamily: Fonts.bold },
  upcomingCurr: { fontSize: 10, fontFamily: Fonts.bold, marginTop: 2 },
  searchSection: { paddingHorizontal: 25, marginVertical: 15 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 16, borderWidth: 1, paddingHorizontal: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontFamily: Fonts.medium, fontSize: 15 },
  listContent: { paddingBottom: 120 },
  // ExpenseCardRow now uses AppListItem; card/amount/badge styles
  // are expressed via the `style`/`rightColor` props inline.
  emptyState: { alignItems: 'center', marginTop: 100, gap: 15 },
  emptyText: { fontSize: 16, fontFamily: Fonts.bold },
  dockedBarWrapper: { position: 'absolute', bottom: 120, right: 20, alignItems: 'flex-end', zIndex: 100 },
  dockedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 28, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, overflow: 'hidden' },
  filterPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, gap: 8 },
  filterPillText: { fontSize: 13, fontFamily: Fonts.bold },
  dockMainBtn: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBackdrop: { flex: 1, width: '100%' },
  bottomSheetContainer: { width: '100%', height: '85%', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  modalHandleRow: { alignItems: 'center', paddingTop: 15, paddingBottom: 5 },
  modalHandle: { width: 40, height: 4, borderRadius: 2 },
  sortMenu: { width: 220, borderRadius: 20, padding: 8, elevation: 10, borderWidth: 1 },
  sortOption: { padding: 15, borderBottomWidth: 1 },
  sortText: { fontSize: 14, fontFamily: Fonts.bold },
});

export default BillsAndTransactions;