import React, { useState, useCallback } from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  TextInput as RNTextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { 
  Search, 
  Calendar, 
  MapPin, 
  ArrowDownUp, 
  Clock, 
  Download, 
  Package,
  ChevronLeft,
  LayoutGrid,
  Filter,
  DollarSign,
  TrendingUp,
  CreditCard,
  History,
  Info
} from 'lucide-react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  FadeIn,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { 
  getFilteredSales, 
  deleteSale, 
  getCategories, 
  getDashboardStats 
} from '@/database/db';
import { useFocusEffect } from '@react-navigation/native';
import { useSettings } from '@/context/SettingsContext';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { formatDate } from '@/utils/date-utils';
import { exportToCSV } from '@/utils/export';
import SaleDetailsScreen from './sales-details';
import { Fonts } from '@/constants/theme';

interface SalesRecordProps {
  onClose?: () => void;
}

const SalesRecordScreen: React.FC<SalesRecordProps> = ({ onClose }) => {
  const { colors, calendarType, language, t, theme } = useSettings();
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  
  const [salesData, setSalesData] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSort, setSelectedSort] = useState('price_desc');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSale, setSelectedSale] = useState<any>(null);

  const loadData = useCallback(() => {
    const data = getFilteredSales({
      search: searchQuery,
      date: selectedDate,
      category: selectedCategory,
      sortBy: selectedSort,
      limit: 50,
    });
    setSalesData(data);
    
    const dashboardStats = getDashboardStats();
    if (dashboardStats) setStats(dashboardStats.today);
  }, [searchQuery, selectedDate, selectedSort, selectedCategory]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      const cats = getCategories();
      setCategories([{ name: t('common.all') || 'All' }, ...cats]);
    }, [loadData, t])
  );

  const handleDownload = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    exportToCSV(salesData, 'Sales_Ledger_Export');
  };

  const renderSaleCard = ({ item, index }: { item: any; index: number }) => {
    const isPaid = item.paymentStatus === 'Paid';
    return (
      <Animated.View entering={FadeInDown.delay(200 + index * 50)}>
        <TouchableOpacity 
          style={[styles.saleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.7}
          onPress={() => setSelectedSale(item)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.timeRow}>
              <Clock size={13} color={colors.textSecondary} />
              <RNText style={[styles.timeText, { color: colors.textSecondary }]}>
                {item.createdAt ? formatDate(new Date(item.createdAt), calendarType, language) : 'Recently'}
              </RNText>
            </View>
            <View style={[styles.statusBadge, isPaid ? { backgroundColor: colors.primary + '15' } : { backgroundColor: '#FF950015' }]}>
              <View style={[styles.statusDot, { backgroundColor: isPaid ? colors.primary : '#FF9500' }]} />
              <RNText style={[styles.statusText, { color: isPaid ? colors.primary : '#FF9500' }]}>
                {isPaid ? t('sales.payment_paid') : t('sales.payment_debt')}
              </RNText>
            </View>
          </View>
          <View style={styles.cardBody}>
            <View style={[styles.iconBox, { backgroundColor: colors.text }]}>
              <Package size={22} color={colors.background} />
            </View>
            <View style={styles.itemInfo}>
              <RNText style={[styles.itemName, { color: colors.text }]}>{item.itemName}</RNText>
              <RNText style={[styles.itemCategory, { color: colors.textSecondary }]}>{item.unit}</RNText>
            </View>
            <View style={styles.priceInfo}>
              <RNText style={[styles.itemPrice, { color: colors.text }]}>{item.totalPrice.toLocaleString()} ETB</RNText>
              <RNText style={[styles.itemQty, { color: colors.textSecondary }]}>{item.quantity} {t('common.units')}</RNText>
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
             onPress={() => onClose ? onClose() : Haptics.selectionAsync()}
             style={[styles.backBtn, { borderColor: colors.border }]}
           >
             <ChevronLeft color={colors.text} size={24} />
           </TouchableOpacity>
           <View style={{ flex: 1, marginLeft: 15 }}>
              <RNText style={[styles.headerSub, { color: colors.textSecondary }]}>{t('dashboard.stats.yesterday')}</RNText>
              <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('sales.ledger')}</RNText>
           </View>
           <TouchableOpacity onPress={handleDownload} style={[styles.downloadBtn, { backgroundColor: colors.text }]}>
             <Download size={20} color={colors.background} />
           </TouchableOpacity>
        </View>

        {/* Sales Performance Stats */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.statsRow}>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <TrendingUp size={16} color={colors.primary} />
             <View style={{ marginLeft: 10 }}>
                <RNText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('sales.revenue_today')}</RNText>
                <RNText style={[styles.statValue, { color: colors.text }]}>{stats?.revenue?.toLocaleString() || 0} ETB</RNText>
             </View>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <CreditCard size={16} color="#FF9500" />
             <View style={{ marginLeft: 10 }}>
                <RNText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('sales.outstanding')}</RNText>
                <RNText style={[styles.statValue, { color: colors.text }]}>{stats?.debt?.toLocaleString() || 0} ETB</RNText>
             </View>
          </View>
        </Animated.View>
      </View>

      {/* Ledger List */}
      <FlatList
        data={salesData}
        renderItem={renderSaleCard}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.searchSection}>
            <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Search size={18} color={colors.textSecondary} />
              <RNTextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('sales.search_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <History size={64} color={colors.border} />
            <RNText style={[styles.emptyText, { color: colors.textSecondary }]}>{t('sales.no_records_found')}</RNText>
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

          <TouchableOpacity 
            style={[styles.filterPill, selectedCategory !== 'All' ? { backgroundColor: colors.text } : null]} 
            onPress={() => setCategoryModalVisible(true)}
          >
            <LayoutGrid size={18} color={selectedCategory !== 'All' ? colors.background : colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterPill, selectedSort !== 'price_desc' ? { backgroundColor: colors.text } : null]} 
            onPress={() => setSortModalVisible(true)}
          >
            <ArrowDownUp size={18} color={selectedSort !== 'price_desc' ? colors.background : colors.textSecondary} />
          </TouchableOpacity>
        </BlurView>
      </View>

      {/* SALES DETAILS MODAL */}
      <Modal visible={!!selectedSale} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedSale(null)} />
          <Animated.View entering={FadeInUp} style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
             <View style={styles.modalHandleRow}>
               <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
             </View>
             {selectedSale && (
               <SaleDetailsScreen 
                 sale={selectedSale} 
                 onClose={() => {
                   setSelectedSale(null);
                   loadData();
                 }} 
               />
             )}
          </Animated.View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <CustomDatePicker
        visible={dateModalVisible}
        onClose={() => setDateModalVisible(false)}
        initialDate={selectedDate}
        onSelectDate={(date) => setSelectedDate(date)}
      />

      {/* Category Modal */}
      <Modal visible={categoryModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setCategoryModalVisible(false)}>
          <View style={[styles.sortMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {categories.map((cat, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={[styles.sortOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSelectedCategory(cat.name);
                  setCategoryModalVisible(false);
                }}
              >
                <RNText style={[styles.sortText, { color: colors.text }]}>
                  {cat.name === (t('common.all') || 'All') ? cat.name : (t('category.' + cat.name.toLowerCase()) !== 'category.' + cat.name.toLowerCase() ? t('category.' + cat.name.toLowerCase()) : cat.name)}
                </RNText>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Sort Modal */}
      <Modal visible={sortModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setSortModalVisible(false)}>
          <View style={[styles.sortMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { label: t('sales.sort_highest_price'), value: 'price_desc' },
              { label: t('sales.sort_lowest_price'), value: 'price_asc' },
              { label: t('sales.sort_highest_quantity'), value: 'qty_desc' },
              { label: t('sales.sort_item_name'), value: 'name_asc' },
            ].map((option) => (
              <TouchableOpacity 
                key={option.value} 
                style={[styles.sortOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSelectedSort(option.value);
                  setSortModalVisible(false);
                }}
              >
                <ArrowDownUp size={14} color={selectedSort === option.value ? colors.primary : colors.text} style={{ marginRight: 12 }} />
                <RNText style={[styles.sortText, { color: selectedSort === option.value ? colors.primary : colors.text }]}>{option.label}</RNText>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Sale Details Modal */}
      <Modal
        visible={!!selectedSale}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSale(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedSale(null)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <SaleDetailsScreen 
                sale={selectedSale} 
                onClose={() => {
                  setSelectedSale(null);
                  loadData();
                }} 
              />
            </ScrollView>
          </View>
        </View>
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
  statsRow: { flexDirection: 'row', gap: 12 },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, borderWidth: 1 },
  statLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  statValue: { fontSize: 14, fontFamily: Fonts.bold },
  searchSection: { paddingHorizontal: 25, marginVertical: 15 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 16, borderWidth: 1, paddingHorizontal: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontFamily: Fonts.medium, fontSize: 15 },
  listContent: { paddingHorizontal: 25, paddingBottom: 120 },
  saleCard: { borderRadius: 24, padding: 18, borderWidth: 1, marginBottom: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeText: { fontSize: 12, fontFamily: Fonts.medium },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  cardBody: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1, marginLeft: 15 },
  itemName: { fontFamily: Fonts.bold, fontSize: 16, marginBottom: 2 },
  itemCategory: { fontSize: 13, fontFamily: Fonts.medium },
  priceInfo: { alignItems: 'flex-end' },
  itemPrice: { fontFamily: Fonts.bold, fontSize: 15, marginBottom: 2 },
  itemQty: { fontSize: 12, fontFamily: Fonts.medium },
  emptyState: { alignItems: 'center', marginTop: 100, gap: 15 },
  emptyText: { fontSize: 16, fontFamily: Fonts.bold },
  dockedBarWrapper: { position: 'absolute', bottom: 30, left: 20, right: 20, alignItems: 'center' },
  dockedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 30, width: '100%', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, overflow: 'hidden' },
  filterPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, gap: 8 },
  filterPillText: { fontSize: 13, fontFamily: Fonts.bold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, width: '100%' },
  bottomSheetContainer: { width: '100%', height: '85%', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  modalHandleRow: { alignItems: 'center', paddingTop: 15, paddingBottom: 5 },
  modalHandle: { width: 40, height: 4, borderRadius: 2 },
  sortMenu: { width: 220, borderRadius: 20, padding: 8, position: 'absolute', top: 100, alignSelf: 'center', elevation: 10, borderWidth: 1 },
  sortOption: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
  sortText: { fontSize: 14, fontFamily: Fonts.bold },
});

export default SalesRecordScreen;