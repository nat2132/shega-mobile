import { Fonts } from '@/constants/theme';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Handshake,
  Package,
  TrendingUp,
  Wallet,
  Search,
  Plus,
  ArrowUpRight,
  LayoutDashboard,
  Zap
} from 'lucide-react-native';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  View,
  Image,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import LowStockItemsScreen from './low-stock-list';
import OnCreditCustomersScreen from './debt-list';
import OnCreditItemsScreen from './oncredit-list';
import SalesRecordScreen from '../sales/sales-record';
import InventoryRecordScreen from '../inventory/inventory-record';
import SaleDetailsScreen from '../sales/sales-details';
import ItemDetailsScreen from '../inventory/item-details';
import ExpenseDetailsScreen from '../expense/expense-details';
import AdjustmentDetailsScreen from '../adjustement/adjustment-details';
import SearchScreen from '../sales/search';
import GlobalCheckout from '../sales/sale-form';
import PendingSales from '../sales/pending';
import AddAssetFlow from '../inventory/inventroy-form';
import ActivityLedgerScreen from './activity-ledger';
import SaleSuccessModal from '@/components/SaleSuccessModal';

import { 
  GestureHandlerRootView, 
  GestureDetector, 
  Gesture 
} from 'react-native-gesture-handler';
import * as SecureStore from 'expo-secure-store';
import Svg, { Path } from 'react-native-svg';
import Animated, { 
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue, 
  withSpring, 
  FadeIn, 
  FadeOut,
  FadeInDown,
  FadeInUp,
  runOnJS 
} from 'react-native-reanimated';
import { useSidebar } from '@/context/SidebarContext';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import { getRecentItems, ItemData, getActivityFeed, getDashboardStats, getInventoryStats, getDebtCustomers, getOnCreditItems, getSaleById, getExpenseById, getAdjustmentById } from '@/database/db';
import RecentItemCard from '@/components/RecentItemCard';
import { formatDate } from '@/utils/date-utils';
import { formatAbbreviated } from '@/utils/number-utils';
import GlobalHeader from '@/components/GlobalHeader';
import { useNotifications } from '@/hooks/useNotifications';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Removed local PROFILE_IMAGES definition as it's now in SettingsContext

const PremiumGauge = ({ percentage = 0.5, color = '#2F6FED' }) => {
  const size = width * 0.85;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  
  // We only show a semi-circle (180 degrees)
  const arcLength = circumference / 2;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(percentage, { damping: 15, stiffness: 80 });
  }, [percentage]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLength * (1 - progress.value)
  }));

  const { colors } = useSettings();

  return (
    <View style={[styles.premiumGaugeCont, { width: size, height: size / 1.6 }]}>
      <Svg height={size} width={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background Track */}
        <Path
          d={`M ${strokeWidth/2} ${size/2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${size/2}`}
          fill="none"
          stroke={colors.border}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
        />
        {/* Active Fill (Animated) */}
        <AnimatedPath
          d={`M ${strokeWidth/2} ${size/2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${size/2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          animatedProps={animatedProps}
          strokeLinecap="round"
        />
      </Svg>
      
      {/* Decorative Glow dots */}
      <View style={[styles.gaugeGlowNode, { left: 0, bottom: 10, backgroundColor: color }]} />
      <View style={[styles.gaugeGlowNode, { right: 0, bottom: 10, backgroundColor: colors.border }]} />
    </View>
  );
};





  const DashboardScreen = () => {
    const { openSidebar } = useSidebar();
    const { userProfile, colors, calendarType, language, theme, t } = useSettings();
    const { notifCount } = useNotifications();
    const [isPrivate, setIsPrivate] = useState(false);
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [showSalesRecord, setShowSalesRecord] = useState(false);
    const [selectedSale, setSelectedSale] = useState<any>(null);
    const [selectedExpense, setSelectedExpense] = useState<any>(null);
    const [selectedAdjustment, setSelectedAdjustment] = useState<any>(null);

    const [showSearch, setShowSearch] = useState(false);
    const [lastSaleData, setLastSaleData] = useState<any>(null);
    const [isBarExpanded, setIsBarExpanded] = useState(false);
    const [showSaleFormFlow, setShowSaleFormFlow] = useState(false);
    const [showPending, setShowPending] = useState(false);
    const [showAddAsset, setShowAddAsset] = useState(false);
    const [recentActivities, setRecentActivities] = useState<any[]>([]);
    const [recentInventoryItems, setRecentInventoryItems] = useState<ItemData[]>([]);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [pendingSales, setPendingSales] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [invStats, setInvStats] = useState<any>(null);
    const [debtCustomersCount, setDebtCustomersCount] = useState(0);
    const [creditItemsCount, setCreditItemsCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [showActivityLedger, setShowActivityLedger] = useState(false);


  const expandedWidth = useSharedValue(56);
  useEffect(() => {
    expandedWidth.value = withSpring(isBarExpanded ? width - 50 : 56, { damping: 15, stiffness: 100 });
  }, [isBarExpanded, width]);

  const expandStyle = useAnimatedStyle(() => ({
    width: expandedWidth.value,
  }));

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async () => {
    const items = getRecentItems(3) as ItemData[];
    setRecentInventoryItems(items);
    
    // Fetch unified activities
    const activities = await getActivityFeed(10);
    setRecentActivities(activities);

    // Fetch live metrics
    const stats = getDashboardStats();
    if (stats) setMetrics(stats);

    const inventoryStats = getInventoryStats();
    if (inventoryStats) setInvStats(inventoryStats);

    const debtCust = await getDebtCustomers();
    setDebtCustomersCount(debtCust.length);

    const creditItems = await getOnCreditItems();
    setCreditItemsCount(creditItems.length);
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Helper to render activity items
  const renderActivityItem = (activity: any) => {
    const isSale = activity.category === 'sale';
    const isExpense = activity.category === 'expense';
    const isAdjustment = activity.category === 'adjustment';
    
    let Icon = TrendingUp;
    let iconBg = colors.primary;
    let label = '';
    let amountColor = colors.text;
    let prefix = '';

    if (isSale) {
      Icon = ArrowUpRight;
      iconBg = colors.primary;
      label = `${activity.quantity} ${activity.unitType} ${t('dashboard.activity.sold')}`;
      amountColor = colors.success || '#34C759';
      prefix = '+';
    } else if (isExpense) {
      Icon = Wallet;
      iconBg = '#FF3B30';
      label = t('dashboard.recorded_today') || 'Recorded Today';
      amountColor = '#FF3B30';
      prefix = '-';
    } else if (isAdjustment) {
      Icon = Zap;
      iconBg = '#FF9500';
      label = activity.type === 'price_up' ? t('adjustment.price_increased') : 
              activity.type === 'price_down' ? t('adjustment.price_decreased') : t('dashboard.activity.damaged');
    }

    return (
      <TouchableOpacity 
        key={`${activity.category}-${activity.id}`} 
        style={[styles.premiumActivityCard, { borderBottomColor: colors.border }]} 
        activeOpacity={0.7} 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (isSale) {
            const sale = getSaleById(activity.id);
            if (sale) setSelectedSale(sale);
          } else if (isExpense) {
            const expense = getExpenseById(activity.id);
            if (expense) setSelectedExpense(expense);
          } else if (isAdjustment) {
            const adj = getAdjustmentById(activity.id);
            if (adj) setSelectedAdjustment(adj);
          }
        }}
      >
        <View style={[styles.activityIconCircle, { backgroundColor: iconBg + '15' }]}>
          <Icon size={20} color={iconBg} />
        </View>
        
        <View style={styles.activityInfo}>
          <RNText style={[styles.activityName, { color: colors.text }]}>{activity.name || (isSale ? t('inventory.header') : (isExpense ? t('expense.header') : t('adjustment.header')))}</RNText>
          <RNText style={[styles.activityMeta, { color: colors.textSecondary }]}>{label}</RNText>
        </View>

        <View style={styles.activityRight}>
          {activity.amount && (
            <RNText style={[styles.activityAmount, { color: amountColor }]}>
              {prefix}{activity.amount}
            </RNText>
          )}
          <RNText style={[styles.activityTime, { color: colors.textSecondary }]}>
            {activity.createdAt ? formatDate(new Date(activity.createdAt), calendarType, language) : t('dashboard.activity.just_now')}
          </RNText>
        </View>
      </TouchableOpacity>
    );
  };

  const [currentMetric, setCurrentMetric] = useState(0);

  const METRICS_DATA = metrics ? [
    { 
      label: t('dashboard.stats.gross_profit'), 
      value: `${formatAbbreviated(metrics.today.grossProfit)} ETB`, 
      secondary: `${formatAbbreviated(metrics.yesterday.grossProfit)} ETB ${t('dashboard.stats.yesterday')}`,
      percentage: metrics.yesterday.grossProfit > 0 ? Math.min(metrics.today.grossProfit / (metrics.yesterday.grossProfit * 1.5), 1) : 0.5, 
      status: metrics.today.grossProfit > metrics.yesterday.grossProfit ? t('dashboard.stats.growing') : (metrics.today.grossProfit < metrics.yesterday.grossProfit ? t('dashboard.stats.stable') : t('dashboard.stats.normal'))
    },
    { 
      label: t('dashboard.stats.revenue'), 
      value: `${formatAbbreviated(metrics.today.revenue)} ETB`, 
      secondary: `${formatAbbreviated(metrics.yesterday.revenue)} ETB ${t('dashboard.stats.yesterday')}`, 
      percentage: metrics.yesterday.revenue > 0 ? Math.min(metrics.today.revenue / (metrics.yesterday.revenue * 1.5), 1) : 0.5, 
      status: metrics.today.revenue > metrics.yesterday.revenue * 1.2 ? t('dashboard.stats.great') : (metrics.today.revenue >= metrics.yesterday.revenue ? t('dashboard.stats.on_track') : t('dashboard.stats.slow'))
    },
    { 
      label: t('dashboard.stats.sales_count'), 
      value: `${metrics.today.salesCount} ${t('common.items')}`, 
      secondary: `${metrics.yesterday.salesCount} ${t('dashboard.stats.yesterday')}`, 
      percentage: metrics.yesterday.salesCount > 0 ? Math.min(metrics.today.salesCount / (metrics.yesterday.salesCount * 1.5), 1) : 0.5, 
      status: metrics.today.salesCount > metrics.yesterday.salesCount ? t('dashboard.stats.high_traffic') : t('dashboard.stats.normal') 
    },
    { 
      label: t('dashboard.stats.expense'), 
      value: `${metrics.today.expenses.toLocaleString()} ETB`, 
      secondary: `${metrics.yesterday.expenses.toLocaleString()} ${t('dashboard.stats.yesterday')}`, 
      percentage: metrics.yesterday.expenses > 0 ? Math.min(metrics.today.expenses / (metrics.yesterday.expenses * 1.5), 1) : 0.2, 
      status: metrics.today.expenses > metrics.yesterday.expenses ? t('dashboard.stats.spending_higher') : t('dashboard.stats.controlled') 
    },
  ] : [
    { label: t('dashboard.stats.gross_profit'), value: '0 ETB', secondary: "0 ETB", percentage: 0, status: t('common.loading') },
    { label: t('dashboard.stats.revenue'), value: '0 ETB', secondary: "0 ETB", percentage: 0, status: t('common.loading') },
    { label: t('dashboard.stats.sales_count'), value: `0 ${t('common.items')}`, secondary: `Target: 50 ${t('common.items')}`, percentage: 0, status: t('common.loading') },
    { label: t('dashboard.stats.expense'), value: '0 ETB', secondary: "0 ETB", percentage: 0, status: t('common.loading') },
  ];

  const handleNextMetric = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMetric((prev) => (prev + 1) % METRICS_DATA.length);
  };
  const handlePrevMetric = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMetric((prev) => (prev - 1 + METRICS_DATA.length) % METRICS_DATA.length);
  };

  // Pan Gesture for Swiping
  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      if (event.translationX > 50) {
        runOnJS(handlePrevMetric)();
      } else if (event.translationX < -50) {
        runOnJS(handleNextMetric)();
      }
    });

  const quickStats = [
    { id: 1, title: t('dashboard.low_stock'), value: invStats?.lowStockCount?.toString() || '0', icon: Package, color: '#FF9500' },
    { id: 2, title: t('dashboard.credit_customers'), value: debtCustomersCount.toString(), icon: Handshake, color: '#34C759' },
    { id: 3, title: t('dashboard.credit_items'), value: creditItemsCount.toString(), icon: Clock, color: '#FF3B30' },
  ];

  return (
    <>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        
        {/* Fixed Background Gradients for Premium Feel */}
        <View style={StyleSheet.absoluteFill}>
          <View style={[styles.bgGlow, { top: -100, left: -100, backgroundColor: colors.primary, opacity: 0.08 }]} />
          <View style={[styles.bgGlow, { bottom: 100, right: -100, backgroundColor: colors.primary, opacity: 0.05 }]} />
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={[styles.container, { backgroundColor: 'transparent' }]}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={colors.text}
              colors={[colors.text]}
            />
          }
        >
          {/* Custom Integrated Header */}
          <View style={styles.integratedHeader}>
            <View style={{ flex: 1 }}>
              <RNText style={[styles.greetingLabel, { color: colors.textSecondary }]}>
                {new Date().getHours() < 12 ? t('dashboard.greeting_morning') : new Date().getHours() < 18 ? t('dashboard.greeting_afternoon') : t('dashboard.greeting_evening')},
              </RNText>
              <RNText style={[styles.businessNameHeading, { color: colors.text }]}>{userProfile.businessName}</RNText>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity 
                onPress={() => router.push('/notifications')} 
                style={[styles.headerIconBtn, { borderColor: colors.border }]}
              >
                 <Bell size={24} color={colors.text} strokeWidth={2} />
                 {notifCount > 0 && (
                   <View style={[styles.notifBadge, { backgroundColor: colors.primary }]}>
                     <RNText style={styles.notifBadgeText}>{notifCount}</RNText>
                   </View>
                 )}
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={openSidebar} 
                activeOpacity={0.7}
                style={[styles.headerAvatarWrap, { borderColor: colors.border }]}
              >
                <Image source={PROFILE_IMAGES[userProfile.avatarIndex]} style={styles.headerAvatar} />
                <View style={[styles.onlineIndicator, { backgroundColor: '#34C759', borderColor: colors.background }]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Metric Hub Area */}
          <Animated.View entering={FadeIn.duration(600)} style={styles.metricHub}>
            <GestureDetector gesture={panGesture}>
              <View style={styles.dialWrapper}>
                <PremiumGauge 
                  percentage={METRICS_DATA[currentMetric].percentage} 
                  color={currentMetric === 3 ? colors.error : colors.primary} 
                />
                
                <View style={styles.dialContent}>
                  <Animated.View 
                    key={currentMetric}
                    entering={FadeInDown.duration(400)} 
                    style={styles.dialTextGroup}
                  >
                    <RNText style={[styles.dialLabel, { color: colors.textSecondary }]}>
                      {METRICS_DATA[currentMetric].label}
                    </RNText>
                    
                    <View style={styles.dialValueRow}>
                      <RNText style={[styles.dialValue, { color: colors.text }]}>
                        {isPrivate ? '••••••' : METRICS_DATA[currentMetric].value}
                      </RNText>
                    </View>

                    <View style={[styles.statusPill, { backgroundColor: colors.surface }]}>
                      <Zap size={12} color={colors.primary} fill={colors.primary} />
                      <RNText style={[styles.statusPillText, { color: colors.text }]}>
                        {METRICS_DATA[currentMetric].status}
                      </RNText>
                    </View>
                  </Animated.View>
                </View>

                {/* Dial Navigation Dots */}
                <View style={styles.dialPagination}>
                  {METRICS_DATA.map((_, i) => (
                    <View 
                      key={i} 
                      style={[
                        styles.paginationDot, 
                        { backgroundColor: i === currentMetric ? colors.primary : colors.border, width: i === currentMetric ? 16 : 6 }
                      ]} 
                    />
                  ))}
                </View>
              </View>
            </GestureDetector>
          </Animated.View>

          {/* Quick Stats Scrollable Section */}
          <View style={styles.bentoSection}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bentoGrid}
              decelerationRate="fast"
              snapToAlignment="start"
              snapToInterval={width * 0.45 + 15}
            >
              {quickStats.map((stat, idx) => {
                const StatIcon = stat.icon;
                return (
                  <Animated.View 
                    key={stat.id}
                    entering={FadeInDown.delay(100 * idx).duration(500)}
                  >
                    <TouchableOpacity 
                      style={[styles.bentoCard, { backgroundColor: colors.card, borderColor: colors.border }]} 
                      activeOpacity={0.9}
                      onPress={() => {
                        if (stat.id === 1) setActiveModal('lowStock');
                        else if (stat.id === 2) setActiveModal('onCreditCustomers');
                        else if (stat.id === 3) setActiveModal('onCreditItems');
                      }}
                    >
                      <View style={[styles.bentoIconBox, { backgroundColor: stat.color + '15' }]}>
                        <StatIcon size={20} color={stat.color} />
                      </View>
                      <RNText style={[styles.bentoValue, { color: colors.text }]}>{stat.value}</RNText>
                      <RNText style={[styles.bentoLabel, { color: colors.textSecondary }]}>{stat.title}</RNText>
                      
                      <View style={styles.bentoArrow}>
                        <ArrowUpRight size={14} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </ScrollView>
          </View>

          {/* Productivity Feed Footer */}
          <View style={styles.feedSection}>
            <View style={styles.feedHeader}>
              <View>
                <RNText style={[styles.feedTitle, { color: colors.text }]}>{t('dashboard.recent_activity')}</RNText>
                <RNText style={[styles.feedSub, { color: colors.textSecondary }]}>{t('dash.live_overview')}</RNText>
              </View>
              <TouchableOpacity onPress={() => setShowActivityLedger(true)} style={styles.viewAllBtn}>
                <RNText style={[styles.viewAllBtnText, { color: colors.primary }]}>{t('common.view_all')}</RNText>
              </TouchableOpacity>
            </View>

            {recentActivities.length > 0 ? (
              <View style={styles.feedList}>
                {recentActivities.map((activity, idx) => (
                  <Animated.View key={idx} entering={FadeInDown.delay(200 + (idx * 50)).duration(500)}>
                    {renderActivityItem(activity)}
                  </Animated.View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyFeed}>
                 <RNText style={[styles.emptyFeedText, { color: colors.textSecondary }]}>{t('dashboard.no_activity')}</RNText>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Expanding Smart FAB */}
        <View style={styles.dockedBarWrapper}>
          <Animated.View style={[expandStyle, { height: 56, borderRadius: 28, overflow: 'hidden' }]}>
            <BlurView intensity={80} tint={theme !== 'light' ? 'dark' : 'light'} style={[styles.dockedBar, { borderColor: colors.border, paddingHorizontal: isBarExpanded ? 10 : 0 }]}>
              {isBarExpanded && (
                <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                  <TouchableOpacity style={styles.dockBtn} onPress={() => { setShowSearch(true); setIsBarExpanded(false); }}>
                    <Search size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </Animated.View>
              )}
              
              <TouchableOpacity 
                style={[styles.dockMainBtn, { backgroundColor: isBarExpanded ? colors.primary : colors.text }]} 
                activeOpacity={0.8}
                onPress={() => setIsBarExpanded(!isBarExpanded)}
              >
                <Plus size={24} color={isBarExpanded ? "#FFF" : colors.background} />
              </TouchableOpacity>
              
              {isBarExpanded && (
                <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                  <TouchableOpacity style={styles.dockBtn} onPress={() => { setShowAddAsset(true); setIsBarExpanded(false); }}>
                    <Package size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </BlurView>
          </Animated.View>
        </View>
      </View>

      {/* Bottom Sheet Modal - placed OUTSIDE the scroll tree */}
      <Modal
        visible={activeModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setActiveModal(null)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <RNText style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</RNText>
              </TouchableOpacity>
            </View>
            <RNText style={[styles.sheetTitle, { color: colors.text }]}>
              {activeModal === 'lowStock' ? t('dashboard.low_stock') : activeModal === 'onCreditCustomers' ? t('dashboard.credit_customers') : t('dashboard.credit_items')}
            </RNText>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {activeModal === 'lowStock' && <LowStockItemsScreen />}
              {activeModal === 'onCreditCustomers' && <OnCreditCustomersScreen />}
              {activeModal === 'onCreditItems' && <OnCreditItemsScreen />}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showActivityLedger}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActivityLedger(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowActivityLedger(false)} />
          <View style={[styles.bottomSheetContainer, { height: Dimensions.get('window').height * 0.85, maxHeight: undefined, backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <ActivityLedgerScreen onClose={() => {
              setShowActivityLedger(false);
              loadDashboardData();
            }} />
          </View>
        </View>
      </Modal>

      {/* Record and Details Bottom Sheets */}
      <Modal
        visible={showSalesRecord}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSalesRecord(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSalesRecord(false)} />
          <View style={[styles.bottomSheetContainer, { height: Dimensions.get('window').height * 0.85, maxHeight: undefined, backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <SalesRecordScreen onClose={() => setShowSalesRecord(false)} />
          </View>
        </View>
      </Modal>

      {/* Activity Details Modals */}
      <Modal visible={!!selectedSale} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedSale(null)} />
          <Animated.View entering={FadeInUp} style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.85 }]}>
             <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
             {selectedSale && <SaleDetailsScreen sale={selectedSale} onClose={() => { setSelectedSale(null); loadDashboardData(); }} />}
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={!!selectedExpense} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedExpense(null)} />
          <Animated.View entering={FadeInUp} style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.85 }]}>
             <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
             {selectedExpense && <ExpenseDetailsScreen expense={selectedExpense} onClose={() => { setSelectedExpense(null); loadDashboardData(); }} />}
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={!!selectedAdjustment} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedAdjustment(null)} />
          <Animated.View entering={FadeInUp} style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.85 }]}>
             <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
             {selectedAdjustment && <AdjustmentDetailsScreen adjustment={selectedAdjustment} onClose={() => setSelectedAdjustment(null)} onRefresh={() => { setSelectedAdjustment(null); loadDashboardData(); }} />}
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showSearch} transparent animationType="slide" onRequestClose={() => setShowSearch(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSearch(false)} />
          <View style={[styles.bottomSheetContainer, { height: Dimensions.get('window').height * 0.85, maxHeight: undefined, backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
            <SearchScreen 
               onSelectItem={(item: any) => {
                 const existing = pendingSales.find(s => s.id === item.id);
                 if (existing) {
                   setPendingSales(pendingSales.map(s => s.id === item.id ? { ...s, quantity: s.quantity + 1 } : s));
                 } else {
                   setPendingSales([...pendingSales, {
                     ...item,
                     id: item.id,
                     quantity: 1,
                     unitType: 'base',
                   }]);
                 }
                 setShowSearch(false);
                 setTimeout(() => setShowPending(true), 300);
               }} 
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showPending} transparent animationType="slide" onRequestClose={() => setShowPending(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowPending(false)} />
          <View style={[styles.bottomSheetContainer, { height: Dimensions.get('window').height * 0.85, maxHeight: undefined, backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
            <PendingSales 
               items={pendingSales}
               onUpdateItem={(id, updates) => {
                 setPendingSales(pendingSales.map(s => s.id === id ? { ...s, ...updates } : s));
               }}
               onRemoveItem={(id) => {
                 setPendingSales(pendingSales.filter(s => s.id !== id));
               }}
               onAddMore={() => {
                 setShowPending(false);
                 setTimeout(() => setShowSearch(true), 300);
               }}
               onFinish={() => {
                 setShowPending(false);
                 setTimeout(() => setShowSaleFormFlow(true), 300);
               }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showSaleFormFlow} transparent animationType="slide" onRequestClose={() => setShowSaleFormFlow(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSaleFormFlow(false)} />
          <View style={[styles.bottomSheetContainer, { height: Dimensions.get('window').height * 0.85, maxHeight: undefined, backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
            <GlobalCheckout 
               cart={pendingSales}
               onBack={() => {
                 setShowSaleFormFlow(false);
                 setTimeout(() => setShowPending(true), 300);
               }}
               onFinish={async (saleMetadata: any) => {
                 try {
                   const { insertSale } = await import('@/database/db');
                   for (const item of pendingSales) {
                     const finalUnitPrice = item.unitType === 'pack' ? item.packSellingPrice : item.baseSellingPrice;
                     const finalUnitLabel = item.unitType === 'pack' ? item.purchaseUnit : item.baseUnit;
                     
                     await insertSale({
                       itemId: item.id,
                       quantity: item.quantity,
                       unit: finalUnitLabel,
                       unitType: item.unitType,
                       discount: Number(saleMetadata.discount) / pendingSales.length,
                       vat: saleMetadata.vat,
                       totalPrice: finalUnitPrice * item.quantity,
                       paymentMethod: saleMetadata.paymentMethod,
                       paymentStatus: saleMetadata.paymentStatus,
                       customerName: saleMetadata.customerName,
                       customerPhone: saleMetadata.customerPhone,
                     });
                   }
                   setPendingSales([]);
                   setShowSaleFormFlow(false);
                   loadDashboardData();
                   setLastSaleData({
                     totalPrice: saleMetadata.totalPrice,
                     paymentMethod: saleMetadata.paymentMethod,
                     itemCount: pendingSales.length,
                     paymentStatus: saleMetadata.paymentStatus,
                     customerName: saleMetadata.customerName,
                   });
                 } catch (e) {
                   Alert.alert('Error', 'Failed to save sale.');
                 }
               }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showAddAsset} transparent animationType="slide" onRequestClose={() => setShowAddAsset(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowAddAsset(false)} />
          <View style={[styles.bottomSheetContainer, { height: Dimensions.get('window').height * 0.85, maxHeight: undefined, backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
            <AddAssetFlow 
              onSuccess={() => {
                setShowAddAsset(false);
                loadDashboardData();
              }} 
              onClose={() => setShowAddAsset(false)}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={!!lastSaleData} transparent animationType="fade">
        <SaleSuccessModal 
          saleData={lastSaleData} 
          onClose={() => setLastSaleData(null)} 
        />
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 220,
    paddingTop: 10,
  },
  bgGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  integratedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 25,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
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
  greetingLabel: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    marginBottom: 2,
  },
  businessNameHeading: {
    fontSize: 24,
    fontFamily: Fonts.bold,
  },
  headerAvatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
    position: 'relative',
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  onlineIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  metricHub: {
    paddingHorizontal: 25,
    marginTop: 15,
    marginBottom: 30,
  },
  dialWrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  premiumGaugeCont: {
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  gaugeGlowNode: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  dialContent: {
    position: 'absolute',
    top: 40,
    alignItems: 'center',
    width: '100%',
  },
  dialTextGroup: {
    alignItems: 'center',
  },
  dialLabel: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    marginBottom: 8,
  },
  dialValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dialValue: {
    fontSize: 36,
    fontFamily: Fonts.bold,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
  },
  dialPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  paginationDot: {
    height: 6,
    borderRadius: 3,
  },
  bentoSection: {
    paddingLeft: 25,
    marginBottom: 30,
  },
  bentoGrid: {
    flexDirection: 'row',
    paddingRight: 25,
    gap: 15,
  },
  bentoCard: {
    width: width * 0.45,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  bentoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  bentoValue: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  bentoLabel: {
    fontSize: 11,
    fontFamily: Fonts.medium,
  },
  bentoArrow: {
    position: 'absolute',
    top: 15,
    right: 15,
    opacity: 0.5,
  },
  feedSection: {
    paddingHorizontal: 25,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  feedTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  feedSub: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  viewAllBtnText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  feedList: {
    gap: 0,
  },
  premiumActivityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  activityIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  activityMeta: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 11,
    fontFamily: Fonts.medium,
  },
  emptyFeed: {
    paddingVertical: 40,
    alignItems: 'center',
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
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  sheetTitle: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    paddingHorizontal: 25,
    paddingBottom: 20,
  },
});

export default DashboardScreen;