import SaleSuccessModal from '@/components/SaleSuccessModal';
import ExpenseReminderModal from '@/components/ExpenseReminderModal';
import { NotificationBell } from '@/components/NotificationBell';
import { DashboardAlerts } from '@/components/DashboardAlerts';
import { Fonts } from '@/constants/theme';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import {
    AlertTriangle,
    ArrowUpRight,
    Bell,
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
    Zap
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Dimensions,
    Image,
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

const { width } = Dimensions.get('window');

import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import { useSidebar } from '@/context/SidebarContext';
import { getActivityFeed, getAdjustmentById, getDashboardStats, getDebtCustomers, getExpenseById, getInventoryStats, getLowStockItems, getOnCreditItems, getRecentItems, getSaleById, ItemData } from '@/database/db';
import { generateBulkTestData } from '@/database/generateTestData';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDate, toEthiopianHour, isEthiopianDayHour } from '@/utils/date-utils';
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
import { SparklineSkeleton } from '@/components/ChartSkeleton';
import { AppText } from '@/components/ui';
const SparklineChart = React.memo(({ todayValue = 0, yesterdayValue = 0, color = '#2F6FED', loading = false }: {
  todayValue?: number;
  yesterdayValue?: number;
  color?: string;
  loading?: boolean;
}) => {
  const widthSize = width - 80;
  const heightSize = 90;

  // While data is still being fetched, render a skeleton. Otherwise
  // the user briefly sees the default flat curve (todayValue === 0
  // triggers the `isPositive` branch and a flat-line SVG) which is
  // visually misleading.
  if (loading || (todayValue === 0 && yesterdayValue === 0)) {
    return <SparklineSkeleton width={widthSize} height={heightSize} />;
  }

  // Sanitise inputs (defensive — guards against NaN from upstream).
  const safeToday = Number.isFinite(todayValue) ? todayValue : 0;
  const safeYesterday = Number.isFinite(yesterdayValue) ? yesterdayValue : 0;

  // Determine trend based on today vs yesterday comparison
  const isPositive = safeToday > safeYesterday;
  const isNegative = safeToday < safeYesterday;

  // SVG path strings and dot Y-coordinate are derived from the
  // current metric — memoised so the chart doesn't re-render when
  // the parent (e.g., theme) changes for unrelated reasons.
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
    const { userProfile, colors, calendarType, language, timeSystem, theme, t } = useSettings();
    const { notifCount } = useNotifications();
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
    const [recentInventoryItems, setRecentInventoryItems] = useState<ItemData[]>([]);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [pendingSales, setPendingSales] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [invStats, setInvStats] = useState<any>(null);
    const [debtCustomersCount, setDebtCustomersCount] = useState(0);
    const [creditItemsCount, setCreditItemsCount] = useState(0);
    const [lowStockCount, setLowStockCount] = useState(0);
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
     const today = new Date().toISOString().split('T')[0];
     const activities = await getActivityFeed({ limit: 5, date: today });
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

    const lowStock = await getLowStockItems();
    setLowStockCount(lowStock.length);
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

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
      message: `${result.message}\n\n⏱️ ${elapsed}s`,
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
    let amountColor = colors.text;
    let prefix = '';

    if (isSale) {
      Icon = ShoppingBag;
      iconBg = colors.primary;
      label = `${activity.quantity || 0} ${t('dashboard.activity.sold')}`;
      amountColor = colors.success || '#34C759';
      prefix = '+';
    } else if (isExpense) {
      Icon = TrendingDown;
      iconBg = '#FF3B30';
      label = activity.expenseCategory || t('expense.not_recurring');
      amountColor = '#FF3B30';
      prefix = '-';
    } else if (isAdjustment) {
      const adjType = activity.adjType || activity.type;
      if (adjType === 'price_up') {
        Icon = TrendingUp;
        iconBg = '#34C759';
        label = t('adjustment.price_increased');
        amountColor = '#34C759';
        prefix = '+';
      } else if (adjType === 'price_down') {
        Icon = TrendingDown;
        iconBg = '#FF3B30';
        label = t('adjustment.price_decreased');
        amountColor = '#FF3B30';
        prefix = '-';
      } else {
        Icon = AlertTriangle;
        iconBg = '#FF9500';
        label = t('dashboard.activity.damaged');
        // For damaged, show loss amount (quantity * purchase price)
        amountColor = '#FF9500';
        prefix = '-';
      }
    } else if (isInventory) {
      Icon = Package;
      iconBg = colors.primary;
      label = `${activity.quantity || 0} ${t('dashboard.activity.added')}`;
      amountColor = colors.success || '#34C759';
      prefix = '+';
    }

    // Name
    const activityName = activity.name || activity.label ||
      (isSale ? t('inventory.header') : (isExpense ? t('expense.header') : (isAdjustment ? t('adjustment.header') : t('inventory.header'))));
    
    // Amount
    let displayAmt = typeof activity.amount === 'number' && !isNaN(activity.amount)
      ? activity.amount
      : (typeof activity.value === 'number' && !isNaN(activity.value) ? activity.value : null);
    
    // For damaged items, compute loss as quantity * basePurchasePrice
    if (isAdjustment && activity.adjType === 'damaged' && activity.quantity && activity.basePurchasePrice) {
      displayAmt = activity.quantity * activity.basePurchasePrice;
    }

    return (
      <TouchableOpacity
        key={`${activity.category ?? activity.type}-${activity.id}`}
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
          <AppText
            style={[styles.activityName, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {activityName}
          </AppText>
          <AppText variant="title-sm" weight="medium" style={[styles.activityMeta, { color: colors.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</AppText>
        </View>

        <View style={styles.activityRight}>
          {displayAmt !== null && (
            <AppText variant="title-sm" weight="bold" shrink={false} style={[styles.activityAmount, { color: amountColor }]} numberOfLines={1}>
              {prefix}{displayAmt.toLocaleString()} {t('common.etb')}
            </AppText>
          )}
          <AppText variant="caption" weight="medium" style={[styles.activityTime, { color: colors.textSecondary }]} numberOfLines={1}>
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
      value: `${metrics.today.grossProfit.toLocaleString()} ${t('common.etb')}`, 
      secondary: `${metrics.yesterday.grossProfit.toLocaleString()} ${t('common.etb')} ${t('dashboard.stats.yesterday')}`,
      todayValue: metrics.today.grossProfit,
      yesterdayValue: metrics.yesterday.grossProfit,
    },
    { 
      label: t('dashboard.stats.revenue'), 
      value: `${metrics.today.revenue.toLocaleString()} ${t('common.etb')}`, 
      secondary: `${metrics.yesterday.revenue.toLocaleString()} ${t('common.etb')} ${t('dashboard.stats.yesterday')}`, 
      todayValue: metrics.today.revenue,
      yesterdayValue: metrics.yesterday.revenue,
    },
    { 
      label: t('dashboard.stats.sales_count'), 
      value: `${metrics.today.salesCount} ${t('common.items')}`, 
      secondary: `${metrics.yesterday.salesCount} ${t('dashboard.stats.yesterday')}`, 
      todayValue: metrics.today.salesCount,
      yesterdayValue: metrics.yesterday.salesCount,
    },
    { 
      label: t('dashboard.stats.expense'), 
      value: `${metrics.today.expenses.toLocaleString()} ${t('common.etb')}`, 
      secondary: `${metrics.yesterday.expenses.toLocaleString()} ${t('dashboard.stats.yesterday')}`, 
      todayValue: metrics.today.expenses,
      yesterdayValue: metrics.yesterday.expenses,
    },
  ] : [
    { label: t('dashboard.stats.gross_profit'), value: `0 ${t('common.etb')}`, secondary: `0 ${t('common.etb')}`, todayValue: 0, yesterdayValue: 0 },
    { label: t('dashboard.stats.revenue'), value: `0 ${t('common.etb')}`, secondary: `0 ${t('common.etb')}`, todayValue: 0, yesterdayValue: 0 },
    { label: t('dashboard.stats.sales_count'), value: `0 ${t('common.items')}`, secondary: `Target: 50 ${t('common.items')}`, todayValue: 0, yesterdayValue: 0 },
    { label: t('dashboard.stats.expense'), value: `0 ${t('common.etb')}`, secondary: `0 ${t('common.etb')}`, todayValue: 0, yesterdayValue: 0 },
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
    { id: 1, title: t('dashboard.low_stock'), value: lowStockCount.toString(), icon: Package, color: '#FF9500' },
    { id: 4, title: t('dashboard.credit_customers'), value: debtCustomersCount.toString(), icon: Handshake, color: '#34C759' },
    { id: 5, title: t('dashboard.credit_items'), value: creditItemsCount.toString(), icon: Clock, color: '#FF3B30' },
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
              <AppText variant="body" weight="medium" style={[styles.greetingLabel, { color: colors.textSecondary }]} numberOfLines={2}>
                {(() => {
                  // Greeting respects the active time system. In
                  // Ethiopian mode the user is greeted based on the
                  // Ethiopian hour (12:00 ETH at 6 AM, etc.), so the
                  // "morning" greeting fires earlier in the day.
                  const localHour = new Date().getHours();
                  const ethHour = toEthiopianHour(localHour);
                  const activeHour = timeSystem === 'ethiopian' ? ethHour : localHour;
                  if (activeHour < 6) return t('dashboard.greeting_evening');
                  if (activeHour < 12) return t('dashboard.greeting_morning');
                  if (activeHour < 18) return t('dashboard.greeting_afternoon');
                  return t('dashboard.greeting_evening');
                })()}
              </AppText>
              <AppText variant="heading-lg" weight="bold" style={[styles.businessNameHeading, { color: colors.text }]} numberOfLines={2}>{userProfile.name}</AppText>
              <AppText variant="body-sm" weight="medium" style={[styles.dateLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {formatDate(new Date(), calendarType, language)}
              </AppText>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity 
                onPress={handleSeedData} 
                style={[styles.headerIconBtn, { borderColor: colors.border }]}
              >
                <AppText variant="title" shrink={false} style={{ color: colors.text }}>🧪</AppText>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => router.push('/notifications')} 
                style={[styles.headerIconBtn, { borderColor: colors.border }]}
              >
                  <NotificationBell size={24} />
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={openSidebar} 
                activeOpacity={0.7}
                style={[styles.headerAvatarWrap, { borderColor: colors.border }]}
              >
                <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.headerAvatar} />
                <View style={[styles.onlineIndicator, { backgroundColor: '#34C759', borderColor: colors.background }]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Dashboard Alert Cards - action required */}
          <View style={{ paddingHorizontal: 25 }}>
            <DashboardAlerts />
          </View>

          {/* Metric Hub Area */}
          <Animated.View entering={FadeIn.duration(600)} style={styles.metricHub}>
            <GestureDetector gesture={panGesture}>
              <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                
{/* Header row with metric details and status */}
                 <View style={styles.metricCardHeader}>
                   <View style={{ flex: 1 }}>
                      <AppText variant="caption" weight="medium" style={[styles.metricLabel, { color: colors.textSecondary }]} numberOfLines={2}>
                        {METRICS_DATA[currentMetric].label}
                      </AppText>
                      <AppText variant="display" weight="extrabold" shrink={false} style={[styles.metricValue, { color: colors.text, fontSize: METRICS_DATA[currentMetric].value.length > 12 ? 22 : 28 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {isPrivate ? '••••••' : METRICS_DATA[currentMetric].value}
                      </AppText>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <View style={[styles.statusPill, { backgroundColor: colors.surface }]}>
                        <Zap size={12} color={currentMetric === 3 ? '#FF3B30' : colors.primary} fill={currentMetric === 3 ? '#FF3B30' : colors.primary} />
                        <AppText variant="caption" weight="bold" shrink={false} style={[styles.statusPillText, { color: colors.text }]} numberOfLines={1}>
                          {METRICS_DATA[currentMetric].todayValue > METRICS_DATA[currentMetric].yesterdayValue ? t('dashboard.stats.growing') : (METRICS_DATA[currentMetric].todayValue < METRICS_DATA[currentMetric].yesterdayValue ? t('dashboard.stats.declining') : t('dashboard.stats.normal'))}
                        </AppText>
                      </View>
                      <AppText variant="caption" weight="medium" style={[styles.metricSecondary, { color: colors.textSecondary }]} numberOfLines={1}>
                        {METRICS_DATA[currentMetric].secondary}
                      </AppText>
                   </View>
                 </View>

                 {/* Animated Sparkline Trend */}
                 <React.Fragment key={currentMetric}>
                   <Animated.View entering={FadeInDown.duration(400)}>
                     <SparklineChart
                       todayValue={METRICS_DATA[currentMetric].todayValue}
                       yesterdayValue={METRICS_DATA[currentMetric].yesterdayValue}
                       color={currentMetric === 3 ? '#FF3B30' : colors.primary}
                       loading={!metrics}
                     />
                   </Animated.View>
                 </React.Fragment>

                {/* Card footer: navigation & page indicators */}
                <View style={styles.metricCardFooter}>
                  <TouchableOpacity onPress={handlePrevMetric} style={styles.navArrow}>
                    <ChevronLeft size={20} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <View style={styles.dialPagination}>
                    {METRICS_DATA.map((_, i) => (
                      <React.Fragment key={i}>
                        <View 
                          style={[
                            styles.paginationDot, 
                            { backgroundColor: i === currentMetric ? colors.primary : colors.border, width: i === currentMetric ? 16 : 6 }
                          ]} 
                        />
                      </React.Fragment>
                    ))}
                  </View>

                  <TouchableOpacity onPress={handleNextMetric} style={styles.navArrow}>
                    <ChevronRight size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

              </View>
            </GestureDetector>
          </Animated.View>

          {/* Quick Stats Scrollable Section */}
          <View style={styles.bentoSection}>
            <View style={styles.bentoSectionHeader}>
              <AppText variant="title" weight="bold" style={[styles.bentoSectionTitle, { color: colors.text }]} numberOfLines={2}>{t('dashboard.quick_status')}</AppText>
            </View>
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
                  <React.Fragment key={stat.id}>
                    <Animated.View 
                      entering={FadeInDown.delay(100 * idx).duration(500)}
                    >
                    <TouchableOpacity 
                      style={[styles.bentoCard, { backgroundColor: colors.card, borderColor: colors.border }]} 
                      activeOpacity={0.7}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        if (stat.id === 1) setActiveModal('lowStock');
                        else if (stat.id === 4) setActiveModal('onCreditCustomers');
                        else if (stat.id === 5) setActiveModal('onCreditItems');
                      }}
                    >
                      <View style={styles.bentoCardTop}>
                        <View style={[styles.bentoIconBox, { backgroundColor: stat.color + '20' }]}>
                          <StatIcon size={20} color={stat.color} />
                        </View>
                        <View style={[styles.bentoArrow, { backgroundColor: stat.color + '15' }]}>
                          <ArrowUpRight size={14} color={stat.color} />
                        </View>
                      </View>
              <AppText variant="display" weight="extrabold" shrink={false} style={[styles.bentoValue, { color: colors.text }]} numberOfLines={1}>{stat.value}</AppText>
              <AppText variant="caption" weight="medium" style={[styles.bentoLabel, { color: colors.textSecondary }]} numberOfLines={2}>{stat.title}</AppText>
                      <View style={[styles.bentoViewBtn, { backgroundColor: stat.color + '12' }]}>
                        <AppText variant="caption" weight="bold" shrink={false} style={[styles.bentoViewBtnText, { color: stat.color }]} numberOfLines={1}>View →</AppText>
                      </View>
                    </TouchableOpacity>
                    </Animated.View>
                  </React.Fragment>
                );
              })}
            </ScrollView>
          </View>

          {/* Productivity Feed Footer */}
          <View style={styles.feedSection}>
            <View style={styles.feedHeader}>
              <View>
                <AppText variant="heading" weight="bold" style={[styles.feedTitle, { color: colors.text }]} numberOfLines={2}>{t('dashboard.recent_activity')}</AppText>
                <AppText variant="body-sm" weight="medium" style={[styles.feedSub, { color: colors.textSecondary }]} numberOfLines={1}>{t('dash.live_overview')}</AppText>
              </View>
              <TouchableOpacity onPress={() => setShowActivityLedger(true)} style={styles.viewAllBtn}>
                <AppText variant="body" weight="bold" shrink={false} style={[styles.viewAllBtnText, { color: colors.primary }]} numberOfLines={1}>{t('common.view_all')}</AppText>
              </TouchableOpacity>
            </View>

            {recentActivities.length > 0 ? (
              <View style={styles.feedList}>
                {recentActivities.map((activity, idx) => (
                  <React.Fragment key={idx}>
                    <Animated.View entering={FadeInDown.delay(200 + (idx * 50)).duration(500)}>
                      {renderActivityItem(activity)}
                    </Animated.View>
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <View style={styles.emptyFeed}>
                 <AppText variant="caption" weight="medium" style={[styles.emptyFeedText, { color: colors.textSecondary }]} numberOfLines={2}>{t('dashboard.no_activity')}</AppText>
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
                style={[styles.dockMainBtn, { backgroundColor: isBarExpanded ? colors.text : colors.text }]} 
                activeOpacity={0.8}
                onPress={() => setIsBarExpanded(!isBarExpanded)}
              >
                <Plus size={24} color={colors.background} />
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
                <AppText variant="title" shrink={false} style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</AppText>
              </TouchableOpacity>
            </View>
            <AppText variant="heading" weight="bold" style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={2}>
              {activeModal === 'lowStock' ? t('dashboard.low_stock') : activeModal === 'onCreditCustomers' ? t('dashboard.credit_customers') : t('dashboard.credit_items')}
            </AppText>
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
                     
                     await insertSale({
                       itemId: item.id,
                       quantity: item.quantity,
                       unit: finalUnitLabel,
                       unitType: item.unitType,
                       discount: discount / pendingSales.length,
                       vat: vat,
                       totalPrice: finalUnitPrice * item.quantity,
                       paymentMethod: saleMetadata.paymentMethod,
                       paymentStatus: saleMetadata.paymentStatus,
                       customerName: customerName,
                       customerPhone: customerPhone,
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
  },
  notifBadgeText: {
    fontFamily: Fonts.bold,
  },
  greetingLabel: {
    fontFamily: Fonts.medium,
    marginBottom: 2,
  },
  businessNameHeading: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  dateLabel: {
    fontFamily: Fonts.medium,
    opacity: 0.7,
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
  metricCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
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
  },
  metricValue: {
    fontFamily: Fonts.bold,
  },
  metricSecondary: {
    fontFamily: Fonts.medium,
  },
  metricCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  navArrow: {
    padding: 6,
    borderRadius: 12,
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
  bentoSectionHeader: {
    paddingRight: 25,
    marginBottom: 14,
  },
  bentoSectionTitle: {
    fontFamily: Fonts.bold,
  },
  bentoGrid: {
    flexDirection: 'row',
    paddingRight: 25,
    gap: 15,
  },
  bentoCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 140,
    justifyContent: 'space-between',
  },
  bentoCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bentoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bentoValue: {
    fontFamily: Fonts.extrabold,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  bentoLabel: {
    fontFamily: Fonts.medium,
    lineHeight: 16,
    marginBottom: 10,
  },
  bentoArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bentoViewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  bentoViewBtnText: {
    fontFamily: Fonts.bold,
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
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  emptyFeedText: {
    fontFamily: Fonts.medium,
  },
  closeBtn: {
    position: 'absolute',
    top: 15,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    fontFamily: Fonts.medium,
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
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  feedSub: {
    fontFamily: Fonts.medium,
  },
  viewAllBtnText: {
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
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  activityMeta: {
    fontFamily: Fonts.medium,
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
    fontFamily: Fonts.bold,
    paddingHorizontal: 25,
    paddingBottom: 20,
  },
});

export default DashboardScreen;