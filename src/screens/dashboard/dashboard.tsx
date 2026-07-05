import { DashboardAlerts } from '@/components/DashboardAlerts';
import { NotificationBell } from '@/components/NotificationBell';
import SaleSuccessModal from '@/components/SaleSuccessModal';
import PremiumTrialBanner from '@/components/PremiumTrialBanner';
import { useSubscription } from '@/context/SubscriptionContext';
import { Fonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Clock,
  Handshake,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  X,
  Zap
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import AdjustmentDetailsScreen from '../adjustement/adjustment-details';
import ExpenseDetailsScreen from '../expense/expense-details';
import AddAssetFlow from '../inventory/inventroy-form';
import PendingSales from '../sales/pending';
import GlobalCheckout from '../sales/sale-form';
import SaleDetailsScreen from '../sales/sales-details';
import SalesRecordScreen from '../sales/sales-record';
import SearchScreen from '../sales/search';
import ActivityLedgerScreen from './activity-ledger';
import OnCreditCustomersScreen from './debt-list';
import LowStockItemsScreen from './low-stock-list';
import OnCreditItemsScreen from './oncredit-list';

import { BusinessAssistant } from '@/components/BusinessAssistant';
import { BusinessHealthCard } from '@/components/BusinessHealthCard';
import { SparklineSkeleton } from '@/components/ChartSkeleton';
import { AppNumber, AppText } from '@/components/ui';
import { UniversalSearch } from '@/components/UniversalSearch';
import { useDialog } from '@/context/DialogContext';
import { PROFILE_IMAGES, useDashboardVisibility, useSettings } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import { useWarehouse } from '@/context/WarehouseContext';
import { getActivityFeed, getAdjustmentById, getDashboardStats, getDebtCustomers, getExpenseById, getInventoryStats, getLowStockItems, getOnCreditItems, getRecentItems, getSaleWithItemsById, ItemData } from '@/database/db';
import { generateBulkTestData } from '@/database/generateTestData';
import { useBusinessAssistant } from '@/hooks/useBusinessAssistant';
import { useBusinessHealthScore } from '@/hooks/useBusinessHealthScore';
import { useNotifications } from '@/hooks/useNotifications';
import { playBad } from '@/services/soundService';
import { formatDate, toEthiopianHour } from '@/utils/date-utils';
import {
  Gesture,
  GestureDetector
} from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { CARD_GAP, CARD_WIDTH, DASH_SPACING, getDashGlass } from './glass-dashboard';

const { width } = Dimensions.get('window');
const SparklineChart = React.memo(({ todayValue = 0, yesterdayValue = 0, color = '#2F6FED', loading = false }: {
  todayValue?: number;
  yesterdayValue?: number;
  color?: string;
  loading?: boolean;
}) => {
  const { t, colors } = useSettings();
  const widthSize = width - 80;
  const heightSize = 90;

  const safeToday = Number.isFinite(todayValue) ? todayValue : 0;
  const safeYesterday = Number.isFinite(yesterdayValue) ? yesterdayValue : 0;
  const isPositive = safeToday > safeYesterday;
  const isNegative = safeToday < safeYesterday;

  const { d, fillD, dotY } = useMemo(() => {
    let pathStr = `M 0 55 Q ${widthSize * 0.25} 25, ${widthSize * 0.5} 65 T ${widthSize} 35`;
    let dot = 35;

    if (isPositive) {
      pathStr = `M 0 65 Q ${widthSize * 0.25} 50, ${widthSize * 0.5} 30 T ${widthSize} 15`;
      dot = 15;
    } else if (isNegative) {
      pathStr = `M 0 20 Q ${widthSize * 0.25} 35, ${widthSize * 0.5} 60 T ${widthSize} 75`;
      dot = 75;
    }

    return {
      d: pathStr,
      fillD: `${pathStr} L ${widthSize} ${heightSize} L 0 ${heightSize} Z`,
      dotY: dot,
    };
  }, [isPositive, isNegative, widthSize, heightSize]);

  if (loading) {
    return <SparklineSkeleton width={widthSize} height={heightSize} />;
  }

  if (safeToday === 0 && safeYesterday === 0) {
    return (
      <View style={{ height: heightSize, width: '100%', justifyContent: 'center', alignItems: 'center', marginVertical: 15 }}>
        <AppText variant="body-sm" weight="medium" style={{ color: colors.text, opacity: 0.5 }}>
          No data
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ height: heightSize, width: '100%', justifyContent: 'center', alignItems: 'center', marginVertical: 15 }}>
      <Svg height={heightSize} width={widthSize}>
        <Defs>
          <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </LinearGradient>
        </Defs>
        <Path d={fillD} fill="url(#chartGradient)" />
        <Path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Glow Ring behind the dot */}
        <Circle
          cx={widthSize - 4}
          cy={dotY}
          r={7}
          fill={color}
          opacity={0.3}
        />
        <Circle
          cx={widthSize - 4}
          cy={dotY}
          r={4}
          fill={color}
        />
        <Circle
          cx={widthSize - 4}
          cy={dotY}
          r={1.5}
          fill="#FFF"
        />
      </Svg>
    </View>
  );
});
SparklineChart.displayName = 'SparklineChart';

  const DashboardScreen = () => {
    const { openSidebar } = useSidebar();
    const { userProfile, colors, calendarType, language, timeSystem, t } = useSettings();
    const { dashboardVisibility, toggleDashboardSection } = useDashboardVisibility();
    const { refreshTrialDays } = useSubscription();
    const G = getDashGlass(colors);
    const styles = useMemo(() => createStyles(G), [G]);
    useNotifications();
    const dialog = useDialog();
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
    const [, setRecentInventoryItems] = useState<ItemData[]>([]);
    const [, setSelectedItem] = useState<any>(null);
    const [pendingSales, setPendingSales] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [, setInvStats] = useState<any>(null);
    const [debtCustomersCount, setDebtCustomersCount] = useState(0);
    const [creditItemsCount, setCreditItemsCount] = useState(0);
    const [lowStockCount, setLowStockCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [showActivityLedger, setShowActivityLedger] = useState(false);
    const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  const { health: businessHealth, loading: healthLoading, refresh: refreshHealth } = useBusinessHealthScore();
  const { insights: assistantInsights, loading: assistantLoading, refresh: refreshAssistant } = useBusinessAssistant();

  const expandedWidth = useSharedValue(56);
  useEffect(() => {
    expandedWidth.value = withSpring(isBarExpanded ? width - 50 : 56, { damping: 15, stiffness: 100 });
  }, [isBarExpanded, width]);

  const expandStyle = useAnimatedStyle(() => ({
    width: expandedWidth.value,
  }));

  const { activeWarehouseId } = useWarehouse();

  const loadDashboardData = React.useCallback(async () => {
    const items = getRecentItems(3) as ItemData[];
    setRecentInventoryItems(items);
    
// Fetch unified activities
     const today = new Date().toISOString().split('T')[0];
     const activities = await getActivityFeed({ limit: 5, date: today });
     setRecentActivities(activities);

    // Fetch live metrics
    const stats = getDashboardStats();
    if (stats) setMetrics(stats);

    const inventoryStats = getInventoryStats(activeWarehouseId);
    if (inventoryStats) setInvStats(inventoryStats);

    const debtCust = await getDebtCustomers();
    setDebtCustomersCount(debtCust.length);

    const creditItems = await getOnCreditItems();
    setCreditItemsCount(creditItems.length);

    const lowStock = await getLowStockItems();
    setLowStockCount(lowStock.length);
    if (lowStock.length > 0) {
      playBad();
    }
    refreshHealth();
    refreshAssistant();
    refreshTrialDays();
  }, [activeWarehouseId, refreshHealth, refreshAssistant, refreshTrialDays]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
    setTimeout(() => setRefreshing(false), 1000);
  }, [loadDashboardData]);

  const handleSeedData = async () => {
    await dialog.choose({
      title: t('dashboard.seed_title'),
      message: t('dashboard.seed_message'),
      cancelText: t('common.cancel'),
      choices: [
        { label: '10', onPress: () => doSeed(10) },
        { label: '100', onPress: () => doSeed(100) },
        { label: '1,000', onPress: () => doSeed(1000) },
        { label: '10,000', onPress: () => doSeed(10000) },
      ],
    });
  };

  const doSeed = async (count: number) => {
    const start = Date.now();
    const result = generateBulkTestData(count);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    await dialog.alert({
      title: result.success ? t('dashboard.seed_success') : t('dashboard.seed_error'),
      message: `${result.message}\n\nâ±ï¸ ${elapsed}s`,
      iconType: result.success ? 'success' : 'danger',
    });
    loadDashboardData();
  };

  // Helper to render activity items
  const renderActivityItem = (activity: any) => {
    const isSale = activity.category === 'sale';
    const isExpense = activity.category === 'expense';
    const isAdjustment = activity.category === 'adjustment';
    const isInventory = activity.category === 'inventory';

    let Icon = TrendingUp;
    let iconBg = colors.primary;
    let label = '';
    let prefix = '';

    if (isSale) {
      const paymentStatus = activity.paymentStatus || 'Paid';
      const isOrder = paymentStatus === 'Order';
      const isDebt = paymentStatus === 'Debt';
      const isCancelled = paymentStatus === 'Cancelled';
      const isPayment = (typeof activity.value === 'number' && activity.value < 0) || (activity.batchId && String(activity.batchId).startsWith('PAY_'));
      if (isPayment) {
        Icon = Banknote;
        iconBg = colors.success;
        label = t('dashboard.activity.debt_collected');
        prefix = '+';
      } else {
        Icon = isCancelled ? AlertTriangle : ShoppingBag;
        iconBg = isCancelled ? colors.error : (isOrder ? colors.primary : (isDebt ? colors.warning : colors.success));
        const statusLabel = isCancelled ? t('sale.cancelled') : (isOrder ? t('dashboard.order') : (isDebt ? t('sale.credit') : t('dashboard.activity.sold')));
        label = `${activity.quantity || 0} ${statusLabel}`;
        prefix = isCancelled ? '' : '+';
      }
    } else if (isExpense) {
      Icon = TrendingDown;
      iconBg = colors.error;
      label = activity.expenseCategory || t('expense.not_recurring');
      prefix = '-';
    } else if (isAdjustment) {
      const adjType = activity.adjType || activity.type;
      if (adjType === 'price_up') {
        Icon = TrendingUp;
        iconBg = colors.success;
        label = t('adjustment.price_increased');
        prefix = '+';
      } else if (adjType === 'price_down') {
        Icon = TrendingDown;
        iconBg = colors.error;
        label = t('adjustment.price_decreased');
        prefix = '-';
      } else {
        Icon = AlertTriangle;
        iconBg = colors.warning;
        label = t('dashboard.activity.damaged');
        prefix = '-';
      }
    } else if (isInventory) {
      Icon = Package;
      iconBg = colors.primary;
      label = `${activity.quantity || 0} ${t('dashboard.activity.added')}`;
      prefix = '+';
    }

    // Name: use customerName for sales, fallback to item label
    const activityName = isSale
      ? (activity.customerName || t('sales.walk_in_customer'))
      : (activity.name || activity.label || (isExpense ? t('expense.header') : (isAdjustment ? t('adjustment.header') : t('inventory.header'))));
    
    // Amount color based on type
    let amtColor: string | undefined = undefined;
    if (isExpense) {
      amtColor = colors.error;
    } else if (isAdjustment) {
      const adjType = activity.adjType || activity.type;
      if (adjType === 'damaged' || adjType === 'price_down') amtColor = colors.error;
      else if (adjType === 'price_up') amtColor = colors.success;
    } else if (isSale) {
      const paymentStatus = activity.paymentStatus || 'Paid';
      if (paymentStatus === 'Cancelled') amtColor = colors.textSecondary;
      else amtColor = colors.success;
    } else if (isInventory) {
      amtColor = colors.success;
    }

    // Amount
    let displayAmt = typeof activity.amount === 'number' && !isNaN(activity.amount)
      ? activity.amount
      : (typeof activity.value === 'number' && !isNaN(activity.value) ? activity.value : null);

    // For damaged items, compute loss as quantity * basePurchasePrice
    if (isAdjustment && activity.adjType === 'damaged' && activity.quantity && activity.basePurchasePrice) {
      displayAmt = activity.quantity * activity.basePurchasePrice;
    }
    // Payment records have negative value — show as positive
    if (isSale && displayAmt !== null && displayAmt < 0) {
      displayAmt = Math.abs(displayAmt);
    }

    return (
      <TouchableOpacity
        key={`${activity.category ?? activity.type}-${activity.id}`}
        style={styles.activityCard}
        activeOpacity={0.7}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (isSale) {
            const sale = getSaleWithItemsById(activity.id);
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
        <View style={[styles.activityIconCircle, { backgroundColor: iconBg + '18' }]}>
          <Icon size={18} color={iconBg} />
        </View>

        <View style={styles.activityInfo}>
          <AppText
            style={styles.activityName}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {activityName}
          </AppText>
          <AppText variant="body-sm" weight="medium" style={styles.activityMeta} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</AppText>
        </View>

        <View style={styles.activityRight}>
          {displayAmt !== null && (
            <AppNumber 
              value={displayAmt} 
              size="title-sm" 
              weight="bold"
              prefix={prefix}
              suffix={' ' + t('common.etb')}
              style={styles.activityAmount}
              color={amtColor}
            />
          )}
          <AppText variant="caption" weight="medium" style={styles.activityTime} numberOfLines={1}>
            {activity.createdAt ? formatDate(new Date(activity.createdAt), calendarType, language) : t('dashboard.activity.just_now')}
          </AppText>
        </View>
      </TouchableOpacity>
    );
  };

  const [currentMetric, setCurrentMetric] = useState(0);

  const METRICS_DATA = metrics ? [
    { 
      label: t('dashboard.stats.gross_profit'), 
      todayValue: metrics.today.grossProfit,
      yesterdayValue: metrics.yesterday.grossProfit,
      isCurrency: true,
    },
    { 
      label: t('dashboard.stats.revenue'), 
      todayValue: metrics.today.revenue,
      yesterdayValue: metrics.yesterday.revenue,
      isCurrency: true,
    },
    { 
      label: t('dashboard.stats.sales_count'), 
      todayValue: metrics.today.salesCount,
      yesterdayValue: metrics.yesterday.salesCount,
      isCount: true,
    },
    { 
      label: t('dashboard.stats.expense'), 
      todayValue: metrics.today.expenses,
      yesterdayValue: metrics.yesterday.expenses,
      isCurrency: true,
    },
  ] : [
    { label: t('dashboard.stats.gross_profit'), todayValue: 0, yesterdayValue: 0, isCurrency: true },
    { label: t('dashboard.stats.revenue'), todayValue: 0, yesterdayValue: 0, isCurrency: true },
    { label: t('dashboard.stats.sales_count'), todayValue: 0, yesterdayValue: 0, isCount: true },
    { label: t('dashboard.stats.expense'), todayValue: 0, yesterdayValue: 0, isCurrency: true },
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
    { id: 1, title: t('dashboard.low_stock'), value: lowStockCount, icon: Package, color: colors.warning },
    { id: 4, title: t('dashboard.credit_customers'), value: debtCustomersCount, icon: Handshake, color: colors.success },
    { id: 5, title: t('dashboard.credit_items'), value: creditItemsCount, icon: Clock, color: colors.error },
  ];

  return (
    <>
      <View style={{ flex: 1, backgroundColor: G.bg }}>
        
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
          {/* Header */}
          <View style={styles.glassHeader}>
            <View style={styles.glassHeaderContent}>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="medium" style={styles.greetingLabel} numberOfLines={2}>
                  {(() => {
                    const localHour = new Date().getHours();
                    const ethHour = toEthiopianHour(localHour);
                    const activeHour = timeSystem === 'ethiopian' ? ethHour : localHour;
                    if (activeHour < 6) return t('dashboard.greeting_evening');
                    if (activeHour < 12) return t('dashboard.greeting_morning');
                    if (activeHour < 18) return t('dashboard.greeting_afternoon');
                    return t('dashboard.greeting_evening');
                  })()}
                </AppText>
                <AppText variant="heading-lg" weight="bold" style={styles.businessNameHeading} numberOfLines={2}>{userProfile.name}</AppText>
                <AppText variant="body-sm" weight="medium" style={styles.dateLabel} numberOfLines={1}>
                  {formatDate(new Date(), calendarType, language)}
                </AppText>
              </View>
              
              <View style={styles.headerActions}>
                <TouchableOpacity 
                  onPress={handleSeedData} 
                  style={styles.headerIconBtn}
                >
                  <RefreshCw size={18} color={G.muted} />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => router.push('/notifications')} 
                  style={styles.headerIconBtn}
                >
                  <NotificationBell size={20} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowUniversalSearch(true)}
                  style={styles.headerIconBtn}
                >
                  <Search size={20} color={G.muted} />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={openSidebar} 
                  activeOpacity={0.7}
                  style={styles.headerAvatarWrap}
                >
                  <View style={styles.headerAvatarGlow}>
                    <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.headerAvatar} />
                  </View>
                  <View style={[styles.onlineIndicator, { backgroundColor: colors.success }]} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Premium Trial Banner */}
          <PremiumTrialBanner />

          {/* Dashboard Alert Cards - action required */}
          {dashboardVisibility.alerts && (
            <View style={{ paddingHorizontal: DASH_SPACING.gutter }}>
              <DashboardAlerts />
            </View>
          )}

          {/* Business Health Score */}
          {dashboardVisibility.businessHealth && (
            <View style={{ paddingHorizontal: DASH_SPACING.gutter }}>
              <BusinessHealthCard health={businessHealth} loading={healthLoading} />
            </View>
          )}

          {/* Metric Hub */}
          <Animated.View entering={FadeInDown.springify().damping(18).stiffness(120)} style={styles.metricHub}>
            <GestureDetector gesture={panGesture}>
                <View style={styles.metricCard}>
                <View style={styles.metricCardHeader}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="caption" weight="medium" style={styles.metricLabel} numberOfLines={2}>
                      {METRICS_DATA[currentMetric].label}
                    </AppText>
                    <AppNumber 
                      value={isPrivate ? null : METRICS_DATA[currentMetric].todayValue} 
                      size="display"
                      prefix={METRICS_DATA[currentMetric].isCurrency ? t('common.etb') + ' ' : ''}
                      suffix={METRICS_DATA[currentMetric].isCount ? ' ' + t('common.items') : ''}
                      fallback="••••••"
                      style={styles.metricValue}
                    />
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={styles.statusPill}>
                      <Zap size={12} color={G.fg} fill={G.fg} />
                      <AppText variant="caption" weight="bold" shrink={false} style={styles.statusPillText} numberOfLines={1}>
                        {METRICS_DATA[currentMetric].todayValue > METRICS_DATA[currentMetric].yesterdayValue ? t('dashboard.stats.growing') : (METRICS_DATA[currentMetric].todayValue < METRICS_DATA[currentMetric].yesterdayValue ? t('dashboard.stats.declining') : t('dashboard.stats.normal'))}
                      </AppText>
                    </View>
                    {METRICS_DATA[currentMetric].isCount && !metrics ? (
                      <AppText variant="caption" weight="medium" style={styles.metricSecondary} numberOfLines={1}>
                        {t('dashboard.target_items', { count: '50', items: t('common.items') })}
                      </AppText>
                    ) : (
                      <AppText variant="caption" weight="medium" style={styles.metricSecondary} numberOfLines={1}>
                        <AppNumber value={METRICS_DATA[currentMetric].yesterdayValue} size="caption" weight="medium" prefix={METRICS_DATA[currentMetric].isCurrency ? t('common.etb') + ' ' : ''} />
                        {' '}{t('dashboard.stats.yesterday')}
                      </AppText>
                    )}
                  </View>
                </View>

                <SparklineChart
                  todayValue={METRICS_DATA[currentMetric].todayValue}
                  yesterdayValue={METRICS_DATA[currentMetric].yesterdayValue}
                  color={G.fg}
                  loading={!metrics}
                />

                <View style={styles.metricCardFooter}>
                  <TouchableOpacity onPress={handlePrevMetric} style={styles.navArrow}>
                    <ChevronLeft size={18} color={G.muted} />
                  </TouchableOpacity>

                  <View style={styles.dialPagination}>
                    {METRICS_DATA.map((_, i) => (
                      <React.Fragment key={i}>
                        <View style={[
                          styles.paginationDot,
                          i === currentMetric && styles.paginationDotActive,
                          { width: i === currentMetric ? 22 : 6 }
                        ]} />
                      </React.Fragment>
                    ))}
                  </View>

                  <TouchableOpacity onPress={handleNextMetric} style={styles.navArrow}>
                    <ChevronRight size={18} color={G.muted} />
                  </TouchableOpacity>
                </View>
                    </View>
            </GestureDetector>
          </Animated.View>

          {/* Quick Stats */}
          <View style={styles.bentoSection}>
            <View style={styles.bentoSectionHeader}>
              <AppText variant="title" weight="bold" style={styles.bentoSectionTitle} numberOfLines={2}>{t('dashboard.quick_status')}</AppText>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bentoGrid}
              decelerationRate="fast"
              snapToAlignment="start"
              snapToInterval={CARD_WIDTH + CARD_GAP}
            >
              {quickStats.map((stat, idx) => {
                const StatIcon = stat.icon;
                return (
                  <React.Fragment key={stat.id}>
                    <Animated.View 
                      entering={FadeInDown.delay(80 * idx).springify().damping(20).stiffness(140)}
                    >
                    <TouchableOpacity 
                      activeOpacity={0.7}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        if (stat.id === 1) setActiveModal('lowStock');
                        else if (stat.id === 4) setActiveModal('onCreditCustomers');
                        else if (stat.id === 5) setActiveModal('onCreditItems');
                      }}
                    >
                    <View style={styles.bentoCard}>
                        <View style={styles.bentoCardTop}>
                        <View style={[styles.bentoIconBox, { backgroundColor: stat.color + '20' }]}>
                          <StatIcon size={20} color={stat.color} />
                        </View>
                        <View style={styles.bentoArrow}>
                          <ArrowUpRight size={13} color={G.muted} />
                        </View>
                      </View>
                      <AppNumber value={stat.value} size="display" style={styles.bentoValue} />
                      <AppText variant="caption" weight="medium" style={[styles.bentoLabel, { color: G.muted }]} numberOfLines={2}>{stat.title}</AppText>
                      <View style={[styles.bentoViewBtn, { backgroundColor: stat.color + '18' }]}>
                        <AppText variant="caption" weight="bold" shrink={false} style={[styles.bentoViewBtnText, { color: stat.color }]} numberOfLines={1}>{t('dashboard.view')}</AppText>
                      </View>
                </View>
                    </TouchableOpacity>
                    </Animated.View>
                  </React.Fragment>
                );
              })}
            </ScrollView>
          </View>

          {/* Business Assistant */}
          {dashboardVisibility.businessAssistant && (
            <View style={{ paddingHorizontal: DASH_SPACING.gutter }}>
              <BusinessAssistant insights={assistantInsights} loading={assistantLoading} />
            </View>
          )}

          {/* Activity Feed */}
          <View style={styles.feedSection}>
            <View style={styles.feedHeader}>
              <View>
                <AppText variant="heading" weight="bold" style={styles.feedTitle} numberOfLines={2}>{t('dashboard.recent_activity')}</AppText>
                <AppText variant="body-sm" weight="medium" style={styles.feedSub} numberOfLines={1}>{t('dash.live_overview')}</AppText>
              </View>
              <TouchableOpacity onPress={() => setShowActivityLedger(true)} style={styles.viewAllBtn}>
                <AppText variant="body" weight="bold" shrink={false} style={styles.viewAllBtnText} numberOfLines={1}>{t('common.view_all')}</AppText>
              </TouchableOpacity>
            </View>

            {recentActivities.length > 0 ? (
              <View style={styles.feedList}>
                {recentActivities.map((activity, idx) => (
                  <React.Fragment key={idx}>
                    <Animated.View entering={FadeInDown.delay(150 + (idx * 40)).springify().damping(22).stiffness(150)}>
                      {renderActivityItem(activity)}
                    </Animated.View>
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <View style={styles.emptyFeed}>
                <View style={styles.emptyFeedIcon}>
                  <Clock size={24} color={G.muted} />
                </View>
                <AppText variant="body" weight="medium" style={styles.emptyFeedText} numberOfLines={2}>{t('dashboard.no_activity')}</AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.muted, opacity: 0.5, marginTop: 4 }} numberOfLines={1}>{t('dashboard.activity_will_appear')}</AppText>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Smart FAB */}
        <View style={styles.dockedBarWrapper}>
          <Animated.View style={[expandStyle, { height: 60, borderRadius: 30, overflow: 'hidden' }]}>
            <View style={[styles.dockedBar, { paddingHorizontal: isBarExpanded ? 12 : 0 }]}>
              {isBarExpanded && (
                <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                  <TouchableOpacity style={styles.dockBtn} onPress={() => { setShowSearch(true); setIsBarExpanded(false); }}>
                    <ShoppingBag size={20} color={G.muted} />
                  </TouchableOpacity>
                </Animated.View>
              )}
              
              <TouchableOpacity 
                style={styles.dockMainBtn} 
                activeOpacity={0.85}
                onPress={() => setIsBarExpanded(!isBarExpanded)}
              >
                <Animated.View entering={FadeIn.duration(200)}>
                  {isBarExpanded ? <X size={22} color={G.bg} /> : <Plus size={22} color={G.bg} />}
                </Animated.View>
              </TouchableOpacity>
              
              {isBarExpanded && (
                <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                  <TouchableOpacity style={styles.dockBtn} onPress={() => { setShowAddAsset(true); setIsBarExpanded(false); }}>
                    <Package size={20} color={G.muted} />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          </Animated.View>
        </View>
      </View>

      {/* Bottom Sheet Modal */}
      <Modal
        visible={activeModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setActiveModal(null)} />
          <View style={styles.bottomSheetContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <AppText variant="title" shrink={false} style={styles.closeBtnText}>âœ•</AppText>
              </TouchableOpacity>
            </View>
            <AppText variant="heading" weight="bold" style={styles.sheetTitle} numberOfLines={2}>
              {activeModal === 'lowStock' ? t('dashboard.low_stock') : activeModal === 'onCreditCustomers' ? t('dashboard.credit_customers') : t('dashboard.credit_items')}
            </AppText>
            <View style={{ height: 400 }}>
              {activeModal === 'lowStock' && <LowStockItemsScreen />}
              {activeModal === 'onCreditCustomers' && <OnCreditCustomersScreen />}
              {activeModal === 'onCreditItems' && <OnCreditItemsScreen />}
            </View>
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
          <View style={[styles.bottomSheetContainer, { height: Dimensions.get('window').height * 0.90 }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
            </View>
            <ActivityLedgerScreen onClose={() => {
              setShowActivityLedger(false);
              loadDashboardData();
            }} />
          </View>
        </View>
      </Modal>

      {/* Sales Record Sheet */}
      <Modal
        visible={showSalesRecord}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSalesRecord(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSalesRecord(false)} />
          <View style={[styles.bottomSheetContainer, { height: Dimensions.get('window').height * 0.90 }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSearch(false)} />
            <View style={[styles.bottomSheetContainer, { maxHeight: Dimensions.get('window').height * 0.90, backgroundColor: colors.background, flex: 1 }]}>
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
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPending} transparent animationType="slide" onRequestClose={() => setShowPending(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowPending(false)} />
          <View style={[styles.bottomSheetContainer, { height: Dimensions.get('window').height * 0.90, backgroundColor: colors.background }]}>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSaleFormFlow(false)} />
            <View style={[styles.bottomSheetContainer, { maxHeight: Dimensions.get('window').height * 0.90, backgroundColor: colors.background, flex: 1 }]}>
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
                    const batchId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 8);
                    
                    for (const item of pendingSales) {
                     // Validate item data
                     if (!item.id || typeof item.id !== 'number') {
                       throw new Error(`Invalid item ID: ${item.id}`);
                     }
                     if (!item.quantity || item.quantity <= 0) {
                       throw new Error(`Invalid quantity for item: ${item.id}`);
                     }
                     
                     const finalUnitPrice = item.unitType === 'pack' ? item.packSellingPrice : item.baseSellingPrice;
                     const finalUnitLabel = item.unitType === 'pack' ? item.purchaseUnit : item.baseUnit;
                     
                     // Validate and sanitize customer info
                     const customerName = saleMetadata.customerName ? saleMetadata.customerName.trim() : '';
                     const customerPhone = saleMetadata.customerPhone ? saleMetadata.customerPhone.trim() : '';
                     const discount = Math.max(0, Number(saleMetadata.discount) || 0);
                      const vat = Math.min(100, Math.max(0, Number(saleMetadata.vat) || 0));
                      const taxType = saleMetadata.taxType || "VAT";
                      
                       await insertSale({
                         itemId: item.id,
                         quantity: item.quantity,
                         unit: finalUnitLabel,
                         unitType: item.unitType,
                         discount: discount / pendingSales.length,
                         vat: vat,
                         taxType: taxType,
                         totalPrice: finalUnitPrice * item.quantity,
                        paymentMethod: saleMetadata.paymentMethod,
                        paymentStatus: saleMetadata.paymentStatus,
                        customerName: customerName,
                        customerPhone: customerPhone,
                        batchId,
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
                  } catch {
                    await dialog.alert({
                      title: t('common.error'),
                      message: t('sale.save_error'),
                      iconType: 'danger',
                    });
                  }
               }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

      <Modal visible={showAddAsset} transparent animationType="slide" onRequestClose={() => setShowAddAsset(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowAddAsset(false)} />
            <View style={[styles.bottomSheetContainer, { maxHeight: Dimensions.get('window').height * 0.90, backgroundColor: colors.background, flex: 1 }]}>
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
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!lastSaleData} transparent animationType="fade">
        <SaleSuccessModal 
          saleData={lastSaleData} 
          onClose={() => setLastSaleData(null)} 
        />
      </Modal>
      <UniversalSearch
        visible={showUniversalSearch}
        onClose={() => setShowUniversalSearch(false)}
        onNavigate={(result) => {
          setShowUniversalSearch(false);
          const data = result.data;
          switch (result.type) {
            case 'sale':
              setSelectedSale(data);
              break;
            case 'expense':
              setSelectedExpense(data);
              break;
            case 'adjustment':
              setSelectedAdjustment(data);
              break;
            case 'item':
            case 'category':
              router.push('/inventory');
              break;
            case 'budget':
              router.push('/budget');
              break;
            case 'warehouse':
            case 'contact':
              router.push('/contacts');
              break;
            default:
              break;
          }
        }}
      />
    </>
  );
};

const createStyles = (G: any) => StyleSheet.create({
  container: {
    paddingBottom: 220,
    paddingTop: 10,
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
    borderColor: G.borderGlass,
    backgroundColor: G.surfaceFill,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: G.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: G.shadowOuter * 0.5,
    shadowRadius: 4,
    elevation: 1,
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: G.bg,
  },
  notifBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
  },
  glassHeader: {
    paddingHorizontal: DASH_SPACING.gutter,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 20,
  },
  glassHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingLabel: {
    fontFamily: Fonts.medium,
    marginBottom: 2,
    color: G.muted,
  },
  businessNameHeading: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
    color: G.fg,
  },
  dateLabel: {
    fontFamily: Fonts.medium,
    opacity: 0.7,
    color: G.muted,
  },
  headerAvatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: G.borderGlassStrong,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
    position: 'relative',
    backgroundColor: G.surfaceFill,
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  headerAvatarGlow: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    overflow: 'hidden',
  },
  onlineIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: G.bg,
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  metricHub: {
    paddingHorizontal: DASH_SPACING.gutter,
    marginTop: 8,
    marginBottom: 24,
  },
  metricCard: {
    padding: 24,
    borderRadius: DASH_SPACING.cardRadiusLg,
    backgroundColor: G.surfaceFill,
    borderWidth: 1,
    borderColor: G.borderGlass,
    shadowColor: G.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: G.shadowOuter,
    shadowRadius: 24,
    elevation: 6,
  },
  metricCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  metricLabel: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    color: G.muted,
  },
  metricValue: {
    fontFamily: Fonts.bold,
    color: G.fg,
  },
  metricSecondary: {
    fontFamily: Fonts.medium,
    color: G.muted,
  },
  metricNoData: {
    textAlign: 'center',
    marginVertical: 40,
    fontFamily: Fonts.medium,
    color: G.muted,
  },
  metricCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  navArrow: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: G.surfaceFillStrong,
    borderWidth: 1,
    borderColor: G.borderGlass,
    shadowColor: G.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: G.shadowOuter * 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 6,
    backgroundColor: G.surfaceFillStrong,
    borderWidth: 1,
    borderColor: G.borderGlass,
    shadowColor: G.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: G.shadowOuter * 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
  statusPillText: {
    fontFamily: Fonts.bold,
    color: G.fg,
  },
  dialPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  paginationDot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: G.mutedLight,
  },
  paginationDotActive: {
    backgroundColor: G.fg,
    shadowColor: G.fg,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  bentoSection: {
    paddingLeft: DASH_SPACING.gutter,
    marginBottom: 24,
  },
  bentoSectionHeader: {
    paddingRight: DASH_SPACING.gutter,
    marginBottom: 14,
  },
  bentoSectionTitle: {
    fontFamily: Fonts.bold,
    color: G.fg,
  },
  bentoGrid: {
    flexDirection: 'row',
    paddingRight: DASH_SPACING.gutter,
    gap: 15,
  },
  bentoCard: {
    flex: 1,
    padding: 18,
    position: 'relative',
    minHeight: 150,
    justifyContent: 'space-between',
    borderRadius: DASH_SPACING.cardRadius,
    backgroundColor: G.surfaceFill,
    borderWidth: 1,
    borderColor: G.borderGlass,
    shadowColor: G.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: G.shadowOuter * 0.8,
    shadowRadius: 18,
    elevation: 4,
  },
  bentoCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bentoIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: G.borderSubtle,
    overflow: 'hidden',
  },
  bentoValue: {
    fontFamily: Fonts.extrabold,
    marginBottom: 4,
    letterSpacing: -0.5,
    color: G.fg,
  },
  bentoLabel: {
    fontFamily: Fonts.medium,
    lineHeight: 16,
    marginBottom: 12,
  },
  bentoArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: G.surfaceFillStrong,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: G.borderSubtle,
  },
  bentoViewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  bentoViewBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
  },
  bentoArrowLabel: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bentoArrowLabelText: {
    fontFamily: Fonts.bold,
  },
  viewAllBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: G.surfaceFill,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: G.borderGlass,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: G.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: G.shadowOuter * 0.6,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyFeedText: {
    fontFamily: Fonts.medium,
    color: G.muted,
  },
  closeBtn: {
    position: 'absolute',
    top: 15,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: G.surfaceFillStrong,
    borderWidth: 1,
    borderColor: G.borderGlass,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: G.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: G.shadowOuter * 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  closeBtnText: {
    fontFamily: Fonts.medium,
    color: G.muted,
  },
  feedSection: {
    paddingHorizontal: DASH_SPACING.gutter,
    marginTop: 8,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  feedTitle: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
    color: G.fg,
  },
  feedSub: {
    fontFamily: Fonts.medium,
    color: G.muted,
  },
  viewAllBtnText: {
    fontFamily: Fonts.bold,
    color: G.fgSecondary,
  },
  feedList: {
    gap: 0,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: G.surfaceFill,
    borderWidth: 1,
    borderColor: G.borderGlass,
    shadowColor: G.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  premiumActivityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: G.bgCard,
    borderWidth: 1,
    borderColor: G.border,
  },
  activityIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: G.borderSubtle,
    overflow: 'hidden',
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
    color: G.fg,
  },
  activityMeta: {
    fontFamily: Fonts.medium,
    color: G.muted,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  activityTime: {
    fontFamily: Fonts.medium,
    color: G.muted,
  },
  emptyFeed: {
    paddingVertical: 56,
    alignItems: 'center',
    backgroundColor: G.surfaceFill,
    borderRadius: DASH_SPACING.cardRadius,
    borderWidth: 1,
    borderColor: G.borderGlass,
    marginTop: 8,
    gap: 8,
    overflow: 'hidden',
  },
  emptyFeedIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: G.surfaceFillStrong,
    borderWidth: 1,
    borderColor: G.borderGlass,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
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
    borderColor: G.borderLight,
    backgroundColor: G.bgCard || G.surfaceFill,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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
    backgroundColor: G.fg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: G.fg,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 40,
    backgroundColor: G.surfaceFill,
    borderWidth: 1,
    borderColor: G.borderGlass,
    borderBottomWidth: 0,
    maxHeight: Dimensions.get('window').height * 0.90,
    elevation: 8,
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
    backgroundColor: G.mutedLight,
  },
  sheetTitle: {
    fontFamily: Fonts.bold,
    paddingHorizontal: DASH_SPACING.gutter,
    paddingBottom: 20,
    color: G.fg,
  },
});

export default DashboardScreen;