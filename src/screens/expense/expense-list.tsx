import { CustomDatePicker } from '@/components/CustomDatePicker';
import { AppListItem, AppNumber, AppText } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import {
  getFilteredExpenses,
  getUpcomingExpenses,
  markRecurringAsPaid,
} from '@/database/db';
import { useDebounce } from '@/hooks/useDebounce';
import { notifyRecurringMarkedPaid } from '@/services/notificationService';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { playNice} from '@/services/soundService';
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  CalendarDays,
  Filter,
  Search,
  Wallet,
  X
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp
} from 'react-native-reanimated';
import ExpenseDetailsScreen from './expense-details';
import { getExpenseGlass } from './glass-expense';
import { useTutorial, TutorialTarget, TutorialButton } from '@/tutorials';
import { expenseListTutorial } from '@/tutorials/definitions';
import { formatDate } from '@/utils/date-utils';

const BillsAndTransactions = ({ filterCategory }: { filterCategory?: string }) => {
  const { colors, t, calendarType, language } = useSettings();
  const G = getExpenseGlass(colors);
  const [activeTab, setActiveTab] = useState(() => t('expense.tab_transactions'));
  const [, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSort, setSelectedSort] = useState(() => t('expense.sort_newest'));
  const [selectedCategory, setSelectedCategory] = useState(filterCategory || '');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  // Modals
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);

  const debouncedSearch = useDebounce(searchQuery, 250);
  const tutorial = useTutorial({ tutorial: expenseListTutorial });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const allTrans = getFilteredExpenses({
        search: debouncedSearch,
        date: selectedDate,
        category: selectedCategory || undefined,
        sortBy: selectedSort === t('expense.sort_highest') ? 'Highest Amount'
          : selectedSort === t('expense.sort_lowest') ? 'Lowest Amount' : undefined,
        limit: 100,
      }) ?? [];
      const allUpcoming = getUpcomingExpenses() ?? [];
      setTransactions(allTrans);
      setUpcoming(allUpcoming);
    } catch (error) {
      console.error('Error loading expense list:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedDate, selectedSort, selectedCategory]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const filteredData = useMemo(() => {
    return activeTab === t('expense.tab_transactions') ? transactions : upcoming;
  }, [activeTab, transactions, upcoming]);

  const handleMarkPaid = (id: number) => {
    const expense = (upcoming as any[]).find((e: any) => e.id === id);
    markRecurringAsPaid(id);
    if (expense) {
      notifyRecurringMarkedPaid({
        id: expense.id,
        name: expense.name,
        amount: expense.amount,
        nextBillingDate: expense.nextBillingDate,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playNice();
    loadData();
  };

  const CATEGORIES = [
    t('expense.all_categories'), 'Utilities', 'Rent', 'Salaries', 'Inventory', 'Transportation',
    'Marketing', 'Maintenance', 'Taxes', 'Loan Payment', 'Office Supplies',
    'Insurance', 'General',
  ];

  const renderExpenseCard = useCallback(({ item, index }: { item: any; index: number }) => (
    <ExpenseCardRow
      item={item}
      index={index}
      activeTab={activeTab}
      onPress={setSelectedExpense}
      onMarkPaid={handleMarkPaid}
    />
  ), [activeTab]);

  const hasActiveFilters = selectedDate || selectedCategory || selectedSort !== t('expense.sort_newest');

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Ambient glow washes */}
      <View style={{ position: 'absolute', top: -100, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: G.mutedLight, opacity: 0.12 }} />
      <View style={{ position: 'absolute', bottom: -80, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: G.mutedLight, opacity: 0.08 }} />
      {/* Header */}
      <TutorialTarget id="el-header">
      <View style={styles.header}>
        <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.headerSub, { color: G.fgSecondary }]}>
          {t('expense.capital_bills')}
        </AppText>
        <View style={styles.headerRow}>
          <AppText variant="title" weight="bold" style={[styles.headerTitle, { color: G.fg }]}>
            {selectedCategory || t('expense.capital_ledger')}
          </AppText>
          <TutorialButton tutorialId="expense-list" screenName={t('screen.expense_records')} />
        </View>
      </View>
      </TutorialTarget>

      {/* Search */}
      <TutorialTarget id="el-filter">
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: G.bgCard, borderColor: G.border, overflow: 'hidden' }]}>
          <Search size={18} color={G.fgSecondary} />
          <TextInput
            style={[styles.searchInput, { color: G.fg }]}
            placeholder={t('expense.search_outflows')}
            placeholderTextColor={G.fgSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color={G.fgSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: selectedDate ? G.fg : G.bgCard, borderColor: G.border }]}
          onPress={() => setDateModalVisible(true)}
        >
          <Calendar size={14} color={selectedDate ? G.bg : G.fgSecondary} />
          <AppText variant="caption" weight="bold" style={{ color: selectedDate ? G.bg : G.fgSecondary, marginLeft: 4 }}>
            {selectedDate ? formatDate(new Date(selectedDate), calendarType, language) : t('expense.date') || 'Date'}
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: selectedCategory ? G.fg : G.bgCard, borderColor: G.border }]}
          onPress={() => setShowCategoryFilter(!showCategoryFilter)}
        >
          <Filter size={14} color={selectedCategory ? G.bg : G.fgSecondary} />
          <AppText variant="caption" weight="bold" style={{ color: selectedCategory ? G.bg : G.fgSecondary, marginLeft: 4 }}>
            {selectedCategory || 'Category'}
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: selectedSort !== t('expense.sort_newest') ? G.fg : G.bgCard, borderColor: G.border }]}
          onPress={() => setSortModalVisible(true)}
        >
          <ArrowUpDown size={14} color={selectedSort !== t('expense.sort_newest') ? G.bg : G.fgSecondary} />
          <AppText variant="caption" weight="bold" style={{ color: selectedSort !== t('expense.sort_newest') ? G.bg : G.fgSecondary, marginLeft: 4 }}>
            {selectedSort === t('expense.sort_newest') ? t('expense.sort') : selectedSort}
          </AppText>
        </TouchableOpacity>

        {hasActiveFilters && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => { setSelectedDate(''); setSelectedCategory(''); setSelectedSort(t('expense.sort_newest')); }}>
            <AppText variant="caption" weight="bold" style={{ color: colors.error }}>{t('expense.clear')}</AppText>
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter Dropdown */}
      {showCategoryFilter && (
        <View style={[styles.categoryDropdown, { backgroundColor: G.bgCard, borderColor: G.border, overflow: 'hidden' }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity key={cat} style={[styles.catChip, { backgroundColor: selectedCategory === cat ? G.fg : G.bg, borderColor: G.border }]}
                onPress={() => { setSelectedCategory(cat === t('expense.all_categories') ? '' : cat); setShowCategoryFilter(false); }}>
                <AppText variant="caption" weight="bold" style={{ color: selectedCategory === cat ? G.bg : G.fg }}>{cat}</AppText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      </TutorialTarget>

      {/* Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: G.bgCard, borderColor: G.border, marginHorizontal: 24, overflow: 'hidden' }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === t('expense.tab_transactions') && [styles.activeTab, { backgroundColor: G.fg }]]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(t('expense.tab_transactions')); }}
        >
          <AppText variant="body-sm" weight="bold" style={[styles.tabText, { color: G.fgSecondary }, activeTab === t('expense.tab_transactions') && { color: G.bg }]}>
            {t('expense.tab_transactions')}
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === t('expense.tab_upcoming') && [styles.activeTab, { backgroundColor: G.fg }]]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(t('expense.tab_upcoming')); }}
        >
          <AppText variant="body-sm" weight="bold" style={[styles.tabText, { color: G.fgSecondary }, activeTab === t('expense.tab_upcoming') && { color: G.bg }]}>
            {t('expense.tab_upcoming')}
          </AppText>
        </TouchableOpacity>
      </View>

      {/* List */}
      <TutorialTarget id="el-list">
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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Wallet size={48} color={G.border} />
            <AppText variant="body" weight="bold" style={[styles.emptyText, { color: G.fgSecondary }]}>
              {t('expense.no_outflows')}
            </AppText>
          </View>
        }
      />
      </TutorialTarget>

      {/* Expense Details Modal */}
      <Modal visible={!!selectedExpense} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedExpense(null)} />
          <Animated.View entering={FadeInUp} style={[styles.detailSheet, { backgroundColor: G.bg }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: G.border }]} />
            </View>
            {selectedExpense && (
              <ExpenseDetailsScreen
                expense={selectedExpense}
                onClose={() => { setSelectedExpense(null); loadData(); }}
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
          <View style={[styles.sortMenu, { backgroundColor: G.bgCard, borderColor: G.border, overflow: 'hidden' }]}>
            {[t('expense.sort_newest'), t('expense.sort_highest'), t('expense.sort_lowest')].map((option, idx) => (
              <TouchableOpacity key={idx} style={[styles.sortOption, { borderBottomColor: G.border }]}
                onPress={() => { setSelectedSort(option); setSortModalVisible(false); }}>
                <AppText variant="body" weight="bold" style={[styles.sortText, { color: selectedSort === option ? colors.primary : G.fg }]}>
                  {option}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const ExpenseCardRow = React.memo(({
  item, index, activeTab, onPress, onMarkPaid,
}: {
  item: any; index: number; activeTab: string;
  onPress: (i: any) => void; onMarkPaid: (id: number) => void;
}) => {
  const { colors, t, calendarType, language } = useSettings();
  const G = getExpenseGlass(colors);
  const isOverdue = item.isOverdue === 1 || item.isOverdue === true;
  const isRecurringPending = item.isRecurring === 1 && item.paymentStatus === 'pending';

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 50).duration(400)}>
      <AppListItem
        left={
          <View style={{
            width: 44, height: 44, borderRadius: 14,
            backgroundColor: isOverdue ? colors.error : isRecurringPending ? colors.primary : G.fg,
            justifyContent: 'center', alignItems: 'center',
          }}>
            {isOverdue ? <AlertTriangle color={G.fg} size={20} /> :
             activeTab === 'Transactions' ? <Wallet color={G.bg} size={20} /> :
             <CalendarDays color={G.bg} size={20} />}
          </View>
        }
        title={item.name || item.category || t('common.untitled')}
        subtitle={activeTab === 'Transactions'
          ? (item.date ? formatDate(new Date(item.date), calendarType, language) : t('common.n_a'))
          : `${t('expense.due')}: ${item.nextBillingDate ? formatDate(new Date(item.nextBillingDate), calendarType, language) : t('common.n_a')}`
        }
        onPress={() => onPress(item)}
        padding={Spacing.md}
        style={{
          borderRadius: 24,
          borderWidth: 1,
          borderColor: isOverdue ? colors.error + '40' : G.border,
          borderLeftWidth: isOverdue ? 3 : 1,
          borderLeftColor: isOverdue ? colors.error : G.border,
          marginBottom: Spacing.lg,
        }}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppNumber
              value={activeTab === 'Transactions' ? -(item.amount || 0) : (item.amount || 0)}
              size="body"
              prefix={t('common.etb') + ' '}
            />
            {activeTab === 'Upcoming' && isRecurringPending ? (
              <TouchableOpacity
                style={{ backgroundColor: G.fg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
                onPress={() => onMarkPaid(item.id)}
              >
                <AppText variant="caption" weight="bold" style={{ color: G.bg }}>{t('expense.paid')}</AppText>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />
    </Animated.View>
  );
});
ExpenseCardRow.displayName = 'ExpenseCardRow';

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
  headerSub: { fontSize: 12, letterSpacing: 1.2, marginBottom: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 28, letterSpacing: -1 },
  searchRow: { paddingHorizontal: 24, marginBottom: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14 },
  searchInput: { flex: 1, marginLeft: 10, fontFamily: Fonts.medium, fontSize: 15 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  categoryDropdown: { marginHorizontal: 24, marginBottom: 12, borderRadius: 14, borderWidth: 1, padding: 12 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  tabContainer: { flexDirection: 'row', padding: 4, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { elevation: 2 },
  tabText: { fontSize: 13 },
  listContent: { paddingHorizontal: 24, paddingBottom: 120 },
  emptyState: { alignItems: 'center', marginTop: 100, gap: 12 },
  emptyText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBackdrop: { flex: 1, width: '100%' },
  detailSheet: { width: '100%', height: '90%', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  modalHandleRow: { alignItems: 'center', paddingTop: 15, paddingBottom: 5 },
  modalHandle: { width: 40, height: 4, borderRadius: 2 },
  sortMenu: { width: 220, borderRadius: 20, padding: 8, elevation: 10, borderWidth: 1 },
  sortOption: { padding: 15, borderBottomWidth: 1 },
  sortText: { fontSize: 14 },
});

export default BillsAndTransactions;