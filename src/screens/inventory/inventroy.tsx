import { Fonts } from '@/constants/theme';
import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import { useDialog } from '@/context/DialogContext';
import {
    getExpiringItems,
    getInventoryComparisonStats,
    getInventoryStats,
    getInventorySummary,
    getItems,
    getLowStockItems,
    getMovingItemsWithFilters,
    getRecentItems,
    getReorderSuggestions,
    getSlowMovingItems,
    getTopHighestValueItems,
    getTopSellingItems,
    getWarehouses,
    transferStock,
    updateItem,
    ItemData
} from '@/database/db';
import { useNotifications } from '@/hooks/useNotifications';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
    BarChart3,
    Bell,
    Download,
    Eye,
    EyeOff,
    Handshake,
    Package,
    Plus,
    Search,
    ShieldCheck,
    ShoppingBag,
    Trash2 as TrashIcon,
    TrendingDown,
    TrendingUp,
    Warehouse,
    X,
    Zap
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import OnCreditListScreen from '../dashboard/oncredit-list-con';
import InventoryRecordScreen from './inventory-record';
import AddAssetFlow from './inventroy-form';
import ItemDetailsScreen from './item-details';
import WarehouseManagerModal from './warehouse-manager';
import { SparklineSkeleton, CategoryBarSkeleton } from '@/components/ChartSkeleton';
import { ChartEmpty } from '@/components/ChartStateView';
import { AppText, AppListItem, AppCard, AppButton, AppRow } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { generateProductListPDF } from '@/utils/pdf-utils';
const SparklineChart = React.memo(({ data, loading }: { data?: number[]; loading?: boolean } = {}) => {
  const { colors } = useSettings();
  // If we have real numeric data, derive an SVG path from it.
  // Otherwise fall back to a skeleton placeholder (or the previous
  // hardcoded curve when no loading flag is provided, to preserve
  // existing call-sites that have not yet been wired up).
  if (loading) {
    return <SparklineSkeleton width={100} height={30} />;
  }
  if (Array.isArray(data) && data.length >= 2) {
    const safe = data.map((n) => (Number.isFinite(n) ? Math.max(0, n) : 0));
    const max = Math.max(...safe, 1);
    const step = 100 / (safe.length - 1);
    const points = safe.map((v, i) => {
      const x = i * step;
      const y = 38 - (v / max) * 30;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    });
    return (
      <Svg width="100" height="30" viewBox="0 0 100 40">
        <Path
          d={points.join(' ')}
          stroke={colors.primary}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width="100" height="30" viewBox="0 0 100 40">
      <Path
        d="M0 35 C15 35, 25 5, 40 20 C55 35, 75 15, 100 5"
        stroke={colors.primary} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
});
SparklineChart.displayName = 'SparklineChart';

/**
 * A single stock-by-category bar row. Memoised because the parent
 * (QuickStats) re-renders on every theme/language change and we want
 * to keep the visible row steady.
 */
const CategoryBarRow = React.memo(({ item, idx }: { item: any; idx: number }) => {
  const { colors, t } = useSettings();
  const safeName = item?.name
    ? t(item.name.toLowerCase().startsWith('category.') ? item.name.toLowerCase() : 'category.' + item.name.toLowerCase())
    : item?.name;
  const safeCount = Number(item?.count) || 0;
  return (
    <AppListItem
      left={
        <View style={[styles.qsIconBox, { backgroundColor: colors.text }]}>
          <Package size={20} color={colors.background} />
        </View>
      }
      title={safeName}
      subtitle={`${safeCount} ${t('inv.items_suffix')}`}
      titleMaxLines={2}
      subtitleMaxLines={1}
      noBorder
      padding={Spacing.md}
      style={{
        backgroundColor: colors.background,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        marginBottom: Spacing.sm,
      }}
    />
  );
});
CategoryBarRow.displayName = 'CategoryBarRow';

const InventoryLedgerItem = React.memo(({ item, onPress }: { item: ItemData, onPress: () => void }) => {
  const { colors, t } = useSettings();
  const isLow = (item.totalBaseQuantity || 0) < 10;

  return (
    <TouchableOpacity
      style={[styles.ledgerItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.ledgerIconCircle, { backgroundColor: colors.surface }]}>
        <Package size={22} color={isLow ? colors.primary : colors.textSecondary} />
      </View>
      <View style={styles.ledgerMain}>
        <AppText variant="body" weight="bold" style={[styles.ledgerName, { color: colors.text }]} numberOfLines={1}>{item.name}</AppText>
        <AppText variant="caption" weight="medium" style={[styles.ledgerCategory, { color: colors.textSecondary }]} numberOfLines={1}>
          {(item.categoryName ? t(item.categoryName.toLowerCase().startsWith('category.') ? item.categoryName.toLowerCase() : 'category.' + item.categoryName.toLowerCase()) : t('common.general'))} • {t('form.' + (item.baseUnit || 'pieces').toLowerCase())}
        </AppText>
      </View>
      <View style={styles.ledgerEnd}>
        <AppText variant="body" weight="bold" shrink={false} style={[styles.ledgerQty, { color: isLow ? colors.primary : colors.text }]} numberOfLines={1}>
          {item.totalBaseQuantity} {t('form.' + (item.baseUnit || 'pieces').toLowerCase())}
        </AppText>
        <View style={[styles.ledgerStatus, { backgroundColor: isLow ? (colors.primary + '15') : (colors.success + '15') }]}>
          <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.ledgerStatusText, { color: isLow ? colors.primary : colors.success }]} numberOfLines={1}>
            {isLow ? t('inv.low_stock') : t('inv.in_stock_label')}
          </AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
});
InventoryLedgerItem.displayName = 'InventoryLedgerItem';

const InventoryDashboard = () => {
  const { openSidebar } = useSidebar();
  const { userProfile, colors, t, theme, language } = useSettings();
  const { notifCount } = useNotifications();
  const dialog = useDialog();
  const [showInventoryRecord, setShowInventoryRecord] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showItemDetails, setShowItemDetails] = useState(false);
  const [activeQuickStatus, setActiveQuickStatus] = useState<string | null>(null);
  const [hideMetrics, setHideMetrics] = useState(false);
  const [isBarExpanded, setIsBarExpanded] = useState(false);
  const [recentItems, setRecentItems] = useState<ItemData[]>([]);
  const [invStats, setInvStats] = useState<any>(null);
  const [invCompStats, setInvCompStats] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [fastMovingItems, setFastMovingItems] = useState<any[]>([]);
  const [slowMovingItems, setSlowMovingItems] = useState<any[]>([]);
  const [expiringItems, setExpiringItems] = useState<any[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [showTop10Modal, setShowTop10Modal] = useState(false);
  const [top10Items, setTop10Items] = useState<any[]>([]);
  const [showMovingDetail, setShowMovingDetail] = useState(false);
  const [movingDetailType, setMovingDetailType] = useState<'fast' | 'slow'>('fast');
  const [movingDetailFilter, setMovingDetailFilter] = useState<'qty_desc' | 'qty_asc' | 'category' | 'today' | 'week' | 'month' | 'year'>('qty_desc');
  const [movingDetailItems, setMovingDetailItems] = useState<any[]>([]);
  const [showOnCreditModal, setShowOnCreditModal] = useState(false);
  const [customOrderName, setCustomOrderName] = useState('');
  const [customOrderQty, setCustomOrderQty] = useState('1');
  const [customOrderNotes, setCustomOrderNotes] = useState('');

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [reorderSuggestions, setReorderSuggestions] = useState<any[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSource, setTransferSource] = useState<number | null>(null);
  const [transferDest, setTransferDest] = useState<number | null>(null);
  const [transferItems, setTransferItems] = useState<any[]>([]);
  const [transferQty, setTransferQty] = useState<Record<string, number>>({});
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [catalogGenerating, setCatalogGenerating] = useState(false);

  const loadAllData = useCallback(() => {
    loadRecentItems();
    const stats = getInventoryStats(selectedWarehouseId);
    if (stats) setInvStats(stats);
    
    const compStats = getInventoryComparisonStats();
    if (compStats) setInvCompStats(compStats);

    const invSummary = getInventorySummary(selectedWarehouseId);
    setSummary(invSummary);

    const lowItems = getLowStockItems();
    setLowStockItems(lowItems);

    const topSelling = getTopSellingItems(10);
    setFastMovingItems(topSelling);

    const slowItems = getSlowMovingItems(10);
    setSlowMovingItems(slowItems);

    const expiring = getExpiringItems(30);
    setExpiringItems(expiring);

    const whs = getWarehouses();
    setWarehouses(whs);

    const reorder = getReorderSuggestions();
    setReorderSuggestions(reorder);
  }, [selectedWarehouseId]);

  const { width } = Dimensions.get('window');
  const expandedWidth = useSharedValue(56);
  useEffect(() => {
    expandedWidth.value = withSpring(isBarExpanded ? width - 50 : 56, { damping: 15, stiffness: 100 });
  }, [isBarExpanded, width]);

  const expandStyle = useAnimatedStyle(() => ({
    width: expandedWidth.value,
  }));

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData])
  );

const loadRecentItems = () => {
     const today = new Date().toISOString().split('T')[0];
     const allItems = getRecentItems(100) as ItemData[];
     const todayItems = allItems.filter((item: any) => {
       const itemDate = item.createdAt ? item.createdAt.split(' ')[0] || item.createdAt.substring(0, 10) : '';
       return itemDate === today;
     });
     setRecentItems(todayItems.slice(0, 5));
   };

  const onRefresh = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRefreshing(true);
    loadAllData();
    setTimeout(() => setRefreshing(false), 800);
  }, [loadAllData]);

  const toggleMetrics = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHideMetrics(!hideMetrics);
  };

  const keyExtractor = useCallback((item: any) => `lowstock-${item.id}`, []);

  const renderLowStockItem = useCallback(({ item }: { item: any }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, marginBottom: 8 }}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <AppText variant="body" weight="bold" style={{ fontSize: 14, fontFamily: Fonts.bold, color: colors.text }} numberOfLines={1}>
          {item.name}
        </AppText>
        <AppText variant="caption" weight="medium" style={{ fontSize: 12, fontFamily: Fonts.medium, color: colors.primary, marginTop: 2 }} numberOfLines={1}>
          {t('inv.current_qty', { count: String(item.totalBaseQuantity || 0) })}
        </AppText>
      </View>
      <TouchableOpacity
        style={{ backgroundColor: colors.text, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
        onPress={() => {
          const newQty = (item.totalBaseQuantity || 0) + 50;
          updateItem(item.id, { totalBaseQuantity: newQty });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          loadAllData();
        }}
      >
        <AppText variant="caption" weight="bold" style={{ color: colors.background, fontSize: 12, fontFamily: Fonts.bold }} numberOfLines={1}>{t('inv.restock_btn')}</AppText>
      </TouchableOpacity>
    </View>
  ), [colors, t, updateItem, loadAllData]);

  return (
    <View style={[styles.screenWrapper, { backgroundColor: colors.background }]}>
      {/* Background Glow */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgWash, { top: -100, left: -100, backgroundColor: colors.primary, opacity: 0.05 }]} />
      </View>

      <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={colors.text}
              colors={[colors.text]}
            />
          }
        >
          {/* Top Navigation Bar */}
          <View style={styles.topBar}>
            <View style={{ flex: 1 }}>
              <TouchableOpacity onPress={openSidebar} style={[styles.headerAvatarBox, { borderColor: colors.border }]}>
                <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.headerAvatar} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity 
                onPress={() => router.push('/notifications')} 
                style={[styles.headerIconBtn, { borderColor: colors.border }]}
              >
                 <Bell size={22} color={colors.text} />
                 {notifCount > 0 && (
                   <View style={[styles.notifBadge, { backgroundColor: colors.primary }]}>
                     <AppText variant="micro" weight="bold" style={styles.notifBadgeText} numberOfLines={1}>{notifCount}</AppText>
                   </View>
                 )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero Page Header */}
          <Animated.View entering={FadeInDown.duration(600)} style={styles.screenHeader}>
             <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inv.inventory_management')}</AppText>
             <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('inv.stock_vault')}</AppText>
          </Animated.View>

          {/* Warehouse Selector Button */}
          <Animated.View entering={FadeInDown.delay(50).duration(600)} style={{ paddingHorizontal: 25, marginBottom: 20, flexDirection: 'row' }}>
            <TouchableOpacity 
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 14,
                gap: 6
              }}
              onPress={() => setShowWarehouseModal(true)}
            >
              <Warehouse size={14} color={selectedWarehouseId ? '#34C759' : colors.primary} />
              <AppText variant="caption" weight="bold" style={{ fontSize: 12, fontFamily: Fonts.bold, color: colors.text }} numberOfLines={1}>
                {warehouses.find(w => w.id === selectedWarehouseId)?.name || t('inv.all_warehouses')}
              </AppText>
            </TouchableOpacity>
          </Animated.View>

          {/* Vault Hero Section */}
          <View style={styles.heroSection}>
              <View style={styles.vaultCard}>
              <View style={styles.vaultTop}>
                <View>
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.vaultLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inv.portfolio_valuation')}</AppText>
<View style={styles.valueRow}>
                     <TouchableOpacity
                       activeOpacity={0.7}
                       onPress={() => {
                         if (!hideMetrics && summary?.totalValue) {
                           dialog.alert({
                             title: t('inv.portfolio_valuation'),
                             message: `${summary.totalValue.toLocaleString()} ${t('common.etb')}`,
                             confirmText: t('common.ok'),
                           });
                         }
                       }}
                       style={{ flexShrink: 1 }}
                     >
                      <AppText
                       variant="display-lg"
                       weight="black"
                       shrink={false}
                       style={[styles.vaultValue, { color: colors.text, fontFamily: Fonts.black }]}
                       numberOfLines={1}
                      >
                        {hideMetrics ? '••••••' : (summary?.totalValue.toLocaleString() || '0')}
                      </AppText>
                     </TouchableOpacity>
                      <AppText variant="heading" weight="bold" style={[{ color: colors.textSecondary, fontFamily: Fonts.bold, flexShrink: 0 }]} numberOfLines={1}>
                        {hideMetrics ? '' : t('common.etb')}
                      </AppText>
                      <TouchableOpacity
                        onPress={toggleMetrics}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={[styles.vaultEyeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        {hideMetrics ? <Eye size={18} color={colors.text} strokeWidth={2.25} /> : <EyeOff size={18} color={colors.text} strokeWidth={2.25} />}
                      </TouchableOpacity>
                     </View>
                </View>
                <TouchableOpacity 
                  onPress={() => setShowHealthModal(true)}
                  style={[styles.healthBadge, { marginTop: 12, backgroundColor: (summary?.stockHealth || 100) > 80 ? (colors.success + '15') : (colors.primary + '15') }]}
                >
                  <ShieldCheck size={12} color={(summary?.stockHealth || 100) > 80 ? (colors.success) : (colors.primary)} />
                  <AppText variant="caption" weight="bold" numberOfLines={1} style={[styles.healthText, { color: (summary?.stockHealth || 100) > 80 ? (colors.success) : (colors.primary), maxWidth: 80 }]}>
                    {t('inv.healthy_status', { percent: (summary?.stockHealth || 100).toString() })}
                  </AppText>
                </TouchableOpacity>
              </View>

              <View style={styles.vaultMetricGrid}>
                <View style={styles.miniMetric}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.miniLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inv.assets')}</AppText>
                  <AppText variant="title" weight="bold" shrink={false} style={[styles.miniValue, { color: colors.text }]} numberOfLines={1}>{summary?.totalItems || 0}</AppText>
                </View>
                <View style={styles.miniDivider} />
                <View style={styles.miniMetric}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.miniLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inv.restock')}</AppText>
                  <AppText variant="title" weight="bold" shrink={false} style={[styles.miniValue, { color: colors.primary }]} numberOfLines={1}>{summary?.lowStockCount || 0}</AppText>
                </View>
                <View style={styles.miniDivider} />
                <View style={styles.miniMetric}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.miniLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inv.movement')}</AppText>
                   <AppText variant="title" weight="bold" shrink={false} style={[styles.miniValue, { color: colors.text }]} numberOfLines={1}>+{invCompStats?.diff || 0}</AppText>
                </View>
              </View>
            </View>
          </View>

           {/* Business Insights Bento */}
            <View style={styles.bentoSection}>
               {/* High Value Item Card - Clickable to Top 10 */}
               <View style={styles.bentoRow}>
                 <TouchableOpacity 
                   style={[styles.highValueCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                   activeOpacity={0.9}
                   onPress={() => {
                     const items = getTopHighestValueItems(10);
                     setTop10Items(items);
                     setShowTop10Modal(true);
                   }}
                 >
                 <Zap size={20} color={colors.primary} style={{ marginBottom: 12 }} />
                 <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.bentoLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inv.highest_value_asset')}</AppText>
                 <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.bentoMainVal, { color: colors.text }]}>{summary?.highestValueItem?.name || '---'}</AppText>
                 <AppText variant="body" weight="bold" style={[styles.bentoSubVal, { color: colors.primary }]} numberOfLines={1}>{summary?.highestValueItem?.value?.toLocaleString()} {t('common.etb')}</AppText>
                 </TouchableOpacity>
               </View>

               {/* Fast & Slow Moving - Side by Side */}
               <View style={styles.bentoRow}>
                 <TouchableOpacity 
                    style={[styles.smallBento, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      setMovingDetailType('fast');
                      const items = getMovingItemsWithFilters('fast', 'qty_desc');
                      setMovingDetailItems(items as any[]);
                      setMovingDetailFilter('qty_desc');
                      setShowMovingDetail(true);
                    }}
                  >
                   <TrendingUp size={20} color={colors.success || '#34C759'} style={{ marginBottom: 8 }} />
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.bentoLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inventory.fast_moving')}</AppText>
                   <AppText variant="body" weight="bold" style={[styles.bentoMainVal, { color: colors.text, fontSize: (invStats?.fastMoving || 0) >= 1000 ? 16 : 18 }]} numberOfLines={1}>{invStats?.fastMoving || 0}</AppText>
                 </TouchableOpacity>
                 <View style={{ width: 12 }} />
                 <TouchableOpacity 
                    style={[styles.smallBento, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      setMovingDetailType('slow');
                      const items = getMovingItemsWithFilters('slow', 'qty_asc');
                      setMovingDetailItems(items as any[]);
                      setMovingDetailFilter('qty_asc');
                      setShowMovingDetail(true);
                    }}
                  >
                     <TrendingDown size={20} color={colors.primary} style={{ marginBottom: 8 }} />
                     <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.bentoLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inventory.slow_moving')}</AppText>
                     <AppText variant="body" weight="bold" style={[styles.bentoMainVal, { color: colors.text, fontSize: (invStats?.slowMoving || 0) >= 1000 ? 16 : 18 }]} numberOfLines={1}>{invStats?.slowMoving || 0}</AppText>
                 </TouchableOpacity>
               </View>

               {/* Product Order Card */}
               <View style={styles.bentoRow}>
                 <TouchableOpacity 
                     style={[styles.smallBento, { backgroundColor: colors.card, borderColor: colors.border }]}
                     onPress={() => {
                       const low = getLowStockItems();
                       setOrderItems(low.map((item: any) => ({ ...item, orderQty: 10 }))); // Default order qty 10
                       setShowOrderModal(true);
                     }}
                   >
                    <ShoppingBag size={20} color={colors.primary} style={{ marginBottom: 8 }} />
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.bentoLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inventory.product_order')}</AppText>
                     <AppText variant="body" weight="bold" style={[styles.bentoMainVal, { color: colors.text, fontSize: (summary?.lowStockCount || 0) >= 1000 ? 16 : 18 }]} numberOfLines={1}>{summary?.lowStockCount || 0}</AppText>
                   </TouchableOpacity>
                </View>

               {/* Reorder Suggestions Card */}
               <View style={styles.bentoRow}>
                 <TouchableOpacity
                   style={[styles.smallBento, { backgroundColor: colors.card, borderColor: colors.border }]}
                   activeOpacity={0.9}
                   onPress={() => {
                     const reorder = getReorderSuggestions();
                     setReorderSuggestions(reorder);
                     if (reorder.length > 0) {
                       const items = reorder.map((r: any) => ({ ...r, orderQty: r.suggestedQty, name: r.name, id: r.id }));
                       setOrderItems(items);
                       setShowOrderModal(true);
                     } else {
                       dialog.alert({ title: t('inv.reorder_title'), message: t('inv.reorder_none'), confirmText: t('common.ok') });
                     }
                   }}
                 >
                   <ShoppingBag size={20} color={colors.primary} style={{ marginBottom: 8 }} />
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.bentoLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inv.reorder_title')}</AppText>
                   <AppText variant="body" weight="bold" style={[styles.bentoMainVal, { color: colors.text, fontSize: reorderSuggestions.length >= 100 ? 16 : 18 }]} numberOfLines={1}>{reorderSuggestions.length}</AppText>
                 </TouchableOpacity>
               </View>

               {/* Stock Transfer + Share Catalog Row */}
               <View style={styles.bentoRow}>
                 <TouchableOpacity
                   style={[styles.smallBento, { backgroundColor: colors.card, borderColor: colors.border }]}
                   activeOpacity={0.9}
                   onPress={() => {
                     setTransferSource(null);
                     setTransferDest(null);
                     setTransferItems([]);
                     setTransferQty({});
                     setShowTransferModal(true);
                   }}
                 >
                   <Warehouse size={20} color={colors.primary} style={{ marginBottom: 8 }} />
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.bentoLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inv.transfer_stock')}</AppText>
                 </TouchableOpacity>
                 <View style={{ width: 12 }} />
                 <TouchableOpacity
                   style={[styles.smallBento, { backgroundColor: colors.card, borderColor: colors.border }]}
                   activeOpacity={0.9}
                   onPress={async () => {
                     if (catalogGenerating) return;
                     setCatalogGenerating(true);
                     try {
                       const allItems = getItems();
                       const business = { businessName: userProfile.businessName || '' };
                       await generateProductListPDF(allItems, business as any, language, 'share');
                     } catch (e) {
                       console.error('Catalog error:', e);
                     }
                     setCatalogGenerating(false);
                   }}
                 >
                   <Download size={20} color={colors.primary} style={{ marginBottom: 8 }} />
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.bentoLabel, { color: colors.textSecondary }]} numberOfLines={1}>{catalogGenerating ? t('common.loading') : t('inv.share_catalog')}</AppText>
                 </TouchableOpacity>
               </View>

               {/* Category Distribution - Fixed percentages */}
               <View style={styles.bentoRow}>
                 <TouchableOpacity 
                    style={[styles.categoryBento, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => setActiveQuickStatus('stockCategory')}
                  >
                   <View style={styles.bentoHeaderRow}>
                     <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.bentoLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inv.category_distribution')}</AppText>
                     <BarChart3 size={16} color={colors.textSecondary} />
                   </View>
                   <View style={styles.categoryDistribution}>
                     {summary?.categories?.slice(0, 3).map((cat: any, idx: number) => {
                       const totalVal = summary?.totalValue || 1;
                       const pct = totalVal > 0 ? Math.round((cat.value / totalVal) * 100) : 0;
                       return (
                         <View key={idx} style={styles.catDistributionItem}>
                           <View style={[styles.catBarBack, { backgroundColor: colors.surface }]}>
                             <View style={[styles.catBarFill, { backgroundColor: colors.text, width: `${Math.min(pct, 100)}%` }]} />
                           </View>
                           <View style={styles.catLabelRow}>
                              <AppText variant="body" weight="medium" style={[styles.catNameText, { color: colors.text }]} numberOfLines={1}>
                                {cat.name ? t(cat.name.toLowerCase().startsWith('category.') ? cat.name.toLowerCase() : 'category.' + cat.name.toLowerCase()) : t('common.general')}
                              </AppText>
                              <AppText variant="body" weight="bold" style={[styles.catValueText, { color: colors.textSecondary }]} numberOfLines={1}>{pct}%</AppText>
                           </View>
                         </View>
                       );
                     })}
                   </View>
                 </TouchableOpacity>
               </View>
             </View>

          {/* Action Ledger Section */}
          <View style={styles.ledgerSection}>
            <View style={styles.sectionHeader}>
              <View>
                <AppText variant="heading" weight="bold" style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={2}>{t('inv.stock_ledger')}</AppText>
                <AppText variant="body-sm" weight="medium" style={[styles.sectionSub, { color: colors.textSecondary }]} numberOfLines={2}>{t('inv.ledger_subtitle')}</AppText>
              </View>
              <TouchableOpacity onPress={() => setShowInventoryRecord(true)}>
                <AppText variant="body" weight="bold" shrink={false} style={[styles.viewAllBtn, { color: colors.primary }]} numberOfLines={1}>{t('common.view_all')}</AppText>
              </TouchableOpacity>
            </View>

            <View style={styles.ledgerList}>
              {recentItems.map((item, idx) => (
                <Animated.View key={item.id} entering={FadeInDown.delay(300 + (idx * 50)).duration(500)}>
                  <InventoryLedgerItem 
                    item={item} 
                    onPress={() => {
                      setSelectedItem(item);
                      setShowItemDetails(true);
                    }} 
                  />
                </Animated.View>
              ))}
              {recentItems.length === 0 && (
                <View style={styles.emptyState}>
                  <Package size={48} color={colors.border} />
                  <AppText variant="body" weight="medium" style={[styles.emptyText, { color: colors.textSecondary }]} numberOfLines={2}>{t('inv.vault_empty_state')}</AppText>
                </View>
              )}
            </View>
          </View>

        </ScrollView>
      </Animated.View>

      {/* Expanding Smart FAB */}
      <View style={styles.dockedBarWrapper}>
        <Animated.View style={[expandStyle, { height: 56, borderRadius: 28, overflow: 'hidden' }]}>
          <BlurView intensity={80} tint={theme !== 'light' ? 'dark' : 'light'} style={[styles.dockedBar, { borderColor: colors.border, paddingHorizontal: isBarExpanded ? 10 : 0 }]}>
            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                <TouchableOpacity style={styles.dockBtn} onPress={() => { setShowInventoryRecord(true); setIsBarExpanded(false); }}>
                  <Search size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}
            
            <TouchableOpacity 
              style={[styles.dockMainBtn, { backgroundColor: isBarExpanded ? colors.primary : colors.text }]} 
              onPress={() => {
                if(isBarExpanded) {
                  setShowAddForm(true);
                  setIsBarExpanded(false);
                } else {
                  setIsBarExpanded(true);
                }
              }}
            >
              <Plus size={24} color={isBarExpanded ? colors.background : colors.background} strokeWidth={2.5} />
            </TouchableOpacity>
            
            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                <TouchableOpacity style={styles.dockBtn} onPress={() => { setShowOnCreditModal(true); setIsBarExpanded(false); }}>
                   <Handshake size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}
          </BlurView>
        </Animated.View>
      </View>

      {/* View Stocks Bottom Sheet */}
      <Modal
        visible={showInventoryRecord}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInventoryRecord(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowInventoryRecord(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <InventoryRecordScreen />
          </View>
        </View>
      </Modal>

      {/* Add Item Bottom Sheet */}
      <Modal
        visible={showAddForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddForm(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowAddForm(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <AddAssetFlow 
              onSuccess={() => {
                setShowAddForm(false);
                loadRecentItems();
              }} 
              onClose={() => setShowAddForm(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Item Details Bottom Sheet */}
      <Modal
        visible={showItemDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setShowItemDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowItemDetails(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.85, maxHeight: undefined }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <ItemDetailsScreen 
              item={selectedItem!} 
              onClose={() => {
                setShowItemDetails(false);
                loadAllData();
              }} 
            />
          </View>
        </View>
      </Modal>

      {/* Quick Status Bottom Sheet */}
      <Modal
        visible={activeQuickStatus !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveQuickStatus(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setActiveQuickStatus(null)} />
          <View style={[styles.quickStatusSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
                  <AppText variant="heading" weight="bold" style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={2}>
                  {activeQuickStatus === 'lowStock' ? t('inv.quantity_left_title') || 'Quantity Left'
                : activeQuickStatus === 'expiring' ? t('inv.expiring_items_title')
                : activeQuickStatus === 'stockCategory' ? t('inv.stock_by_category_title')
                : activeQuickStatus === 'fastMoving' ? t('inv.fast_moving_items_title')
                : t('inv.slow_moving_items_title')}
            </AppText>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {/* Low Stock Items */}
              {activeQuickStatus === 'lowStock' && lowStockItems.map(item => (
                <AppListItem
                  key={item.id}
                  left={
                    <View style={[styles.qsIconBox, { backgroundColor: colors.text }]}>
                      <Package size={20} color={colors.background} />
                    </View>
                  }
                  title={item.name}
                  subtitle={`${item.totalBaseQuantity} ${t('form.' + (item.baseUnit || 'pieces').toLowerCase())} ${t('inv.left_suffix')}`}
                  titleMaxLines={2}
                  subtitleMaxLines={1}
                  right={
                    <View style={[styles.qsBadge, item.totalBaseQuantity <= 0 ? [styles.qsBadgeDark, { backgroundColor: colors.text }] : [styles.qsBadgeLight, { backgroundColor: colors.border }]]}>
                      <AppText variant="micro" weight="bold" shrink={false} style={[styles.qsBadgeText, { color: item.totalBaseQuantity <= 0 ? colors.background : colors.text }]} numberOfLines={1}>
                        {item.totalBaseQuantity <= 0 ? t('inventory.out_of_stock') : t('inv.low_stock')}
                      </AppText>
                    </View>
                  }
                  onPress={() => {
                    setSelectedItem(item);
                    setActiveQuickStatus(null);
                    setShowItemDetails(true);
                  }}
                  noBorder
                  padding={Spacing.md}
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: BorderRadius.lg,
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.05)',
                    marginBottom: Spacing.sm,
                  }}
                />
              ))}
              {activeQuickStatus === 'lowStock' && lowStockItems.length === 0 && (
                <AppText variant="caption" weight="medium" style={[styles.emptyStatsText, { color: colors.textSecondary, textAlign: 'center', marginTop: 20 }]} numberOfLines={2}>{t('inv.no_low_stock')}</AppText>
              )}

              {/* Expiring Items */}
              {activeQuickStatus === 'expiring' && expiringItems.map(item => {
                const daysDiff = Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / 86400000);
                const urgent = daysDiff < 7;
                return (
                  <AppListItem
                    key={item.id}
                    left={
                      <View style={[styles.qsIconBox, { backgroundColor: colors.text }]}>
                        <Package size={20} color={colors.background} />
                      </View>
                    }
                    title={item.name}
                    subtitle={t('inv.expires_in', { days: daysDiff.toString() })}
                    titleMaxLines={2}
                    subtitleMaxLines={1}
                    right={
                      <View style={[styles.qsBadge, urgent ? [styles.qsBadgeDark, { backgroundColor: colors.text }] : [styles.qsBadgeLight, { backgroundColor: colors.border }]]}>
                        <AppText variant="micro" weight="bold" shrink={false} style={[styles.qsBadgeText, { color: urgent ? colors.background : colors.text }]} numberOfLines={1}>
                          {urgent ? t('inv.urgent_label') : t('inv.soon_label')}
                        </AppText>
                      </View>
                    }
                    onPress={() => {
                      setSelectedItem(item);
                      setActiveQuickStatus(null);
                      setShowItemDetails(true);
                    }}
                    noBorder
                    padding={Spacing.md}
                    style={{
                      backgroundColor: colors.background,
                      borderRadius: BorderRadius.lg,
                      borderWidth: 1,
                      borderColor: 'rgba(0,0,0,0.05)',
                      marginBottom: Spacing.sm,
                    }}
                  />
                );
              })}
              {activeQuickStatus === 'expiring' && expiringItems.length === 0 && (
                <AppText variant="caption" weight="medium" style={[styles.emptyStatsText, { color: colors.textSecondary, textAlign: 'center', marginTop: 20 }]} numberOfLines={2}>{t('inv.no_expiring')}</AppText>
              )}

              {/* Stock by Category */}
              {activeQuickStatus === 'stockCategory' && (summary?.categories || []).map((item: any, idx: number) => (
                <CategoryBarRow key={idx} item={item} idx={idx} />
              ))}
              {activeQuickStatus === 'stockCategory' && (!summary?.categories || summary.categories.length === 0) && summary && (
                <AppText variant="caption" weight="medium" style={[styles.emptyStatsText, { color: colors.textSecondary, textAlign: 'center', marginTop: 20 }]} numberOfLines={2}>{t('inv.no_categories')}</AppText>
              )}
              {activeQuickStatus === 'stockCategory' && !summary && (
                <CategoryBarSkeleton rows={3} />
              )}

              {/* Fast Moving */}
              {activeQuickStatus === 'fastMoving' && fastMovingItems.map(item => (
                <AppListItem
                  key={item.id}
                  left={
                    <View style={[styles.qsIconBox, { backgroundColor: colors.text }]}>
                      <TrendingUp size={18} color={colors.background} />
                    </View>
                  }
                  title={item.name}
                  subtitle={`${item.totalSales} ${t('inv.sold_week_suffix')}`}
                  titleMaxLines={2}
                  subtitleMaxLines={1}
                  onPress={() => {
                    setSelectedItem(item);
                    setActiveQuickStatus(null);
                    setShowItemDetails(true);
                  }}
                  noBorder
                  padding={Spacing.md}
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: BorderRadius.lg,
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.05)',
                    marginBottom: Spacing.sm,
                  }}
                />
              ))}
              {activeQuickStatus === 'fastMoving' && fastMovingItems.length === 0 && (
                <AppText variant="caption" weight="medium" style={[styles.emptyStatsText, { color: colors.textSecondary, textAlign: 'center', marginTop: 20 }]} numberOfLines={2}>{t('inv.no_fast_moving')}</AppText>
              )}

              {/* Slow Moving */}
              {activeQuickStatus === 'slowMoving' && slowMovingItems.map(item => (
                <AppListItem
                  key={item.id}
                  left={
                    <View style={[styles.qsIconBox, { backgroundColor: colors.text }]}>
                      <TrendingDown size={18} color={colors.background} />
                    </View>
                  }
                  title={item.name}
                  subtitle={`${item.totalQty} ${t('inv.sold_month_suffix')}`}
                  titleMaxLines={2}
                  subtitleMaxLines={1}
                  onPress={() => {
                    setSelectedItem(item);
                    setActiveQuickStatus(null);
                    setShowItemDetails(true);
                  }}
                  noBorder
                  padding={Spacing.md}
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: BorderRadius.lg,
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.05)',
                    marginBottom: Spacing.sm,
                  }}
                />
              ))}
              {activeQuickStatus === 'slowMoving' && slowMovingItems.length === 0 && (
                <AppText variant="caption" weight="medium" style={[styles.emptyStatsText, { color: colors.textSecondary, textAlign: 'center', marginTop: 20 }]} numberOfLines={2}>{t('inv.no_slow_moving')}</AppText>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Product Order Modal */}
      <Modal
        visible={showOrderModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOrderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowOrderModal(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: '80%' }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <View style={{ paddingHorizontal: 25, flex: 1 }}>
              <View style={styles.orderHeader}>
                <View>
                  <AppText variant="heading" weight="bold" style={[styles.sheetTitle, { color: colors.text, marginBottom: 2 }]} numberOfLines={2}>{t('inventory.create_order')}</AppText>
                  <AppText variant="body-sm" weight="medium" style={[styles.orderSub, { color: colors.textSecondary }]} numberOfLines={1}>{t('inventory.order_items_count', { count: orderItems.length.toString() })}</AppText>
                </View>
                <TouchableOpacity onPress={() => setShowOrderModal(false)}>
                   <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1, marginTop: 20 }} showsVerticalScrollIndicator={false}>
                {orderItems.map((item, idx) => (
                  <View key={item.id} style={[styles.orderItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                     <View style={{ flex: 1 }}>
                      <AppText variant="body-lg" weight="bold" style={[styles.orderItemName, { color: colors.text }]} numberOfLines={1}>{item.name}</AppText>
                      <AppText variant="caption" weight="medium" style={[styles.orderItemStock, { color: colors.textSecondary }]} numberOfLines={1}>{t('inv.current_stock')}: {item.totalBaseQuantity} {item.baseUnit}</AppText>
                    </View>
                    <View style={styles.qtyControl}>
                      <TouchableOpacity 
                        style={[styles.qtyBtn, { backgroundColor: colors.surface }]} 
                        onPress={() => {
                          const newItems = [...orderItems];
                          newItems[idx].orderQty = Math.max(0, newItems[idx].orderQty - 1);
                          setOrderItems(newItems);
                        }}
                      >
                        <AppText variant="body" weight="bold" style={{ color: colors.text, fontSize: 18 }} numberOfLines={1}>-</AppText>
                      </TouchableOpacity>
                      <AppText variant="body" weight="bold" style={[styles.qtyVal, { color: colors.text }]} numberOfLines={1}>{item.orderQty}</AppText>
                      <TouchableOpacity 
                        style={[styles.qtyBtn, { backgroundColor: colors.surface }]} 
                        onPress={() => {
                          const newItems = [...orderItems];
                          newItems[idx].orderQty += 1;
                          setOrderItems(newItems);
                        }}
                      >
                        <AppText variant="body" weight="bold" style={{ color: colors.text, fontSize: 18 }} numberOfLines={1}>+</AppText>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity 
                      style={{ marginLeft: 15 }} 
                      onPress={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}
                    >
                      <TrashIcon size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
                {orderItems.length === 0 && (
                  <View style={{ alignItems: 'center', marginTop: 50 }}>
                    <Package size={48} color={colors.border} />
                    <AppText variant="body" weight="medium" style={[styles.emptyText, { color: colors.textSecondary, marginTop: 15 }]} numberOfLines={2}>{t('inventory.no_order_items')}</AppText>
                  </View>
                )}
              </ScrollView>

              {/* Custom Order Section */}
              <View style={[styles.customOrderSection, { borderTopColor: colors.border }]}>
                <AppText variant="body-lg" weight="bold" style={[styles.customOrderTitle, { color: colors.text }]} numberOfLines={1}>{t('inventory.custom_order')}</AppText>
                <View style={styles.customOrderRow}>
                  <TextInput
                    style={[styles.customOrderInput, { color: colors.text, borderColor: colors.border, flex: 2, marginRight: 8 }]}
                    placeholder={t('inv.item_name_ph')}
                    placeholderTextColor={colors.textSecondary}
                    value={customOrderName}
                    onChangeText={setCustomOrderName}
                  />
                  <TextInput
                    style={[styles.customOrderInput, { color: colors.text, borderColor: colors.border, flex: 1, marginRight: 8 }]}
                    placeholder={t('inv.qty_ph')}
                    placeholderTextColor={colors.textSecondary}
                    value={customOrderQty}
                    onChangeText={setCustomOrderQty}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={[styles.customOrderAddBtn, { backgroundColor: colors.text }]}
                    onPress={() => {
                      if (customOrderName.trim() && Number(customOrderQty) > 0) {
                        setOrderItems([...orderItems, {
                          id: Date.now(),
                          name: customOrderName.trim(),
                          totalBaseQuantity: 0,
                          baseUnit: 'pcs',
                          orderQty: Number(customOrderQty),
                          notes: customOrderNotes.trim(),
                          isCustom: true
                        }]);
                        setCustomOrderName('');
                        setCustomOrderQty('1');
                        setCustomOrderNotes('');
                      }
                    }}
                  >
                    <Plus size={18} color={colors.background} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.customOrderInput, { color: colors.text, borderColor: colors.border, marginTop: 8 }]}
                  placeholder={t('inv.notes_optional')}
                  placeholderTextColor={colors.textSecondary}
                  value={customOrderNotes}
                  onChangeText={setCustomOrderNotes}
                />
              </View>

              <View style={{ paddingVertical: 20 }}>
                <TouchableOpacity 
                  disabled={orderItems.length === 0}
                  style={[styles.orderSubmitBtn, { backgroundColor: colors.text, opacity: orderItems.length === 0 ? 0.5 : 1 }]}
                  onPress={async () => {
                    const allItems = orderItems.map(item => 
                      item.isCustom 
                        ? `${item.name} - Qty: ${item.orderQty}${item.notes ? ` (${item.notes})` : ''}`
                        : `${item.name} - Stock: ${item.totalBaseQuantity} ${item.baseUnit}, Order: ${item.orderQty} ${item.baseUnit}`
                    ).join('\n');
                    
                    try {
                      const html = `
                        <html>
                          <head>
                            <style>
                              body { font-family: Helvetica; padding: 20px; }
                              h1 { text-align: center; color: #333; }
                              p { color: #666; }
                              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                              th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                              th { background-color: #f2f2f2; color: #333; }
                            </style>
                          </head>
                          <body>
                            <h1>Product Order List</h1>
                            <p>Date: ${new Date().toLocaleDateString()}</p>
                            <p>Total Items: ${orderItems.length}</p>
                            <table>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Item Name</th>
                                  <th>Order Quantity</th>
                                  <th>Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${orderItems.map((item, idx) => `
                                  <tr>
                                    <td>${idx + 1}</td>
                                    <td>${item.name}</td>
                                    <td>${item.orderQty}</td>
                                    <td>${item.notes || (item.isCustom ? '' : `${item.totalBaseQuantity} ${item.baseUnit} in stock`)}</td>
                                  </tr>
                                `).join('')}
                              </tbody>
                            </table>
                          </body>
                        </html>
                      `;
                      const { uri } = await Print.printToFileAsync({ html });
                      await Sharing.shareAsync(uri);
                      setShowOrderModal(false);
                    } catch (e) {
                      console.error('Export error:', e);
                      // Fallback: share as text
                      try {
                        await Sharing.shareAsync(`data:text/plain;base64,${btoa(allItems)}`);
                      } catch (e2) {
                        console.error('Fallback export error:', e2);
                        await dialog.alert({ title: t('common.error'), message: t('inventory.export_failed'), iconType: 'danger' });
                      }
                    }
                  }}
                >
                  <Download size={20} color={colors.background} style={{ marginRight: 10 }} />
                  <AppText variant="body" weight="bold" style={[styles.orderSubmitText, { color: colors.background }]} numberOfLines={1}>{t('inventory.export_order')}</AppText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Top 10 Highest Value Items Modal */}
      <Modal
        visible={showTop10Modal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTop10Modal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowTop10Modal(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: '80%' }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <View style={{ paddingHorizontal: 25, flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <AppText variant="heading" weight="bold" style={[styles.sheetTitle, { color: colors.text, marginBottom: 0 }]} numberOfLines={2}>{t('inv.top_10_highest_value')}</AppText>
                <TouchableOpacity onPress={() => setShowTop10Modal(false)}>
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {top10Items.map((item, idx) => (
                  <AppListItem
                    key={item.id}
                    left={
                      <View style={[styles.rankBadge, { backgroundColor: colors.text }]}>
                        <AppText variant="body" weight="bold" shrink={false} style={[styles.rankText, { color: colors.background }]}>{idx + 1}</AppText>
                      </View>
                    }
                    title={item.name}
                    subtitle={`${item.categoryName} \u2022 ${item.totalBaseQuantity} ${item.baseUnit}`}
                    titleMaxLines={2}
                    subtitleMaxLines={1}
                    rightText={`${item.totalValue?.toLocaleString()} ${t('common.etb')}`}
                    rightColor={colors.primary}
                    onPress={() => {
                      setSelectedItem(item);
                      setShowTop10Modal(false);
                      setShowItemDetails(true);
                    }}
                    noBorder
                    padding={Spacing.md}
                    style={{
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: BorderRadius.lg,
                      marginBottom: Spacing.sm,
                    }}
                  />
                ))}
                {top10Items.length === 0 && (
                  <View style={{ alignItems: 'center', marginTop: 50 }}>
                    <Package size={48} color={colors.border} />
                    <AppText variant="body" weight="medium" style={[styles.emptyText, { color: colors.textSecondary, marginTop: 15 }]} numberOfLines={2}>{t('inv.no_items_found')}</AppText>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* Moving Detail Modal */}
      <Modal
        visible={showMovingDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMovingDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowMovingDetail(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: '85%' }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <View style={{ paddingHorizontal: 25, flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <AppText variant="heading" weight="bold" style={[styles.sheetTitle, { color: colors.text, marginBottom: 0 }]} numberOfLines={2}>
                  {movingDetailType === 'fast' ? t('inventory.fast_moving') : t('inventory.slow_moving')}
                </AppText>
                <TouchableOpacity onPress={() => setShowMovingDetail(false)}>
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['qty_desc', 'qty_asc', 'category', 'today', 'week', 'month', 'year'] as const).map(f => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.filterChip, { 
                        backgroundColor: movingDetailFilter === f ? colors.text : colors.card,
                        borderColor: colors.border
                      }]}
                      onPress={() => {
                        setMovingDetailFilter(f);
                        const items = getMovingItemsWithFilters(movingDetailType, f);
                        setMovingDetailItems(items as any[]);
                      }}
                    >
                <AppText variant="caption" weight="bold" shrink={false} style={[styles.filterChipText, {
                  color: movingDetailFilter === f ? colors.background : colors.text
                }]} numberOfLines={1}>
                        {f === 'qty_desc' ? t('inv.sort_highest_price') :
                         f === 'qty_asc' ? t('inv.sort_lowest_price') :
                         f === 'category' ? t('inv.filter_category') :
                         f === 'today' ? t('common.today') :
                         f === 'week' ? t('inv.filter_this_week') :
                         f === 'month' ? t('inv.filter_this_month') : t('inv.filter_this_year')}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <ScrollView showsVerticalScrollIndicator={false}>
                {movingDetailItems.map((item: any, idx: number) => (
                  <AppListItem
                    key={item.id || idx}
                    left={
                      <View style={[styles.qsIconBox, { backgroundColor: colors.text }]}>
                        {movingDetailType === 'fast'
                          ? <TrendingUp size={18} color={colors.background} />
                          : <TrendingDown size={18} color={colors.background} />
                        }
                      </View>
                    }
                    title={item.name || item.categoryName || 'General'}
                    subtitle={t('inv.units_moved', { count: String(item.totalQty || item.totalSales || 0) })}
                    titleMaxLines={2}
                    subtitleMaxLines={1}
                    rightText={String(item.totalQty || item.totalSales || 0)}
                    rightColor={movingDetailType === 'fast' ? '#34C759' : colors.primary}
                    noBorder
                    padding={Spacing.md}
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: BorderRadius.lg,
                      borderWidth: 1,
                      borderColor: 'rgba(0,0,0,0.05)',
                      marginBottom: Spacing.sm,
                    }}
                  />
                ))}
                {movingDetailItems.length === 0 && (
                  <View style={{ alignItems: 'center', marginTop: 50 }}>
                    <Package size={48} color={colors.border} />
                    <AppText variant="body" weight="medium" style={[styles.emptyText, { color: colors.textSecondary, marginTop: 15 }]} numberOfLines={2}>{t('inv.no_items_found')}</AppText>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* On-Credit List Modal */}
      <Modal
        visible={showOnCreditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOnCreditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowOnCreditModal(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.85 }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <OnCreditListScreen />
          </View>
        </View>
      </Modal>

      {/* Inventory Health Modal */}
      <Modal
        visible={showHealthModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHealthModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowHealthModal(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.8 }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            
            <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <AppText variant="title" weight="bold" style={{ fontSize: 20, fontFamily: Fonts.bold, color: colors.text }} numberOfLines={1}>{t('inv.stock_health_score')}</AppText>
                <TouchableOpacity onPress={() => setShowHealthModal(false)}>
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={{ alignItems: 'center', marginVertical: 20, padding: 20, borderRadius: 16, backgroundColor: colors.surface }}>
                <AppText variant="hero" weight="extrabold" style={{ fontSize: 48, fontFamily: Fonts.bold, color: (summary?.stockHealth || 100) > 80 ? colors.success : colors.primary }} numberOfLines={1}>
                  {summary?.stockHealth || 100}%
                </AppText>
                <AppText variant="body" weight="bold" style={{ fontSize: 16, fontFamily: Fonts.bold, color: colors.text, marginTop: 8 }} numberOfLines={1}>
                  {(summary?.stockHealth || 100) === 100 ? t('inv.health_optimal') : t('inv.health_action')}
                </AppText>
                <AppText variant="caption" weight="medium" style={{ fontSize: 12, fontFamily: Fonts.medium, color: colors.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 10 }} numberOfLines={3}>
                  {t('inv.health_description')}
                </AppText>
              </View>

              <AppText variant="body" weight="bold" style={{ fontSize: 16, fontFamily: Fonts.bold, color: colors.text, marginBottom: 12 }} numberOfLines={1}>
                {t('inv.low_stock_items', { count: String(lowStockItems.length) })}
              </AppText>

              <FlatList
                data={lowStockItems}
                keyExtractor={keyExtractor}
                style={{ flex: 1, marginBottom: 20 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
                initialNumToRender={10}
                maxToRenderPerBatch={6}
                windowSize={5}
                removeClippedSubviews={true}
                renderItem={renderLowStockItem}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <ShieldCheck size={48} color={colors.success} />
                    <AppText variant="body" weight="bold" style={{ fontSize: 14, fontFamily: Fonts.bold, color: colors.text, marginTop: 12 }} numberOfLines={1}>{t('inv.all_healthy')}</AppText>
                  </View>
                }
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Warehouse Manager Modal */}
      <WarehouseManagerModal
        visible={showWarehouseModal}
        onClose={() => setShowWarehouseModal(false)}
        selectedWarehouseId={selectedWarehouseId}
        onSelectWarehouse={(id) => {
          setSelectedWarehouseId(id);
          setShowWarehouseModal(false);
        }}
      />

      {/* Stock Transfer Modal */}
      <Modal visible={showTransferModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTransferModal(false)}>
        <View style={[styles.transferModal, { backgroundColor: colors.background }]}>
          <View style={styles.transferHeader}>
            <TouchableOpacity onPress={() => setShowTransferModal(false)}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <AppText variant="heading" weight="bold" style={{ color: colors.text }} numberOfLines={1}>{t('inv.transfer_title')}</AppText>
            <View style={{ width: 24 }} />
          </View>

          {!transferSource ? (
            <View style={styles.transferStep}>
              <AppText variant="body" weight="medium" style={{ color: colors.textSecondary, marginBottom: 16 }}>{t('inv.transfer_select_source')}</AppText>
              {warehouses.filter(w => !transferDest || w.id !== transferDest).map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.transferWarehouseItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setTransferSource(w.id)}
                >
                  <Warehouse size={20} color={colors.primary} />
                  <AppText variant="body" weight="bold" style={{ color: colors.text, flex: 1 }} numberOfLines={1}>{w.name}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          ) : !transferDest ? (
            <View style={styles.transferStep}>
              <View style={styles.transferBackRow}>
                <TouchableOpacity onPress={() => setTransferSource(null)}>
                  <AppText variant="body" weight="bold" style={{ color: colors.primary }}>{t('common.back')}</AppText>
                </TouchableOpacity>
              </View>
              <AppText variant="body" weight="medium" style={{ color: colors.textSecondary, marginVertical: 16 }}>{t('inv.transfer_select_dest')}</AppText>
              {warehouses.filter(w => w.id !== transferSource).map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.transferWarehouseItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setTransferDest(w.id)}
                >
                  <Warehouse size={20} color={colors.primary} />
                  <AppText variant="body" weight="bold" style={{ color: colors.text, flex: 1 }} numberOfLines={1}>{w.name}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.transferStep}>
              <View style={styles.transferBackRow}>
                <TouchableOpacity onPress={() => setTransferDest(null)}>
                  <AppText variant="body" weight="bold" style={{ color: colors.primary }}>{t('common.back')}</AppText>
                </TouchableOpacity>
              </View>
              <AppText variant="body" weight="bold" style={{ color: colors.text, marginBottom: 4 }}>{t('inv.transfer_select_items')}</AppText>
              <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
                {warehouses.find(w => w.id === transferSource)?.name} → {warehouses.find(w => w.id === transferDest)?.name}
              </AppText>
              <ScrollView style={{ flex: 1 }}>
                {getItems().filter((i: any) => i.warehouseId === transferSource && i.totalBaseQuantity > 0).map((item: any) => (
                  <View key={item.id} style={[styles.transferItemRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="body" weight="bold" style={{ color: colors.text }} numberOfLines={1}>{item.name}</AppText>
                      <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }} numberOfLines={1}>{t('inv.current_stock')}: {item.totalBaseQuantity} {item.baseUnit}</AppText>
                    </View>
                    <View style={styles.qtyControl}>
                      <TouchableOpacity
                        style={[styles.qtyBtn, { backgroundColor: colors.surface }]}
                        onPress={() => setTransferQty(p => ({ ...p, [String(item.id)]: Math.max(0, (p[String(item.id)] || 0) - 1) }))}
                      >
                        <AppText variant="body" weight="bold" style={{ color: colors.text, fontSize: 18 }} numberOfLines={1}>-</AppText>
                      </TouchableOpacity>
                      <AppText variant="body" weight="bold" style={[styles.qtyVal, { color: colors.text }]} numberOfLines={1}>{transferQty[String(item.id)] || 0}</AppText>
                      <TouchableOpacity
                        style={[styles.qtyBtn, { backgroundColor: colors.surface }]}
                        onPress={() => setTransferQty(p => ({ ...p, [String(item.id)]: Math.min(item.totalBaseQuantity, (p[String(item.id)] || 0) + 1) }))}
                      >
                        <AppText variant="body" weight="bold" style={{ color: colors.text, fontSize: 18 }} numberOfLines={1}>+</AppText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.transferSubmitBtn, { backgroundColor: colors.primary, opacity: Object.keys(transferQty).some(k => transferQty[k] > 0) ? 1 : 0.5 }]}
                disabled={!Object.keys(transferQty).some(k => transferQty[k] > 0)}
                onPress={async () => {
                  const transfers = Object.entries(transferQty)
                    .filter(([_, qty]) => qty > 0)
                    .map(([itemId, qty]) => ({ itemId: Number(itemId), quantity: qty }));
                  if (transfers.length === 0) return;
                  const ok = await dialog.confirm({
                    title: t('inv.transfer_confirm_title'),
                    message: t('inv.transfer_confirm_msg', {
                      count: transfers.length.toString(),
                      from: warehouses.find(w => w.id === transferSource)?.name || '',
                      to: warehouses.find(w => w.id === transferDest)?.name || '',
                    }),
                    confirmText: t('common.proceed'),
                    cancelText: t('common.cancel'),
                  });
                  if (ok) {
                    const success = transferStock(transferSource!, transferDest!, transfers);
                    if (success) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setShowTransferModal(false);
                      loadAllData();
                    } else {
                      dialog.alert({ title: t('common.error'), message: t('inv.transfer_failed'), iconType: 'danger', confirmText: t('common.ok') });
                    }
                  }
                }}
              >
                <AppText variant="body" weight="bold" style={{ color: '#FFF' }}>{t('inv.transfer_execute', { count: Object.keys(transferQty).filter(k => transferQty[k] > 0).length.toString() })}</AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 220,
    paddingTop: 10,
  },
  bgWash: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    transform: [{ scale: 1.5 }],
    opacity: 0.2,
  },
  topBar: {
    paddingHorizontal: 25,
    paddingTop: 65,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenHeader: {
    paddingHorizontal: 25,
    paddingTop: 10,
    paddingBottom: 35,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  notifBadgeText: {
    color: '#FFF',
    fontFamily: Fonts.bold,
  },
  headerLabel: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    opacity: 0.7
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    letterSpacing: -1,
    lineHeight: 46,
  },
  headerAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  heroSection: {
    paddingHorizontal: 25,
    marginBottom: 25,
  },
  vaultCard: {
    borderRadius: 30,
    padding: 25,
    backgroundColor: 'rgba(0,0,0,0.03)', // Custom card tint or use white with elevation
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  vaultTop: {
    marginBottom: 25,
  },
  vaultLabel: {
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  vaultValue: {
    fontFamily: Fonts.extrabold,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  vaultEyeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 5,
  },
  healthText: {
    fontFamily: Fonts.bold,
  },
  vaultMetricGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  miniMetric: {
    alignItems: 'center',
    flex: 1,
  },
  miniLabel: {
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  miniValue: {
    fontFamily: Fonts.bold,
  },
  miniDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  bentoSection: {
    paddingHorizontal: 25,
    marginBottom: 30,
  },
  bentoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  highValueCard: {
    flex: 1.4,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  smallBento: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    justifyContent: 'center',
  },
  categoryBento: {
    flex: 1.4,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  bentoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  bentoLabel: {
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
  },
  bentoMainVal: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  bentoSubVal: {
    fontFamily: Fonts.bold,
  },
  categoryDistribution: {
    gap: 12,
  },
  catDistributionItem: {
    gap: 6,
  },
  catBarBack: {
    height: 4,
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  catLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catNameText: {
    fontFamily: Fonts.medium,
  },
  catValueText: {
    fontFamily: Fonts.bold,
  },
  ledgerSection: {
    paddingHorizontal: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
  },
  sectionSub: {
    fontFamily: Fonts.medium,
    marginTop: 4,
  },
  viewAllBtn: {
    fontFamily: Fonts.bold,
  },
  ledgerList: {
    gap: 4,
  },
  ledgerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  ledgerIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  ledgerMain: {
    flex: 1,
  },
  ledgerName: {
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  ledgerCategory: {
    fontFamily: Fonts.medium,
  },
  ledgerEnd: {
    alignItems: 'flex-end',
  },
  ledgerQty: {
    fontFamily: Fonts.bold,
    marginBottom: 6,
  },
  ledgerStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ledgerStatusText: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 15,
  },
  emptyText: {
    fontFamily: Fonts.medium,
  },
  emptyStatsText: { fontSize: 13, fontFamily: Fonts.medium },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10 },
  orderSub: { fontSize: 13, fontFamily: Fonts.medium },
  orderItemCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 18, borderWidth: 1, marginBottom: 12 },
  orderItemName: { fontSize: 15, fontFamily: Fonts.bold, marginBottom: 2 },
  orderItemStock: { fontSize: 12, fontFamily: Fonts.medium },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  qtyVal: { fontSize: 16, fontFamily: Fonts.bold, minWidth: 25, textAlign: 'center' },
  orderSubmitBtn: { flexDirection: 'row', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  orderSubmitText: { fontSize: 16, fontFamily: Fonts.bold },
  dockedBarWrapper: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockedBar: {
    flex: 1,
    borderRadius: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 10,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  dockBtn: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dockMainBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 40,
    height: Dimensions.get('window').height * 0.85,
    overflow: 'hidden',
  },
  modalHandleRow: {
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  quickStatusSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 40,
    maxHeight: Dimensions.get('window').height * 0.7,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  sheetTitle: {
    fontFamily: Fonts.bold,
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  qsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  qsIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qsName: {
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  qsSub: {
    fontFamily: Fonts.medium,
  },
  qsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  qsBadgeDark: {},
  qsBadgeLight: {},
  qsBadgeText: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },
  customOrderSection: {
    borderTopWidth: 1,
    paddingTop: 15,
    marginTop: 10,
  },
  customOrderTitle: {
    fontFamily: Fonts.bold,
    marginBottom: 10,
  },
  customOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customOrderInput: {
    height: 45,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: Fonts.medium,
  },
  customOrderAddBtn: {
    width: 45,
    height: 45,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontFamily: Fonts.bold,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: Fonts.bold,
  },
  transferModal: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
  },
  transferHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  transferStep: {
    flex: 1,
    paddingHorizontal: 24,
  },
  transferBackRow: {
    marginBottom: 8,
  },
  transferWarehouseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  transferItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  transferSubmitBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
});

export default InventoryDashboard;