import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text as RNText,
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  FlatList, 
  ActivityIndicator,
  Modal,
  Pressable,
  Platform
} from 'react-native';
import { 
  Search, 
  Calendar, 
  Tag, 
  ArrowUpDown, 
  Wallet, 
  Clock,
  ChevronLeft,
  Download,
  AlertCircle,
  TrendingDown,
  LayoutGrid,
  ChevronRight,
  Info,
  CalendarDays
} from 'lucide-react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  FadeIn,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Fonts } from '@/constants/theme';
import { 
  getFilteredExpenses, 
  getUpcomingExpenses, 
  deleteExpense,
  getDashboardStats
} from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { exportToCSV } from '@/utils/export';
import { formatDate } from '@/utils/date-utils';
import ExpenseDetailsScreen from './expense-details';
import { useFocusEffect } from '@react-navigation/native';

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
  
  // Modals
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const allTrans = await getFilteredExpenses({
         search: searchQuery,
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
  }, [searchQuery, selectedDate, selectedSort]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDownload = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    exportToCSV(filteredData, 'Capital_Ledger_Export');
  };

  const filteredData = (activeTab === 'Transactions' ? transactions : upcoming).filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderExpenseCard = ({ item, index }: { item: any; index: number }) => {
    return (
      <Animated.View entering={FadeInDown.delay(200 + index * 50)}>
        <TouchableOpacity 
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.7}
          onPress={() => setSelectedExpense(item)}
        >
          <View style={styles.cardMain}>
            <View style={[styles.iconBox, { backgroundColor: colors.text }]}>
                {activeTab === 'Transactions' ? <Wallet color={colors.background} size={20} /> : <CalendarDays color={colors.background} size={20} />}
            </View>
            <View style={{ flex: 1 }}>
              <RNText style={[styles.cardTitle, { color: colors.text }]}>{item.name}</RNText>
              <RNText style={[styles.cardDate, { color: colors.textSecondary }]}>
                {activeTab === 'Transactions' 
                  ? (item.date ? formatDate(new Date(item.date), calendarType, language) : 'N/A')
                  : `Due: ${item.nextBillingDate ? formatDate(new Date(item.nextBillingDate), calendarType, language) : 'N/A'}`}
              </RNText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
               <RNText style={[styles.amountText, { color: colors.text }]}>
                 {activeTab === 'Transactions' ? '-' : ''} {item.amount.toLocaleString()} 
                 <RNText style={styles.currSmall}> {t('common.etb')}</RNText>
               </RNText>
               {activeTab === 'Upcoming' && (
                 <View style={styles.payBadge}>
                    <RNText style={[styles.payBadgeText, { color: colors.primary }]}>{t('common.search')}</RNText>
                 </View>
               )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

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
              <RNText style={[styles.headerSub, { color: colors.textSecondary }]}>{t('expense.capital_bills')}</RNText>
              <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('expense.capital_ledger')}</RNText>
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
            <RNText style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'Transactions' && { color: colors.background }]}>{t('expense.executed')}</RNText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'Upcoming' && [styles.activeTab, { backgroundColor: colors.text }]]} 
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab('Upcoming'); }}
          >
            <RNText style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'Upcoming' && { color: colors.background }]}>{t('expense.upcoming')}</RNText>
          </TouchableOpacity>
        </View>

        {/* Expense Summary Stats */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.statsRow}>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <TrendingDown size={16} color="#FF3B30" />
             <View style={{ marginLeft: 10 }}>
                <RNText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('expense.disbursed_today')}</RNText>
                <RNText style={[styles.statValue, { color: colors.text }]}>{stats?.expenses?.toLocaleString() || 0} {t('common.etb')}</RNText>
             </View>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <Clock size={16} color={colors.primary} />
             <View style={{ marginLeft: 10 }}>
                <RNText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('expense.active_bills')}</RNText>
                <RNText style={[styles.statValue, { color: colors.text }]}>{t('expense.scheduled', { count: upcoming.length })}</RNText>
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
        ListHeaderComponent={
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
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Wallet size={64} color={colors.border} />
            <RNText style={[styles.emptyText, { color: colors.textSecondary }]}>{t('expense.no_outflows')}</RNText>
          </View>
        }
      />

      {/* Glassmorphic Filter Dock */}
      <View style={styles.dockedBarWrapper}>
        <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint={theme === 'light' ? 'light' : 'dark'} style={[styles.dockedBar, { borderColor: colors.border, backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }]}>
          <TouchableOpacity 
            style={[styles.filterPill, selectedDate ? { backgroundColor: colors.text } : null]} 
            onPress={() => setDateModalVisible(true)}
          >
            <Calendar size={18} color={selectedDate ? colors.background : colors.textSecondary} />
            <RNText style={[styles.filterPillText, { color: selectedDate ? colors.background : colors.textSecondary }]}>
              {selectedDate ? selectedDate : t('common.date')}
            </RNText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterPill} onPress={() => Haptics.selectionAsync()}>
            <LayoutGrid size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterPill, selectedSort !== 'Date (Newest)' ? { backgroundColor: colors.text } : null]} 
            onPress={() => setSortModalVisible(true)}
          >
            <ArrowUpDown size={18} color={selectedSort !== 'Date (Newest)' ? colors.background : colors.textSecondary} />
          </TouchableOpacity>
        </BlurView>
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
                <RNText style={[styles.sortText, { color: selectedSort === t(optionKey) ? colors.primary : colors.text }]}>{t(optionKey)}</RNText>
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
  searchSection: { paddingHorizontal: 25, marginVertical: 15 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 16, borderWidth: 1, paddingHorizontal: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontFamily: Fonts.medium, fontSize: 15 },
  listContent: { paddingHorizontal: 25, paddingBottom: 120 },
  card: { padding: 18, borderRadius: 24, borderWidth: 1, marginBottom: 15 },
  cardMain: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTitle: { fontFamily: Fonts.bold, fontSize: 16, marginBottom: 4 },
  cardDate: { fontSize: 12, fontFamily: Fonts.medium },
  amountText: { fontFamily: Fonts.bold, fontSize: 16, textAlign: 'right' },
  currSmall: { fontSize: 11 },
  payBadge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'transparent', alignSelf: 'flex-end' },
  payBadgeText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  emptyState: { alignItems: 'center', marginTop: 100, gap: 15 },
  emptyText: { fontSize: 16, fontFamily: Fonts.bold },
  dockedBarWrapper: { position: 'absolute', bottom: 30, left: 20, right: 20, alignItems: 'center' },
  dockedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 30, width: '100%', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, overflow: 'hidden' },
  filterPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, gap: 8 },
  filterPillText: { fontSize: 13, fontFamily: Fonts.bold },
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