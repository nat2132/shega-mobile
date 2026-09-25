import { CustomDatePicker } from "@/components/CustomDatePicker";
import { PDFLanguageModal } from "@/components/PDFLanguageModal";
import { Fonts, LightTheme } from "@/constants/theme";
import { useSettings } from "@/context/SettingsContext";
import {
  getBusinesses,
  getEarliestRecordDate,
  getPaidOutstandingSummary,
  getSalesGroupedByDateRange,
} from "@/database/db";
import { generateReceiptPDF } from "@/utils/pdf-utils";
import {
  getEthiopianMonthNames,
  toEthiopianDate,
  formatTime,
} from "@/utils/date-utils";
import { useFocusEffect } from "expo-router";
import { useDataChangedRefresh } from "@/hooks/useDataChangedRefresh";
import { ProductImageStack } from "@/components/ProductImageStack";
import { useToast } from "@/context/ToastContext";
import {
  AlertCircle,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  History,
  Search,
  ShoppingBag,
  SortAsc,
  X,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
} from "react-native-reanimated";
import SaleDetailsScreen from "./sales-details";
import { useDebounce } from "@/hooks/useDebounce";
import { useAutoHideScroll } from "@/hooks/useAutoHideScroll";
import { SkeletonList } from "@/components/Skeleton";
import { AppText, AppNumber } from "@/components/ui";
import { getSalesGlass } from './glass-sales';
const SALES_GLASS = getSalesGlass(LightTheme);
interface SalesRecordProps {
  onClose?: () => void;
}

const DAY_KEYS = [
  "common.day_sun",
  "common.day_mon",
  "common.day_tue",
  "common.day_wed",
  "common.day_thu",
  "common.day_fri",
  "common.day_sat",
];
const FILTER_OPTIONS = [
  { key: "today", labelKey: "common.today" },
  { key: "yesterday", labelKey: "summary.yesterday" },
  { key: "week", labelKey: "common.week_short" },
  { key: "month", labelKey: "common.month_short" },
  { key: "year", labelKey: "reports.year" },
  { key: "date", labelKey: "sales.pick_date" },
] as const;

const SalesRecordScreen: React.FC<SalesRecordProps> = ({ onClose }) => {
  const { colors, calendarType, language, timeSystem, t } =
    useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);
  const hideFABStyle = useAutoHideScroll();
  const { showToast } = useToast();
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [paidOutstanding, setPaidOutstanding] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState<
    "today" | "yesterday" | "date" | "week" | "month" | "year"
  >("today");
  const [selectedDate, setSelectedDate] = useState("");
  const [dateOffset, setDateOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState("price_desc");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [activeBusiness, setActiveBusiness] = useState<any>(null);
  const [earliestDate, setEarliestDate] = useState<string | undefined>(
    undefined,
  );
  const [showLangModal, setShowLangModal] = useState(false);
  const [pendingReceiptSale, setPendingReceiptSale] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const debouncedSearch = useDebounce(searchQuery, 250);

  const loadData = useCallback(() => {
    const businesses = getBusinesses();
    const active = businesses[0];
    setActiveBusiness(active);
    const groupedData = getSalesGroupedByDateRange(
      dateFilter,
      selectedDate,
      dateOffset,
    );
    setSalesData(groupedData);
    const summary = getPaidOutstandingSummary(
      dateFilter,
      selectedDate,
      dateOffset,
    );
    if (summary) setPaidOutstanding(summary);
    setIsLoading(false);
  }, [dateFilter, selectedDate, dateOffset]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      setEarliestDate(getEarliestRecordDate());
    }, [loadData]),
  );

  useDataChangedRefresh(loadData);

  const getHeaderLabel = () => {
    const now = new Date();
    const localeMap: Record<string, string> = {
      en: "en-US",
      am: "am-ET",
      om: "en-US",
      ti: "en-US",
    };
    const locale = localeMap[language] || "en-US";
    switch (dateFilter) {
      case "today":
        if (calendarType === "ethiopian") {
          const e = toEthiopianDate(now);
          return `${getEthiopianMonthNames(language)[e.month - 1].substring(0, 3)} ${e.day}, ${e.year}`;
        }
        return now.toLocaleDateString(locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      case "yesterday": {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (calendarType === "ethiopian") {
          const e = toEthiopianDate(yesterday);
          return `${getEthiopianMonthNames(language)[e.month - 1].substring(0, 3)} ${e.day}, ${e.year}`;
        }
        return yesterday.toLocaleDateString(locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
      case "date":
        if (selectedDate) {
          const d = new Date(selectedDate);
          if (calendarType === "ethiopian") {
            const e = toEthiopianDate(d);
            return `${getEthiopianMonthNames(language)[e.month - 1].substring(0, 3)} ${e.day}, ${e.year}`;
          }
          return d.toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        }
        return t("sales.pick_date");
      case "week": {
        const weekStart = new Date(now);
        weekStart.setDate(
          weekStart.getDate() - weekStart.getDay() + dateOffset * 7,
        );
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        if (calendarType === "ethiopian") {
          const ws = toEthiopianDate(weekStart);
          const we = toEthiopianDate(weekEnd);
          const mName = getEthiopianMonthNames(language);
          if (ws.month === we.month) {
            return `${mName[ws.month - 1].substring(0, 3)} ${ws.day} – ${we.day}, ${ws.year}`;
          }
          return `${mName[ws.month - 1].substring(0, 3)} ${ws.day} – ${mName[we.month - 1].substring(0, 3)} ${we.day}, ${ws.year}`;
        }
        return `${weekStart.toLocaleDateString(locale, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}`;
      }
      case "month": {
        const monthDate = new Date(
          now.getFullYear(),
          now.getMonth() + dateOffset,
          1,
        );
        if (calendarType === "ethiopian") {
          const e = toEthiopianDate(monthDate);
          return `${getEthiopianMonthNames(language)[e.month - 1]} ${e.year}`;
        }
        const monthName = monthDate.toLocaleDateString(locale, {
          month: "long",
        });
        return `${monthName} ${monthDate.getFullYear()}`;
      }
      case "year": {
        if (calendarType === "ethiopian") {
          return String(toEthiopianDate(now).year);
        }
        return String(now.getFullYear() + dateOffset);
      }
    }
  };

  const handleDateFilterChange = (
    filter: "today" | "yesterday" | "date" | "week" | "month" | "year",
  ) => {
    setDateFilter(filter);
    setDateOffset(0);
    if (filter === "date") setDateModalVisible(true);
  };

  // Filter + Sort sales
  const processedSales = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    let filtered = q
      ? salesData.filter(
          (s) =>
            s.itemName?.toLowerCase().includes(q) ||
            s.customerName?.toLowerCase().includes(q) ||
            s.paymentMethod?.toLowerCase().includes(q),
        )
      : salesData;

    filtered = [...filtered].sort((a, b) => {
      if (selectedSort === "price_desc")
        return (b.totalPrice || 0) - (a.totalPrice || 0);
      if (selectedSort === "price_asc")
        return (a.totalPrice || 0) - (b.totalPrice || 0);
      if (selectedSort === "qty_desc")
        return (b.quantity || 0) - (a.quantity || 0);
      if (selectedSort === "name_asc")
        return (a.itemName || "").localeCompare(b.itemName || "");
      return 0;
    });

    return filtered;
  }, [salesData, debouncedSearch, selectedSort]);

  const renderGroup = useCallback(
    ({ item: group }: { item: any }) => (
      <View style={styles.groupSection}>
        <View style={styles.groupHeader}>
          <AppText
            variant="micro"
            weight="bold"
            transform="uppercase"
            shrink={false}
            style={[styles.groupTitle, { color: SALES_GLASS.fgSecondary }]}
            numberOfLines={1}
          >
            {group.title}
          </AppText>
          <View
            style={[
              styles.groupTotalBadge,
              { backgroundColor: colors.primary + "15" },
            ]}
          >
            <AppNumber
              value={group.total}
              size="caption"
              weight="bold"
              showCurrency
              color={colors.primary}
              style={styles.groupTotalText}
            />
          </View>
        </View>
        {group.data.map((sale: any, idx: number) => (
          <Animated.View
            key={sale.id || idx}
            entering={FadeInDown.delay(Math.min(idx, 6) * 40).duration(400)}
          >
            <SaleItemCard sale={sale} onPress={() => setSelectedSale(sale)} />
          </Animated.View>
        ))}
      </View>
    ),
    [SALES_GLASS.fgSecondary, colors.primary, t],
  );

  const keyExtractor = useCallback((item: any) => item.title, []);

  const totalForPeriod = useMemo(
    () => processedSales.reduce((sum, s) => sum + (s.totalPrice || 0), 0),
    [processedSales],
  );

  // Group sales by day/week/month
  const groupedSales = useMemo(() => {
    if (
      dateFilter === "today" ||
      dateFilter === "yesterday" ||
      dateFilter === "date"
    ) {
      return [
        {
          title: getHeaderLabel(),
          data: processedSales,
          total: totalForPeriod,
        },
      ];
    } else if (dateFilter === "week") {
      const groups: { [key: string]: any[] } = {};
      processedSales.forEach((sale: any) => {
        const dayName = t(DAY_KEYS[sale.dayOfWeek] || "common.unknown");
        if (!groups[dayName]) groups[dayName] = [];
        groups[dayName].push(sale);
      });
      return Object.entries(groups).map(([title, data]) => ({
        title,
        data,
        total: data.reduce((sum, s) => sum + (s.totalPrice || 0), 0),
      }));
    } else if (dateFilter === "month") {
      const groups: { [key: string]: any[] } = {};
      processedSales.forEach((sale: any) => {
        const weekLabel = t("common.week_num", { num: String(sale.weekNum) });
        if (!groups[weekLabel]) groups[weekLabel] = [];
        groups[weekLabel].push(sale);
      });
      return Object.entries(groups).map(([title, data]) => ({
        title,
        data,
        total: data.reduce((sum, s) => sum + (s.totalPrice || 0), 0),
      }));
    } else if (dateFilter === "year") {
      const groups: { [key: string]: any[] } = {};
      if (calendarType === "ethiopian") {
        const ethMonths = getEthiopianMonthNames(language);
        processedSales.forEach((sale: any) => {
          const monthLabel = ethMonths[(sale.monthNum || 1) - 1].substring(
            0,
            3,
          );
          if (!groups[monthLabel]) groups[monthLabel] = [];
          groups[monthLabel].push(sale);
        });
      } else {
        const localeMap: Record<string, string> = {
          en: "en-US",
          am: "am-ET",
          om: "en-US",
          ti: "en-US",
        };
        processedSales.forEach((sale: any) => {
          const monthDate = new Date(2024, (sale.monthNum || 1) - 1, 1);
          const monthLabel = monthDate.toLocaleDateString(
            localeMap[language] || "en-US",
            { month: "short" },
          );
          if (!groups[monthLabel]) groups[monthLabel] = [];
          groups[monthLabel].push(sale);
        });
      }
      return Object.entries(groups).map(([title, data]) => ({
        title,
        data,
        total: data.reduce((sum, s) => sum + (s.totalPrice || 0), 0),
      }));
    }
    return [];
  }, [processedSales, dateFilter, dateOffset]);

  return (
    <View style={[styles.container, { backgroundColor: SALES_GLASS.bg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: 'absolute', top: -90, left: -50, width: 280, height: 280, borderRadius: 140, backgroundColor: SALES_GLASS.mutedLight }} />
        <View style={{ position: 'absolute', bottom: -70, right: -30, width: 220, height: 220, borderRadius: 110, backgroundColor: SALES_GLASS.glow }} />
      </View>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => onClose?.()}
            style={[styles.backBtn, { borderColor: SALES_GLASS.border }]}
          >
            <ChevronLeft color={SALES_GLASS.fg} size={22} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <AppText
              variant="micro"
              weight="bold"
              transform="uppercase"
              style={[styles.headerSub, { color: SALES_GLASS.fgSecondary }]}
              numberOfLines={1}
            >
              {t("sales.ledger")}
            </AppText>
            <AppText
              variant="title"
              weight="bold"
              style={[styles.headerTitle, { color: SALES_GLASS.fg }]}
              numberOfLines={2}
            >
              {getHeaderLabel()}
            </AppText>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.success + "12",
                borderColor: colors.success + "20",
              },
            ]}
          >
            <CheckCircle size={14} color={colors.success} />
            <AppText
              variant="micro"
              weight="bold"
              transform="uppercase"
              style={[styles.summaryLabel, { color: SALES_GLASS.fgSecondary }]}
              numberOfLines={1}
            >
              {t("sales.status_paid")}
            </AppText>
            <AppNumber
              value={paidOutstanding?.paid?.total ?? 0}
              size="body-sm"
              weight="bold"
              showCurrency
              color={colors.success}
              style={styles.summaryValue}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppNumber
                value={paidOutstanding?.paid?.count ?? 0}
                size="caption"
                weight="medium"
                color={SALES_GLASS.fgSecondary}
                style={styles.summaryCount}
              />
              <AppText
                variant="caption"
                weight="medium"
                style={[styles.summaryCount, { color: SALES_GLASS.fgSecondary }]}
                numberOfLines={1}
              >
                {" "}{t("common.items")}
              </AppText>
            </View>
          </View>
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.warning + "12",
                borderColor: colors.warning + "20",
              },
            ]}
          >
            <AlertCircle size={14} color={colors.warning} />
            <AppText
              variant="micro"
              weight="bold"
              transform="uppercase"
              style={[styles.summaryLabel, { color: SALES_GLASS.fgSecondary }]}
              numberOfLines={1}
            >
              {t("summary.outstanding")}
            </AppText>
            <AppNumber
              value={paidOutstanding?.outstanding?.total ?? 0}
              size="body-sm"
              weight="bold"
              showCurrency
              color={colors.warning}
              style={styles.summaryValue}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppNumber
                value={paidOutstanding?.outstanding?.count ?? 0}
                size="caption"
                weight="medium"
                color={SALES_GLASS.fgSecondary}
                style={styles.summaryCount}
              />
              <AppText
                variant="caption"
                weight="medium"
                style={[styles.summaryCount, { color: SALES_GLASS.fgSecondary }]}
                numberOfLines={1}
              >
                {" "}{t("common.items")}
              </AppText>
            </View>
          </View>
        </View>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
          ]}
        >
          <Search size={16} color={SALES_GLASS.fgSecondary} />
          <TextInput
            style={[styles.searchInput, { color: SALES_GLASS.fg }]}
            placeholder={t("sales.search_items")}
            placeholderTextColor={SALES_GLASS.fgSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <X size={14} color={SALES_GLASS.fgSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterChips}
        >
          {FILTER_OPTIONS.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              onPress={() => handleDateFilterChange(filter.key as any)}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    dateFilter === filter.key ? SALES_GLASS.fg : SALES_GLASS.bgCard,
                  borderColor:
                    dateFilter === filter.key ? SALES_GLASS.fg : SALES_GLASS.border,
                },
              ]}
            >
              <AppText
                variant="caption"
                weight="bold"
                shrink={false}
                style={[
                  styles.filterChipText,
                  {
                    color:
                      dateFilter === filter.key
                        ? SALES_GLASS.bg
                        : SALES_GLASS.fg,
                  },
                ]}
                numberOfLines={1}
              >
                {t(filter.labelKey)}
              </AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {(dateFilter === "week" ||
          dateFilter === "month" ||
          dateFilter === "year") && (
          <View style={styles.navRow}>
            <TouchableOpacity
              onPress={() => setDateOffset((prev) => prev - 1)}
              style={[
                styles.navBtn,
                { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
              ]}
            >
              <ChevronLeft size={16} color={SALES_GLASS.fg} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDateOffset((prev) => Math.min(prev + 1, 0))}
              style={[
                styles.navBtn,
                { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
                dateOffset >= 0 && { opacity: 0.3 },
              ]}
            >
              <ChevronRight size={16} color={SALES_GLASS.fg} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Sales List */}
      {isLoading ? (
        <SkeletonList count={6} showAvatar style={styles.listContent} />
      ) : (
        <FlatList
          data={processedSales.length === 0 ? [] : groupedSales}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          style={{ flex: 1 }}
          renderItem={renderGroup}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <History size={56} color={SALES_GLASS.border} />
              <AppText
                variant="title"
                weight="bold"
                align="center"
                style={[styles.emptyText, { color: SALES_GLASS.fgSecondary }]}
                numberOfLines={2}
              >
                {t("sales.no_records_found")}
              </AppText>
              <AppText
                variant="body-sm"
                weight="medium"
                align="center"
                style={[styles.emptySubtext, { color: SALES_GLASS.fgSecondary }]}
                numberOfLines={3}
              >
                {t("sales.no_records_sub")}
              </AppText>
            </View>
          }
        />
      )}

      {/* Sort FAB */}
      <Animated.View style={hideFABStyle}>
      <TouchableOpacity
        style={[styles.sortFab, { backgroundColor: SALES_GLASS.fg }]}
        onPress={() => setSortModalVisible(true)}
      >
        <ArrowDownUp size={20} color={SALES_GLASS.bg} />
      </TouchableOpacity>
      </Animated.View>

      {/* Date Picker */}
      <CustomDatePicker
        visible={dateModalVisible}
        onClose={() => setDateModalVisible(false)}
        initialDate={selectedDate}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setDateModalVisible(false);
        }}
        minDate={earliestDate}
      />

      {/* Sale Details Modal */}
      <Modal visible={!!selectedSale} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedSale(null)}
          />
          <View
            style={[
              styles.bottomSheetContainer,
              { backgroundColor: SALES_GLASS.bg },
            ]}
          >
            <View style={styles.modalHandleRow}>
              <View
                style={[styles.modalHandle, { backgroundColor: SALES_GLASS.border }]}
              />
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
          </View>
        </View>
      </Modal>

      {/* Sort Modal */}
      <Modal visible={sortModalVisible} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlayCenter}
          onPress={() => setSortModalVisible(false)}
        >
          <View
            style={[
              styles.sortMenu,
              { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
            ]}
          >
            {[
              {
                label: t("inv.sort_highest_price"),
                icon: ArrowUp,
                value: "price_desc",
              },
              {
                label: t("inv.sort_lowest_price"),
                icon: ArrowDown,
                value: "price_asc",
              },
              {
                label: t("inv.sort_highest_qty"),
                icon: ArrowUp,
                value: "qty_desc",
              },
              {
                label: t("inv.sort_name_az"),
                icon: SortAsc,
                value: "name_asc",
              },
            ].map((option, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.sortOption,
                  { borderBottomColor: SALES_GLASS.border },
                ]}
                onPress={() => {
                  setSelectedSort(option.value);
                  setSortModalVisible(false);
                }}
              >
                <option.icon
                  size={16}
                  color={
                    selectedSort === option.value ? colors.primary : SALES_GLASS.fg
                  }
                  style={{ marginRight: 12 }}
                />
                <AppText
                  variant="body"
                  weight="bold"
                  style={[
                    styles.sortText,
                    {
                      color:
                        selectedSort === option.value
                          ? colors.primary
                          : SALES_GLASS.fg,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {option.label}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* PDF Language Modal */}
      <PDFLanguageModal
        visible={showLangModal}
        onClose={() => {
          setShowLangModal(false);
          setPendingReceiptSale(null);
        }}
        onSelect={async (lang, calendar, action) => {
          if (pendingReceiptSale) {
            try {
              const ts = calendar === "ethiopian" ? "ethiopian" : "device";
              await generateReceiptPDF(
                pendingReceiptSale,
                activeBusiness,
                lang,
                action,
                ts,
              );
              showToast({
                title: t('toast.receipt_ready'),
                message: t('toast.receipt_ready_desc'),
                type: "success",
              });
            } catch {
              showToast(t("toast.receipt_pdf_failed"), "error");
            }
          }
        }}
      />
    </View>
  );
};

// Sale Item Card Component
const SaleItemCard = React.memo(
  ({ sale, onPress }: { sale: any; onPress: () => void }) => {
    const { colors, timeSystem, language, t } = useSettings();
    const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);
    const isPaid = sale.paymentStatus === "Paid";
    const isDebt = sale.paymentStatus === "Debt";
    const isCancelled = sale.paymentStatus === "Cancelled";
    const isPayment = sale.batchId && String(sale.batchId).startsWith("PAY_");
    const customerLabel = sale.customerName || t("sales.walk_in_customer");
    const itemDetail = isPayment
      ? `${sale.paymentMethod || "Cash"}`
        : sale.isBatch
          ? String(sale.quantity || sale.itemCount || 1) +
            " " +
            t("inv.items_suffix", { count: String(sale.quantity || sale.itemCount || 1) }) +
            " • " +
            (sale.paymentMethod || "Cash")
          : String(sale.quantity || 1) +
            " " +
            t("inv.items_suffix", { count: String(sale.quantity || 1) }) +
            " • " +
            (sale.paymentMethod || "Cash");
    const badgeColor = isPayment
      ? colors.success
      : isCancelled
        ? colors.error
        : isDebt
          ? colors.warning
          : isPaid
            ? colors.success
            : colors.warning;
    const badgeLabel = isPayment
      ? t("dashboard.activity.debt_collected")
      : isCancelled
        ? t("sale.cancelled")
        : isPaid
          ? t("sales.payment_paid")
          : t("sales.payment_debt");
    const Icon = isPayment
      ? CheckCircle
      : isCancelled
        ? AlertCircle
        : isPaid
          ? CheckCircle
          : AlertCircle;
    const displayPrice = isPayment
      ? Math.abs(sale.totalPrice)
      : sale.totalPrice;
    return (
      <TouchableOpacity
        style={[
          styles.saleCard,
          { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.saleIcon, { backgroundColor: badgeColor + "15" }]}>
          {isPayment ? (
            <Icon size={16} color={badgeColor} />
          ) : (
            <ProductImageStack
              images={sale.images?.length ? sale.images : sale.image ? [sale.image] : []}
              totalCount={sale.isBatch ? (sale.quantity || sale.itemCount) : 1}
              size={32}
              radius={8}
              ringColor={SALES_GLASS.bgCard}
              backgroundColor={badgeColor + "15"}
              iconColor={badgeColor}
            />
          )}
        </View>
        <View style={styles.saleInfo}>
          <AppText
            variant="body-sm"
            weight="bold"
            style={[styles.saleName, { color: SALES_GLASS.fg }]}
            numberOfLines={1}
          >
            {customerLabel}
          </AppText>
          <View style={styles.saleMeta}>
            <AppText
              variant="micro"
              weight="medium"
              shrink={false}
              style={[styles.saleMetaText, { color: SALES_GLASS.fgSecondary }]}
              numberOfLines={1}
            >
              {itemDetail}
            </AppText>
            <View
              style={[
                styles.paymentBadge,
                { backgroundColor: badgeColor + "15" },
              ]}
            >
              <AppText
                variant="micro"
                weight="bold"
                transform="uppercase"
                shrink={false}
                style={[styles.paymentBadgeText, { color: badgeColor }]}
                numberOfLines={1}
              >
                {badgeLabel}
              </AppText>
            </View>
          </View>
        </View>
        <View style={styles.salePriceSection}>
          <AppNumber
            value={displayPrice}
            size="body-sm"
            weight="bold"
            showCurrency
            color={SALES_GLASS.fg}
            style={styles.salePrice}
          />
          <AppText
            variant="micro"
            weight="medium"
            shrink={false}
            style={[styles.saleTime, { color: SALES_GLASS.fgSecondary }]}
            numberOfLines={1}
          >
            {sale.createdAt
              ? formatTime(sale.createdAt, timeSystem, language)
              : ""}
          </AppText>
        </View>
      </TouchableOpacity>
    );
  },
);
SaleItemCard.displayName = "SaleItemCard";

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 10 },
  headerTop: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  headerTitle: { fontSize: 20, fontFamily: Fonts.bold, marginTop: 2 },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
  },
  summaryValue: { fontSize: 14, fontFamily: Fonts.bold },
  summaryCount: { fontSize: 11, fontFamily: Fonts.medium },
  filterSection: { paddingHorizontal: 20, paddingVertical: 10, gap: 10 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  filterChips: { marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: { fontSize: 12, fontFamily: Fonts.bold },
  navRow: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 150, paddingTop: 5 },
  groupSection: { marginBottom: 20 },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  groupTitle: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  groupTotalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  groupTotalText: { fontSize: 12, fontFamily: Fonts.bold },
  saleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  saleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  saleInfo: { flex: 1, marginLeft: 10 },
  saleName: { fontSize: 14, fontFamily: Fonts.bold, marginBottom: 4 },
  saleMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  saleMetaText: { fontSize: 11, fontFamily: Fonts.medium },
  paymentBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  paymentBadgeText: { fontSize: 9, fontFamily: Fonts.bold },
  salePriceSection: { alignItems: "flex-end" },
  salePrice: { fontSize: 14, fontFamily: Fonts.bold },
  saleTime: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
  emptyState: { alignItems: "center", marginTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: Fonts.bold },
  emptySubtext: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  sortFab: {
    position: "absolute",
    bottom: 130,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: { flex: 1, width: "100%" },
  bottomSheetContainer: {
    width: "100%",
    height: "90%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderTopColor: SALES_GLASS.border,
  },
  modalHandleRow: { alignItems: "center", paddingTop: 15, paddingBottom: 5 },
  modalHandle: { width: 40, height: 4, borderRadius: 2 },
  sortMenu: {
    width: 220,
    borderRadius: 20,
    padding: 8,
    elevation: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
  },
  sortText: { fontSize: 14, fontFamily: Fonts.bold },
});

export default SalesRecordScreen;