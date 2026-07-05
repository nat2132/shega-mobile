import { BarChartSkeleton } from "@/components/ChartSkeleton";
import { ChartEmpty } from "@/components/ChartStateView";
import { PDFLanguageModal } from "@/components/PDFLanguageModal";
import SaleSuccessModal from "@/components/SaleSuccessModal";
import { AppNumber, AppText } from "@/components/ui";
import { Fonts, LightTheme } from "@/constants/theme";
import { useDialog } from "@/context/DialogContext";
import { useNavigationIntent } from "@/context/NavigationIntentContext";
import { PROFILE_IMAGES, useSettings } from "@/context/SettingsContext";
import { useSidebar } from "@/context/SidebarContext";
import { useToast } from "@/context/ToastContext";
import {
  getCustomerActivity,
  getDebtCustomers,
  getDebtSales,
  getPaymentMethodBreakdown,
  getPeakSalesHoursByItem,
  getRecentSales,
  getRecentSalesGrouped,
  getSalesChartData,
  getSalesSummary,
  getTopSellingItems,
  insertSale,
  markDebtAsLoss,
  processDebtPayment,
  processIndividualPayment,
} from "@/database/db";
import { useNotifications } from "@/hooks/useNotifications";
import { playBad, playNice } from "@/services/soundService";
import {
  formatHourLabel,
  formatShortDate,
  formatTime,
  getDayName,
  getEthiopianMonthNames,
  toEthiopianDate,
} from "@/utils/date-utils";
import { generateInvoicePDF } from "@/utils/pdf-utils";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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
  ShoppingBag,
  User,
  Wallet,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart } from "react-native-gifted-charts";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { getSalesGlass } from "./glass-sales";
import PendingSales from "./pending";
import GlobalCheckout from "./sale-form";
import SaleDetailsScreen from "./sales-details";
import SalesRecordScreen from "./sales-record";
import SearchScreen from "./search";

const isDarkBg = (c: typeof LightTheme) => {
  const bg = c.background.toLowerCase();
  return bg === '#000000' || bg === '#0b0b0b' || bg === '#0d1b2a' || bg === '#0d1f12' ||
         bg === '#1a1614' || bg === '#121820' || bg === '#1c1510' || bg === '#111111' ||
         bg === '#0f0f0f' || bg === '#0a0a0a';
};

const LiquidGlassSurface = ({
  children, style, borderRadius = 20,
}: {
  children: React.ReactNode; style?: any; borderRadius?: number;
}) => {
  const { colors } = useSettings();
  return (
    <View style={[{ borderRadius, overflow: 'hidden', position: 'relative' }, style]}>
      {children}
    </View>
  );
};

const SALES_GLASS = getSalesGlass(LightTheme);
const { width, height } = Dimensions.get("window");

const SalesDashboard = () => {
  const { openSidebar } = useSidebar();
  const { userProfile, colors, calendarType, language, timeSystem, t } =
    useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);
  const { showToast } = useToast();
  const { notifCount } = useNotifications();
  const router = useRouter();
  const { consumeIntent, intent: pendingIntent } = useNavigationIntent();
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState("W");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [periodOffset, setPeriodOffset] = useState(0);
  const [showSalesRecord, setShowSalesRecord] = useState(false);
  const [showSaleFlow, setShowSaleFlow] = useState(false);
  const [saleFlowStep, setSaleFlowStep] = useState<
    "search" | "form" | "pending"
  >("search");
  const [, setSelectedItem] = useState<any>(null);
  const [pendingSales, setPendingSales] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);
  const [isBarExpanded, setIsBarExpanded] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentMethodModalVisible, setPaymentMethodModalVisible] =
    useState(false);
  const [pendingPaymentAction, setPendingPaymentAction] = useState<
    "full" | "selected" | null
  >(null);
  const [chartDataState, setChartDataState] = useState<{
    labels: string[];
    values: number[];
  }>({ labels: [], values: [] });
  const [chartLoaded, setChartLoaded] = useState(false);
  const [, setSummary] = useState<any>(null);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [activeBusiness] = useState<any>({
    businessName: userProfile.businessName || "My Store",
    storeName: "Main Branch",
  });

  // Modal states for KPIs
  const [showPeakHoursModal, setShowPeakHoursModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [peakHoursData, setPeakHoursData] = useState<any[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<any[]>([]);

  // Sale success modal
  const [showSaleSuccess, setShowSaleSuccess] = useState(false);
  const [completedSaleData, setCompletedSaleData] = useState<any>(null);

  // Collect Payments modal
  const [showCollectPayment, setShowCollectPayment] = useState(false);
  const [debtCustomers, setDebtCustomers] = useState<any[]>([]);
  const [searchCustomer, setSearchCustomer] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerDebts, setCustomerDebts] = useState<any[]>([]);
  const [showCustomerActivity, setShowCustomerActivity] = useState(false);
  const [customerActivity, setCustomerActivity] = useState<any[]>([]);
  const [selectedDebtItems, setSelectedDebtItems] = useState<number[]>([]);
  // qty to pay per item (saleId -> qty string)
  const [partialQtyMap, setPartialQtyMap] = useState<Record<number, string>>(
    {},
  );

  // Invoice PDF state
  const [showInvoiceLangModal, setShowInvoiceLangModal] = useState(false);
  const [invoiceTarget, setInvoiceTarget] = useState<"single" | "all" | null>(
    null,
  );

  const loadData = () => {
    setChartLoaded(false);
    const today = new Date().toISOString().split("T")[0];
    const allSales = getRecentSalesGrouped(100);
    // Filter to today only
    const todaySales = allSales.filter((s: any) => {
      const saleDate = s.createdAt
        ? s.createdAt.split(" ")[0] || s.createdAt.substring(0, 10)
        : "";
      return saleDate === today;
    });
    const sales = todaySales.slice(0, 5);
    setRecentSales(sales);

    const dbChartData = getSalesChartData(
      activeTab as "W" | "M" | "Y",
      periodOffset,
      calendarType,
    );
    if (dbChartData && dbChartData.length > 0) {
      setChartDataState({
        labels: dbChartData.map((d) => d.label),
        values: dbChartData.map((d) => d.value),
      });
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
    expandedWidth.value = withSpring(isBarExpanded ? width - 50 : 56, {
      damping: 15,
      stiffness: 100,
    });
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
    () =>
      (chartDataState.values || []).map((v) =>
        Number.isFinite(v) && !Number.isNaN(v) ? Math.max(0, v) : 0,
      ),
    [chartDataState.values],
  );

  const hasChartData =
    sanitizedValues.length > 0 && sanitizedValues.some((v) => v > 0);
  const maxValueInData = hasChartData ? Math.max(...sanitizedValues) : 500;
  const chartMax = maxValueInData * 1.3;

  // Calculate dynamic barWidth and spacing to fit the graph within the frame bounds
  const numBars = sanitizedValues.length || 7;
  const availWidth = width - 80;
  const calculatedBarWidth = Math.floor(
    availWidth / (numBars + (numBars - 1) * 0.5),
  );
  const calculatedSpacing = Math.floor(calculatedBarWidth * 0.5);

  // Chart content width for horizontal scrolling (year tab has 12-13 months)
  const chartBarSpacing = useMemo(
    () => Math.max(calculatedSpacing * 2, 12),
    [calculatedSpacing],
  );
  const chartContentWidth = useMemo(() => {
    const totalWidth =
      numBars * calculatedBarWidth + (numBars - 1) * chartBarSpacing + 80;
    return Math.max(totalWidth, width - 50);
  }, [numBars, calculatedBarWidth, chartBarSpacing, width]);

  // Format data for GiftedCharts — memoized so the heavy date-math
  // only re-runs when chart data, period, language, or selection changes.
  const todayBadgeText = useMemo(() => {
    if (activeTab === "W") return t("sales.today");
    if (activeTab === "M") return t("sales.this_week");
    return t("sales.this_month");
  }, [activeTab, t]);

  const chartData = useMemo(
    () =>
      sanitizedValues.map((val, i) => {
        let label = chartDataState.labels[i];
        if (activeTab === "W" && label !== "None") {
          const dayIdx = parseInt(label);
          if (!isNaN(dayIdx)) {
            const d = new Date();
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay() + dayIdx);
            weekStart.setDate(weekStart.getDate() + periodOffset * 7);
            label = getDayName(weekStart, calendarType, language).substring(
              0,
              3,
            );
          }
        } else if (activeTab === "M") {
          const weekNum = parseInt(label);
          if (!isNaN(weekNum)) {
            label = t("sales.week_chart_label", { num: String(weekNum) });
          }
        } else if (activeTab === "Y") {
          const monthNum = parseInt(label);
          if (!isNaN(monthNum) && monthNum >= 1) {
            if (calendarType === "ethiopian") {
              const ethMonths = getEthiopianMonthNames(language);
              if (monthNum <= ethMonths.length) {
                label = ethMonths[monthNum - 1].substring(0, 3);
              }
            } else {
              const d = new Date(2024, monthNum - 1, 1);
              const localeMap: Record<string, string> = {
                en: "en-US",
                am: "am-ET",
                om: "en-US",
                ti: "en-US",
              };
              label = d.toLocaleDateString(localeMap[language] || "en-US", {
                month: "short",
              });
            }
          }
        }

        // Highlight current period
        let isCurrent = false;
        if (activeTab === "W") {
          const today = new Date();
          const todayDay = today.getDay(); // 0=Sun, 1=Mon ...
          isCurrent = i === todayDay && periodOffset === 0;
        } else if (activeTab === "M") {
          const now = new Date();
          if (calendarType === "ethiopian") {
            const current = toEthiopianDate(now);
            const currentWeek = Math.min(
              Math.floor((current.day - 1) / 7) + 1,
              5,
            );
            isCurrent = i === currentWeek - 1 && periodOffset === 0;
          } else {
            const currentWeek = Math.ceil(now.getDate() / 7);
            isCurrent = i === currentWeek - 1 && periodOffset === 0;
          }
        } else if (activeTab === "Y") {
          const now = new Date();
          if (calendarType === "ethiopian") {
            const yr = now.getFullYear();
            const mo = now.getMonth() + 1;
            const dy = now.getDate();
            const a = Math.floor((14 - mo) / 12);
            const y = yr + 4800 - a;
            const m = mo + 12 * a - 3;
            const jdn =
              dy +
              Math.floor((153 * m + 2) / 5) +
              365 * y +
              Math.floor(y / 4) -
              Math.floor(y / 100) +
              Math.floor(y / 400) -
              32045;
            const ethiopicEpoch = 1723856;
            const r = (jdn - ethiopicEpoch) % 1461;
            const n = (r % 365) + 365 * Math.floor(r / 1460);
            const currentEthMonth = Math.floor(n / 30) + 1;
            isCurrent = i === currentEthMonth - 1 && periodOffset === 0;
          } else {
            const currentMonth = now.getMonth(); // 0-11
            isCurrent = i === currentMonth && periodOffset === 0;
          }
        }

        const isSelected = selectedIdx === i;

        let barColor: string;
        let gradientColor: string;
        if (isCurrent) {
          barColor = colors.warning;
          gradientColor = colors.warning + "40";
        } else if (isSelected) {
          barColor = colors.primary;
          gradientColor = colors.primary + "40";
        } else {
          barColor = colors.primary + "25";
          gradientColor = colors.primary + "15";
        }

        return {
          value: val,
          label: label !== "None" ? label : "",
          frontColor: barColor,
          gradientColor,
          isCurrent,
          isSelected,
        };
      }),
    [
      sanitizedValues,
      chartDataState.labels,
      activeTab,
      periodOffset,
      calendarType,
      language,
      selectedIdx,
      colors.primary,
      colors.warning,
    ],
  );

  // Stable per-bar topLabelComponent factory. We render the badge
  // (or placeholder) here once per `chartData` and pass a stable
  // function reference to BarChart so the prop equality check
  // doesn't re-animate the "today" pill on every parent re-render.
  const barTopLabelComponents = useMemo(
    () =>
      chartData.map((d, i) => {
        const BarLabel = () => {
          if (d.isCurrent) {
            return (
              <View
                style={[
                  styles.currentPeriodBadge,
                  { backgroundColor: colors.warning },
                ]}
              >
                <AppText
                  variant="micro"
                  weight="bold"
                  style={styles.currentPeriodBadgeText}
                  numberOfLines={1}
                >
                  {todayBadgeText}
                </AppText>
              </View>
            );
          }
          return <View style={styles.currentPeriodBadgePlaceholder} />;
        };
        BarLabel.displayName = 'BarLabel';
        return BarLabel;
      }),
    [chartData, todayBadgeText],
  );

  const totalRevenue = useMemo(
    () => sanitizedValues.reduce((a, b) => a + b, 0),
    [sanitizedValues],
  );

  // Stable onPress handler for BarChart — we resolve the pressed
  // item's value from chartData so the tooltip below always shows
  // the correct, sanitised number.
  const handleBarPress = useCallback((_item: any, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIdx((prev) => (prev === index ? -1 : index));
  }, []);

  const barChartDataWithLabels = useMemo(
    () =>
      chartData.map((d, i) => ({
        ...d,
        topLabelComponent: barTopLabelComponents[i],
      })),
    [chartData, barTopLabelComponents],
  );

  const handlePeriodChange = (tab: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChartDataState({ labels: [], values: [] });
    setActiveTab(tab);
    setPeriodOffset(0);
  };

  // Format date range label based on active tab
  const getDateRangeLabel = useMemo(
    () => () => {
      const now = new Date();
      const localeMap: Record<string, string> = {
        en: "en-US",
        am: "am-ET",
        om: "en-US",
        ti: "en-US",
      };
      const locale = localeMap[language] || "en-US";

      if (activeTab === "W") {
        const dayOffset = periodOffset * 7;
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + dayOffset);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        if (calendarType === "ethiopian") {
          const es = toEthiopianDate(weekStart);
          const ee = toEthiopianDate(weekEnd);
          const mName = getEthiopianMonthNames(language);
          if (es.month === ee.month) {
            return `${mName[es.month - 1]} ${es.day} – ${ee.day}, ${es.year}`;
          }
          return `${mName[es.month - 1]} ${es.day} – ${mName[ee.month - 1]} ${ee.day}, ${es.year}`;
        }
        const options: Intl.DateTimeFormatOptions = {
          month: "short",
          day: "numeric",
          year: "numeric",
        };
        return `${weekStart.toLocaleDateString(locale, options)} – ${weekEnd.toLocaleDateString(locale, options)}`;
      } else if (activeTab === "M") {
        if (calendarType === "ethiopian") {
          const current = toEthiopianDate(now);
          let ethYear = current.year;
          let ethMonth = current.month + periodOffset;
          if (ethMonth < 1) {
            ethMonth += 13;
            ethYear--;
          }
          if (ethMonth > 13) {
            ethMonth -= 13;
            ethYear++;
          }
          const monthName = getEthiopianMonthNames(language)[ethMonth - 1];
          return `${monthName} ${ethYear}`;
        }
        const monthDate = new Date(
          now.getFullYear(),
          now.getMonth() + periodOffset,
          1,
        );
        const monthName = monthDate.toLocaleDateString(locale, {
          month: "long",
        });
        return `${monthName} ${monthDate.getFullYear()}`;
      } else {
        const yearDate = new Date(now.getFullYear() + periodOffset, 0, 1);
        if (calendarType === "ethiopian") {
          return String(toEthiopianDate(yearDate).year);
        }
        return yearDate.getFullYear().toString();
      }
    },
    [activeTab, periodOffset, calendarType, language],
  );

  const salesKPIs = useMemo(
    () => [
      {
        title: t("sales.peak_hour"),
        value: t("sales.tap_to_view"),
        icon: Clock,
        color: colors.warning,
        onPress: () => handleShowPeakHours(),
      },
      {
        title: t("sales.methods"),
        value: t("sales.tap_to_view"),
        icon: Wallet,
        color: colors.error,
        onPress: () => handleShowPaymentMethods(),
      },
      {
        title: t("orders.orders"),
        value: t("sales.tap_to_view"),
        icon: ShoppingBag,
        color: colors.primary,
        onPress: () => router.push("/(tabs)/orders"),
      },
    ],
    [t],
  );

  const handleShowPeakHours = () => {
    const data = getPeakSalesHoursByItem();
    setPeakHoursData(data);
    setShowPeakHoursModal(true);
  };

  const handleShowPaymentMethods = () => {
    const today = new Date().toISOString().split("T")[0];
    const data = getPaymentMethodBreakdown(today, today);
    setPaymentBreakdown(data);
    setShowPaymentModal(true);
  };

  // Collect Payments handlers
  const handleOpenCollectPayments = (preSelectName?: string) => {
    const customers: any[] = getDebtCustomers() as any[];
    setDebtCustomers(customers);
    setSearchCustomer(preSelectName || "");
    setShowCollectPayment(true);
    if (preSelectName) {
      const match = customers.find(
        (c: any) => c.customerName === preSelectName,
      );
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
    if (pendingIntent.kind === "collect_payments") {
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
    setPendingPaymentAction("full");
    setPaymentMethodModalVisible(true);
  };

  const filteredDebtCustomers = useMemo(
    () =>
      debtCustomers.filter((c) =>
        c.customerName?.toLowerCase().includes(searchCustomer.toLowerCase()),
      ),
    [debtCustomers, searchCustomer],
  );

  const handleInvoiceDownload = async (
    lang: "en" | "am" | "om" | "ti",
    calendar: "gregorian" | "ethiopian",
    action: "share" | "save",
  ) => {
    try {
      const timeSystem = calendar === "ethiopian" ? "ethiopian" : "device";
      if (invoiceTarget === "single" && selectedCustomer) {
        const debts = getDebtSales(selectedCustomer.customerName);
        await generateInvoicePDF(
          selectedCustomer,
          debts,
          activeBusiness,
          lang,
          action,
          timeSystem,
        );
      } else if (invoiceTarget === "all") {
        const allDebts = debtCustomers.flatMap((c) =>
          getDebtSales(c.customerName),
        );
        const combined = {
          customerName: t("sales.all_customers"),
          customerPhone: "",
          oweAmount: debtCustomers.reduce((s, c) => s + (c.oweAmount || 0), 0),
        };
        await generateInvoicePDF(
          combined,
          allDebts,
          activeBusiness,
          lang,
          action,
          timeSystem,
        );
      }
      showToast({
        title: "Invoice Exported",
        message: "PDF document is ready to share",
        type: "success",
      });
    } catch {
      showToast("Failed to generate invoice PDF", "error");
    }
    setInvoiceTarget(null);
  };

  const formatDueDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (calendarType === "ethiopian") {
      const e = toEthiopianDate(d);
      return `${getEthiopianMonthNames(language)[e.month - 1].substring(0, 3)} ${e.day}, ${e.year}`;
    }
    const localeMap: Record<string, string> = {
      en: "en-US",
      am: "am-ET",
      om: "en-US",
      ti: "en-US",
    };
    return d.toLocaleDateString(localeMap[language] || "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: SALES_GLASS.bg }}>
      {/* Glass Background Layers */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgWash, { top: -80, right: -60, backgroundColor: '#FFFFFF', opacity: 0.04 }]} />
        <View style={[styles.bgWash, { bottom: -100, left: -80, backgroundColor: '#FFFFFF', opacity: 0.025 }]} />
        <View style={[styles.bgWashSmall, { top: '40%', left: '30%', backgroundColor: '#FFFFFF', opacity: 0.03 }]} />
      </View>

      <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { backgroundColor: "transparent" },
          ]}
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
              <AppText
                variant="caption"
                weight="bold"
                transform="uppercase"
                style={[styles.headerLabel, { color: SALES_GLASS.muted }]}
                numberOfLines={1}
              >
                {t("sales.overview")}
              </AppText>
              <AppText
                variant="display"
                weight="bold"
                style={[styles.headerTitle, { color: SALES_GLASS.fg }]}
                numberOfLines={2}
              >
                {t("sales.revenue_hub")}
              </AppText>
            </View>

            <View style={styles.headerActions}>
              <View style={[styles.glassIconBtn, { backgroundColor: colors.card, borderColor: SALES_GLASS.border }]}>
                <TouchableOpacity
                  onPress={() => router.push("/notifications")}
                  style={styles.glassIconBtnInner}
                >
                  <Bell size={22} color={SALES_GLASS.fg} />
                </TouchableOpacity>
                  {notifCount > 0 && (
                  <View
                    style={[
                      styles.notifBadge,
                      { backgroundColor: colors.card },
                    ]}
                  >
                    <AppNumber
                      value={notifCount}
                      size="caption"
                      weight="bold"
                      color={colors.text}
                      style={styles.notifBadgeText}
                    />
                  </View>
                )}

              </View>

              <View style={[styles.glassAvatarBox, { backgroundColor: colors.card, borderColor: SALES_GLASS.border }]}>
                <TouchableOpacity onPress={openSidebar}>
                  <Image
                    source={
                      userProfile.avatarUri
                        ? { uri: userProfile.avatarUri }
                        : PROFILE_IMAGES[
                            userProfile.avatarIndex >= 0
                              ? userProfile.avatarIndex
                              : 0
                          ]
                    }
                    style={styles.headerAvatar}
                  />
                </TouchableOpacity>

              </View>
            </View>
          </View>

          {/* Revenue Hero Section */}
          <View style={styles.heroSection}>
            <View style={[styles.revenueGlassCard, { borderColor: SALES_GLASS.border, backgroundColor: colors.card }]}>
              <View style={styles.revenueMainDisplay}>
                <AppText
                  variant="caption"
                  weight="bold"
                  transform="uppercase"
                  style={[
                    styles.revenueRangeLabel,
                    { color: SALES_GLASS.muted },
                  ]}
                  numberOfLines={2}
                >
                  {activeTab === "W"
                    ? t("sales.weekly_revenue")
                    : activeTab === "M"
                      ? t("sales.monthly_revenue")
                      : t("sales.yearly_revenue")}
                </AppText>
                <AppNumber
                  value={totalRevenue}
                  size="display"
                  weight="extrabold"
                  prefix={"ETB "}
                  color={SALES_GLASS.fg}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={[
                    styles.totalRevenueVal,
                    {
                      fontSize:
                        totalRevenue >= 10000000
                          ? 36
                          : totalRevenue >= 1000000
                            ? 40
                            : totalRevenue >= 100000
                              ? 44
                              : 52,
                    },
                  ]}
                />
                <AppText
                  variant="caption"
                  weight="medium"
                  style={[
                    styles.dateRangeSubLabel,
                    { color: SALES_GLASS.muted },
                  ]}
                  numberOfLines={2}
                >
                  {getDateRangeLabel()}
                </AppText>
               </View>
             </View>

            {/* Selected bar detail */}
            {selectedIdx !== null &&
              selectedIdx >= 0 &&
              selectedIdx < sanitizedValues.length && (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  style={[
                    styles.selectedBarDetail,
                    {
                      backgroundColor: SALES_GLASS.bgCardStrong,
                      borderColor: SALES_GLASS.borderLight,
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    weight="medium"
                    style={[
                      styles.selectedBarLabel,
                      { color: SALES_GLASS.muted },
                    ]}
                    numberOfLines={2}
                  >
                    {chartData[selectedIdx]?.label ||
                      (chartDataState.labels[selectedIdx] !== "None"
                        ? chartDataState.labels[selectedIdx]
                        : "—")}
                  </AppText>
                  <AppNumber
                    value={sanitizedValues[selectedIdx]}
                    size="body-lg"
                    prefix={"ETB "}
                    color={SALES_GLASS.fg}
                    style={styles.selectedBarValue}
                  />
                </Animated.View>
              )}

            <View style={styles.chartContainer}>
              {!chartLoaded ? (
                <BarChartSkeleton height={150} barCount={numBars} />
              ) : !hasChartData ? (
                <ChartEmpty
                  height={150}
                  icon="chart"
                  message={t("sales.no_sales_period")}
                />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  bounces={false}
                  contentContainerStyle={{ paddingRight: 20 }}
                >
                  <BarChart
                    data={barChartDataWithLabels}
                    barWidth={calculatedBarWidth}
                    spacing={chartBarSpacing}
                    roundedTop
                    hideRules
                    hideYAxisText
                    hideAxesAndRules
                    yAxisThickness={0}
                    xAxisThickness={0}
                    noOfSections={4}
                    maxValue={chartMax}
                    isAnimated
                    showGradient
                    initialSpacing={20}
                    endSpacing={20}
                    onPress={handleBarPress}
                    width={chartContentWidth}
                    height={160}
                    showValuesAsTopLabel={false}
                    xAxisLabelTextStyle={{
                      color: colors.textSecondary,
                      fontSize: 10,
                      fontFamily: Fonts.medium,
                    }}
                  />
                </ScrollView>
              )}
            </View>

            {/* Time Period Selectors */}
            <View style={styles.periodRow}>
              <View
                style={[styles.periodBar, { backgroundColor: colors.surface }]}
              >
                {[
                  { key: "W", label: t("sales.wk_label") },
                  { key: "M", label: t("sales.mo_label") },
                  { key: "Y", label: t("sales.yr_label") },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => handlePeriodChange(tab.key)}
                    style={[
                      styles.periodTab,
                      activeTab === tab.key && {
                        backgroundColor: colors.primary,
                      },
                    ]}
                  >
                        <AppText
                          variant="caption"
                          weight="bold"
                          shrink={false}
                          style={[
                            styles.periodTabText,
                            {
                              color:
                                activeTab === tab.key
                                  ? colors.background
                                  : SALES_GLASS.muted,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {tab.label}
                        </AppText>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.periodNavRow}>
                <TouchableOpacity
                  onPress={() => setPeriodOffset((prev) => prev - 1)}
                  style={[
                    styles.navBtn,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <ChevronLeft size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPeriodOffset((prev) => prev + 1)}
                  disabled={periodOffset >= 0}
                  style={[
                    styles.navBtn,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    periodOffset >= 0 && { opacity: 0.3 },
                  ]}
                >
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
                  <TouchableOpacity
                    key={idx}
                    onPress={kpi.onPress}
                    activeOpacity={0.7}
                  >
                    <Animated.View
                      entering={FadeInDown.delay(idx * 100).duration(500)}
                      style={[
                        styles.bentoCard,
                        {
                          backgroundColor: SALES_GLASS.bgCard,
                          borderColor: SALES_GLASS.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.bentoIconArea,
                          { backgroundColor: kpi.color + "20" },
                        ]}
                      >
                        <KpiIcon size={18} color={kpi.color} />
                      </View>
                      <AppText
                        variant="title"
                        weight="bold"
                        shrink={false}
                        style={[
                          styles.bentoValue,
                          {
                            color: SALES_GLASS.fg,
                            fontSize: kpi.value.length > 10 ? 16 : 18,
                          },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {kpi.value}
                      </AppText>
                      <AppText
                        variant="caption"
                        weight="medium"
                        style={[
                          styles.bentoLabel,
                          { color: SALES_GLASS.muted },
                        ]}
                        numberOfLines={2}
                      >
                        {kpi.title}
                       </AppText>
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
                <AppText
                  variant="heading"
                  weight="bold"
                  style={[styles.sectionTitle, { color: SALES_GLASS.fg }]}
                  numberOfLines={2}
                >
                  {t("sales.top_performing")}
                </AppText>
                <BarChart3 size={18} color={SALES_GLASS.muted} />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topItemsScroll}
              >
                {topItems.map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.topItemCard,
                      {
                        backgroundColor: SALES_GLASS.bgCard,
                        borderColor: SALES_GLASS.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.rankBadge,
                        { backgroundColor: '#FFFFFF' },
                      ]}
                    >
                      <AppNumber
                        value={idx + 1}
                        size="caption"
                        weight="extrabold"
                        color={SALES_GLASS.bg}
                        style={styles.rankText}
                      />
                    </View>
                    <AppText
                      variant="body"
                      weight="bold"
                      numberOfLines={1}
                      style={[styles.topItemName, { color: SALES_GLASS.fg }]}
                    >
                      {item.name}
                    </AppText>
                    <AppNumber
                      value={item.totalRevenue}
                      size="body"
                      prefix={"ETB "}
                      color={SALES_GLASS.fgSecondary}
                      style={styles.topItemRevenue}
                    />
                    <AppText
                      variant="caption"
                      weight="medium"
                      style={[
                        styles.topItemVolume,
                        { color: SALES_GLASS.muted },
                      ]}
                      numberOfLines={2}
                    >
                      {t("common.item_sold_count", {
                        count: item.totalQty,
                        unit: t(
                          "form." + (item.baseUnit || "pieces").toLowerCase(),
                        ),
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
                <AppText
                  variant="heading"
                  weight="bold"
                  style={[styles.sectionTitle, { color: SALES_GLASS.fg }]}
                  numberOfLines={2}
                >
                  {t("sales.recent_sales")}
                </AppText>
                <AppText
                  variant="body-sm"
                  weight="medium"
                  style={[styles.sectionSub, { color: SALES_GLASS.muted }]}
                  numberOfLines={1}
                >
                  {t("sales.detailed_ledger")}
                </AppText>
              </View>
              <View style={[styles.glassViewAllBtn, { borderColor: SALES_GLASS.border }]}>
                <TouchableOpacity
                  onPress={() => setShowSalesRecord(true)}
                  style={styles.glassViewAllBtnInner}
                >
                  <AppText
                    variant="caption"
                    weight="bold"
                    shrink={false}
                    style={[styles.viewAllBtn, { color: SALES_GLASS.fgSecondary }]}
                    numberOfLines={1}
                  >
                    {t("common.view_all")}
                  </AppText>
                </TouchableOpacity>

              </View>
            </View>

            <View style={styles.ledgerList}>
              {recentSales.map((sale, idx) => (
                <Animated.View
                  key={idx}
                  entering={FadeInDown.delay(300 + idx * 50).duration(500)}
                >
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
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: SALES_GLASS.bgCard,
                      borderWidth: 1,
                      borderColor: SALES_GLASS.border,
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <ShoppingBag size={22} color={SALES_GLASS.muted} />
                  </View>
                  <AppText
                    variant="body"
                    weight="medium"
                    style={[styles.emptyText, { color: SALES_GLASS.muted }]}
                    numberOfLines={2}
                  >
                    {t("sales.no_sales")}
                  </AppText>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Expanding Smart FAB */}
      <View style={styles.dockedBarWrapper}>
        <Animated.View
          style={[
            expandStyle,
            { height: 60, borderRadius: 30, overflow: "hidden" },
          ]}
        >
          <View style={[styles.dockedBarGlass, { borderColor: SALES_GLASS.borderLight }]}>
            <View
              style={[
                styles.dockedBar,
                {
                  paddingHorizontal: isBarExpanded ? 10 : 0,
                  backgroundColor: SALES_GLASS.bgCardStrong,
                },
              ]}
            >
              {isBarExpanded && (
                <Animated.View
                  entering={FadeIn.delay(100)}
                  exiting={FadeOut.duration(100)}
                >
                  <TouchableOpacity
                    style={styles.dockBtn}
                    onPress={() => {
                      setShowSalesRecord(true);
                      setIsBarExpanded(false);
                    }}
                  >
                    <ShoppingBag size={22} color={SALES_GLASS.fgSecondary} />
                  </TouchableOpacity>
                </Animated.View>
              )}

              <TouchableOpacity
                style={[
                  styles.dockMainBtn,
                  {
                    backgroundColor: SALES_GLASS.fg,
                  },
                ]}
                onPress={() => setIsBarExpanded(!isBarExpanded)}
              >
                {isBarExpanded ? (
                  <X size={24} color={SALES_GLASS.bg} />
                ) : (
                  <Plus size={24} color={SALES_GLASS.bg} />
                )}
              </TouchableOpacity>

              {isBarExpanded && (
                <Animated.View
                  entering={FadeIn.delay(100)}
                  exiting={FadeOut.duration(100)}
                >
                  <TouchableOpacity
                    style={styles.dockBtn}
                    onPress={() => {
                      handleOpenCollectPayments();
                      setIsBarExpanded(false);
                    }}
                  >
                    <DollarSign size={22} color={SALES_GLASS.fgSecondary} />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {isBarExpanded && (
                <Animated.View
                  entering={FadeIn.delay(120)}
                  exiting={FadeOut.duration(100)}
                >
                  <TouchableOpacity
                    style={styles.dockBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSaleFlowStep("search");
                      setSelectedItem(null);
                      setShowSaleFlow(true);
                      setIsBarExpanded(false);
                    }}
                  >
                    <Plus size={22} color={SALES_GLASS.fgSecondary} />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Peak Hours Modal */}
      <Modal visible={showPeakHoursModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowPeakHoursModal(false)}
          />
          <View
            style={[
              styles.bottomSheetContainer,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <View
                style={[styles.modalHandle, { backgroundColor: colors.border }]}
              />
              <AppText
                variant="heading"
                weight="bold"
                style={[styles.peakModalTitle, { color: SALES_GLASS.fg }]}
                numberOfLines={2}
              >
                {t("sales.peak_sales_hours")}
              </AppText>
              <AppText
                variant="body-sm"
                weight="medium"
                style={[styles.peakModalSub, { color: SALES_GLASS.muted }]}
                numberOfLines={2}
              >
                {t("sales.peak_subtitle")}
              </AppText>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 25, gap: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {peakHoursData.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: SALES_GLASS.bgCard,
                      borderWidth: 1,
                      borderColor: SALES_GLASS.border,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Clock size={24} color={SALES_GLASS.muted} />
                  </View>
                  <AppText
                    variant="body"
                    weight="medium"
                    style={[
                      styles.emptyText,
                      {
                        color: SALES_GLASS.muted,
                        textAlign: "center",
                        marginTop: 12,
                      },
                    ]}
                    numberOfLines={3}
                  >
                    {t("sales.no_peak_data")}
                  </AppText>
                </View>
              ) : (
                peakHoursData.map((row: any, idx: number) => {
                  const hour = parseInt(row.hour ?? "0");
                  const nextHour = (hour + 1) % 24;
                  // Hour labels respect the user's selected time system.
                  // - 'ethiopian': shift by -6 so 6 AM Gregorian → 12:00 (Day).
                  // - 'device':   use 12-hour AM/PM in the active language.
                  const fmt = (h: number) =>
                    formatHourLabel(h, timeSystem, language);
                  const timeRange = `${fmt(hour)} – ${fmt(nextHour)}`;
                  const barWidth =
                    peakHoursData[0]?.count > 0
                      ? `${Math.round((row.count / peakHoursData[0].count) * 100)}%`
                      : "0%";
                  const rankColors = [
                    colors.warning,
                    colors.warning + "CC",
                    colors.warning + "AA",
                    colors.warning + "88",
                    colors.warning + "66",
                  ];
                  const rankColor = rankColors[idx] ?? rankColors[4];

                  return (
                    <View
                      key={idx}
                      style={[
                        styles.peakCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View style={styles.peakCardRow}>
                        {/* Rank badge */}
                        <View
                          style={[
                            styles.peakRankBadge,
                            { backgroundColor: rankColor + "20" },
                          ]}
                        >
                          <AppNumber
                            value={idx + 1}
                            size="body"
                            weight="bold"
                            prefix="#"
                            color={rankColor}
                            style={styles.peakRankText}
                          />
                        </View>

                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={styles.peakCardTopRow}>
                            <View style={styles.peakTimeRow}>
                              <Clock size={14} color={rankColor} />
                              <AppText
                                variant="body"
                                weight="bold"
                                shrink={false}
                                style={[
                                  styles.peakTimeText,
                                  { color: SALES_GLASS.fg },
                                ]}
                                numberOfLines={1}
                              >
                                {timeRange}
                              </AppText>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <AppNumber
                                value={row.count}
                                size="body"
                                weight="bold"
                                color={rankColor}
                                style={styles.peakCountText}
                              />
                              <AppText
                                variant="body"
                                weight="bold"
                                style={[styles.peakCountText, { color: rankColor }]}
                                numberOfLines={1}
                              >
                                {" "}{row.count === 1 ? t("sales.sale") : t("sales.sales_plural")}
                              </AppText>
                            </View>
                          </View>

                          {/* Progress bar */}
                          <View
                            style={[
                              styles.peakBarBg,
                              { backgroundColor: SALES_GLASS.border },
                            ]}
                          >
                            <View
                              style={[
                                styles.peakBarFill,
                                {
                                  width: barWidth as any,
                                  backgroundColor: rankColor,
                                },
                              ]}
                            />
                          </View>

                          <AppText
                            variant="caption"
                            weight="medium"
                            style={[
                              styles.peakQtyText,
                              { color: colors.textSecondary },
                            ]}
                            numberOfLines={2}
                          >
                            {t("sales.units_sold", {
                              count: row.totalQty ?? 0,
                            })}
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
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowPaymentModal(false)}
          />
          <View
            style={[
              styles.bottomSheetContainer,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <View
                style={[styles.modalHandle, { backgroundColor: colors.border }]}
              />
              <AppText
                variant="heading"
                weight="bold"
                style={[styles.peakModalTitle, { color: SALES_GLASS.fg }]}
                numberOfLines={2}
              >
                {t("sales.payment_methods_modal")}
              </AppText>
              <AppText
                variant="body-sm"
                weight="medium"
                style={[styles.peakModalSub, { color: SALES_GLASS.muted }]}
                numberOfLines={2}
              >
                {t("sales.payment_subtitle")}
              </AppText>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 25, gap: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {paymentBreakdown.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: SALES_GLASS.bgCard,
                      borderWidth: 1,
                      borderColor: SALES_GLASS.border,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Wallet size={24} color={SALES_GLASS.muted} />
                  </View>
                  <AppText
                    variant="body"
                    weight="medium"
                    style={[
                      styles.emptyText,
                      {
                        color: SALES_GLASS.muted,
                        textAlign: "center",
                        marginTop: 12,
                      },
                    ]}
                    numberOfLines={3}
                  >
                    {t("sales.no_payment_data")}
                  </AppText>
                </View>
              ) : (
                (() => {
                  const grandTotal = paymentBreakdown.reduce(
                    (sum: number, pm: any) => sum + (Number(pm.total) || 0),
                    0,
                  );
                  return paymentBreakdown.map((pm: any, idx: number) => {
                    const amount = Number(pm.total) || 0;
                    const pct =
                      grandTotal > 0
                        ? Math.round((amount / grandTotal) * 100)
                        : 0;
                    const isCash = (pm.paymentMethod || "")
                      .toLowerCase()
                      .includes("cash");
                    const iconColor = isCash ? colors.success : colors.primary;
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.paymentCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View style={styles.paymentRow}>
                          <View
                            style={[
                              styles.paymentIconBox,
                              { backgroundColor: iconColor + "15" },
                            ]}
                          >
                            {isCash ? (
                              <Banknote size={20} color={iconColor} />
                            ) : (
                              <CreditCard size={20} color={iconColor} />
                            )}
                          </View>
                          <View style={{ flex: 1, marginLeft: 15 }}>
                              <AppText
                                variant="body"
                                weight="bold"
                                style={[
                                  styles.paymentMethodText,
                                  { color: SALES_GLASS.fg },
                                ]}
                                numberOfLines={2}
                              >
                                {pm.paymentMethod || t("sales.unknown_method")}
                              </AppText>
                              <AppNumber
                                value={amount}
                                size="caption"
                                weight="medium"
                                prefix={"ETB "}
                                color={SALES_GLASS.muted}
                                style={styles.paymentAmountText}
                              />
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <AppNumber
                              value={pct}
                              size="body"
                              weight="bold"
                              decimals={0}
                              suffix="%"
                              color={iconColor}
                              style={styles.paymentPercentText}
                            />
                              <AppText
                                variant="caption"
                                weight="medium"
                                style={[
                                  styles.paymentCountText,
                                  { color: SALES_GLASS.muted },
                                ]}
                                numberOfLines={2}
                              >
                                {t("sales.transactions_count", {
                                  count: pm.count,
                                })}
                              </AppText>
                          </View>
                        </View>
                          <View
                            style={[
                              styles.progressBarBg,
                              { backgroundColor: SALES_GLASS.border },
                            ]}
                        >
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${pct}%` as any,
                                backgroundColor: iconColor,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  });
                })()
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Collect Payments Modal */}
      <Modal visible={showCollectPayment} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCollectPayment(false)}
          />
          <View
            style={[
              styles.bottomSheetContainer,
              { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.85 },
            ]}
          >
            <View style={styles.modalHeader}>
              <View
                style={[styles.modalHandle, { backgroundColor: colors.border }]}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  width: "100%",
                }}
              >
                <AppText
                  variant="heading"
                  weight="bold"
                  style={[styles.peakModalTitle, { color: SALES_GLASS.fg }]}
                  numberOfLines={2}
                >
                  {t("sales.collect_payments")}
                </AppText>
                <View
                  style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
                >
                  {debtCustomers.length > 0 && (
                    <TouchableOpacity
                      style={[
                        styles.invoiceBtn,
                        {
                          backgroundColor: colors.primary + "15",
                          borderColor: colors.primary + "30",
                        },
                      ]}
                      onPress={() => {
                        setInvoiceTarget("all");
                        setShowInvoiceLangModal(true);
                      }}
                    >
                      <Download size={14} color={colors.primary} />
                      <AppText
                        variant="caption"
                        weight="bold"
                        shrink={false}
                        style={[
                          styles.invoiceBtnText,
                          { color: colors.primary },
                        ]}
                        numberOfLines={1}
                      >
                        {t("sales.all_invoices")}
                      </AppText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => setShowCollectPayment(false)}
                  >
                    <X size={22} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {!selectedCustomer ? (
              /* →→ Customer List: name Â· amount Â· due date only →→ */
              <View style={{ flex: 1, paddingHorizontal: 20 }}>
                <View
                  style={[
                    styles.searchBox,
                    {
                      backgroundColor: SALES_GLASS.bgCard,
                      borderColor: SALES_GLASS.border,
                      marginBottom: 12,
                    },
                  ]}
                >
                  <Search size={16} color={SALES_GLASS.muted} />
                  <TextInput
                    style={[styles.searchInput, { color: SALES_GLASS.fg }]}
                    placeholder={t("sales.search_customers")}
                    placeholderTextColor={colors.textSecondary}
                    value={searchCustomer}
                    onChangeText={setSearchCustomer}
                  />
                  {searchCustomer.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchCustomer("")}>
                      <X size={15} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
                <FlatList
                  data={filteredDebtCustomers}
                  keyExtractor={(item, idx) => item.customerName + idx}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const isOverdue =
                      item.earliestDue &&
                      new Date(item.earliestDue) < new Date();
                    return (
                      <TouchableOpacity
                        style={[
                          styles.cpCustomerRow,
                          {
                            backgroundColor: colors.card,
                            borderColor: isOverdue
                              ? colors.error + "40"
                              : colors.border,
                            borderLeftColor: isOverdue
                              ? colors.error
                              : colors.border,
                            borderLeftWidth: isOverdue ? 3 : 1,
                          },
                        ]}
                        onPress={() => handleSelectCustomer(item)}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.cpAvatar,
                            {
                              backgroundColor: isOverdue
                                ? colors.error + "15"
                                : colors.primary + "15",
                            },
                          ]}
                        >
                          <User
                            size={17}
                            color={isOverdue ? colors.error : colors.primary}
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <AppText
                            variant="body"
                            weight="bold"
                            style={[
                              styles.cpCustomerName,
                              { color: SALES_GLASS.fg },
                            ]}
                            numberOfLines={1}
                          >
                            {item.customerName}
                          </AppText>
                      <AppText
                        variant="caption"
                        weight="medium"
                        style={[
                          styles.cpDueText,
                          {
                            color: isOverdue
                              ? colors.error
                              : SALES_GLASS.muted,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {item.earliestDue
                          ? isOverdue
                            ? t("sales.overdue_label", {
                                date: formatDueDate(item.earliestDue),
                              })
                            : t("sales.due_label", {
                                date: formatDueDate(item.earliestDue),
                              })
                          : t("sales.no_due_date")}
                      </AppText>
                    </View>
                    <AppNumber
                      value={item.oweAmount}
                      size="body"
                      weight="bold"
                      prefix={"ETB "}
                      color={isOverdue ? colors.error : colors.warning}
                      style={styles.cpAmount}
                    />
                  </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <AppText
                      variant="body"
                      weight="medium"
                      style={[
                        styles.emptyText,
                        {
                          color: colors.textSecondary,
                          textAlign: "center",
                          marginTop: 50,
                        },
                      ]}
                      numberOfLines={3}
                    >
                      {t("sales.no_outstanding")}
                    </AppText>
                  }
                />
              </View>
            ) : (
              /* →→ Customer Detail →→ */
              <View style={{ flex: 1 }}>
                {/* Header: back + name + due + call */}
                <View
                  style={[
                    styles.cpDetailHeader,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedCustomer(null)}
                    style={styles.cpBackBtn}
                  >
                    <ChevronLeft size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <AppText
                      variant="title-sm"
                      weight="bold"
                      style={[
                        styles.cpCustomerName,
                        { color: colors.text, fontSize: 16 },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedCustomer.customerName}
                    </AppText>
                    {selectedCustomer.earliestDue && (
                      <AppText
                        variant="caption"
                        weight="medium"
                        style={[
                          styles.cpDueText,
                          {
                            color:
                              new Date(selectedCustomer.earliestDue) <
                              new Date()
                                ? colors.error
                                : colors.textSecondary,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {
                          t("common.due_date", {
                            date: formatDueDate(selectedCustomer.earliestDue),
                          }) as any
                        }
                      </AppText>
                    )}
                  </View>
                  {selectedCustomer.customerPhone && (
                    <TouchableOpacity
                      style={[
                        styles.cpCallBtn,
                        { backgroundColor: colors.success + "18" },
                      ]}
                      onPress={() =>
                        Linking.openURL(`tel:${selectedCustomer.customerPhone}`)
                      }
                    >
                      <Phone size={18} color={colors.success} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.cpCallBtn,
                      { backgroundColor: colors.primary + "15" },
                    ]}
                    onPress={() => {
                      setInvoiceTarget("single");
                      setShowInvoiceLangModal(true);
                    }}
                  >
                    <Download size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View
                  style={[
                    styles.cpTabRow,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  {[t("sales.items_tab"), t("sales.activity_tab")].map(
                    (tab) => {
                      const active =
                        tab === t("sales.items_tab")
                          ? !showCustomerActivity
                          : showCustomerActivity;
                      return (
                        <TouchableOpacity
                          key={tab}
                          style={[
                            styles.cpTab,
                            active && {
                              borderBottomColor: colors.text,
                              borderBottomWidth: 2,
                            },
                          ]}
                          onPress={() => {
                            if (tab === "Activity") {
                              setShowCustomerActivity(true);
                              const act = getCustomerActivity(
                                selectedCustomer.customerName,
                              );
                              setCustomerActivity(act);
                            } else {
                              setShowCustomerActivity(false);
                            }
                          }}
                        >
                          <AppText
                            variant="caption"
                            weight="bold"
                            shrink={false}
                            style={[
                              styles.cpTabText,
                              {
                                color: active
                                  ? colors.text
                                  : colors.textSecondary,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {tab}
                          </AppText>
                        </TouchableOpacity>
                      );
                    },
                  )}
                </View>

                {!showCustomerActivity ? (
                  /* →→ Items Tab →→ */
                  <View style={{ flex: 1 }}>
                    <FlatList
                      data={customerDebts}
                      keyExtractor={(item) => item.id.toString()}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingTop: 10,
                        paddingBottom: 6,
                      }}
                      renderItem={({ item }) => {
                        const paid = item.paidAmount || 0;
                        const remaining = item.totalPrice - paid;
                        const isItemOverdue =
                          item.dueDate && new Date(item.dueDate) < new Date();
                        const isSelected = selectedDebtItems.includes(item.id);
                        const maxQty = item.quantity;
                        const currentQtyStr =
                          partialQtyMap[item.id] ?? String(maxQty);
                        const currentQty = Math.min(
                          Math.max(1, parseInt(currentQtyStr) || 1),
                          maxQty,
                        );
                        const unitPrice =
                          maxQty > 0 ? item.totalPrice / maxQty : 0;
                        const payAmt = Math.min(
                          unitPrice * currentQty,
                          remaining,
                        );
                        return (
                          <View
                            style={[
                              styles.cpItemCard,
                              {
                                backgroundColor: colors.card,
                                borderColor: isSelected
                                  ? colors.primary
                                  : isItemOverdue
                                    ? colors.error + "30"
                                    : colors.border,
                                borderWidth: isSelected ? 1.5 : 1,
                              },
                            ]}
                          >
                            <TouchableOpacity
                              style={styles.cpItemTop}
                              onPress={() =>
                                setSelectedDebtItems((prev) =>
                                  prev.includes(item.id)
                                    ? prev.filter((id) => id !== item.id)
                                    : [...prev, item.id],
                                )
                              }
                              activeOpacity={0.8}
                            >
                              <View
                                style={[
                                  styles.cpCheckbox,
                                  {
                                    backgroundColor: isSelected
                                      ? colors.primary
                                      : "transparent",
                                    borderColor: isSelected
                                      ? colors.primary
                                      : colors.border,
                                  },
                                ]}
                              >
                                {isSelected && (
                                  <Check
                                    size={10}
                                    color="#FFF"
                                    strokeWidth={3}
                                  />
                                )}
                              </View>
                              <AppText
                                variant="body"
                                weight="bold"
                                style={[
                                  styles.cpItemName,
                                  { color: colors.text },
                                ]}
                                numberOfLines={1}
                              >
                                {item.itemName}
                              </AppText>
                              <View
                                style={[
                                  styles.cpStatusBadge,
                                  {
                                    backgroundColor:
                                      item.paymentStatus === "Paid"
                                        ? colors.success + "15"
                                        : paid > 0
                                          ? colors.warning + "15"
                                          : colors.error + "15",
                                  },
                                ]}
                              >
                                <AppText
                                  variant="micro"
                                  weight="bold"
                                  shrink={false}
                                  style={[
                                    styles.cpStatusText,
                                    {
                                      color:
                                        item.paymentStatus === "Paid"
                                          ? colors.success
                                          : paid > 0
                                            ? colors.warning
                                            : colors.error,
                                    },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {item.paymentStatus === "Paid"
                                    ? t("sales.status_paid")
                                    : paid > 0
                                      ? t("sales.status_partial")
                                      : t("sales.status_unpaid")}
                                </AppText>
                              </View>
                            </TouchableOpacity>
                            <View
                              style={[
                                styles.cpItemStats,
                                { borderTopColor: colors.border },
                              ]}
                            >
                              <View style={styles.cpStat}>
                                <AppText
                                  variant="micro"
                                  weight="medium"
                                  style={[
                                    styles.cpStatLabel,
                                    { color: colors.textSecondary },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {t("sales.stat_qty")}
                                </AppText>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <AppNumber
                                    value={item.quantity}
                                    size="body"
                                    weight="bold"
                                    color={colors.text}
                                    style={styles.cpStatValue}
                                  />
                                  <AppText
                                    variant="body"
                                    weight="bold"
                                    style={[{ color: colors.text, marginLeft: 4 }]}
                                    numberOfLines={1}
                                  >
                                    {item.unit}
                                  </AppText>
                                </View>
                              </View>
                              <View style={styles.cpStat}>
                                <AppText
                                  variant="micro"
                                  weight="medium"
                                  style={[
                                    styles.cpStatLabel,
                                    { color: colors.textSecondary },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {t("sales.stat_total")}
                                </AppText>
                                <AppNumber
                                  value={item.totalPrice}
                                  size="body"
                                  weight="bold"
                                  color={colors.text}
                                  style={styles.cpStatValue}
                                />
                              </View>
                              <View style={styles.cpStat}>
                                <AppText
                                  variant="micro"
                                  weight="medium"
                                  style={[
                                    styles.cpStatLabel,
                                    { color: colors.textSecondary },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {t("sales.stat_paid")}
                                </AppText>
                                <AppNumber
                                  value={paid}
                                  size="body"
                                  weight="bold"
                                  color={colors.success}
                                  style={styles.cpStatValue}
                                />
                              </View>
                              <View style={styles.cpStat}>
                                <AppText
                                  variant="micro"
                                  weight="medium"
                                  style={[
                                    styles.cpStatLabel,
                                    { color: colors.textSecondary },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {t("sales.stat_left")}
                                </AppText>
                                <AppNumber
                                  value={remaining}
                                  size="body"
                                  weight="bold"
                                  color={colors.warning}
                                  style={styles.cpStatValue}
                                />
                              </View>
                            </View>
                            {isSelected && (
                              <View
                                style={[
                                  styles.cpQtyRow,
                                  { borderTopColor: colors.border },
                                ]}
                              >
                                <AppText
                                  variant="caption"
                                  weight="medium"
                                  style={[
                                    styles.cpQtyLabel,
                                    { color: colors.textSecondary },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {t("sales.pay_qty")}
                                </AppText>
                                <View style={styles.cpQtyStepper}>
                                  <TouchableOpacity
                                    style={[
                                      styles.cpStepBtn,
                                      { backgroundColor: colors.border },
                                    ]}
                                    onPress={() =>
                                      setPartialQtyMap((prev) => ({
                                        ...prev,
                                        [item.id]: String(
                                          Math.max(1, currentQty - 1),
                                        ),
                                      }))
                                    }
                                  >
                                    <AppText
                                      variant="title"
                                      weight="bold"
                                      shrink={false}
                                      style={[
                                        styles.cpStepBtnText,
                                        { color: colors.text },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      ←
                                    </AppText>
                                  </TouchableOpacity>
                                  <TextInput
                                    style={[
                                      styles.cpQtyInput,
                                      {
                                        color: colors.text,
                                        borderColor: colors.border,
                                      },
                                    ]}
                                    value={currentQtyStr}
                                    onChangeText={(v) => {
                                      const n = parseInt(v);
                                      setPartialQtyMap((prev) => ({
                                        ...prev,
                                        [item.id]: isNaN(n)
                                          ? v
                                          : String(
                                              Math.min(Math.max(1, n), maxQty),
                                            ),
                                      }));
                                    }}
                                    keyboardType="numeric"
                                    selectTextOnFocus
                                  />
                                  <TouchableOpacity
                                    style={[
                                      styles.cpStepBtn,
                                      { backgroundColor: colors.border },
                                    ]}
                                    onPress={() =>
                                      setPartialQtyMap((prev) => ({
                                        ...prev,
                                        [item.id]: String(
                                          Math.min(maxQty, currentQty + 1),
                                        ),
                                      }))
                                    }
                                  >
                                    <AppText
                                      variant="title"
                                      weight="bold"
                                      style={[
                                        styles.cpStepBtnText,
                                        { color: colors.text },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      +
                                    </AppText>
                                  </TouchableOpacity>
                                  <AppText
                                    variant="caption"
                                    weight="medium"
                                    style={[
                                      styles.cpQtyOf,
                                      { color: colors.textSecondary },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    / <AppNumber value={maxQty} size="caption" color={colors.textSecondary} />
                                  </AppText>
                                </View>
                                <AppNumber
                                  value={payAmt}
                                  size="body"
                                  weight="bold"
                                  prefix={"ETB "}
                                  color={colors.primary}
                                  style={styles.cpPayAmt}
                                />
                              </View>
                            )}
                          </View>
                        );
                      }}
                    />

                    {/* Sticky footer */}
                    <View
                      style={[
                        styles.cpFooter,
                        {
                          backgroundColor: colors.background,
                          borderTopColor: colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.cpTotalRow,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <AppText
                          variant="caption"
                          weight="medium"
                          style={[
                            styles.cpTotalLabel,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {t("sales.total_outstanding")}
                        </AppText>
                        <AppNumber
                          value={selectedCustomer.oweAmount}
                          size="body-lg"
                          prefix={"ETB "}
                          color={colors.warning}
                          style={styles.cpTotalValue}
                        />
                      </View>
                      <View style={styles.cpBtnRow}>
                        <TouchableOpacity
                          style={[
                            styles.cpBtn,
                            { backgroundColor: colors.text, flex: 1 },
                          ]}
                          onPress={() => handleFullPayment(selectedCustomer)}
                        >
                          <Check size={15} color={colors.background} />
                          <AppText
                            variant="body"
                            weight="bold"
                            style={[
                              styles.cpBtnText,
                              { color: colors.background },
                            ]}
                            numberOfLines={1}
                          >
                            {t("sales.pay_all")}
                          </AppText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.cpBtn,
                            {
                              backgroundColor:
                                selectedDebtItems.length > 0
                                  ? colors.warning
                                  : colors.border,
                              flex: 1,
                            },
                          ]}
                          disabled={selectedDebtItems.length === 0}
                          onPress={async () => {
                            if (selectedDebtItems.length === 0) {
                              await dialog.alert({
                                title: t("sales.select_items_title"),
                                message: t("sales.select_items_msg"),
                                iconType: "warning",
                              });
                              return;
                            }
                            setPendingPaymentAction("selected");
                            setPaymentMethodModalVisible(true);
                          }}
                        >
                          <Check size={15} color="#FFF" />
                          <AppText
                            variant="body"
                            weight="bold"
                            style={[styles.cpBtnText, { color: "#FFF" }]}
                            numberOfLines={1}
                          >
                            {t("sales.pay_selected", {
                              count: String(selectedDebtItems.length),
                            })}
                          </AppText>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.cpBtn,
                          {
                            borderWidth: 1,
                            borderColor: colors.error + "40",
                            backgroundColor: colors.error + "10",
                          },
                        ]}
                        onPress={async () => {
                          const ok = await dialog.confirm({
                            title: t("sales.mark_loss_title"),
                            message: t("sales.write_off_msg", {
                              amount:
                                selectedCustomer.oweAmount.toLocaleString(),
                              name: selectedCustomer.customerName,
                            }),
                            confirmText: t("sales.write_off_action"),
                            cancelText: t("common.cancel"),
                            iconType: "danger",
                            destructive: true,
                          });
                          if (ok) {
                            markDebtAsLoss(selectedCustomer.customerName);
                            Haptics.notificationAsync(
                              Haptics.NotificationFeedbackType.Warning,
                            );
                            playBad();
                            setShowCollectPayment(false);
                            loadData();
                          }
                        }}
                      >
                        <X size={15} color={colors.error} />
                        <AppText
                          variant="body"
                          weight="bold"
                          style={[styles.cpBtnText, { color: colors.error }]}
                          numberOfLines={1}
                        >
                          {t("sales.mark_loss_title")}
                        </AppText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* →→ Activity Tab →→ */
                  <FlatList
                    data={customerActivity}
                    keyExtractor={(item, idx) =>
                      (item.id || 0).toString() + idx
                    }
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                      paddingHorizontal: 16,
                      paddingTop: 14,
                      paddingBottom: 40,
                    }}
                    ListEmptyComponent={
                      <View
                        style={{
                          alignItems: "center",
                          paddingTop: 50,
                          gap: 14,
                        }}
                      >
                        <View
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: SALES_GLASS.bgCard,
                            borderWidth: 1,
                            borderColor: SALES_GLASS.border,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Clock size={24} color={SALES_GLASS.muted} />
                        </View>
                        <AppText
                          variant="body"
                          weight="bold"
                          style={[
                            styles.emptyText,
                            {
                              color: SALES_GLASS.fgSecondary,
                              textAlign: "center",
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {t("sales.no_debt_activity")}
                        </AppText>
                        <AppText
                          variant="caption"
                          weight="medium"
                          style={{
                            fontSize: 12,
                            fontFamily: Fonts.medium,
                            color: SALES_GLASS.muted,
                            textAlign: "center",
                            paddingHorizontal: 30,
                          }}
                          numberOfLines={3}
                        >
                          {t("sales.debt_activity_desc")}
                        </AppText>
                      </View>
                    }
                    renderItem={({ item, index }) => {
                      const isFP = item.activityType === "full_payment";
                      const isPP = item.activityType === "partial_payment";
                      const isPurch = item.activityType === "purchase";

                      const dotColor = isFP
                        ? colors.success
                        : isPP
                          ? colors.warning
                          : colors.primary;

                      const typeLabel = isFP
                        ? t("sales.activity_full")
                        : isPP
                          ? t("sales.activity_partial")
                          : t("sales.activity_credit");

                      const timeStr = item.createdAt
                        ? (() => {
                            const cd = new Date(item.createdAt);
                            const datePart = formatShortDate(
                              cd,
                              calendarType,
                              language,
                            );
                            // Time portion respects the selected time
                            // system (device vs. Ethiopian). The full
                            // ISO is reconstructed because SQLite
                            // returns `YYYY-MM-DD HH:MM:SS` which
                            // some JS engines parse as local time
                            // and others as UTC.
                            const isoLike =
                              typeof item.createdAt === "string" &&
                              !item.createdAt.includes("T") &&
                              !item.createdAt.includes("Z")
                                ? `${item.createdAt.replace(" ", "T")}Z`
                                : item.createdAt;
                            const timePart = formatTime(
                              isoLike,
                              timeSystem,
                              language,
                            );
                            return `${datePart}, ${timePart}`;
                          })()
                        : "";

                      const paid = Number(
                        item.paidSoFar ?? item.paidAmount ?? 0,
                      );
                      const remaining = Number(
                        item.remainingBalance ?? item.totalPrice - paid,
                      );

                      return (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            marginBottom: 10,
                          }}
                        >
                          {/* Timeline spine */}
                          <View
                            style={{
                              alignItems: "center",
                              marginRight: 12,
                              paddingTop: 4,
                            }}
                          >
                            <View
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: dotColor,
                              }}
                            />
                            {index < customerActivity.length - 1 && (
                              <View
                                style={{
                                  width: 2,
                                  flex: 1,
                                  minHeight: 30,
                                    backgroundColor: SALES_GLASS.border,
                                    marginTop: 4,
                                }}
                              />
                            )}
                          </View>

                          {/* Card */}
                          <View
                            style={{
                              flex: 1,
                              borderRadius: 14,
                              borderWidth: 1,
                              padding: 12,
                              marginBottom: 2,
                              backgroundColor: SALES_GLASS.bgCard,
                              borderColor: SALES_GLASS.border,
                            }}
                          >
                            {/* Header: type badge + time */}
                            <View
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 8,
                              }}
                            >
                              <View
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 6,
                                  backgroundColor: dotColor + "18",
                                }}
                              >
                                <AppText
                                  variant="caption"
                                  weight="bold"
                                  style={{
                                    fontSize: 11,
                                    fontFamily: Fonts.bold,
                                    color: dotColor,
                                  }}
                                  numberOfLines={1}
                                >
                                  {typeLabel}
                                </AppText>
                              </View>
                              <AppText
                                variant="micro"
                                weight="medium"
                                style={{
                                  fontSize: 10,
                                  fontFamily: Fonts.medium,
                                  color: colors.textSecondary,
                                }}
                                numberOfLines={1}
                              >
                                {timeStr}
                              </AppText>
                            </View>

                            {/* Item name + qty */}
                            <AppText
                              variant="body"
                              weight="bold"
                              style={{
                                fontSize: 14,
                                fontFamily: Fonts.bold,
                                color: colors.text,
                                marginBottom: 8,
                              }}
                              numberOfLines={1}
                            >
                              {item.itemName || "—"}
                              <AppText
                                variant="caption"
                                weight="medium"
                                style={{
                                  fontSize: 12,
                                  fontFamily: Fonts.medium,
                                  color: colors.textSecondary,
                                }}
                                numberOfLines={1}
                              >
                                {"  "}×<AppNumber value={item.quantity} size="caption" color={colors.textSecondary} /> {item.unit}
                              </AppText>
                            </AppText>

                            {/* Amount chips */}
                            <View
                              style={{
                                flexDirection: "row",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              {/* Total — always shown */}
                              <View
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  borderRadius: 8,
                                  backgroundColor: colors.primary + "12",
                                }}
                              >
                                <AppText
                                  variant="micro"
                                  weight="bold"
                                  transform="uppercase"
                                  style={{
                                    fontSize: 9,
                                    fontFamily: Fonts.bold,
                                    color: colors.textSecondary,
                                  }}
                                  numberOfLines={1}
                                >
                                  {t("sales.stat_total")}
                                </AppText>
                              <AppNumber
                                value={Number(item.totalPrice)}
                                size="caption"
                                weight="bold"
                                prefix={"ETB "}
                                color={colors.text}
                                style={{ fontSize: 12 }}
                              />
                              </View>

                              {/* Paid — for full or partial payments */}
                              {(isFP || isPP) && paid > 0 && (
                                <View
                                  style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 8,
                                    backgroundColor: colors.success + "12",
                                  }}
                                >
                                  <AppText
                                    variant="micro"
                                    weight="bold"
                                    transform="uppercase"
                                    style={{
                                      fontSize: 9,
                                      fontFamily: Fonts.bold,
                                      color: colors.textSecondary,
                                    }}
                                    numberOfLines={1}
                                  >
                                    {t("sales.stat_paid")}
                                  </AppText>
                                  <AppNumber
                                    value={isFP ? Number(item.totalPrice) : paid}
                                    size="caption"
                                    weight="bold"
                                    prefix={"ETB "}
                                    color={colors.success}
                                    style={{ fontSize: 12 }}
                                  />
                                </View>
                              )}

                              {/* Remaining — only for partial with balance left */}
                              {isPP && remaining > 0 && (
                                <View
                                  style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 8,
                                    backgroundColor: colors.warning + "12",
                                  }}
                                >
                                  <AppText
                                    variant="micro"
                                    weight="bold"
                                    transform="uppercase"
                                    style={{
                                      fontSize: 9,
                                      fontFamily: Fonts.bold,
                                      color: colors.textSecondary,
                                    }}
                                    numberOfLines={1}
                                  >
                                    {t("sales.stat_left")}
                                  </AppText>
                                  <AppNumber
                                    value={remaining}
                                    size="caption"
                                    weight="bold"
                                    prefix={"ETB "}
                                    color={colors.warning}
                                    style={{ fontSize: 12 }}
                                  />
                                </View>
                              )}

                              {/* On credit purchase — show outstanding */}
                              {isPurch && remaining > 0 && (
                                <View
                                  style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 8,
                                    backgroundColor: colors.error + "12",
                                  }}
                                >
                                  <AppText
                                    variant="micro"
                                    weight="bold"
                                    transform="uppercase"
                                    style={{
                                      fontSize: 9,
                                      fontFamily: Fonts.bold,
                                      color: colors.textSecondary,
                                    }}
                                    numberOfLines={1}
                                  >
                                    {t("sales.stat_owed")}
                                  </AppText>
                                  <AppNumber
                                    value={remaining}
                                    size="caption"
                                    weight="bold"
                                    prefix={"ETB "}
                                    color={colors.error}
                                    style={{ fontSize: 12 }}
                                  />
                                </View>
                              )}

                              {/* Payment method */}
                              {item.paymentMethod && (
                                <View
                                  style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 8,
                                    backgroundColor: colors.border + "60",
                                  }}
                                >
                                  <AppText
                                    variant="micro"
                                    weight="bold"
                                    transform="uppercase"
                                    style={{
                                      fontSize: 9,
                                      fontFamily: Fonts.bold,
                                      color: colors.textSecondary,
                                    }}
                                    numberOfLines={1}
                                  >
                                    {t("sales.stat_method")}
                                  </AppText>
                                  <AppText
                                    variant="caption"
                                    weight="bold"
                                    style={{
                                      fontSize: 12,
                                      fontFamily: Fonts.bold,
                                      color: colors.text,
                                    }}
                                    numberOfLines={1}
                                  >
                                    {item.paymentMethod}
                                  </AppText>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    }}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Payment Method Selection Modal */}
      <Modal
        visible={paymentMethodModalVisible}
        transparent
        animationType="fade"
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
          }}
          onPress={() => {
            setPaymentMethodModalVisible(false);
            setPendingPaymentAction(null);
          }}
        >
          <View
            style={{
              backgroundColor: SALES_GLASS.bgCard,
              margin: 30,
              borderRadius: 24,
              padding: 24,
              borderWidth: 1,
              borderColor: SALES_GLASS.border,
              overflow: "hidden",
            }}
          >
            <AppText
              variant="heading"
              weight="bold"
              style={{ color: SALES_GLASS.fg, marginBottom: 6 }}
              numberOfLines={2}
            >
              {t("sale.payment_modality")}
            </AppText>
            <AppText
              variant="body-sm"
              weight="medium"
              style={{ color: SALES_GLASS.muted, marginBottom: 20 }}
              numberOfLines={2}
            >
              {t("sales.select_payment_method")}
            </AppText>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 60,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: SALES_GLASS.border,
                  backgroundColor: SALES_GLASS.bgCardStrong,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
                onPress={async () => {
                  setPaymentMethodModalVisible(false);
                  if (pendingPaymentAction === "full" && selectedCustomer) {
                    const ok = await dialog.confirm({
                      title: t("sales.confirm_full_title"),
                      message: t("sales.confirm_full_msg", {
                        amount: selectedCustomer.oweAmount.toLocaleString(),
                        name: selectedCustomer.customerName,
                      }),
                      confirmText: t("sales.confirm_action") || "Confirm",
                      cancelText: t("common.cancel"),
                      iconType: "success",
                    });
                    if (ok) {
                      processDebtPayment(
                        selectedCustomer.customerName,
                        selectedCustomer.oweAmount,
                        "full",
                        { paymentMethod: "Cash" },
                      );
                      Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Success,
                      );
                      playNice();
                      setShowCollectPayment(false);
                      loadData();
                    }
                  } else if (pendingPaymentAction === "selected") {
                    for (const saleId of selectedDebtItems) {
                      const sale = customerDebts.find(
                        (d: any) => d.id === saleId,
                      );
                      if (sale) {
                        const mq = sale.quantity;
                        const qs = partialQtyMap[saleId] ?? String(mq);
                        const q = Math.min(Math.max(1, parseInt(qs) || mq), mq);
                        const up = mq > 0 ? sale.totalPrice / mq : 0;
                        const pa = Math.min(
                          up * q,
                          sale.totalPrice - (sale.paidAmount || 0),
                        );
                        processIndividualPayment(saleId, pa, "Cash");
                      }
                    }
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                    playNice();
                    await dialog.alert({
                      title: t("sales.payment_processed"),
                      message: t("sales.payment_items", {
                        count: String(selectedDebtItems.length),
                      }),
                      iconType: "success",
                    });
                    setSelectedDebtItems([]);
                    setPartialQtyMap({});
                    setShowCollectPayment(false);
                    loadData();
                  }
                  setPendingPaymentAction(null);
                }}
              >
                <Banknote size={18} color={SALES_GLASS.fgSecondary} />
                <AppText
                  variant="body"
                  weight="bold"
                  style={{ color: SALES_GLASS.fg }}
                  numberOfLines={1}
                >
                  {t("sale.physical_cash")}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 60,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: SALES_GLASS.border,
                  backgroundColor: SALES_GLASS.bgCardStrong,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
                onPress={async () => {
                  setPaymentMethodModalVisible(false);
                  if (pendingPaymentAction === "full" && selectedCustomer) {
                    const ok = await dialog.confirm({
                      title: t("sales.confirm_full_title"),
                      message: t("sales.confirm_full_msg", {
                        amount: selectedCustomer.oweAmount.toLocaleString(),
                        name: selectedCustomer.customerName,
                      }),
                      confirmText: t("sales.confirm_action") || "Confirm",
                      cancelText: t("common.cancel"),
                      iconType: "success",
                    });
                    if (ok) {
                      processDebtPayment(
                        selectedCustomer.customerName,
                        selectedCustomer.oweAmount,
                        "full",
                        { paymentMethod: "Transfer" },
                      );
                      Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Success,
                      );
                      playNice();
                      setShowCollectPayment(false);
                      loadData();
                    }
                  } else if (pendingPaymentAction === "selected") {
                    for (const saleId of selectedDebtItems) {
                      const sale = customerDebts.find(
                        (d: any) => d.id === saleId,
                      );
                      if (sale) {
                        const mq = sale.quantity;
                        const qs = partialQtyMap[saleId] ?? String(mq);
                        const q = Math.min(Math.max(1, parseInt(qs) || mq), mq);
                        const up = mq > 0 ? sale.totalPrice / mq : 0;
                        const pa = Math.min(
                          up * q,
                          sale.totalPrice - (sale.paidAmount || 0),
                        );
                        processIndividualPayment(saleId, pa, "Transfer");
                      }
                    }
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                    playNice();
                    await dialog.alert({
                      title: t("sales.payment_processed"),
                      message: t("sales.payment_items", {
                        count: String(selectedDebtItems.length),
                      }),
                      iconType: "success",
                    });
                    setSelectedDebtItems([]);
                    setPartialQtyMap({});
                    setShowCollectPayment(false);
                    loadData();
                  }
                  setPendingPaymentAction(null);
                }}
              >
                <CreditCard size={18} color={SALES_GLASS.fgSecondary} />
                <AppText
                  variant="body"
                  weight="bold"
                  style={{ color: SALES_GLASS.fg }}
                  numberOfLines={1}
                >
                  {t("sale.digital_bank")}
                </AppText>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{ marginTop: 12, alignSelf: "center" }}
              onPress={() => {
                setPaymentMethodModalVisible(false);
                setPendingPaymentAction(null);
              }}
            >
              <AppText
                variant="body"
                weight="bold"
                style={{ color: SALES_GLASS.fgSecondary }}
                numberOfLines={1}
              >
                {t("common.cancel")}
              </AppText>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Invoice PDF Language Modal */}
      <PDFLanguageModal
        visible={showInvoiceLangModal}
        onClose={() => {
          setShowInvoiceLangModal(false);
          setInvoiceTarget(null);
        }}
        onSelect={handleInvoiceDownload}
      />

      {/* Sales Record Bottom Sheet */}
      <Modal
        visible={showSalesRecord}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSalesRecord(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowSalesRecord(false)}
          />
          <View
            style={[
              styles.bottomSheetContainer,
              {
                backgroundColor: colors.background,
                height: Dimensions.get('window').height * 0.85,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View
                style={[styles.modalHandle, { backgroundColor: colors.border }]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SalesRecordScreen onClose={() => setShowSalesRecord(false)} />
            </View>
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
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowSaleDetails(false)}
          />
          <View
            style={[
              styles.bottomSheetContainer,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <View
                style={[styles.modalHandle, { backgroundColor: colors.border }]}
              />
            </View>
            <SaleDetailsScreen
              sale={selectedSale}
              onClose={() => {
                setShowSaleDetails(false);
                loadData();
              }}
            />
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setShowSaleFlow(false)}
            />
            <View
              style={[
                styles.bottomSheetContainer,
                {
                  backgroundColor: colors.background,
                  maxHeight: Dimensions.get('window').height * 0.85,
                  flex: 1,
                },
              ]}
            >
            <View style={styles.modalHeader}>
              <View
                style={[styles.modalHandle, { backgroundColor: colors.border }]}
              />
            </View>
            {saleFlowStep === "search" && (
              <SearchScreen
                onSelectItem={(item: any) => {
                  const existing = pendingSales.find((s) => s.id === item.id);
                  if (existing) {
                    setPendingSales(
                      pendingSales.map((s) =>
                        s.id === item.id
                          ? { ...s, quantity: s.quantity + 1 }
                          : s,
                      ),
                    );
                  } else {
                    setPendingSales([
                      ...pendingSales,
                      {
                        ...item,
                        id: item.id,
                        quantity: 1,
                        unitType: "base",
                      },
                    ]);
                  }
                  setSaleFlowStep("pending");
                }}
              />
            )}
            {saleFlowStep === "pending" && (
              <PendingSales
                items={pendingSales}
                onUpdateItem={(id, updates) => {
                  setPendingSales(
                    pendingSales.map((s) =>
                      s.id === id ? { ...s, ...updates } : s,
                    ),
                  );
                }}
                onRemoveItem={(id) => {
                  setPendingSales(pendingSales.filter((s) => s.id !== id));
                }}
                onAddMore={() => {
                  setSaleFlowStep("search");
                }}
                onFinish={() => {
                  setSaleFlowStep("form");
                }}
              />
            )}
            {saleFlowStep === "form" && (
              <GlobalCheckout
                cart={pendingSales}
                onBack={() => setSaleFlowStep("pending")}
                onFinish={async (saleMetadata: any) => {
                  try {
                    const batchId =
                      Date.now().toString() +
                      "_" +
                      Math.random().toString(36).substring(2, 8);
                    const totalDiscount = Number(saleMetadata.discount) || 0;
                    for (const item of pendingSales) {
                      const finalUnitPrice =
                        item.unitType === "pack"
                          ? item.packSellingPrice
                          : item.baseSellingPrice;
                      const finalUnitLabel =
                        item.unitType === "pack"
                          ? item.purchaseUnit
                          : item.baseUnit;

                      const lineSubtotal =
                        (parseFloat(finalUnitPrice) || 0) *
                        Math.max(0, item.quantity || 0);
                      const totalSubtotal = pendingSales.reduce((sum, i) => {
                        const price =
                          i.unitType === "pack"
                            ? parseFloat(i.packSellingPrice) || 0
                            : parseFloat(i.baseSellingPrice) || 0;
                        return sum + price * Math.max(0, i.quantity || 0);
                      }, 0);
                      const itemDiscount =
                        totalSubtotal > 0
                          ? (lineSubtotal / totalSubtotal) *
                            Math.max(0, totalDiscount)
                          : 0;
                      const discountedTotal = lineSubtotal - itemDiscount;

                      await insertSale({
                        itemId: item.id,
                        quantity: item.quantity,
                        unit: finalUnitLabel,
                        unitType: item.unitType,
                        discount: itemDiscount,
                        vat: saleMetadata.vat,
                        taxType: saleMetadata.taxType || "VAT",
                        totalPrice: discountedTotal,
                        paymentMethod: saleMetadata.paymentMethod,
                        paymentStatus: saleMetadata.paymentStatus,
                        customerName: saleMetadata.customerName,
                        customerPhone: saleMetadata.customerPhone,
                        packId: undefined,
                        batchId,
                      });
                    }
                    setShowSaleFlow(false);
                    setPendingSales([]);
                    setSaleFlowStep("search");
                    loadData();
                    setCompletedSaleData({
                      totalPrice:
                        saleMetadata.totalPrice ||
                        pendingSales.reduce((sum, i) => {
                          const p =
                            i.unitType === "pack"
                              ? i.packSellingPrice || 0
                              : i.baseSellingPrice || 0;
                          return sum + Number(p) * (i.quantity || 0);
                        }, 0),
                      paymentMethod: saleMetadata.paymentMethod || "Cash",
                      itemCount: pendingSales.length,
                      paymentStatus: saleMetadata.paymentStatus || "Paid",
                      customerName:
                        saleMetadata.customerName ||
                        t("sales.walk_in_customer"),
                      transactionId: batchId,
                    });
                    setShowSaleSuccess(true);
                  } catch {
                    showToast(t("sales.failed_msg") || "Sale failed", "error");
                  }
                }}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

      {showSaleSuccess && completedSaleData && (
        <SaleSuccessModal
          saleData={completedSaleData}
          onClose={() => setShowSaleSuccess(false)}
          onPrint={() =>
            showToast(
              t("sales.receipt_ready") || "Receipt available in sale details",
              "info",
            )
          }
          onShare={() =>
            showToast(
              t("sales.receipt_ready") || "Receipt available in sale details",
              "info",
            )
          }
          onViewDetails={() => {
            const batchId = completedSaleData.transactionId;
            const sales = getRecentSales(1);
            const found = sales.find((s: any) => s.batchId === batchId);
            if (found) {
              setSelectedSale(found);
              setShowSaleDetails(true);
            } else {
              showToast("Sale not found", "error");
            }
          }}
        />
      )}
    </View>
  );
};

const SalesActivityCard = React.memo(
  ({ sale, onPress }: { sale: any; onPress: () => void }) => {
    const { colors, t } = useSettings();
    const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);
    const isPaid = sale.paymentStatus === "Paid";
    const isOrder = sale.paymentStatus === "Order";
    const isDebt = sale.paymentStatus === "Debt";
    const isCancelled = sale.paymentStatus === "Cancelled";
    const isBatch = sale.isBatch;
    const isPayment = sale.batchId && String(sale.batchId).startsWith("PAY_");
    const customerLabel = sale.customerName || t("sales.walk_in_customer");
    const itemDetail = isPayment
      ? sale.paymentMethod || "Cash"
      : isBatch
        ? (sale.itemCount || sale.quantity) +
          " items • " +
          (sale.paymentMethod || "Cash")
        : sale.quantity +
          " " +
          (sale.unit || "") +
          " • " +
          (sale.paymentMethod || "Cash");
    const badgeColor = isPayment
      ? colors.success
      : isCancelled
        ? colors.error
        : isOrder
          ? colors.primary
          : isDebt
            ? colors.warning
            : isPaid
              ? colors.success
              : colors.warning;
    const badgeLabel = isPayment
      ? t("dashboard.activity.debt_collected")
      : isCancelled
        ? t("sale.cancelled")
        : isOrder
          ? "Order"
          : isPaid
            ? t("sales.payment_paid")
            : t("sales.payment_debt");
    const displayPrice = isPayment
      ? Math.abs(sale.totalPrice)
      : sale.totalPrice;
    return (
      <View style={[styles.glassActivityItem, { backgroundColor: colors.card, borderColor: SALES_GLASS.border }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          style={styles.activityTouchable}
        >
          <View
            style={[
              styles.activityIconCircle,
              { backgroundColor: badgeColor + "18", borderColor: SALES_GLASS.borderSubtle },
            ]}
          >
            <User size={18} color={badgeColor} />
          </View>
          <View style={styles.activityMain}>
            <AppText
              variant="body"
              weight="bold"
              style={[styles.activityNameText, { color: SALES_GLASS.fg }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {customerLabel}
            </AppText>
            <AppText
              variant="body-sm"
              weight="medium"
              style={[styles.activityUnitText, { color: SALES_GLASS.muted }]}
              numberOfLines={1}
            >
              {itemDetail}
            </AppText>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <AppNumber
              value={displayPrice}
              size="body"
              weight="bold"
              prefix={"ETB "}
              color={SALES_GLASS.fg}
              style={styles.activityPriceText}
            />
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: badgeColor + "18" },
              ]}
            >
              <AppText
                variant="micro"
                weight="bold"
                transform="uppercase"
                style={[styles.statusIndicatorText, { color: badgeColor }]}
                numberOfLines={1}
              >
                {badgeLabel}
              </AppText>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  },
);

SalesActivityCard.displayName = "SalesActivityCard";

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 220,
    paddingTop: 10,
  },
  bgWash: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    transform: [{ scale: 1.8 }],
  },
  bgWashSmall: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    transform: [{ scale: 1.5 }],
  },
  integratedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 10,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  headerIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "transparent",
  },
  notifBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
  },
  headerLabel: {
    fontFamily: Fonts.semibold,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
  },
  glassIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    backgroundColor: SALES_GLASS.surfaceFill,
    borderColor: SALES_GLASS.borderGlass,
  },
  glassIconBtnInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  glassAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: SALES_GLASS.surfaceFill,
    borderColor: SALES_GLASS.borderGlass,
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
  revenueGlassCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    backgroundColor: SALES_GLASS.surfaceFill,
    borderColor: SALES_GLASS.borderGlass,
    overflow: "hidden",
    shadowColor: SALES_GLASS.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: SALES_GLASS.shadowOuter,
    shadowRadius: 24,
    elevation: 6,
  },
  revenueMainDisplay: {
    marginBottom: 0,
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
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  selectedBarDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
    marginBottom: 4,
  },
  currentPeriodBadgeText: {
    color: "#FFF",
    fontFamily: Fonts.bold,
    letterSpacing: 0.3,
  },
  currentPeriodBadgePlaceholder: {
    height: 22,
    width: 1,
  },
  chartContainer: {
    height: 190,
    justifyContent: "flex-end",
    marginBottom: 10,
  },
  chartEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  chartEmptyText: {
    fontFamily: Fonts.medium,
    textAlign: "center",
  },
  chartTooltip: {
    minWidth: 50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    shadowColor: SALES_GLASS.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: SALES_GLASS.shadowOuter * 0.6,
    shadowRadius: 6,
    elevation: 5,
  },
  tooltipText: {
    fontFamily: Fonts.bold,
    textAlign: "center",
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  periodBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    borderRadius: 14,
    backgroundColor: SALES_GLASS.surfaceFill,
    borderWidth: 1,
    borderColor: SALES_GLASS.borderGlass,
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
    backgroundColor: SALES_GLASS.borderGlass,
    marginHorizontal: 8,
  },
  periodNavRow: {
    flexDirection: "row",
    gap: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: SALES_GLASS.surfaceFill,
    borderColor: SALES_GLASS.borderGlass,
  },
  bentoSection: {
    paddingHorizontal: 25,
    marginBottom: 30,
  },
  bentoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  bentoCard: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: SALES_GLASS.surfaceFill,
    borderColor: SALES_GLASS.borderGlass,
    shadowColor: SALES_GLASS.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: SALES_GLASS.shadowOuter * 0.8,
    shadowRadius: 18,
    elevation: 4,
  },
  bentoIconArea: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    width: 160,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
    backgroundColor: SALES_GLASS.surfaceFill,
    borderColor: SALES_GLASS.borderGlass,
    shadowColor: SALES_GLASS.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: SALES_GLASS.shadowOuter * 0.7,
    shadowRadius: 16,
    elevation: 3,
  },
  rankBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomLeftRadius: 12,
  },
  rankText: {
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
  },
  ledgerList: {
    marginTop: 10,
    paddingHorizontal: 25,
  },
  viewAllBtn: {
    fontFamily: Fonts.bold,
  },
  glassViewAllBtn: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: SALES_GLASS.surfaceFill,
    borderColor: SALES_GLASS.borderGlass,
  },
  glassViewAllBtnInner: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  glassActivityItem: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    backgroundColor: SALES_GLASS.surfaceFill,
    borderColor: SALES_GLASS.borderGlass,
    shadowColor: SALES_GLASS.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  activityTouchable: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  activityIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    borderWidth: 1,
    borderColor: SALES_GLASS.borderSubtle,
    overflow: "hidden",
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
    alignItems: "flex-end",
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
    textTransform: "uppercase",
  },
  miniReceiptBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontFamily: Fonts.medium,
  },
  dockedBarWrapper: {
    position: "absolute",
    bottom: 120,
    alignSelf: "center",
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
  },
  dockedBarGlass: {
    flex: 1,
    borderRadius: 30,
    borderWidth: 1,
    overflow: "hidden",
    borderColor: SALES_GLASS.borderGlassStrong,
    shadowColor: SALES_GLASS.shadowColor,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: SALES_GLASS.shadowOuter * 1.2,
    shadowRadius: 24,
    elevation: 12,
  },
  dockedBar: {
    flex: 1,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 10,
    overflow: "hidden",
  },
  dockBtn: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  dockMainBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: SALES_GLASS.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: SALES_GLASS.shadowOuter,
    shadowRadius: 8,
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
    backgroundColor: SALES_GLASS.surfaceFill,
    borderColor: SALES_GLASS.borderGlass,
    shadowColor: SALES_GLASS.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: SALES_GLASS.shadowOuter * 0.5,
    shadowRadius: 12,
    elevation: 3,
  },
  peakCardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  peakRankBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  peakRankText: {
    fontFamily: Fonts.bold,
  },
  peakCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  peakTimeRow: {
    flexDirection: "row",
    alignItems: "center",
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
    overflow: "hidden",
    marginBottom: 6,
  },
  peakBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  peakQtyText: {
    fontFamily: Fonts.medium,
  },
  peakHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  peakTotalText: {
    fontFamily: Fonts.bold,
  },
  peakItem: {
    flexDirection: "row",
    alignItems: "center",
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
    backgroundColor: SALES_GLASS.surfaceFill,
    borderColor: SALES_GLASS.borderGlass,
    shadowColor: SALES_GLASS.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: SALES_GLASS.shadowOuter * 0.5,
    shadowRadius: 12,
    elevation: 3,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  paymentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
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
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Collect Payment Styles
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  debtItem: {
    flexDirection: "row",
    alignItems: "center",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 20,
    gap: 10,
  },
  collectBtnText: {
    fontFamily: Fonts.bold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 40,
    height: height * 0.90,
    backgroundColor: SALES_GLASS.surfaceFill,
    borderWidth: 1,
    borderColor: SALES_GLASS.borderGlass,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    elevation: 8,
  },
  modalHeader: {
    alignItems: "center",
    paddingTop: 15,
    paddingBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
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

  // →→ Collect Payments new styles →→
  cpCustomerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    backgroundColor: SALES_GLASS.surfaceFill,
    borderColor: SALES_GLASS.borderGlass,
  },
  cpAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SALES_GLASS.borderGlass,
    gap: 10,
    backgroundColor: SALES_GLASS.surfaceFill,
  },
  cpBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  cpCallBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  cpTabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  cpTab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginRight: 4,
  },
  cpTabText: {
    fontFamily: Fonts.semibold,
  },
  cpItemCard: {
    borderRadius: 14,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: SALES_GLASS.surfaceFill,
    borderColor: SALES_GLASS.borderGlass,
  },
  cpItemTop: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  cpCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
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
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cpItemStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cpStat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  cpStatLabel: {
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cpStatValue: {
    fontFamily: Fonts.bold,
  },
  cpQtyRow: {
    flexDirection: "row",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  cpStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
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
    textAlign: "center",
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
    borderTopColor: SALES_GLASS.borderGlass,
  },
  cpTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
    backgroundColor: SALES_GLASS.surfaceFillStrong,
    borderColor: SALES_GLASS.borderGlass,
  },
  cpTotalLabel: {
    fontFamily: Fonts.medium,
  },
  cpTotalValue: {
    fontFamily: Fonts.bold,
  },
  cpBtnRow: {
    flexDirection: "row",
    gap: 8,
  },
  cpBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: 14,
    gap: 8,
  },
  cpBtnText: {
    fontFamily: Fonts.bold,
  },
  invoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: SALES_GLASS.surfaceFill,
    borderColor: SALES_GLASS.borderGlass,
  },
  invoiceBtnText: {
    fontFamily: Fonts.bold,
  },
});

export default SalesDashboard;