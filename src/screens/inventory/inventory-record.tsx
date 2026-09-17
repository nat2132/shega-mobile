import { CustomDatePicker } from '@/components/CustomDatePicker';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useWarehouse } from '@/context/WarehouseContext';
import {
    getCategories,
    getFilteredItems,
    getInventorySummary,
    getItemsFilteredByStockStatus,
    ItemData
} from '@/database/db';
import { getEthiopianMonthNames, toEthiopianDate } from '@/utils/date-utils';
import { translateWarehouseName } from '@/utils/warehouse-labels';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
    AlertCircle,
    Archive,
    ArrowDown,
    ArrowUp,
    ArrowDownUp,
    ChevronLeft,
    LayoutGrid,
    Package,
    Search,
    SortAsc,
    Warehouse,
    X
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDataChangedRefresh } from '@/hooks/useDataChangedRefresh';
import { useDebounce } from '@/hooks/useDebounce';
import { SkeletonList } from '@/components/Skeleton';
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
import { AppNumber, AppText} from '@/components/ui';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ItemDetailsScreen from './item-details';
import { getInventoryGlass } from './glass-inventory';
const InventoryRecordScreen = () => {
  const router = useRouter();
  const { colors, t } = useSettings();
  const { activeWarehouseId, warehouses } = useWarehouse();
  const G = getInventoryGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [inventoryData, setInventoryData] = useState<ItemData[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState('name_asc');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const debouncedSearch = useDebounce(searchQuery, 250);

  const loadData = useCallback(() => {
    const options: any = {
      search: debouncedSearch,
      category: selectedCategory,
      sortBy: selectedSort,
      limit: 100,
    };
    if (activeWarehouseId) {
      options.warehouseId = activeWarehouseId;
    }
    const items = getFilteredItems(options) as ItemData[];
    setInventoryData(items);
    setIsLoading(false);

    const stats = getInventorySummary();
    if (stats) setSummary(stats);
  }, [debouncedSearch, selectedCategory, selectedSort, activeWarehouseId]);

  useDataChangedRefresh(loadData);

  useEffect(() => {
      loadData();
      const cats = getCategories();
      setCategories([{ name: t('common.all') || 'All' }, ...cats]);
  }, [loadData, t]);

  const filteredItems = useMemo(() => {
    return inventoryData;
  }, [inventoryData]);

  const selectedWarehouse = warehouses.find((w: any) => w.id === activeWarehouseId);

  const renderItem = useCallback(({ item, index }: { item: ItemData; index: number }) => (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 30).duration(400)}>
      <InventoryCard item={item} onPress={() => setSelectedItem(item)} warehouses={warehouses} />
    </Animated.View>
  ), [warehouses]);

  const keyExtractor = useCallback((item: ItemData) => item.id.toString(), []);

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Ambient glow washes */}
      <View style={[styles.glowWash1, { backgroundColor: G.mutedLight }]} />
      <View style={[styles.glowWash2, { backgroundColor: G.mutedLight }]} />
      <View style={[styles.glowWash3, { backgroundColor: G.mutedLight }]} />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            onPress={() => { Haptics.selectionAsync(); if (router.canGoBack()) router.back(); }}
            style={[styles.backBtn, { borderColor: G.border }]}
          >
            <ChevronLeft color={G.fg} size={22} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.header')}</AppText>
            <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{t('inv.asset_vault')}</AppText>
          </View>
        </View>

        {/* Summary + Warehouse Selector */}
        <View style={styles.summaryRow}>
          <TouchableOpacity 
            style={[styles.summaryCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
            onPress={() => {
              const items = getItemsFilteredByStockStatus('in_stock');
              setInventoryData(items);
            }}
          >
            <Archive size={14} color={colors.primary} />
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.in_stock_label')}</AppText>
            <AppNumber value={summary?.totalItems} fallback="0" size="title" style={styles.summaryValue} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.summaryCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
            onPress={() => {
              const items = getItemsFilteredByStockStatus('low_stock');
              setInventoryData(items);
            }}
          >
            <AlertCircle size={14} color={colors.error} />
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.low_stock')}</AppText>
            <AppNumber value={summary?.lowStockCount} fallback="0" size="title" color={colors.error} style={styles.summaryValue} />
          </TouchableOpacity>
          {activeWarehouseId && (
            <View style={[styles.whBtn, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <Warehouse size={14} color={colors.success} />
              <AppText variant="body-sm" weight="bold" style={[styles.whBtnText, { color: colors.success }]} numberOfLines={1}>
                {selectedWarehouse?.name || t('common.all')}
              </AppText>
            </View>
          )}
        </View>
      </View>

      {/* Search & Filters */}
      <View style={styles.filterSection}>
        <View style={[styles.searchBox, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <Search size={16} color={G.fgSecondary} />
          <TextInput
            style={[styles.searchInput, { color: G.fg }]}
            placeholder={t('inv.search_items_ph')}
            placeholderTextColor={G.fgSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={14} color={G.fgSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterChipsRow}>
            <TouchableOpacity
              style={[styles.filterChip, { backgroundColor: selectedCategory !== 'All' ? G.fg : G.bgCard, borderColor: G.border }]}
              onPress={() => setCategoryModalVisible(true)}
            >
              <LayoutGrid size={14} color={selectedCategory !== 'All' ? G.bg : G.fgSecondary} />
              <AppText variant="caption" weight="bold" shrink={false} style={[styles.filterChipText, { color: selectedCategory !== 'All' ? G.bg : G.fg }]} numberOfLines={1}>
                {selectedCategory === 'All' ? t('common.all') : selectedCategory}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, { backgroundColor: selectedSort !== 'name_asc' ? G.fg : G.bgCard, borderColor: G.border }]}
              onPress={() => setSortModalVisible(true)}
            >
              <ArrowDownUp size={14} color={selectedSort !== 'name_asc' ? G.bg : G.fgSecondary} />
              <AppText variant="caption" weight="bold" shrink={false} style={[styles.filterChipText, { color: selectedSort !== 'name_asc' ? G.bg : G.fg }]} numberOfLines={1}>
                {t('inv.sort_btn')}
              </AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Inventory List */}
      {isLoading ? (
        <SkeletonList count={6} showAvatar style={styles.listContent} />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Package size={56} color={G.border} />
              <AppText variant="title" weight="bold" align="center" style={[styles.emptyText, { color: G.fgSecondary }]} numberOfLines={2}>{t('inv.no_items_found')}</AppText>
              <AppText variant="body-sm" weight="medium" align="center" style={[styles.emptySubtext, { color: G.fgSecondary }]} numberOfLines={3}>{t('inv.empty_subtitle')}</AppText>
            </View>
          }
        />
      )}

      {/* Item Details Modal */}
      <Modal visible={!!selectedItem} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedItem(null)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: G.bg }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: G.border }]} />
            </View>
            {selectedItem && (
              <ItemDetailsScreen 
                item={selectedItem} 
                onClose={() => { setSelectedItem(null); loadData(); }} 
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Category Modal */}
      <Modal visible={categoryModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlayCenter} onPress={() => setCategoryModalVisible(false)}>
          <View style={[styles.sortMenu, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppText variant="title" weight="bold" style={[styles.modalTitle, { color: G.fg, paddingHorizontal: 15, paddingTop: 10 }]} numberOfLines={2}>{t('inv.category_title')}</AppText>
            {categories.map((cat: any, idx: number) => (
              <TouchableOpacity key={idx} style={[styles.sortOption, { borderBottomColor: G.border }]} 
                onPress={() => { setSelectedCategory(cat.name); setCategoryModalVisible(false); }}>
                <AppText variant="body" weight="bold" style={[styles.sortText, { color: selectedCategory === cat.name ? colors.primary : G.fg }]} numberOfLines={1}>{cat.name}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Sort Modal */}
      <Modal visible={sortModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlayCenter} onPress={() => setSortModalVisible(false)}>
          <View style={[styles.sortMenu, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppText variant="title" weight="bold" style={[styles.modalTitle, { color: G.fg, paddingHorizontal: 15, paddingTop: 10 }]} numberOfLines={2}>{t('inv.sort_title')}</AppText>
            {[
              { label: t('inv.sort_name_az'), icon: SortAsc, value: 'name_asc' },
              { label: t('inv.sort_highest_price'), icon: ArrowUp, value: 'price_desc' },
              { label: t('inv.sort_lowest_price'), icon: ArrowDown, value: 'price_asc' },
              { label: t('inv.sort_highest_qty'), icon: ArrowUp, value: 'qty_desc' },
            ].map((option, idx) => (
              <TouchableOpacity key={idx} style={[styles.sortOption, { borderBottomColor: G.border }]} 
                onPress={() => { setSelectedSort(option.value); setSortModalVisible(false); }}>
                <option.icon size={16} color={selectedSort === option.value ? colors.primary : G.fg} style={{ marginRight: 12 }} />
                <AppText variant="body" weight="bold" style={[styles.sortText, { color: selectedSort === option.value ? colors.primary : G.fg }]} numberOfLines={1}>{option.label}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <CustomDatePicker
        visible={dateModalVisible}
        onClose={() => setDateModalVisible(false)}
        initialDate=""
        onSelectDate={(date: string) => setDateModalVisible(false)}
      />
    </View>
  );
};

const getRelativeTimeString = (
  dateStr: string,
  t: (key: string, params?: Record<string, string>) => string,
  calendarType: 'ethiopian' | 'gregorian' = 'gregorian',
  language: string = 'en'
) => {
  try {
    if (!dateStr) return '';
    let normalized = dateStr;
    if (!normalized.includes('T') && !normalized.includes('Z')) {
      normalized = normalized.replace(' ', 'T') + 'Z';
    }
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return t('common.just_now');
    } else if (diffMins < 60) {
      return t('inv.minutes_ago', { count: String(diffMins) });
    } else if (diffHours < 24) {
      return t('common.hr_ago', { count: String(diffHours) });
    } else if (diffDays < 7) {
      return t('common.d_ago', { count: String(diffDays) });
    } else {
      if (calendarType === 'ethiopian') {
        const e = toEthiopianDate(date);
        return `${getEthiopianMonthNames(language)[e.month - 1].substring(0, 3)} ${e.day}`;
      }
      const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'en-US', ti: 'en-US' };
      return date.toLocaleDateString(localeMap[language] || 'en-US', { month: 'short', day: 'numeric' });
    }
  } catch {
    return '';
  }
};

// Inventory Card Component
const InventoryCard = React.memo(({ item, onPress, warehouses }: { item: ItemData; onPress: () => void; warehouses: any[] }) => {
  const { colors, calendarType, language, t } = useSettings();
  const G = getInventoryGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const isLow = (item.totalBaseQuantity || 0) < 10;
  const isOutOfStock = (item.totalBaseQuantity || 0) <= 0;
  const warehouse = warehouses.find((w: any) => w.id === (item as any).warehouseId);
  const stockPct = Math.min((item.totalBaseQuantity || 0) / 50 * 100, 100);

  const statusColor = isOutOfStock ? colors.error : (isLow ? colors.warning : colors.success);
  const statusText = isOutOfStock
    ? t('inventory.out_of_stock')
    : (isLow ? t('inv.low_stock') : t('inv.in_stock_label'));

  const relativeTime = getRelativeTimeString(item.createdAt || '', t, calendarType, language);
  const subtitle = [
    item.categoryName || 'General',
    relativeTime
  ].filter(Boolean).join(' • ');

  return (
    <TouchableOpacity
      style={[styles.itemCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.itemCardTop}>
        <View style={[styles.itemIcon, { backgroundColor: G.bgCard }]}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <Package size={18} color={G.fg} />
          )}
        </View>
        <View style={styles.itemInfo}>
          <AppText variant="body-sm" weight="bold" style={[styles.itemName, { color: G.fg }]} numberOfLines={1}>{item.name}</AppText>
          <AppText variant="caption" weight="medium" style={[styles.itemCategory, { color: G.fgSecondary }]} numberOfLines={1}>
            {subtitle}
          </AppText>
        </View>
        <View style={[styles.stockBadge, { backgroundColor: statusColor }]}>
          <AppText variant="micro" weight="bold" shrink={false} style={styles.stockBadgeText} numberOfLines={1}>
            • {statusText}
          </AppText>
        </View>
      </View>

      {/* Stock progress bar */}
      <View style={[styles.stockBar, { backgroundColor: G.border }]}>
        <View style={[styles.stockBarFill, { 
          width: `${stockPct}%`, 
          backgroundColor: statusColor 
        }]} />
      </View>

      {/* 3 columns bottom info */}
      <View style={styles.itemCardBottomGrid}>
        <View style={styles.gridCol}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.gridLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.grid_quantity')}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <AppNumber value={item.totalBaseQuantity} fallback="0" size="body-sm" style={styles.gridValue} />
            <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.gridValue, { color: G.fg }]} numberOfLines={1}> {item.baseUnit || 'pcs'}</AppText>
          </View>
        </View>
        <View style={styles.gridCol}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.gridLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.grid_purchase')}</AppText>
          <AppNumber value={item.basePurchasePrice} prefix={t('common.etb') + ' '} size="body-sm" style={styles.gridValue} />
        </View>
        <View style={styles.gridCol}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.gridLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.grid_selling')}</AppText>
          <AppNumber value={item.baseSellingPrice} prefix={t('common.etb') + ' '} size="body-sm" style={styles.gridValue} />
        </View>
      </View>

      {warehouse && (
        <View style={styles.whLabelRow}>
          <Warehouse size={10} color={G.fgSecondary} />
          <AppText variant="micro" weight="bold" shrink={false} style={[styles.whLabelText, { color: G.fgSecondary }]} numberOfLines={1}>{translateWarehouseName(t, warehouse.name)}</AppText>
        </View>
      )}
    </TouchableOpacity>
  );
});
InventoryCard.displayName = 'InventoryCard';

const createStyles = (G: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerSub: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerTitle: { fontSize: 24, fontFamily: Fonts.bold },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, gap: 4, overflow: 'hidden' },
  summaryLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  summaryValue: { fontSize: 16, fontFamily: Fonts.bold },
  whBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, borderWidth: 1, gap: 6, maxWidth: 110 },
  whBtnText: { fontSize: 11, fontFamily: Fonts.bold },
  filterSection: { paddingHorizontal: 20, paddingVertical: 8, gap: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 42, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontFamily: Fonts.medium },
  filterChipsRow: { flexDirection: 'row', gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, gap: 4 },
  filterChipText: { fontSize: 11, fontFamily: Fonts.bold },
  listContent: { paddingHorizontal: 20, paddingBottom: 150, paddingTop: 5 },
  itemCard: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10, overflow: 'hidden' },
  itemCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemIcon: { width: 36, height: 36, borderRadius: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontFamily: Fonts.bold },
  itemCategory: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 2 },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  stockBadgeText: { fontSize: 9, fontFamily: Fonts.bold, color: G.fg },
  stockBar: { height: 4, borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  stockBarFill: { height: '100%', borderRadius: 2 },
  itemCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  priceText: { fontSize: 13, fontFamily: Fonts.bold },
  whLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  whLabelText: { fontSize: 10, fontFamily: Fonts.medium },
  emptyState: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: Fonts.bold },
  emptySubtext: { fontSize: 12, fontFamily: Fonts.medium, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBackdrop: { flex: 1, width: '100%' },
  bottomSheetContainer: { width: '100%', height: '90%', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  modalHandleRow: { alignItems: 'center', paddingTop: 15, paddingBottom: 5 },
  modalHandle: { width: 40, height: 4, borderRadius: 2 },
  modalTitle: { fontSize: 16, fontFamily: Fonts.bold, marginBottom: 5 },
  sortMenu: { width: 240, borderRadius: 20, padding: 8, elevation: 10, borderWidth: 1 },
  sortOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  sortText: { fontSize: 13, fontFamily: Fonts.bold },
  itemCardBottomGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: G.border,
  },
  gridCol: {
    flex: 1,
    gap: 3,
  },
  gridLabel: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gridValue: {
    fontFamily: Fonts.bold,
  },
  whLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  glowWash1: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.5,
  },
  glowWash2: {
    position: 'absolute',
    top: 120,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.4,
  },
  glowWash3: {
    position: 'absolute',
    bottom: 100,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.35,
  },
});

export default InventoryRecordScreen;