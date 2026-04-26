import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Pressable,
  Platform,
  Dimensions
} from 'react-native';
import {
  Search,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  SortAsc,
  Package,
  X,
  Filter,
  BarChart3,
  Archive,
  AlertCircle,
  Clock,
  LayoutGrid
} from 'lucide-react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { 
  getFilteredItems, 
  deleteItem, 
  getCategories, 
  getInventorySummary,
  ItemData 
} from '@/database/db';
import RecentItemCard from '@/components/RecentItemCard';
import { useSettings } from '@/context/SettingsContext';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { exportToCSV } from '@/utils/export';
import { useFocusEffect } from '@react-navigation/native';
import { formatDate } from '@/utils/date-utils';
import ItemDetailsScreen from './item-details';
import { Fonts } from '@/constants/theme';

const InventoryRecordScreen = () => {
  const { colors, calendarType, language, t, theme } = useSettings();
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [inventoryData, setInventoryData] = useState<ItemData[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSort, setSelectedSort] = useState('name_asc');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isBarExpanded, setIsBarExpanded] = useState(false);

  const loadData = useCallback(() => {
    const items = getFilteredItems({
      search: searchQuery,
      date: selectedDate,
      category: selectedCategory,
      sortBy: selectedSort,
      limit: 100,
    }) as ItemData[];
    setInventoryData(items);
    
    const stats = getInventorySummary();
    if (stats) setSummary(stats);
  }, [searchQuery, selectedDate, selectedCategory, selectedSort]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      const cats = getCategories();
      setCategories([{ name: t('common.all') || 'All' }, ...cats]);
    }, [loadData, t])
  );

  const handleDownload = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    exportToCSV(inventoryData, 'Inventory_Vault_Export');
  };

  const { width } = Dimensions.get('window');
  const expandedWidth = useSharedValue(56);
  useEffect(() => {
    expandedWidth.value = withSpring(isBarExpanded ? width - 40 : 56, { damping: 15, stiffness: 100 });
  }, [isBarExpanded, width]);

  const expandStyle = useAnimatedStyle(() => ({
    width: expandedWidth.value,
  }));


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Integrated Header */}
      <View style={styles.header}>
        <View style={styles.headerMain}>
           <TouchableOpacity 
             onPress={() => {
               Haptics.selectionAsync();
               if (router.canGoBack()) router.back();
             }}
             style={[styles.backBtn, { borderColor: colors.border }]}
           >
             <ChevronLeft color={colors.text} size={24} />
           </TouchableOpacity>
           <View style={{ flex: 1, marginLeft: 15 }}>
              <RNText style={[styles.headerSub, { color: colors.textSecondary }]}>{t('inv.asset_management')}</RNText>
              <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('inv.inventory_vault')}</RNText>
           </View>
           <TouchableOpacity onPress={handleDownload} style={[styles.downloadBtn, { backgroundColor: colors.text }]}>
             <Download size={20} color={colors.background} />
           </TouchableOpacity>
        </View>

        {/* Global Stock Stats */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.statsRow}>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <Archive size={16} color={colors.primary} />
             <View style={{ marginLeft: 10 }}>
                <RNText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('inv.total_valuation')}</RNText>
                <RNText style={[styles.statValue, { color: colors.text }]}>{summary?.totalValue?.toLocaleString() || 0} {t('common.etb')}</RNText>
             </View>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <AlertCircle size={16} color="#FF3B30" />
             <View style={{ marginLeft: 10 }}>
                <RNText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('inv.low_stock')}</RNText>
                <RNText style={[styles.statValue, { color: colors.text }]}>{summary?.lowStockCount || 0} {t('inv.items_suffix')}</RNText>
             </View>
          </View>
        </Animated.View>
      </View>

      {/* Vault List */}
      <FlatList
        data={inventoryData}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(200 + index * 50)}>
            <RecentItemCard 
              key={item.id} 
              item={item} 
              onPress={() => setSelectedItem(item)}
              // No delete/swipe as per user request
            />
          </Animated.View>
        )}
        ListHeaderComponent={
          <View style={styles.searchSection}>
            <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('inv.search_vault_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Archive size={64} color={colors.border} />
            <RNText style={[styles.emptyText, { color: colors.textSecondary }]}>{t('inv.vault_empty')}</RNText>
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
                  style={[styles.filterPill, selectedCategory !== 'All' ? { backgroundColor: colors.text } : null]} 
                  onPress={() => { setCategoryModalVisible(true); setIsBarExpanded(false); }}
                >
                  <LayoutGrid size={18} color={selectedCategory !== 'All' ? colors.background : colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.filterPill, selectedSort !== 'name_asc' ? { backgroundColor: colors.text } : null]} 
                  onPress={() => { setSortModalVisible(true); setIsBarExpanded(false); }}
                >
                  <Filter size={18} color={selectedSort !== 'name_asc' ? colors.background : colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}

            <TouchableOpacity 
              style={[styles.dockBtn, { width: 56, height: 56, backgroundColor: isBarExpanded ? colors.primary : colors.text, borderRadius: 28 }]} 
              onPress={() => setIsBarExpanded(!isBarExpanded)}
            >
              <Filter size={24} color={isBarExpanded ? colors.background : colors.background} />
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </View>

      {/* ITEM DETAILS MODAL */}
      <Modal visible={!!selectedItem} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedItem(null)} />
          <Animated.View entering={FadeInUp} style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
             <View style={styles.modalHandleRow}>
               <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
             </View>
             {selectedItem && (
               <ItemDetailsScreen 
                 item={selectedItem} 
                 onClose={() => {
                   setSelectedItem(null);
                   loadData();
                 }} 
               />
             )}
          </Animated.View>
        </View>
      </Modal>

      {/* Item Details Modal */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedItem(null)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ItemDetailsScreen 
                item={selectedItem!} 
                onClose={() => {
                  setSelectedItem(null);
                  loadData();
                }} 
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
      <CustomDatePicker
        visible={dateModalVisible}
        onClose={() => setDateModalVisible(false)}
        initialDate={selectedDate}
        onSelectDate={(date) => setSelectedDate(date)}
      />

      <Modal visible={categoryModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setCategoryModalVisible(false)}>
          <View style={[styles.sortMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {categories.map((cat, idx) => (
              <TouchableOpacity key={idx} style={[styles.sortOption, { borderBottomColor: colors.border }]} onPress={() => { setSelectedCategory(cat.name); setCategoryModalVisible(false); }}>
                <RNText style={[styles.sortText, { color: colors.text }]}>
                  {cat.name === (t('common.all') || 'All') ? cat.name : t(cat.name.toLowerCase().startsWith('category.') ? cat.name.toLowerCase() : 'category.' + cat.name.toLowerCase())}
                </RNText>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={sortModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setSortModalVisible(false)}>
          <View style={[styles.sortMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { label: t('inv.sort_highest_price'), icon: ArrowUp, value: 'price_desc' },
              { label: t('inv.sort_lowest_price'), icon: ArrowDown, value: 'price_asc' },
              { label: t('inv.sort_highest_qty'), icon: ArrowUp, value: 'qty_desc' },
              { label: t('inv.sort_name_az'), icon: SortAsc, value: 'name_asc' },
            ].map((option, idx) => (
              <TouchableOpacity key={idx} style={[styles.sortOption, { borderBottomColor: colors.border }]} onPress={() => { setSelectedSort(option.value); setSortModalVisible(false); }}>
                <option.icon size={16} color={selectedSort === option.value ? colors.primary : colors.text} style={{ marginRight: 12 }} />
                <RNText style={[styles.sortText, { color: selectedSort === option.value ? colors.primary : colors.text }]}>{option.label}</RNText>
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
  statsRow: { flexDirection: 'row', gap: 12 },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, borderWidth: 1 },
  statLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  statValue: { fontSize: 14, fontFamily: Fonts.bold },
  searchSection: { paddingHorizontal: 25, marginVertical: 15 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 16, borderWidth: 1, paddingHorizontal: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontFamily: Fonts.medium, fontSize: 15 },
  listContent: { paddingHorizontal: 25, paddingBottom: 220, paddingTop: 10 },
  emptyState: { alignItems: 'center', marginTop: 100, gap: 15 },
  emptyText: { fontSize: 16, fontFamily: Fonts.bold },
  dockedBarWrapper: { position: 'absolute', bottom: 120, right: 20, alignItems: 'flex-end', zIndex: 100 },
  dockedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 28, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, overflow: 'hidden' },
  dockBtn: { justifyContent: 'center', alignItems: 'center' },
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

export default InventoryRecordScreen;