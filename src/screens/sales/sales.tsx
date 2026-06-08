import { Fonts } from '@/constants/theme';
import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import {
  getActiveBusiness,
    getCustomerActivity,
    getDebtCustomers,
    getDebtSales,
    getPaymentMethodBreakdown,
    getPeakSalesHoursByItem,
    getRecentSales,
    getSalesChartData,
    getSalesSummary,
    getTopSellingItems,
    insertSale,
    markDebtAsLoss,
    processDebtPayment,
    processIndividualPayment
} from '@/database/db';
import { useNotifications } from '@/hooks/useNotifications';
import { formatShortDate, getDayName, getDayNameFull, getEthiopianMonthNames, toEthiopianDate, formatHourLabel, toEthiopianHour, formatTime } from '@/utils/date-utils';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
    Banknote,
    BarChart3,
    Bell,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    CreditCard,
    DollarSign,
    Download,
    Phone,
    Plus,
    Search,
    User,
    Wallet,
    X
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    Linking,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import GlobalCheckout from './sale-form';
import SaleDetailsScreen from './sales-details';
import SalesRecordScreen from './sales-record';
import SearchScreen from './search';
import { generateInvoicePDF } from '@/utils/pdf-utils';
import { PDFLanguageModal } from '@/components/PDFLanguageModal';
import PendingSales from './pending';
import { useNavigationIntent } from '@/context/NavigationIntentContext';
import { useDialog } from '@/context/DialogContext';
import { BarChartSkeleton } from '@/components/ChartSkeleton';
import { ChartEmpty, ChartError } from '@/components/ChartStateView';
import { AppText } from '@/components/ui';
const { width, height } = Dimensions.get('window');

const SalesDashboard = () => {
  const { openSidebar } = useSidebar();
  const { userProfile, colors, calendarType, language, timeSystem, t, theme } = useSettings();
  const { notifCount } = useNotifications();
  const router = useRouter();
  const { consumeIntent, intent: pendingIntent } = useNavigationIntent();
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState('W');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [periodOffset, setPeriodOffset] = useState(0);
  const [showSalesRecord, setShowSalesRecord] = useState(false);
  const [showSaleFlow, setShowSaleFlow] = useState(false);
  const [saleFlowStep, setSaleFlowStep] = useState<'search' | 'form' | 'pending'>('search');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [pendingSales, setPendingSales] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);
  const [isBarExpanded, setIsBarExpanded] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [chartDataState, setChartDataState] = useState<{ labels: string[], values: number[] }>({ labels: [], values: [] });
  const [chartLoaded, setChartLoaded] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [activeBusiness] = useState<any>({ businessName: userProfile.businessName || 'My Store', storeName: 'Main Branch' });

  // Modal states for KPIs
  const [showPeakHoursModal, setShowPeakHoursModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [peakHoursData, setPeakHoursData] = useState<any[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<any[]>([]);

  // Collect Payments modal
  const [showCollectPayment, setShowCollectPayment] = useState(false);
  const [debtCustomers, setDebtCustomers] = useState<any[]>([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerDebts, setCustomerDebts] = useState<any[]>([]);
  const [showCustomerActivity, setShowCustomerActivity] = useState(false);
  const [customerActivity, setCustomerActivity] = useState<any[]>([]);
  const [selectedDebtItems, setSelectedDebtItems] = useState<number[]>([]);
  // qty to pay per item (saleId -> qty string)
  const [partialQtyMap, setPartialQtyMap] = useState<Record<number, string>>({});

  // Invoice PDF state
  const [showInvoiceLangModal, setShowInvoiceLangModal] = useState(false);
  const [invoiceTarget, setInvoiceTarget] = useState<'single' | 'all' | null>(null);

  const loadData = () => {
    setChartLoaded(false);
    const today = new Date().toISOString().split('T')[0];
    const allSales = getRecentSales(100);
    // Filter to today only
    const todaySales = allSales.filter((s: any) => {
      const saleDate = s.createdAt ? s.createdAt.split(' ')[0] || s.createdAt.substring(0, 10) : '';
      return saleDate === today;
    });
    const sales = todaySales.slice(0, 5);
    setRecentSales(sales);

    const dbChartData = getSalesChartData(activeTab as 'W' | 'M' | 'Y', periodOffset);
    if (dbChartData && dbChartData.length > 0) {
      const baseLabels = dbChartData.map(d => d.label);
      const baseValues = dbChartData.map(d => d.value);
      const labels = activeTab === 'Y' && calendarType === 'ethiopian' ? [...baseLabels, '13'] : baseLabels;
      const values = activeTab === 'Y' && calendarType === 'ethiopian' ? [...baseValues, 0] : baseValues;
      setChartDataState({ labels, values });
    } else {
      setChartDataState({ labels: [], values: [] });
    }
    setChartLoaded(true);

    const salesSummary = getSalesSummary();
    setSummary(salesSummary);

    const products = getTopSellingItems(5);
    setTopItems(products);
  };

  const onRefresh = React.useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 800);
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [activeTab, periodOffset]);

  const expandedWidth = useSharedValue(56);
  useEffect(() => {
    expandedWidth.value = withSpring(isBarExpanded ? width - 50 : 56, { damping: 15, stiffness: 100 });
  }, [isBarExpanded, width]);

  const expandStyle = useAnimatedStyle(() => ({
    width: expandedWidth.value,
  }));

  useEffect(() => {
    setSelectedIdx(null);
    setSelectedIdx(-1);
  }, [activeTab, periodOffset]);

  // Chart state machine. We only render the real BarChart once data is
  // present AND non-empty. Until then we show a skeleton or the empty
  // state — never an empty frame with zero-height bars, which is what
  // react-native-gifted-charts produces when given an empty `data`.
  const sanitizedValues = useMemo(
    () => (chartDataState.values || []).map((v) => (Number.isFinite(v) && !Number.isNaN(v) ? Math.max(0, v) : 0)),
    [chartDataState.values],
  );

  const hasChartData = sanitizedValues.length > 0 && sanitizedValues.some(v => v > 0);
  const maxValueInData = hasChartData ? Math.max(...sanitizedValues) : 500;
  const chartMax = maxValueInData * 1.3;

  // Calculate dynamic barWidth and spacing to fit the graph within the frame bounds
  const numBars = sanitizedValues.length || 7;
  const availWidth = width - 80;
  const calculatedBarWidth = Math.floor(availWidth / (numBars + (numBars - 1) * 0.5));
  const calculatedSpacing = Math.floor(calculatedBarWidth * 0.5);

  // Format data for GiftedCharts — memoized so the heavy date-math
  // only re-runs when chart data, period, language, or selection changes.
  const todayBadgeText = useMemo(() => {
    if (activeTab === 'W') return t('sales.today');
    if (activeTab === 'M') return t('sales.this_week');
    return t('sales.this_month');
  }, [activeTab, t]);

  const chartData = useMemo(() => sanitizedValues.map((val, i) => {
    let label = chartDataState.labels[i];
    let fullLabel = label;
    if (activeTab === 'W' && label !== 'None') {
      const dayIdx = parseInt(label);
      if (!isNaN(dayIdx)) {
        const d = new Date();
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay() + dayIdx);
        weekStart.setDate(weekStart.getDate() + (periodOffset * 7));
        label = getDayName(weekStart, calendarType, language).substring(0, 3);
        fullLabel = getDayNameFull(weekStart, calendarType, language);
      }
    } else if (activeTab === 'M') {
      const weekNum = parseInt(label);
      if (!isNaN(weekNum)) {
        label = t('sales.week_chart_label', { num: String(weekNum) });
        fullLabel = label;
      }
    } else if (activeTab === 'Y') {
      const monthNum = parseInt(label);
      if (!isNaN(monthNum)) {
        const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'en-US', ti: 'en-US' };
        if (calendarType === 'ethiopian') {
          const name = getEthiopianMonthNames(language)[monthNum - 1];
          label = name.substring(0, 3);
          fullLabel = name;
        } else {
          const d = new Date(2024, monthNum - 1, 1);
          label = d.toLocaleDateString(localeMap[language] || 'en-US', { month: 'short' });
          fullLabel = d.toLocaleDateString(localeMap[language] || 'en-US', { month: 'long' });
        }
      }
    }

    // Highlight current period
    let isCurrent = false;
    if (activeTab === 'W') {
      const today = new Date();
      const todayDay = today.getDay(); // 0=Sun, 1=Mon ...
      isCurrent = i === todayDay && periodOffset === 0;
    } else if (activeTab === 'M') {
      const now = new Date();
      const currentWeek = Math.ceil(now.getDate() / 7);
      isCurrent = i === (currentWeek - 1) && periodOffset === 0;
    } else if (activeTab === 'Y') {
      const now = new Date();
      const currentMonth = calendarType === 'ethiopian'
        ? toEthiopianDate(now).month - 1
        : now.getMonth();
      isCurrent = i === currentMonth && periodOffset === 0;
    }

    const isSelected = selectedIdx === i;
    const isHighlighted = isSelected || isCurrent;

    let barColor: string;
    let gradientColor: string;
    if (isCurrent) {
      barColor = colors.warning || '#FF9500';
      gradientColor = (colors.warning || '#FF9500') + '40';
    } else if (isSelected) {
      barColor = colors.primary;
      gradientColor = colors.primary + '40';
    } else {
      barColor = colors.primary + '25';
      gradientColor = colors.primary + '15';
    }

    return {
      value: val,
      label: label !== 'None' ? label : '',
      fullLabel: fullLabel !== 'None' ? fullLabel : '',
      frontColor: barColor,
      gradientColor,
      isCurrent,
      isSelected,
    };
  }), [sanitizedValues, chartDataState.labels, activeTab, periodOffset, calendarType, language, selectedIdx, colors.primary, colors.warning]);

  // Stable per-bar topLabelComponent factory. We render the badge
  // (or placeholder) here once per `chartData` and pass a stable
  // function reference to BarChart so the prop equality check
  // doesn't re-animate the "today" pill on every parent re-render.
  const barTopLabelComponents = useMemo(
    () =>
      chartData.map((d, i) => () => {
        if (d.isCurrent) {
          return (
            <View style={styles.currentPeriodBadge}>
              <AppText variant="micro" weight="bold" style={styles.currentPeriodBadgeText} numberOfLines={1}>{todayBadgeText}</AppText>
            </View>
          );
        }
        return <View style={styles.currentPeriodBadgePlaceholder} />;
      }),
    [chartData, todayBadgeText],
  );

  const totalRevenue = useMemo(() => sanitizedValues.reduce((a, b) => a + b, 0), [sanitizedValues]);

  // Stable onPress handler for BarChart — we resolve the pressed
  // item's value from chartData so the tooltip below always shows
  // the correct, sanitised number.
  const handleBarPress = useCallback((_item: any, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIdx((prev) => (prev === index ? -1 : index));
  }, []);

  const barChartDataWithLabels = useMemo(
    () => chartData.map((d, i) => ({ ...d, topLabelComponent: barTopLabelComponents[i] })),
    [chartData, barTopLabelComponents],
  );

  const handlePeriodChange = (tab: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    setPeriodOffset(0);
  };

  // Format date range label based on active tab
  const getDateRangeLabel = useMemo(() => () => {
    const now = new Date();
    const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'en-US', ti: 'en-US' };
    const locale = localeMap[language] || 'en-US';

    if (activeTab === 'W') {
      const dayOffset = periodOffset * 7;
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + dayOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      if (calendarType === 'ethiopian') {
        const es = toEthiopianDate(weekStart);
        const ee = toEthiopianDate(weekEnd);
        const mName = getEthiopianMonthNames(language);
        if (es.month === ee.month) {
          return `${mName[es.month - 1]} ${es.day} – ${ee.day}, ${es.year}`;
        }
        return `${mName[es.month - 1]} ${es.day} – ${mName[ee.month - 1]} ${ee.day}, ${es.year}`;
      }
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      return `${weekStart.toLocaleDateString(locale, options)} – ${weekEnd.toLocaleDateString(locale, options)}`;
    } else if (activeTab === 'M') {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
      if (calendarType === 'ethiopian') {
        const e = toEthiopianDate(monthDate);
        return `${getEthiopianMonthNames(language)[e.month - 1]} ${e.year}`;
      }
      const monthName = monthDate.toLocaleDateString(locale, { month: 'long' });
      return `${monthName} ${monthDate.getFullYear()}`;
    } else {
      const yearDate = new Date(now.getFullYear() + periodOffset, 0, 1);
      if (calendarType === 'ethiopian') {
        return String(toEthiopianDate(yearDate).year);
      }
      return yearDate.getFullYear().toString();
    }
  }, [activeTab, periodOffset, calendarType, language]);

  const salesKPIs = useMemo(() => {
    const tapHint = t('sales.tap_to_view');
    const topPayment = (summary?.payments ?? [])
      .slice()
      .sort((a: any, b: any) => (Number(b.total) || 0) - (Number(a.total) || 0))[0];
    const topPaymentName = topPayment?.paymentMethod
      ? String(topPayment.paymentMethod).trim()
      : '';
    const methodsCount = summary?.payments?.length || 0;
    const methodsValue = topPaymentName && methodsCount > 0
      ? `${topPaymentName} · ${methodsCount}`
      : methodsCount > 0
        ? `${methodsCount} ${t('sales.types')}`
        : tapHint;
    return [
      { title: t('sales.peak_hour'), value: tapHint, isHint: true, icon: Clock, color: '#FF9500', onPress: () => handleShowPeakHours() },
      { title: t('sales.methods'), value: methodsValue, icon: Wallet, color: '#FF3B30', onPress: () => handleShowPaymentMethods() },
    ];
  }, [t, summary]);

  const handleShowPeakHours = () => {
    const data = getPeakSalesHoursByItem();
    setPeakHoursData(data);
    setShowPeakHoursModal(true);
  };

  const handleShowPaymentMethods = () => {
    const today = new Date().toISOString().split('T')[0];
    const data = getPaymentMethodBreakdown(today, today);
    setPaymentBreakdown(data);
    setShowPaymentModal(true);
  };

  // Collect Payments handlers
  const handleOpenCollectPayments = (preSelectName?: string) => {
    const customers: any[] = getDebtCustomers() as any[];
    setDebtCustomers(customers);
    setSearchCustomer(preSelectName || '');
    setShowCollectPayment(true);
    if (preSelectName) {
      const match = customers.find((c: any) => c.customerName === preSelectName);
      if (match) {
        setSelectedCustomer(match);
        const debts = getDebtSales(match.customerName);
        setCustomerDebts(debts);
        setSelectedDebtItems([]);
        setPartialQtyMap({});
        setShowCustomerActivity(false);
      } else {
        setSelectedCustomer(null);
      }
    } else {
      setSelectedCustomer(null);
    }
  };

  // Consume any pending navigation intent (e.g. from a notification
  // "View Details" tap that asked to open the collect-payments modal).
  // React to the `intent` value itself — this fires reliably on first
  // mount AND on subsequent publishes, without racing the focus event.
  React.useEffect(() => {
    if (!pendingIntent) return;
    if (pendingIntent.kind === 'collect_payments') {
      handleOpenCollectPayments(pendingIntent.customerName);
    }
    consumeIntent();
  }, [pendingIntent, consumeIntent]);

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    const debts = getDebtSales(customer.customerName);
    setCustomerDebts(debts);
    setSelectedDebtItems([]);
    setPartialQtyMap({});
    setShowCustomerActivity(false);
  };

  const handleFullPayment = async (customer: any) => {
    const ok = await dialog.confirm({
      title: t('sales.confirm_full_title'),
      message: t('sales.confirm_full_msg', { amount: customer.oweAmount.toLocaleString(), name: customer.customerName }),
      confirmText: t('sales.confirm_action') || 'Confirm',
      cancelText: t('common.cancel'),
      iconType: 'success',
    });
    if (ok) {
      processDebtPayment(customer.customerName, customer.oweAmount, 'full');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCollectPayment(false);
      loadData();
    }
  };

  const filteredDebtCustomers = useMemo(
    () => debtCustomers.filter(c =>
      c.customerName?.toLowerCase().includes(searchCustomer.toLowerCase())
    ),
    [debtCustomers, searchCustomer],
  );

  const handleInvoiceDownload = async (lang: 'en' | 'am' | 'om' | 'ti', action: 'share' | 'save') => {
    const business = getActiveBusiness();
    if (invoiceTarget === 'single' && selectedCustomer) {
      const debts = getDebtSales(selectedCustomer.customerName);
      await generateInvoicePDF(selectedCustomer, debts, business, lang, action);
    } else if (invoiceTarget === 'all') {
      // Generate one combined invoice for all customers
      const allDebts = debtCustomers.flatMap(c => getDebtSales(c.customerName));
      const combined = { customerName: t('sales.all_customers'), customerPhone: '', oweAmount: debtCustomers.reduce((s, c) => s + (c.oweAmount || 0), 0) };
      await generateInvoicePDF(combined, allDebts, business, lang, action);
    }
    setInvoiceTarget(null);
  };

  const formatDueDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (calendarType === 'ethiopian') {
      const e = toEthiopianDate(d);
      return `${getEthiopianMonthNames(language)[e.month - 1].substring(0, 3)} ${e.day}, ${e.year}`;
    }
    const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'en-US', ti: 'en-US' };
    return d.toLocaleDateString(localeMap[language] || 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const customerKeyExtractor = useCallback((item: any, idx: number) => item.customerName + idx, []);
  const renderCustomerItem = useCallback(({ item }: { item: any }) => {
    const isOverdue = item.earliestDue && new Date(item.earliestDue) < new Date();
    return (
      <TouchableOpacity
        style={[styles.cpCustomerRow, {
          backgroundColor: colors.card,
          borderColor: isOverdue ? '#FF3B3040' : colors.border,
          borderLeftColor: isOverdue ? '#FF3B30' : colors.border,
          borderLeftWidth: isOverdue ? 3 : 1,
        }]}
        onPress={() => handleSelectCustomer(item)}
        activeOpacity={0.75}
      >
        <View style={[styles.cpAvatar, { backgroundColor: isOverdue ? '#FF3B3015' : colors.primary + '15' }]}>
          <User size={17} color={isOverdue ? '#FF3B30' : colors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <AppText variant="body" weight="bold" style={[styles.cpCustomerName, { color: colors.text }]} numberOfLines={1}>
            {item.customerName}
          </AppText>
          <AppText variant="caption" weight="medium" style={[styles.cpDueText, { color: isOverdue ? '#FF3B30' : colors.textSecondary }]} numberOfLines={1}>
            {item.earliestDue
              ? (isOverdue ? t('sales.overdue_label', { date: formatDueDate(item.earliestDue) }) : t('sales.due_label', { date: formatDueDate(item.earliestDue) }))
              : t('sales.no_due_date')}
          </AppText>
        </View>
        <AppText variant="body" weight="bold" shrink={false} style={[styles.cpAmount, { color: isOverdue ? '#FF3B30' : '#FF9500' }]} numberOfLines={1}>
          {item.oweAmount.toLocaleString()} {t('common.etb')}
        </AppText>
      </TouchableOpacity>
    );
  }, [colors, t, formatDueDate, handleSelectCustomer]);

  const debtItemKeyExtractor = useCallback((item: any) => item.id.toString(), []);
  const renderDebtItem = useCallback(({ item }: { item: any }) => {
    const paid = item.paidAmount || 0;
    const remaining = item.totalPrice - paid;
    const isItemOverdue = item.dueDate && new Date(item.dueDate) < new Date();
    const isSelected = selectedDebtItems.includes(item.id);
    const maxQty = item.quantity;
    const currentQtyStr = partialQtyMap[item.id] ?? String(maxQty);
    const currentQty = Math.min(Math.max(1, parseInt(currentQtyStr) || 1), maxQty);
    const unitPrice = maxQty > 0 ? item.totalPrice / maxQty : 0;
    const payAmt = Math.min(unitPrice * currentQty, remaining);
    return (
      <View style={[styles.cpItemCard, {
        backgroundColor: colors.card,
        borderColor: isSelected ? colors.primary : (isItemOverdue ? '#FF3B3030' : colors.border),
        borderWidth: isSelected ? 1.5 : 1,
      }]}>
        <TouchableOpacity
          style={styles.cpItemTop}
          onPress={() => setSelectedDebtItems(prev =>
            prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
          )}
          activeOpacity={0.8}
        >
          <View style={[styles.cpCheckbox, {
            backgroundColor: isSelected ? colors.primary : 'transparent',
            borderColor: isSelected ? colors.primary : colors.border,
          }]}>
            {isSelected && <Check size={10} color="#FFF" strokeWidth={3} />}
          </View>
          <AppText variant="body" weight="bold" style={[styles.cpItemName, { color: colors.text }]} numberOfLines={1}>
            {item.itemName}
          </AppText>
          <View style={[styles.cpStatusBadge, {
            backgroundColor: item.paymentStatus === 'Paid' ? '#34C75915' : paid > 0 ? '#FF950015' : '#FF3B3015'
          }]}>
            <AppText variant="micro" weight="bold" shrink={false} style={[styles.cpStatusText, {
              color: item.paymentStatus === 'Paid' ? '#34C759' : paid > 0 ? '#FF9500' : '#FF3B30'
            }]} numberOfLines={1}>
              {item.paymentStatus === 'Paid' ? t('sales.status_paid') : paid > 0 ? t('sales.status_partial') : t('sales.status_unpaid')}
            </AppText>
          </View>
        </TouchableOpacity>
        <View style={[styles.cpItemStats, { borderTopColor: colors.border }]}>
          <View style={styles.cpStat}>
            <AppText variant="micro" weight="medium" style={[styles.cpStatLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sales.stat_qty')}</AppText>
            <AppText variant="body" weight="bold" shrink={false} style={[styles.cpStatValue, { color: colors.text }]} numberOfLines={1}>{item.quantity} {item.unit}</AppText>
          </View>
          <View style={styles.cpStat}>
            <AppText variant="micro" weight="medium" style={[styles.cpStatLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sales.stat_total')}</AppText>
            <AppText variant="body" weight="bold" shrink={false} style={[styles.cpStatValue, { color: colors.text }]} numberOfLines={1}>{item.totalPrice.toLocaleString()}</AppText>
          </View>
          <View style={styles.cpStat}>
            <AppText variant="micro" weight="medium" style={[styles.cpStatLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sales.stat_paid')}</AppText>
            <AppText variant="body" weight="bold" shrink={false} style={[styles.cpStatValue, { color: '#34C759' }]} numberOfLines={1}>{paid.toLocaleString()}</AppText>
          </View>
          <View style={styles.cpStat}>
            <AppText variant="micro" weight="medium" style={[styles.cpStatLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sales.stat_left')}</AppText>
            <AppText variant="body" weight="bold" shrink={false} style={[styles.cpStatValue, { color: '#FF9500' }]} numberOfLines={1}>{remaining.toLocaleString()}</AppText>
          </View>
        </View>
        {isSelected && (
          <View style={[styles.cpQtyRow, { borderTopColor: colors.border }]}>
            <AppText variant="caption" weight="medium" style={[styles.cpQtyLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sales.pay_qty')}</AppText>
            <View style={styles.cpQtyStepper}>
              <TouchableOpacity
                style={[styles.cpStepBtn, { backgroundColor: colors.border }]}
                onPress={() => setPartialQtyMap(prev => ({ ...prev, [item.id]: String(Math.max(1, currentQty - 1)) }))}
              >
                <AppText variant="title" weight="bold" shrink={false} style={[styles.cpStepBtnText, { color: colors.text }]} numberOfLines={1}>−</AppText>
              </TouchableOpacity>
              <TextInput
                style={[styles.cpQtyInput, { color: colors.text, borderColor: colors.border }]}
                value={currentQtyStr}
                onChangeText={v => {
                  const n = parseInt(v);
                  setPartialQtyMap(prev => ({
                    ...prev,
                    [item.id]: isNaN(n) ? v : String(Math.min(Math.max(1, n), maxQty))
                  }));
                }}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <TouchableOpacity
                style={[styles.cpStepBtn, { backgroundColor: colors.border }]}
                onPress={() => setPartialQtyMap(prev => ({ ...prev, [item.id]: String(Math.min(maxQty, currentQty + 1)) }))}
              >
                <AppText variant="title" weight="bold" style={[styles.cpStepBtnText, { color: colors.text }]} numberOfLines={1}>+</AppText>
              </TouchableOpacity>
              <AppText variant="caption" weight="medium" style={[styles.cpQtyOf, { color: colors.textSecondary }]} numberOfLines={1}>/ {maxQty}</AppText>
            </View>
            <AppText variant="body" weight="bold" style={[styles.cpPayAmt, { color: colors.primary }]} numberOfLines={1}>
              {payAmt.toLocaleString()} {t('common.etb')}
            </AppText>
          </View>
        )}
      </View>
    );
  }, [colors, t, selectedDebtItems, partialQtyMap]);

  const activityKeyExtractor = useCallback((item: any, idx: number) => (item.id || 0).toString() + idx, []);
  const renderActivityItem = useCallback(({ item, index }: { item: any, index: number }) => {
    const isFP    = item.activityType === 'full_payment';
    const isPP    = item.activityType === 'partial_payment';
    const isPurch = item.activityType === 'purchase';

    const dotColor = isFP ? '#34C759' : isPP ? '#FF9500' : colors.primary;

    const typeLabel = isFP    ? t('sales.activity_full')
                    : isPP    ? t('sales.activity_partial')
                    : t('sales.activity_credit');
    const typeEmoji = isFP ? '💳' : isPP ? '💵' : '🛒';

    const timeStr = item.createdAt
      ? (() => {
          const cd = new Date(item.createdAt);
          const datePart = formatShortDate(cd, calendarType, language);
          const isoLike = (typeof item.createdAt === 'string' && !item.createdAt.includes('T') && !item.createdAt.includes('Z'))
            ? `${item.createdAt.replace(' ', 'T')}Z`
            : item.createdAt;
          const timePart = formatTime(isoLike, timeSystem, language);
          return `${datePart}, ${timePart}`;
        })()
      : '';

    const paid      = Number(item.paidSoFar ?? item.paidAmount ?? 0);
    const remaining = Number(item.remainingBalance ?? (item.totalPrice - paid));

    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
        <View style={{ alignItems: 'center', marginRight: 12, paddingTop: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor }} />
          {index < customerActivity.length - 1 && (
            <View style={{ width: 2, flex: 1, minHeight: 30, backgroundColor: colors.border, marginTop: 4 }} />
          )}
        </View>

        <View style={{
          flex: 1, borderRadius: 14, borderWidth: 1,
          padding: 12, marginBottom: 2,
          backgroundColor: colors.card,
          borderColor: colors.border,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: dotColor + '18' }}>
              <AppText variant="caption" weight="bold" style={{ fontSize: 11, fontFamily: Fonts.bold, color: dotColor }} numberOfLines={1}>
                {typeEmoji} {typeLabel}
              </AppText>
            </View>
            <AppText variant="micro" weight="medium" style={{ fontSize: 10, fontFamily: Fonts.medium, color: colors.textSecondary }} numberOfLines={1}>
              {timeStr}
            </AppText>
          </View>

          <AppText variant="body" weight="bold" style={{ fontSize: 14, fontFamily: Fonts.bold, color: colors.text, marginBottom: 8 }} numberOfLines={1}>
            {item.itemName || '—'}
            <AppText variant="caption" weight="medium" style={{ fontSize: 12, fontFamily: Fonts.medium, color: colors.textSecondary }} numberOfLines={1}>
              {'  '}×{item.quantity} {item.unit}
            </AppText>
          </AppText>

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primary + '12' }}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ fontSize: 9, fontFamily: Fonts.bold, color: colors.textSecondary }} numberOfLines={1}>{t('sales.stat_total')}</AppText>
              <AppText variant="caption" weight="bold" style={{ fontSize: 12, fontFamily: Fonts.bold, color: colors.text }} numberOfLines={1}>
                {Number(item.totalPrice).toLocaleString()} {t('common.etb')}
              </AppText>
            </View>

            {(isFP || isPP) && paid > 0 && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#34C75912' }}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={{ fontSize: 9, fontFamily: Fonts.bold, color: colors.textSecondary }} numberOfLines={1}>{t('sales.stat_paid')}</AppText>
                <AppText variant="caption" weight="bold" style={{ fontSize: 12, fontFamily: Fonts.bold, color: '#34C759' }} numberOfLines={1}>
                  {(isFP ? Number(item.totalPrice) : paid).toLocaleString()} {t('common.etb')}
                </AppText>
              </View>
            )}

            {isPP && remaining > 0 && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#FF950012' }}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={{ fontSize: 9, fontFamily: Fonts.bold, color: colors.textSecondary }} numberOfLines={1}>{t('sales.stat_left')}</AppText>
                <AppText variant="caption" weight="bold" style={{ fontSize: 12, fontFamily: Fonts.bold, color: '#FF9500' }} numberOfLines={1}>
                  {remaining.toLocaleString()} {t('common.etb')}
                </AppText>
              </View>
            )}

            {isPurch && remaining > 0 && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#FF3B3012' }}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={{ fontSize: 9, fontFamily: Fonts.bold, color: colors.textSecondary }} numberOfLines={1}>{t('sales.stat_owed')}</AppText>
                <AppText variant="caption" weight="bold" style={{ fontSize: 12, fontFamily: Fonts.bold, color: '#FF3B30' }} numberOfLines={1}>
                  {remaining.toLocaleString()} {t('common.etb')}
                </AppText>
              </View>
            )}

            {item.paymentMethod && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.border + '60' }}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={{ fontSize: 9, fontFamily: Fonts.bold, color: colors.textSecondary }} numberOfLines={1}>{t('sales.stat_method')}</AppText>
                <AppText variant="caption" weight="bold" style={{ fontSize: 12, fontFamily: Fonts.bold, color: colors.text }} numberOfLines={1}>
                  {item.paymentMethod}
                </AppText>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }, [colors, t, calendarType, language, timeSystem, customerActivity]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Background Ambience */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgWash, { top: -50, right: -50, backgroundColor: colors.primary, opacity: 0.08 }]} />
      </View>

      <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { backgroundColor: 'transparent' }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.text}
              colors={[colors.text]}
            />
          }
        >
          {/* Integrated Header */}
          <View style={styles.integratedHeader}>
            <View style={{ flex: 1 }}>
<AppText variant="caption" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sales.overview')}</AppText>
<AppText variant="display" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('sales.revenue_hub')}</AppText>
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

              <TouchableOpacity onPress={openSidebar} style={[styles.headerAvatarBox, { borderColor: colors.border }]}>
                <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.headerAvatar} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Revenue Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.revenueMainDisplay}>
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.revenueRangeLabel, { color: colors.textSecondary }]} numberOfLines={2}>
                {activeTab === 'W' ? t('sales.weekly_revenue') : activeTab === 'M' ? t('sales.monthly_revenue') : t('sales.yearly_revenue')}
              </AppText>
              <AppText variant="display-lg" weight="black" shrink={false} style={[styles.totalRevenueVal, { color: colors.text, fontFamily: Fonts.black, fontSize: totalRevenue >= 10000000 ? 36 : totalRevenue >= 1000000 ? 40 : totalRevenue >= 100000 ? 44 : 52 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {totalRevenue.toLocaleString()}<AppText variant="body" weight="medium" style={styles.currency} numberOfLines={1}> {t('common.etb')}</AppText>
              </AppText>
              <AppText variant="caption" weight="medium" style={[styles.dateRangeSubLabel, { color: colors.textSecondary }]} numberOfLines={2}>
                {getDateRangeLabel()}
              </AppText>
            </View>

            {/* Selected bar detail */}
            {selectedIdx !== null && selectedIdx >= 0 && selectedIdx < sanitizedValues.length && (
              <Animated.View entering={FadeIn.duration(200)} style={[styles.selectedBarDetail, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                <AppText variant="caption" weight="medium" style={[styles.selectedBarLabel, { color: colors.textSecondary }]} numberOfLines={2}>
                  {chartData[selectedIdx]?.fullLabel || chartData[selectedIdx]?.label || (chartDataState.labels[selectedIdx] !== 'None' ? chartDataState.labels[selectedIdx] : '—')}
                </AppText>
                <AppText variant="body-lg" weight="bold" shrink={false} style={[styles.selectedBarValue, { color: colors.primary }]} numberOfLines={1}>
                  {sanitizedValues[selectedIdx].toLocaleString()} {t('common.etb')}
                </AppText>
              </Animated.View>
            )}

            <View style={styles.chartContainer}>
              {!chartLoaded ? (
                <BarChartSkeleton
                  height={150}
                  barCount={numBars}
                />
              ) : !hasChartData ? (
                <ChartEmpty height={150} icon="chart" message={t('sales.no_sales_period')} />
              ) : (
                <BarChart
                  data={barChartDataWithLabels}
                  barWidth={calculatedBarWidth}
                  spacing={calculatedSpacing}
                  roundedTop
                  hideRules
                  hideAxesAndRules
                  yAxisThickness={0}
                  xAxisThickness={0}
                  noOfSections={4}
                  maxValue={chartMax}
                  isAnimated
                  showGradient
                   initialSpacing={0}
                  onPress={handleBarPress}
                  width={width - 50}
                  height={150}
                  showValuesAsTopLabel={false}
                  xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10, fontFamily: Fonts.medium }}
                />
              )}
            </View>

            {/* Time Period Selectors */}
            <View style={styles.periodRow}>
              <View style={[styles.periodBar, { backgroundColor: colors.surface }]}>
                {[
                  { key: 'W', label: t('sales.wk_label') },
                  { key: 'M', label: t('sales.mo_label') },
                  { key: 'Y', label: t('sales.yr_label') },
                ].map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => handlePeriodChange(tab.key)}
                    style={[styles.periodTab, activeTab === tab.key && { backgroundColor: colors.primary }]}
                  >
                    <AppText variant="caption" weight="bold" shrink={false} style={[styles.periodTabText, { color: activeTab === tab.key ? '#FFF' : colors.textSecondary }]} numberOfLines={1}>{tab.label}</AppText>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.periodNavRow}>
                <TouchableOpacity onPress={() => setPeriodOffset(prev => prev - 1)} style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <ChevronLeft size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPeriodOffset(prev => prev + 1)} disabled={periodOffset >= 0} style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }, periodOffset >= 0 && { opacity: 0.3 }]}>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Business Intelligence Bento - Updated KPIs */}
          <View style={styles.bentoSection}>
            <View style={styles.bentoGrid}>
              {salesKPIs.map((kpi, idx) => {
                const KpiIcon = kpi.icon;
                return (
                  <TouchableOpacity key={idx} onPress={kpi.onPress} activeOpacity={0.7}>
                    <Animated.View entering={FadeInDown.delay(idx * 100).duration(500)} style={[styles.bentoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[styles.bentoIconArea, { backgroundColor: kpi.color + '15' }]}>
                        <KpiIcon size={18} color={kpi.color} />
                      </View>
            <AppText variant={kpi.isHint ? 'body-sm' : 'title'} weight={kpi.isHint ? 'medium' : 'bold'} shrink={false} style={[styles.bentoValue, { color: kpi.isHint ? colors.textSecondary : colors.text, fontSize: kpi.isHint ? 14 : (kpi.value.length > 10 ? 16 : 18) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{kpi.value}</AppText>
            <AppText variant="caption" weight="medium" style={[styles.bentoLabel, { color: colors.textSecondary }]} numberOfLines={2}>{kpi.title}</AppText>
                    </Animated.View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Top Selling Products */}
          {topItems.length > 0 && (
            <View style={styles.topItemsSection}>
              <View style={styles.sectionHead}>
                <AppText variant="heading" weight="bold" style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={2}>{t('sales.top_performing')}</AppText>
                <BarChart3 size={18} color={colors.textSecondary} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topItemsScroll}>
                {topItems.map((item, idx) => (
                  <View key={idx} style={[styles.topItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
                      <AppText variant="caption" weight="extrabold" style={styles.rankText} numberOfLines={1}>{idx + 1}</AppText>
                    </View>
                    <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.topItemName, { color: colors.text }]}>{item.name}</AppText>
                    <AppText variant="body" weight="bold" shrink={false} style={[styles.topItemRevenue, { color: colors.primary }]} numberOfLines={1}>{item.totalRevenue.toLocaleString()} {t('common.etb')}</AppText>
                    <AppText variant="caption" weight="medium" style={[styles.topItemVolume, { color: colors.textSecondary }]} numberOfLines={2}>
                      {t('common.item_sold_count', {
                        count: item.totalQty,
                        unit: t('form.' + (item.baseUnit || 'pieces').toLowerCase())
                      })}
                    </AppText>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Transaction Ledger */}
          <View style={styles.ledgerSection}>
            <View style={styles.sectionHead}>
              <View>
                <AppText variant="heading" weight="bold" style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={2}>{t('sales.recent_sales')}</AppText>
                <AppText variant="body-sm" weight="medium" style={[styles.sectionSub, { color: colors.textSecondary }]} numberOfLines={1}>{t('sales.detailed_ledger')}</AppText>
              </View>
              <TouchableOpacity onPress={() => setShowSalesRecord(true)}>
                <AppText variant="body" weight="bold" shrink={false} style={[styles.viewAllBtn, { color: colors.primary }]} numberOfLines={1}>{t('common.view_all')}</AppText>
              </TouchableOpacity>
            </View>

            <View style={styles.ledgerList}>
              {recentSales.map((sale, idx) => (
                <Animated.View key={idx} entering={FadeInDown.delay(300 + (idx * 50)).duration(500)}>
                  <SalesActivityCard
                    sale={sale}
                    onPress={() => {
                      setSelectedSale(sale);
                      setShowSaleDetails(true);
                    }}
                  />
                </Animated.View>
              ))}
              {recentSales.length === 0 && (
                <View style={styles.emptyContainer}>
                  <AppText variant="body" weight="medium" style={[styles.emptyText, { color: colors.textSecondary }]} numberOfLines={2}>{t('sales.no_sales')}</AppText>
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
                <TouchableOpacity style={styles.dockBtn} onPress={() => { setShowSalesRecord(true); setIsBarExpanded(false); }}>
                  <Search size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}

            <TouchableOpacity
              style={[styles.dockMainBtn, { backgroundColor: isBarExpanded ? colors.primary : colors.text }]}
              onPress={() => {
                if (isBarExpanded) {
                  setSaleFlowStep('search');
                  setSelectedItem(null);
                  setShowSaleFlow(true);
                  setIsBarExpanded(false);
                } else {
                  setIsBarExpanded(true);
                }
              }}
            >
              <Plus size={24} color={isBarExpanded ? colors.background : colors.background} />
            </TouchableOpacity>

            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                <TouchableOpacity style={styles.dockBtn} onPress={() => { handleOpenCollectPayments(); setIsBarExpanded(false); }}>
                  <DollarSign size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}
          </BlurView>
        </Animated.View>
      </View>

      {/* Peak Hours Modal */}
      <Modal visible={showPeakHoursModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowPeakHoursModal(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <AppText variant="heading" weight="bold" style={[styles.peakModalTitle, { color: colors.text }]} numberOfLines={2}>{t('sales.peak_sales_hours')}</AppText>
              <AppText variant="body-sm" weight="medium" style={[styles.peakModalSub, { color: colors.textSecondary }]} numberOfLines={2}>{t('sales.peak_subtitle')}</AppText>
            </View>
            <ScrollView contentContainerStyle={{ padding: 25, gap: 12 }} showsVerticalScrollIndicator={false}>
              {peakHoursData.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Clock size={48} color={colors.border} />
                  <AppText variant="body" weight="medium" style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'center', marginTop: 12 }]} numberOfLines={3}>
                    {t('sales.no_peak_data')}
                  </AppText>
                </View>
              ) : (
                peakHoursData.map((row: any, idx: number) => {
                  const hour = parseInt(row.hour ?? '0');
                  const nextHour = (hour + 1) % 24;
                  // Hour labels respect the user's selected time system.
                  // - 'ethiopian': shift by -6 so 6 AM Gregorian → 12:00 (Day).
                  // - 'device':   use 12-hour AM/PM in the active language.
                  const fmt = (h: number) => formatHourLabel(h, timeSystem, language);
                  const timeRange = `${fmt(hour)} – ${fmt(nextHour)}`;
                  const barWidth = peakHoursData[0]?.count > 0
                    ? `${Math.round((row.count / peakHoursData[0].count) * 100)}%`
                    : '0%';
                  const rankColors = ['#FF9500', '#FF9500CC', '#FF9500AA', '#FF950088', '#FF950066'];
                  const rankColor = rankColors[idx] ?? rankColors[4];

                  return (
                    <View key={idx} style={[styles.peakCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.peakCardRow}>
                        {/* Rank badge */}
                        <View style={[styles.peakRankBadge, { backgroundColor: rankColor + '20' }]}>
                          <AppText variant="body" weight="bold" shrink={false} style={[styles.peakRankText, { color: rankColor }]}>#{idx + 1}</AppText>
                        </View>

                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={styles.peakCardTopRow}>
                            <View style={styles.peakTimeRow}>
                              <Clock size={14} color={rankColor} />
                              <AppText variant="body" weight="bold" shrink={false} style={[styles.peakTimeText, { color: colors.text }]} numberOfLines={1}>{timeRange}</AppText>
                            </View>
                            <AppText variant="body" weight="bold" shrink={false} style={[styles.peakCountText, { color: rankColor }]} numberOfLines={1}>
                              {row.count} {row.count === 1 ? t('sales.sale') : t('sales.sales_plural')}
                            </AppText>
                          </View>

                          {/* Progress bar */}
                          <View style={[styles.peakBarBg, { backgroundColor: colors.border }]}>
                            <View style={[styles.peakBarFill, { width: barWidth as any, backgroundColor: rankColor }]} />
                          </View>

                          <AppText variant="caption" weight="medium" style={[styles.peakQtyText, { color: colors.textSecondary }]} numberOfLines={2}>
                            {t('sales.units_sold', { count: row.totalQty ?? 0 })}
                          </AppText>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Methods Modal */}
      <Modal visible={showPaymentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowPaymentModal(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <AppText variant="heading" weight="bold" style={[styles.peakModalTitle, { color: colors.text }]} numberOfLines={2}>{t('sales.payment_methods_modal')}</AppText>
              <AppText variant="body-sm" weight="medium" style={[styles.peakModalSub, { color: colors.textSecondary }]} numberOfLines={2}>{t('sales.payment_subtitle')}</AppText>
            </View>
            <ScrollView contentContainerStyle={{ padding: 25, gap: 12 }} showsVerticalScrollIndicator={false}>
              {paymentBreakdown.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Wallet size={48} color={colors.border} />
                  <AppText variant="body" weight="medium" style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'center', marginTop: 12 }]} numberOfLines={3}>
                    {t('sales.no_payment_data')}
                  </AppText>
                </View>
              ) : (() => {
                const grandTotal = paymentBreakdown.reduce((sum: number, pm: any) => sum + (Number(pm.total) || 0), 0);
                return paymentBreakdown.map((pm: any, idx: number) => {
                  const amount = Number(pm.total) || 0;
                  const pct = grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0;
                  const isCash = (pm.paymentMethod || '').toLowerCase().includes('cash');
                  const iconColor = isCash ? '#34C759' : '#2F6FED';
                  return (
                    <View key={idx} style={[styles.paymentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.paymentRow}>
                        <View style={[styles.paymentIconBox, { backgroundColor: iconColor + '15' }]}>
                          {isCash ? <Banknote size={20} color={iconColor} /> : <CreditCard size={20} color={iconColor} />}
                        </View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                          <AppText variant="body" weight="bold" style={[styles.paymentMethodText, { color: colors.text }]} numberOfLines={2}>{pm.paymentMethod || t('sales.unknown_method')}</AppText>
                          <AppText variant="caption" weight="medium" shrink={false} style={[styles.paymentAmountText, { color: colors.textSecondary }]} numberOfLines={1}>{amount.toLocaleString()} {t('common.etb')}</AppText>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <AppText variant="body" weight="bold" shrink={false} style={[styles.paymentPercentText, { color: iconColor }]} numberOfLines={1}>{pct}%</AppText>
                          <AppText variant="caption" weight="medium" style={[styles.paymentCountText, { color: colors.textSecondary }]} numberOfLines={2}>{t('sales.transactions_count', { count: pm.count })}</AppText>
                        </View>
                      </View>
                      <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                        <View style={[styles.progressBarFill, { width: `${pct}%` as any, backgroundColor: iconColor }]} />
                      </View>
                    </View>
                  );
                });
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Collect Payments Modal */}
      <Modal visible={showCollectPayment} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowCollectPayment(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, width: '100%' }}>
                <AppText variant="heading" weight="bold" style={[styles.peakModalTitle, { color: colors.text }]} numberOfLines={2}>{t('sales.collect_payments')}</AppText>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  {debtCustomers.length > 0 && (
                    <TouchableOpacity
                      style={[styles.invoiceBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
                      onPress={() => { setInvoiceTarget('all'); setShowInvoiceLangModal(true); }}
                    >
                      <Download size={14} color={colors.primary} />
                      <AppText variant="caption" weight="bold" shrink={false} style={[styles.invoiceBtnText, { color: colors.primary }]} numberOfLines={1}>{t('sales.all_invoices')}</AppText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setShowCollectPayment(false)}>
                    <X size={22} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {!selectedCustomer ? (
              /* ── Customer List: name · amount · due date only ── */
              <View style={{ flex: 1, paddingHorizontal: 20 }}>
                <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 12 }]}>
                  <Search size={16} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder={t('sales.search_customers')}
                    placeholderTextColor={colors.textSecondary}
                    value={searchCustomer}
                    onChangeText={setSearchCustomer}
                  />
                  {searchCustomer.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchCustomer('')}>
                      <X size={15} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
                <FlatList
                  data={filteredDebtCustomers}
                  keyExtractor={customerKeyExtractor}
                  showsVerticalScrollIndicator={false}
                  renderItem={renderCustomerItem}
                  ListEmptyComponent={
                    <AppText variant="body" weight="medium" style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'center', marginTop: 50 }]} numberOfLines={3}>
                      {t('sales.no_outstanding')}
                    </AppText>
                  }
                />
              </View>
            ) : (
              /* ── Customer Detail ── */
              <View style={{ flex: 1 }}>
                {/* Header: back + name + due + call */}
                <View style={[styles.cpDetailHeader, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity onPress={() => setSelectedCustomer(null)} style={styles.cpBackBtn}>
                    <ChevronLeft size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <AppText variant="title-sm" weight="bold" style={[styles.cpCustomerName, { color: colors.text, fontSize: 16 }]} numberOfLines={1}>
                      {selectedCustomer.customerName}
                    </AppText>
                    {selectedCustomer.earliestDue && (
                      <AppText variant="caption" weight="medium" style={[styles.cpDueText, {
                        color: new Date(selectedCustomer.earliestDue) < new Date() ? '#FF3B30' : colors.textSecondary
                      }]} numberOfLines={1}>
                        {t('common.due_date', { date: formatDueDate(selectedCustomer.earliestDue) }) as any}
                      </AppText>
                    )}
                  </View>
                  {selectedCustomer.customerPhone && (
                    <TouchableOpacity
                      style={[styles.cpCallBtn, { backgroundColor: '#34C75918' }]}
                      onPress={() => Linking.openURL(`tel:${selectedCustomer.customerPhone}`)}
                    >
                      <Phone size={18} color="#34C759" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.cpCallBtn, { backgroundColor: colors.primary + '15' }]}
                    onPress={() => { setInvoiceTarget('single'); setShowInvoiceLangModal(true); }}
                  >
                    <Download size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View style={[styles.cpTabRow, { borderBottomColor: colors.border }]}>
                  {[t('sales.items_tab'), t('sales.activity_tab')].map(tab => {
                    const active = tab === t('sales.items_tab') ? !showCustomerActivity : showCustomerActivity;
                    return (
                      <TouchableOpacity
                        key={tab}
                        style={[styles.cpTab, active && { borderBottomColor: colors.text, borderBottomWidth: 2 }]}
                        onPress={() => {
                          if (tab === 'Activity') {
                            setShowCustomerActivity(true);
                            const act = getCustomerActivity(selectedCustomer.customerName);
                            setCustomerActivity(act);
                          } else {
                            setShowCustomerActivity(false);
                          }
                        }}
                      >
                        <AppText variant="caption" weight="bold" shrink={false} style={[styles.cpTabText, { color: active ? colors.text : colors.textSecondary }]} numberOfLines={1}>{tab}</AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {!showCustomerActivity ? (
                  /* ── Items Tab ── */
                  <View style={{ flex: 1 }}>
                    <FlatList
                      data={customerDebts}
                      keyExtractor={debtItemKeyExtractor}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}
                      renderItem={renderDebtItem}
                    />

                    {/* Sticky footer */}
                    <View style={[styles.cpFooter, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                      <View style={[styles.cpTotalRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <AppText variant="caption" weight="medium" style={[styles.cpTotalLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sales.total_outstanding')}</AppText>
                        <AppText variant="body-lg" weight="bold" style={[styles.cpTotalValue, { color: '#FF9500' }]} numberOfLines={1}>
                          {selectedCustomer.oweAmount.toLocaleString()} {t('common.etb')}
                        </AppText>
                      </View>
                      <View style={styles.cpBtnRow}>
                        <TouchableOpacity
                          style={[styles.cpBtn, { backgroundColor: colors.text, flex: 1 }]}
                          onPress={() => handleFullPayment(selectedCustomer)}
                        >
                          <Check size={15} color={colors.background} />
                          <AppText variant="body" weight="bold" style={[styles.cpBtnText, { color: colors.background }]} numberOfLines={1}>{t('sales.pay_all')}</AppText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cpBtn, { backgroundColor: selectedDebtItems.length > 0 ? '#FF9500' : colors.border, flex: 1 }]}
                          disabled={selectedDebtItems.length === 0}
                          onPress={async () => {
                            if (selectedDebtItems.length === 0) { await dialog.alert({ title: t('sales.select_items_title'), message: t('sales.select_items_msg'), iconType: 'warning' }); return; }
                            for (const saleId of selectedDebtItems) {
                              const sale = customerDebts.find((d: any) => d.id === saleId);
                              if (sale) {
                                const mq = sale.quantity;
                                const qs = partialQtyMap[saleId] ?? String(mq);
                                const q = Math.min(Math.max(1, parseInt(qs) || mq), mq);
                                const up = mq > 0 ? sale.totalPrice / mq : 0;
                                const pa = Math.min(up * q, sale.totalPrice - (sale.paidAmount || 0));
                                processIndividualPayment(saleId, pa);
                              }
                            }
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            await dialog.alert({ title: t('sales.payment_processed'), message: t('sales.payment_items', { count: String(selectedDebtItems.length) }), iconType: 'success' });
                            setSelectedDebtItems([]); setPartialQtyMap({});
                            setShowCollectPayment(false); loadData();
                          }}
                        >
                          <Check size={15} color="#FFF" />
                          <AppText variant="body" weight="bold" style={[styles.cpBtnText, { color: '#FFF' }]} numberOfLines={1}>{t('sales.pay_selected', { count: String(selectedDebtItems.length) })}</AppText>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={[styles.cpBtn, { borderWidth: 1, borderColor: '#FF3B3040', backgroundColor: '#FF3B3010' }]}
                        onPress={async () => {
                          const ok = await dialog.confirm({
                            title: t('sales.mark_loss_title'),
                            message: t('sales.write_off_msg', { amount: selectedCustomer.oweAmount.toLocaleString(), name: selectedCustomer.customerName }),
                            confirmText: t('sales.write_off_action'),
                            cancelText: t('common.cancel'),
                            iconType: 'danger',
                            destructive: true,
                          });
                          if (ok) {
                            markDebtAsLoss(selectedCustomer.customerName);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            setShowCollectPayment(false);
                            loadData();
                          }
                        }}
                      >
                        <X size={15} color="#FF3B30" />
                        <AppText variant="body" weight="bold" style={[styles.cpBtnText, { color: '#FF3B30' }]} numberOfLines={1}>{t('sales.mark_loss_title')}</AppText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* ── Activity Tab ── */
                  <FlatList
                    data={customerActivity}
                    keyExtractor={activityKeyExtractor}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 }}
                    ListEmptyComponent={
                      <View style={{ alignItems: 'center', paddingTop: 50, gap: 10 }}>
                        <AppText variant="display" weight="regular" shrink={false} style={{}}>📭</AppText>
                        <AppText variant="body" weight="medium" style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'center' }]} numberOfLines={2}>
                          {t('sales.no_debt_activity')}
                        </AppText>
                        <AppText variant="caption" weight="medium" style={{ fontSize: 12, fontFamily: Fonts.medium, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 30 }} numberOfLines={3}>
                          {t('sales.debt_activity_desc')}
                        </AppText>
                      </View>
                    }
                    renderItem={renderActivityItem}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Invoice PDF Language Modal */}
      <PDFLanguageModal
        visible={showInvoiceLangModal}
        onClose={() => { setShowInvoiceLangModal(false); setInvoiceTarget(null); }}
        onSelect={handleInvoiceDownload}
      />

      {/* Sales Record Bottom Sheet */}
      <Modal
        visible={showSalesRecord}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSalesRecord(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSalesRecord(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <SalesRecordScreen onClose={() => setShowSalesRecord(false)} />
          </View>
        </View>
      </Modal>

      {/* Sale Details Bottom Sheet */}
      <Modal
        visible={showSaleDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSaleDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSaleDetails(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <SaleDetailsScreen
                sale={selectedSale}
                onClose={() => {
                  setShowSaleDetails(false);
                  loadData();
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Sale Multi-Step Flow */}
      <Modal
        visible={showSaleFlow}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSaleFlow(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSaleFlow(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            {saleFlowStep === 'search' && (
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
                  setSaleFlowStep('pending');
                }}
              />
            )}
            {saleFlowStep === 'pending' && (
              <PendingSales
                items={pendingSales}
                onUpdateItem={(id, updates) => {
                  setPendingSales(pendingSales.map(s => s.id === id ? { ...s, ...updates } : s));
                }}
                onRemoveItem={(id) => {
                  setPendingSales(pendingSales.filter(s => s.id !== id));
                }}
                onAddMore={() => {
                  setSaleFlowStep('search');
                }}
                onFinish={() => {
                  setSaleFlowStep('form');
                }}
              />
            )}
            {saleFlowStep === 'form' && (
              <GlobalCheckout
                cart={pendingSales}
                onBack={() => setSaleFlowStep('pending')}
                onFinish={async (saleMetadata: any) => {
                  try {
                    const totalDiscount = Number(saleMetadata.discount) || 0;
                    for (const item of pendingSales) {
                      const finalUnitPrice = item.unitType === 'pack' ? item.packSellingPrice : item.baseSellingPrice;
                      const finalUnitLabel = item.unitType === 'pack' ? item.purchaseUnit : item.baseUnit;

                      const lineSubtotal = (parseFloat(finalUnitPrice) || 0) * Math.max(0, item.quantity || 0);
                      const totalSubtotal = pendingSales.reduce((sum, i) => {
                        const price = i.unitType === 'pack' ? (parseFloat(i.packSellingPrice) || 0) : (parseFloat(i.baseSellingPrice) || 0);
                        return sum + (price * Math.max(0, i.quantity || 0));
                      }, 0);
                      const itemDiscount = totalSubtotal > 0 ? (lineSubtotal / totalSubtotal) * Math.max(0, totalDiscount) : 0;
                      const discountedTotal = lineSubtotal - itemDiscount;

                      await insertSale({
                        itemId: item.id,
                        quantity: item.quantity,
                        unit: finalUnitLabel,
                        unitType: item.unitType,
                        discount: itemDiscount,
                        vat: saleMetadata.vat,
                        totalPrice: discountedTotal,
                        paymentMethod: saleMetadata.paymentMethod,
                        paymentStatus: saleMetadata.paymentStatus,
                        customerName: saleMetadata.customerName,
                        customerPhone: saleMetadata.customerPhone,
                        packId: undefined,
                      });
                    }
                    setShowSaleFlow(false);
                    setPendingSales([]);
                    setSaleFlowStep('search');
                    loadData();
                    await dialog.alert({ title: t('sales.sale_success'), message: t('sales.checkout_msg'), iconType: 'success' });
                  } catch (e) {
                    await dialog.alert({ title: t('sales.sale_error'), message: t('sales.failed_msg'), iconType: 'danger' });
                  }
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const SalesActivityCard = React.memo(({ sale, onPress }: { sale: any; onPress: () => void }) => {
  const { colors, t } = useSettings();
  const isPaid = sale.paymentStatus === 'Paid';
  return (
    <TouchableOpacity style={[styles.activityItem, { borderBottomColor: colors.border }]} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.activityIconCircle, { backgroundColor: colors.surface }]}>
        <User size={20} color={isPaid ? (colors.success || '#34C759') : colors.primary} />
      </View>
      <View style={styles.activityMain}>
        <AppText variant="body" weight="bold" style={[styles.activityNameText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{sale.itemName}</AppText>
        <AppText variant="body-sm" weight="medium" style={[styles.activityUnitText, { color: colors.textSecondary }]} numberOfLines={1}>{sale.quantity} {sale.unit} • {sale.paymentMethod || 'Cash'}</AppText>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <AppText variant="body" weight="bold" style={[styles.activityPriceText, { color: colors.text }]} numberOfLines={1}>{sale.totalPrice.toLocaleString()} {t('common.etb')}</AppText>
        <View style={[styles.statusIndicator, { backgroundColor: isPaid ? (colors.success || '#34C759') + '15' : colors.primary + '15' }]}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.statusIndicatorText, { color: isPaid ? (colors.success || '#34C759') : colors.primary }]} numberOfLines={1}>
            {isPaid ? t('sales.payment_paid') : t('sales.payment_debt')}
          </AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
});

SalesActivityCard.displayName = 'SalesActivityCard';

const styles = StyleSheet.create({
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
  integratedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 10,
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
    fontFamily: Fonts.bold,
  },
  headerLabel: {
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
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
  dateRangeSubLabel: {
    fontFamily: Fonts.medium,
    marginTop: 4,
  },
  heroSection: {
    paddingHorizontal: 25,
    marginBottom: 30,
  },
  revenueMainDisplay: {
    marginBottom: 16,
  },
  totalRevenueVal: {
    fontFamily: Fonts.extrabold,
    letterSpacing: -1,
    marginTop: 4,
  },
  currency: {
    fontFamily: Fonts.bold,
    opacity: 0.6,
  },
  revenueRangeLabel: {
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  selectedBarDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  selectedBarLabel: {
    fontFamily: Fonts.medium,
  },
  selectedBarValue: {
    fontFamily: Fonts.bold,
  },
  currentPeriodBadge: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
    marginBottom: 4,
  },
  currentPeriodBadgeText: {
    color: '#FFF',
    fontFamily: Fonts.bold,
    letterSpacing: 0.3,
  },
  currentPeriodBadgePlaceholder: {
    height: 22,
    width: 1,
  },
  chartContainer: {
    height: 170,
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  chartEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chartEmptyText: {
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  chartTooltip: {
    minWidth: 50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipText: {
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 14,
  },
  periodTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  periodTabText: {
    fontFamily: Fonts.bold,
  },
  periodDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 8,
  },
  periodNavRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bentoSection: {
    paddingHorizontal: 25,
    marginBottom: 30,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bentoCard: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  bentoIconArea: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  bentoValue: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  bentoLabel: {
    fontFamily: Fonts.medium,
  },
  topItemsSection: {
    marginBottom: 30,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    marginBottom: 15,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
  },
  sectionSub: {
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  topItemsScroll: {
    paddingHorizontal: 25,
    gap: 12,
  },
  topItemCard: {
    width: 150,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  rankBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomLeftRadius: 12,
  },
  rankText: {
    color: '#FFF',
    fontFamily: Fonts.extrabold,
  },
  topItemName: {
    fontFamily: Fonts.bold,
    marginTop: 10,
    marginBottom: 4,
  },
  topItemRevenue: {
    fontFamily: Fonts.bold,
  },
  topItemVolume: {
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  ledgerSection: {
    paddingHorizontal: 25,
  },
  ledgerList: {
    marginTop: 10,
  },
  viewAllBtn: {
    fontFamily: Fonts.bold,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  activityIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  activityMain: {
    flex: 1,
  },
  activityNameText: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  activityUnitText: {
    fontFamily: Fonts.medium,
  },
  activityEnd: {
    alignItems: 'flex-end',
  },
  activityPriceText: {
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusIndicatorText: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },
  miniReceiptBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
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

  // Peak Hours Modal Styles
  peakModalTitle: {
    fontFamily: Fonts.bold,
    marginTop: 15,
    paddingHorizontal: 25,
  },
  peakModalSub: {
    fontFamily: Fonts.medium,
    paddingHorizontal: 25,
    marginTop: 4,
    marginBottom: 5,
  },
  peakCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  peakCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  peakRankBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  peakRankText: {
    fontFamily: Fonts.bold,
  },
  peakCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  peakTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  peakTimeText: {
    fontFamily: Fonts.bold,
  },
  peakCountText: {
    fontFamily: Fonts.bold,
  },
  peakBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  peakBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  peakQtyText: {
    fontFamily: Fonts.medium,
  },
  peakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  peakTotalText: {
    fontFamily: Fonts.bold,
  },
  peakItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  peakItemName: {
    fontFamily: Fonts.medium,
    flex: 1,
  },
  peakItemQty: {
    fontFamily: Fonts.bold,
  },

  // Payment Method Styles
  paymentCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentMethodText: {
    fontFamily: Fonts.bold,
  },
  paymentAmountText: {
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  paymentPercentText: {
    fontFamily: Fonts.bold,
  },
  paymentCountText: {
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Collect Payment Styles
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: Fonts.medium,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerName: {
    fontFamily: Fonts.bold,
  },
  customerPhone: {
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  debtAmount: {
    fontFamily: Fonts.bold,
  },
  debtCount: {
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  selectedCustomerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  debtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  debtItemName: {
    fontFamily: Fonts.medium,
  },
  debtItemAmount: {
    fontFamily: Fonts.bold,
  },
  totalDebtBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 20,
    marginBottom: 15,
  },
  totalDebtLabel: {
    fontFamily: Fonts.medium,
  },
  totalDebtValue: {
    fontFamily: Fonts.bold,
  },
  collectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 20,
    gap: 10,
  },
  collectBtnText: {
    fontFamily: Fonts.bold,
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
    height: height * 0.85,
    overflow: 'hidden',
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  activityLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
  },
  activityCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  activityType: {
    fontFamily: Fonts.bold,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },

  // ── Collect Payments new styles ──
  cpCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  cpAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cpCustomerName: {
    fontFamily: Fonts.bold,
  },
  cpDueText: {
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  cpAmount: {
    fontFamily: Fonts.bold,
    flexShrink: 0,
    marginLeft: 8,
  },
  cpDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  cpBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cpCallBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cpTabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  cpTab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 4,
  },
  cpTabText: {
    fontFamily: Fonts.semibold,
  },
  cpItemCard: {
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cpItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  cpCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cpItemName: {
    flex: 1,
    fontFamily: Fonts.bold,
  },
  cpStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  cpStatusText: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cpItemStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cpStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  cpStatLabel: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cpStatValue: {
    fontFamily: Fonts.bold,
  },
  cpQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  cpQtyLabel: {
    fontFamily: Fonts.medium,
    flexShrink: 0,
  },
  cpQtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  cpStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cpStepBtnText: {
    fontFamily: Fonts.bold,
    lineHeight: 20,
  },
  cpQtyInput: {
    width: 40,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontFamily: Fonts.bold,
  },
  cpQtyOf: {
    fontFamily: Fonts.medium,
  },
  cpPayAmt: {
    fontFamily: Fonts.bold,
    flexShrink: 0,
  },
  cpFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 8,
  },
  cpTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  cpTotalLabel: {
    fontFamily: Fonts.medium,
  },
  cpTotalValue: {
    fontFamily: Fonts.bold,
  },
  cpBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 14,
    gap: 8,
  },
  cpBtnText: {
    fontFamily: Fonts.bold,
  },
  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  invoiceBtnText: {
    fontFamily: Fonts.bold,
  },
});

export default SalesDashboard;