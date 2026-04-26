import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text as RNText,
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Modal, 
  Dimensions,
  RefreshControl,
  Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';
import { 
  Bell, 
  Search, 
  EyeOff, 
  ChevronLeft, 
  ChevronRight, 
  ShoppingCart, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Eye, 
  Plus,
  Zap,
  ShieldCheck,
  AlertCircle,
  BarChart3,
  Layers,
  ArrowUpRight,
  Filter
} from 'lucide-react-native';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp,
  useSharedValue,
  withSpring,
  useAnimatedStyle,
  FadeOut
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSidebar } from '@/context/SidebarContext';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import Svg, { Path, Circle } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { useNotifications } from '@/hooks/useNotifications';
import { router } from 'expo-router';
import InventoryRecordScreen from './inventory-record';
import AddAssetFlow from './inventroy-form';
import ItemDetailsScreen from './item-details';
import { 
  getRecentItems, 
  ItemData, 
  getInventoryStats, 
  getInventoryComparisonStats,
  getInventorySummary,
  getTopSellingItems,
  getLowStockItems,
  getSlowMovingItems,
  getExpiringItems
} from '@/database/db';

const SparklineChart = () => {
  const { colors } = useSettings();
  return (
    <Svg width="100" height="30" viewBox="0 0 100 40">
      <Path 
        d="M0 35 C15 35, 25 5, 40 20 C55 35, 75 15, 100 5" 
        stroke={colors.primary} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" 
      />
    </Svg>
  );
};

const InventoryLedgerItem = ({ item, onPress }: { item: ItemData, onPress: () => void }) => {
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
        <RNText style={[styles.ledgerName, { color: colors.text }]}>{item.name}</RNText>
        <RNText style={[styles.ledgerCategory, { color: colors.textSecondary }]}>
          {(item.categoryName ? t(item.categoryName.toLowerCase().startsWith('category.') ? item.categoryName.toLowerCase() : 'category.' + item.categoryName.toLowerCase()) : t('common.general'))} • {t('form.' + (item.baseUnit || 'pieces').toLowerCase())}
        </RNText>
      </View>
      <View style={styles.ledgerEnd}>
        <RNText style={[styles.ledgerQty, { color: isLow ? colors.primary : colors.text }]}>
          {item.totalBaseQuantity} {t('form.' + (item.baseUnit || 'pieces').toLowerCase())}
        </RNText>
        <View style={[styles.ledgerStatus, { backgroundColor: isLow ? (colors.primary + '15') : (colors.success + '15') }]}>
          <RNText style={[styles.ledgerStatusText, { color: isLow ? colors.primary : colors.success }]}>
            {isLow ? t('inv.low_stock') : t('inv.in_stock_label')}
          </RNText>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const InventoryDashboard = () => {
  const { openSidebar } = useSidebar();
  const { userProfile, colors, t, theme } = useSettings();
  const { notifCount } = useNotifications();
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

  const loadAllData = useCallback(() => {
    loadRecentItems();
    const stats = getInventoryStats();
    if (stats) setInvStats(stats);
    
    const compStats = getInventoryComparisonStats();
    if (compStats) setInvCompStats(compStats);

    const invSummary = getInventorySummary();
    setSummary(invSummary);

    const lowItems = getLowStockItems();
    setLowStockItems(lowItems);

    const topSelling = getTopSellingItems(10);
    setFastMovingItems(topSelling);

    const slowItems = getSlowMovingItems(10);
    setSlowMovingItems(slowItems);

    const expiring = getExpiringItems(30);
    setExpiringItems(expiring);
  }, []);

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
    const items = getRecentItems(10) as ItemData[];
    setRecentItems(items);
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
                <Image source={PROFILE_IMAGES[userProfile.avatarIndex]} style={styles.headerAvatar} />
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
                     <RNText style={styles.notifBadgeText}>{notifCount}</RNText>
                   </View>
                 )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero Page Header */}
          <Animated.View entering={FadeInDown.duration(600)} style={styles.screenHeader}>
            <RNText style={[styles.headerLabel, { color: colors.textSecondary }]}>{t('inv.inventory_management')}</RNText>
            <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('inv.stock_vault')}</RNText>
          </Animated.View>

          {/* Vault Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.vaultCard}>
              <View style={styles.vaultTop}>
                <View>
                  <RNText style={[styles.vaultLabel, { color: colors.textSecondary }]}>{t('inv.portfolio_valuation')}</RNText>
                  <TouchableOpacity onPress={toggleMetrics} style={styles.valueRow}>
                    <RNText style={[styles.vaultValue, { color: colors.text }]}>
                      {hideMetrics ? '••••••' : `${summary?.totalValue.toLocaleString() || '0'} ETB`}
                    </RNText>
                    {hideMetrics ? <Eye size={18} color={colors.textSecondary} /> : <EyeOff size={18} color={colors.textSecondary} />}
                  </TouchableOpacity>
                </View>
                <View style={[styles.healthBadge, { backgroundColor: (summary?.stockHealth || 100) > 80 ? (colors.success + '15') : (colors.primary + '15') }]}>
                  <ShieldCheck size={14} color={(summary?.stockHealth || 100) > 80 ? (colors.success) : (colors.primary)} />
                  <RNText style={[styles.healthText, { color: (summary?.stockHealth || 100) > 80 ? (colors.success) : (colors.primary) }]}>
                    {t('inv.healthy_status', { percent: (summary?.stockHealth || 100).toString() })}
                  </RNText>
                </View>
              </View>

              <View style={styles.vaultMetricGrid}>
                <View style={styles.miniMetric}>
                  <RNText style={[styles.miniLabel, { color: colors.textSecondary }]}>{t('inv.assets')}</RNText>
                  <RNText style={[styles.miniValue, { color: colors.text }]}>{summary?.totalItems || 0}</RNText>
                </View>
                <View style={styles.miniDivider} />
                <View style={styles.miniMetric}>
                  <RNText style={[styles.miniLabel, { color: colors.textSecondary }]}>{t('inv.restock')}</RNText>
                  <RNText style={[styles.miniValue, { color: colors.primary }]}>{summary?.lowStockCount || 0}</RNText>
                </View>
                <View style={styles.miniDivider} />
                <View style={styles.miniMetric}>
                  <RNText style={[styles.miniLabel, { color: colors.textSecondary }]}>{t('inv.movement')}</RNText>
                   <RNText style={[styles.miniValue, { color: colors.text }]}>+{invCompStats?.diff || 0}</RNText>
                </View>
              </View>
            </View>
          </View>

          {/* Business Insights Bento */}
          <View style={styles.bentoSection}>
             <View style={styles.bentoRow}>
               {/* High Value Item Card */}
               <TouchableOpacity 
                 style={[styles.highValueCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                 activeOpacity={0.9}
               >
                 <Zap size={20} color={colors.primary} style={{ marginBottom: 12 }} />
                 <RNText style={[styles.bentoLabel, { color: colors.textSecondary }]}>{t('inv.highest_value_asset')}</RNText>
                 <RNText numberOfLines={1} style={[styles.bentoMainVal, { color: colors.text }]}>{summary?.highestValueItem?.name || '---'}</RNText>
                 <RNText style={[styles.bentoSubVal, { color: colors.primary }]}>{summary?.highestValueItem?.value.toLocaleString()} ETB</RNText>
               </TouchableOpacity>

               {/* Fast Moving Card */}
               <TouchableOpacity 
                  style={[styles.smallBento, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setActiveQuickStatus('fastMoving')}
                >
                  <TrendingUp size={20} color={colors.success || '#34C759'} style={{ marginBottom: 8 }} />
                  <RNText style={[styles.bentoLabel, { color: colors.textSecondary }]}>{t('inventory.fast_moving')}</RNText>
                  <RNText style={[styles.bentoMainVal, { color: colors.text }]}>{invStats?.fastMoving || 0}</RNText>
               </TouchableOpacity>
             </View>

             <View style={styles.bentoRow}>
                {/* Categorization Map */}
                <TouchableOpacity 
                  style={[styles.categoryBento, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setActiveQuickStatus('stockCategory')}
                >
                  <View style={styles.bentoHeaderRow}>
                    <RNText style={[styles.bentoLabel, { color: colors.textSecondary }]}>{t('inv.category_distribution')}</RNText>
                    <BarChart3 size={16} color={colors.textSecondary} />
                  </View>
                  <View style={styles.categoryDistribution}>
                    {summary?.categories?.slice(0, 3).map((cat: any, idx: number) => (
                      <View key={idx} style={styles.catDistributionItem}>
                        <View style={[styles.catBarBack, { backgroundColor: colors.surface }]}>
                          <View style={[styles.catBarFill, { backgroundColor: colors.text, width: `${Math.min((cat.value / summary.totalValue) * 100, 100)}%` }]} />
                        </View>
                        <View style={styles.catLabelRow}>
                          <RNText style={[styles.catNameText, { color: colors.text }]}>
                            {cat.name ? t(cat.name.toLowerCase().startsWith('category.') ? cat.name.toLowerCase() : 'category.' + cat.name.toLowerCase()) : t('common.general')}
                          </RNText>
                          <RNText style={[styles.catValueText, { color: colors.textSecondary }]}>{Math.round((cat.value / summary.totalValue) * 100)}%</RNText>
                        </View>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>

                {/* Slow Moving Card */}
                <TouchableOpacity 
                   style={[styles.smallBento, { backgroundColor: colors.card, borderColor: colors.border }]}
                   onPress={() => setActiveQuickStatus('slowMoving')}
                 >
                   <TrendingDown size={20} color={colors.primary} style={{ marginBottom: 8 }} />
                   <RNText style={[styles.bentoLabel, { color: colors.textSecondary }]}>{t('inventory.slow_moving')}</RNText>
                   <RNText style={[styles.bentoMainVal, { color: colors.text }]}>{invStats?.slowMoving || 0}</RNText>
                </TouchableOpacity>
             </View>
          </View>

          {/* Action Ledger Section */}
          <View style={styles.ledgerSection}>
            <View style={styles.sectionHeader}>
              <View>
                <RNText style={[styles.sectionTitle, { color: colors.text }]}>{t('inv.stock_ledger')}</RNText>
                <RNText style={[styles.sectionSub, { color: colors.textSecondary }]}>{t('inv.ledger_subtitle')}</RNText>
              </View>
              <TouchableOpacity onPress={() => setShowInventoryRecord(true)}>
                <RNText style={[styles.viewAllBtn, { color: colors.primary }]}>{t('common.view_all')}</RNText>
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
                  <RNText style={[styles.emptyText, { color: colors.textSecondary }]}>{t('inv.vault_empty_state')}</RNText>
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
                <TouchableOpacity style={styles.dockBtn} onPress={() => { setActiveQuickStatus('stockCategory'); setIsBarExpanded(false); }}>
                   <Layers size={22} color={colors.textSecondary} />
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
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {activeQuickStatus === 'lowStock' ? t('inv.low_stock_items_title') 
                : activeQuickStatus === 'expiring' ? t('inv.expiring_items_title')
                : activeQuickStatus === 'stockCategory' ? t('inv.stock_by_category_title')
                : activeQuickStatus === 'fastMoving' ? t('inv.fast_moving_items_title')
                : t('inv.slow_moving_items_title')}
            </Text>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {/* Low Stock Items */}
              {activeQuickStatus === 'lowStock' && lowStockItems.map(item => (
                <TouchableOpacity 
                  key={item.id} 
                  style={[styles.qsCard, { backgroundColor: colors.background }]}
                  onPress={() => {
                    setSelectedItem(item);
                    setActiveQuickStatus(null);
                    setShowItemDetails(true);
                  }}
                >
                  <View style={[styles.qsIconBox, { backgroundColor: colors.text }]}><Package size={20} color={colors.background} /></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.qsName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.qsSub, { color: colors.textSecondary }]}>{item.totalBaseQuantity} {t('form.' + (item.baseUnit || 'pieces').toLowerCase())} {t('inv.left_suffix')}</Text>
                  </View>
                  <View style={[styles.qsBadge, item.totalBaseQuantity <= 0 ? [styles.qsBadgeDark, { backgroundColor: colors.text }] : [styles.qsBadgeLight, { backgroundColor: colors.border }]]}>
                    <Text style={[styles.qsBadgeText, { color: item.totalBaseQuantity <= 0 ? colors.background : colors.text }]}>
                      {item.totalBaseQuantity <= 0 ? t('inventory.out_of_stock') : t('inv.low_stock')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {activeQuickStatus === 'lowStock' && lowStockItems.length === 0 && (
                <Text style={[styles.emptyStatsText, { color: colors.textSecondary, textAlign: 'center', marginTop: 20 }]}>{t('inv.no_low_stock')}</Text>
              )}

              {/* Expiring Items */}
              {activeQuickStatus === 'expiring' && expiringItems.map(item => {
                const daysDiff = Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / 86400000);
                const urgent = daysDiff < 7;
                return (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.qsCard, { backgroundColor: colors.background }]}
                    onPress={() => {
                      setSelectedItem(item);
                      setActiveQuickStatus(null);
                      setShowItemDetails(true);
                    }}
                  >
                    <View style={[styles.qsIconBox, { backgroundColor: colors.text }]}><Package size={20} color={colors.background} /></View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.qsName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.qsSub, { color: colors.textSecondary }]}>{t('inv.expires_in', { days: daysDiff.toString() })}</Text>
                    </View>
                    <View style={[styles.qsBadge, urgent ? [styles.qsBadgeDark, { backgroundColor: colors.text }] : [styles.qsBadgeLight, { backgroundColor: colors.border }]]}>
                      <Text style={[styles.qsBadgeText, { color: urgent ? colors.background : colors.text }]}>
                        {urgent ? t('inv.urgent_label') : t('inv.soon_label')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {activeQuickStatus === 'expiring' && expiringItems.length === 0 && (
                <Text style={[styles.emptyStatsText, { color: colors.textSecondary, textAlign: 'center', marginTop: 20 }]}>{t('inv.no_expiring')}</Text>
              )}

              {/* Stock by Category */}
              {activeQuickStatus === 'stockCategory' && (summary?.categories || []).map((item: any, idx: number) => (
                <View key={idx} style={[styles.qsCard, { backgroundColor: colors.background }]}>
                  <View style={[styles.qsIconBox, { backgroundColor: colors.text }]}><Package size={20} color={colors.background} /></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.qsName, { color: colors.text }]}>
                      {item.name ? t(item.name.toLowerCase().startsWith('category.') ? item.name.toLowerCase() : 'category.' + item.name.toLowerCase()) : item.name}
                    </Text>
                    <Text style={[styles.qsSub, { color: colors.textSecondary }]}>{item.count} {t('inv.items_suffix')}</Text>
                  </View>
                </View>
              ))}
              {activeQuickStatus === 'stockCategory' && (!summary?.categories || summary.categories.length === 0) && (
                <Text style={[styles.emptyStatsText, { color: colors.textSecondary, textAlign: 'center', marginTop: 20 }]}>{t('inv.no_categories')}</Text>
              )}

              {/* Fast Moving */}
              {activeQuickStatus === 'fastMoving' && fastMovingItems.map(item => (
                <TouchableOpacity 
                   key={item.id} 
                   style={[styles.qsCard, { backgroundColor: colors.background }]}
                   onPress={() => {
                     setSelectedItem(item);
                     setActiveQuickStatus(null);
                     setShowItemDetails(true);
                   }}
                >
                  <View style={[styles.qsIconBox, { backgroundColor: colors.text }]}><TrendingUp size={18} color={colors.background} /></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.qsName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.qsSub, { color: colors.textSecondary }]}>{item.totalSales} {t('inv.sold_week_suffix')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {activeQuickStatus === 'fastMoving' && fastMovingItems.length === 0 && (
                <Text style={[styles.emptyStatsText, { color: colors.textSecondary, textAlign: 'center', marginTop: 20 }]}>{t('inv.no_fast_moving')}</Text>
              )}

              {/* Slow Moving */}
              {activeQuickStatus === 'slowMoving' && slowMovingItems.map(item => (
                <TouchableOpacity 
                   key={item.id} 
                   style={[styles.qsCard, { backgroundColor: colors.background }]}
                   onPress={() => {
                     setSelectedItem(item);
                     setActiveQuickStatus(null);
                     setShowItemDetails(true);
                   }}
                >
                  <View style={[styles.qsIconBox, { backgroundColor: colors.text }]}><TrendingDown size={18} color={colors.background} /></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.qsName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.qsSub, { color: colors.textSecondary }]}>{item.totalQty} {t('inv.sold_month_suffix')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {activeQuickStatus === 'slowMoving' && slowMovingItems.length === 0 && (
                <Text style={[styles.emptyStatsText, { color: colors.textSecondary, textAlign: 'center', marginTop: 20 }]}>{t('inv.no_slow_moving')}</Text>
              )}
            </ScrollView>
          </View>
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
    filter: 'blur(80px)',
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
    fontSize: 9,
    fontFamily: Fonts.bold,
  },
  headerLabel: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    opacity: 0.7
  },
  headerTitle: {
    fontSize: 34,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 25,
  },
  vaultLabel: {
    fontSize: 13,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vaultValue: {
    fontSize: 32,
    fontFamily: Fonts.extrabold,
    letterSpacing: -0.5,
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
    fontSize: 11,
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
    fontSize: 10,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  miniValue: {
    fontSize: 16,
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
    gap: 12,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
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
    fontSize: 11,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
  },
  bentoMainVal: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  bentoSubVal: {
    fontSize: 13,
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
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  catValueText: {
    fontSize: 11,
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
    fontSize: 22,
    fontFamily: Fonts.bold,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    marginTop: 4,
  },
  viewAllBtn: {
    fontSize: 14,
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
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  ledgerCategory: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  ledgerEnd: {
    alignItems: 'flex-end',
  },
  ledgerQty: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    marginBottom: 6,
  },
  ledgerStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ledgerStatusText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 15,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
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
    fontSize: 20,
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
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  qsSub: {
    fontSize: 12,
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
    fontSize: 10,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },
});

export default InventoryDashboard;