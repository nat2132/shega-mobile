import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Pressable,
} from "react-native";
import Animated, {
  FadeInDown,
  Layout,
} from "react-native-reanimated";
import {
  Banknote,
  Barcode,
  Calendar,
  ChevronLeft,
  CreditCard,
  Eye,
  History,
  Minus,
  Package as PackageItem,
  Percent,
  Phone,
  Plus,
  Repeat,
  ScanLine,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Split,
  Ticket,
  Trash2,
  User,
  Wallet,
  X,
  Zap,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { getDebtCustomers, getComplianceSettings, getItemByBarcode, searchInventory } from "@/database/db";
import { useSettings } from "@/context/SettingsContext";
import { useDialog } from "@/context/DialogContext";
import { playNice, playBad } from "@/services/soundService";
import { Fonts, LightTheme } from "@/constants/theme";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { formatDate } from '@/utils/date-utils';
import { AppText, AppNumber } from "@/components/ui";
import { DraftSection } from '@/components/DraftSection';
import { Draft } from '@/services/draftService';
import { useFormDrafts } from '@/hooks/useFormDrafts';
import { usePermissions } from '@/hooks/usePermissions';
import BarcodeScannerView, { BarcodeScanResult } from '@/components/BarcodeScanner';
import { getLinePrice, getLineUnitLabel, getLineStock, calcLineTotal, cartSubtotal, cartUnitCount } from '@/utils/cartUtils';
import { getSalesGlass } from './glass-sales';
import { useTutorial, useTutorialExample, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { saleFormTutorial } from '@/tutorials/definitions';
const SALES_GLASS = getSalesGlass(LightTheme);

type PaymentMethod = "Cash" | "Transfer" | "Card" | "Mobile" | "";
interface TenderRow {
  method: Exclude<PaymentMethod, "">;
  amount: string;
}
interface SaleFormProps {
  cart: any[];
  onFinish?: (saleData: any) => void;
  onBack?: () => void;
  onAddItem?: (item: any) => void;
  onUpdateItem?: (id: any, updates: any) => void;
  onRemoveItem?: (id: any) => void;
}

const GlobalCheckout: React.FC<SaleFormProps> = ({
  cart,
  onFinish,
  onBack,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}) => {
  const { colors, t, theme, calendarType, language } = useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);
  const tutorial = useTutorial({ tutorial: saleFormTutorial });
  const dialog = useDialog();
  const { canManageCatalog } = usePermissions();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    "Cash",
  );
  const [paymentStatus, setPaymentStatus] = useState<"Paid" | "Debt" | "Order">(
    "Paid",
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState("0");
  const [taxType, setTaxType] = useState<"VAT" | "TOT" | "Other" | "None">("None");
  const [taxRate, setTaxRate] = useState("0");
  const [recordDate, setRecordDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dueDays, setDueDays] = useState("5");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [existingCustomers, setExistingCustomers] = useState<any[]>([]);

  // Cart editing + adding
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addTab, setAddTab] = useState<"scan" | "search">("scan");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [editingPrice, setEditingPrice] = useState<{ id: any; value: string } | null>(null);

  // Tenders / split payments / cash change
  const [tenders, setTenders] = useState<TenderRow[]>([
    { method: "Cash", amount: "" },
    { method: "Transfer", amount: "" },
    { method: "Card", amount: "" },
    { method: "Mobile", amount: "" },
  ]);

  // Receipt preview + duplicate-submit guard
  const [showReceipt, setShowReceipt] = useState(false);
  const submittingRef = useRef(false);
  const scanBusyRef = useRef(false);

  useEffect(() => {
    if (!tutorial.isActive) return;
    const tid = tutorial.currentStep?.targetId;
    if (tid === 'sf-customer-info') {
      setCustomerName('Tigist Desta');
      setCustomerPhone('0911-234-567');
      setDueDays('30');
    } else if (tid === 'sf-pricing') {
      setGlobalDiscount('5');
      setTaxType('VAT');
      setTaxRate('15');
    }
  }, [tutorial.isActive, tutorial.currentStep?.targetId]);

  const draftFormKey = 'sale';
  const draftFormData = useFormDrafts({
    screen: 'sale',
    formKey: draftFormKey,
    getPayload: useCallback(() => ({
      paymentMethod,
      paymentStatus,
      customerName,
      customerPhone,
      globalDiscount,
      taxType,
      taxRate,
      recordDate,
      dueDays,
    }), [paymentMethod, paymentStatus, customerName, customerPhone, globalDiscount, taxType, taxRate, recordDate, dueDays]),
    getTitle: useCallback(() => t('sale.draft_title', { count: String(cart.length) }), [cart.length, t]),
    getSubtitle: useCallback(() => {
      if (paymentStatus === 'Paid') return `${paymentMethod} • ${t('sale.settled_full')}`;
      if (paymentStatus === 'Debt') return `${customerName || t('sale.no_name')} • ${t('sale.debt_credit')}`;
      return t('sale.order');
    }, [paymentStatus, paymentMethod, customerName, t]),
    enabled: cart.length > 0,
  });

  const safeCart = useMemo(
    () => (Array.isArray(cart) ? cart : []),
    [cart],
  );

  const calculateTotals = () => {
    const subtotal = cartSubtotal(safeCart);
    const disc = Math.max(0, parseFloat(globalDiscount) || 0);
    const rate = Math.min(100, Math.max(0, parseFloat(taxRate) || 0));
    // Tax per item: only lines whose stored taxType is not "None" are taxed.
    // Falls back to taxing every line when items were created without tax metadata.
    let vatAmount = 0;
    if (taxType !== "None" && safeCart.length > 0) {
      const hasTaxMetadata = safeCart.some((i: any) => i.taxType);
      for (const item of safeCart) {
        const lineSubtotal = calcLineTotal(item);
        const itemDisc =
          subtotal > 0 ? (lineSubtotal / subtotal) * Math.max(0, disc) : 0;
        const taxable = Math.max(0, lineSubtotal - itemDisc);
        const isExempt = hasTaxMetadata && (!item.taxType || item.taxType === "None");
        if (!isExempt) vatAmount += taxable * (rate / 100);
      }
    }
    const total = Math.max(0, subtotal - disc + vatAmount);
    return { subtotal, vatAmount, total, discounted: Math.max(0, subtotal - disc) };
  };

  const { subtotal, vatAmount: taxAmount, total } = calculateTotals();

  // Tenders: amounts per method; non-split Quick mode auto-fills the active method.
  const applyQuickTender = useCallback(
    (method: Exclude<PaymentMethod, "">) => {
      setTenders((prev) =>
        prev.map((row) =>
          row.method === method
            ? { ...row, amount: total.toFixed(2) }
            : { ...row, amount: "" },
        ),
      );
    },
    [total],
  );

  const allocatedTotal = useMemo(
    () =>
      tenders.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0),
    [tenders],
  );
  const cashTendered = useMemo(
    () => parseFloat(tenders.find((r) => r.method === "Cash")?.amount || "0") || 0,
    [tenders],
  );
  const nonCashTendered = Math.max(0, allocatedTotal - cashTendered);
  const changeDue = Math.max(0, cashTendered - Math.max(0, total - nonCashTendered));
  const outstanding = Math.max(0, total - allocatedTotal);
  const allTenderFilled =
    paymentStatus !== "Paid" ||
    (allocatedTotal >= total - 0.01 && allocatedTotal <= total + 0.01);

  const primaryMethod = useMemo((): PaymentMethod => {
    if (paymentStatus === "Paid") {
      const paid: TenderRow[] = tenders.filter(
        (r) => (parseFloat(r.amount) || 0) > 0,
      );
      if (paid.length === 1) return paid[0].method;
      const dominant = tenders.reduce((best, r) =>
        (parseFloat(r.amount) || 0) > (parseFloat(best.amount) || 0) ? r : best,
      );
      return dominant.method;
    }
    return paymentMethod as PaymentMethod;
  }, [tenders, paymentStatus, paymentMethod]);

  const handleCheckout = async () => {
    // Duplicate-sale protection: ignore re-taps while the settlement is in flight.
    if (submittingRef.current) return;
    submittingRef.current = true;
    const resetGuard = () => {
      submittingRef.current = false;
    };

    // Validate cart is not empty
    if (!safeCart || safeCart.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({
        title: t("common.error"),
        message: t('sale.empty_cart_error'),
        iconType: "danger",
      });
      resetGuard();
      return;
    }

    // Validate discount is non-negative
    const parsedDiscount = parseFloat(globalDiscount) || 0;
    if (parsedDiscount < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({
        title: t("common.error"),
        message: t('sale.discount_negative_error'),
        iconType: "danger",
      });
      return;
    }

    // Validate tax rate is non-negative
    const parsedRate = parseFloat(taxRate) || 0;
    if (parsedRate < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({
        title: t("common.error"),
        message: t('sale.tax_rate_negative_error'),
        iconType: "danger",
      });
      return;
    }

    // Validate debt customer info
    if (paymentStatus === "Debt") {
      if (!customerName || !customerName.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await dialog.alert({
          title: t("common.error"),
          message: t("sale.credit_error"),
          iconType: "danger",
        });
        return;
      }
      if (!customerPhone || !customerPhone.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await dialog.alert({
          title: t("common.error"),
          message: t("sale.credit_error"),
          iconType: "danger",
        });
        return;
      }
      if (!/^\+?[\d\s\-()]{7,20}$/.test(customerPhone.trim())) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await dialog.alert({
          title: t("sale.invalid_phone"),
          message: t("sale.invalid_phone_msg"),
          iconType: "warning",
        });
        return;
      }
    }

    // Orders require customer name (for order tracking) but not phone
    if (paymentStatus === "Order") {
      if (!customerName || !customerName.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        playBad();
        await dialog.alert({
          title: t("common.error"),
          message: t("sale.order_requires_name"),
          iconType: "danger",
        });
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playNice();
      await draftFormData.clearCurrent();
      onFinish?.({
        paymentMethod,
        paymentStatus,
        customerName,
        customerPhone,
        discount: globalDiscount,
        taxType,
        vat: taxRate,
        totalPrice: total,
        createdAt: recordDate || undefined,
      });
      return;
    }

    // Validate total is a valid number
    if (isNaN(total) || total < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      await dialog.alert({
        title: t("common.error"),
        message: t("sale.invalid_total"),
        iconType: "danger",
      });
      return;
    }

    // Stock validation: check each item has sufficient stock before checkout
    for (const item of safeCart) {
      const requiredQty = Math.max(0, item.quantity || 0);
      const availableStock = getLineStock(item);
      if (requiredQty > availableStock) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        playBad();
        const unitLabel =
          item.unitType === "pack" ? item.purchaseUnit : item.baseUnit;
        await dialog.alert({
          title: t('dialog.insufficient_stock'),
          message: t('dialog.insufficient_stock_desc', { name: item.name, required: String(requiredQty), unit: unitLabel, available: String(availableStock) }),
          iconType: "danger",
        });
        resetGuard();
        return;
      }
    }

    // Tender validation: tendered amounts must cover the total.
    if (paymentStatus === "Paid" && !allTenderFilled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      const shortfall = (total - allocatedTotal).toFixed(2);
      await dialog.alert({
        title: t("sale.split_incomplete_title") || "Payment not covered",
        message:
          t("sale.split_incomplete_msg") ||
          `Tendered ETB ${allocatedTotal.toFixed(2)} of ${total.toFixed(2)}. Enter the remaining ETB ${shortfall} to complete the sale.`,
        iconType: "warning",
      });
      resetGuard();
      return;
    }

    // ETB cash-transaction guardrail (National Bank of Ethiopia DAB limit).
    // Any cash portion of a Paid sale above the configured threshold requires a digital method.
    if (paymentStatus === "Paid" && cashTendered > 0) {
      const compliance = getComplianceSettings();
      if (cashTendered > compliance.cashTransactionLimit) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        playBad();
        const switchToTransfer = await dialog.confirm({
          title: t("sale.cash_limit_title") || "Cash Limit Exceeded",
          message:
            t("sale.cash_limit_msg") ||
            `This cash tender (ETB ${cashTendered.toLocaleString()}) exceeds the ETB ${compliance.cashTransactionLimit.toLocaleString()} cash transaction limit. Switch to Transfer to continue.`,
          confirmText: t("sale.cash_limit_switch") || "Switch to Transfer",
          cancelText: t("common.cancel") || "Cancel",
          iconType: "warning",
        });
        if (switchToTransfer) {
          applyQuickTender("Transfer");
        }
        resetGuard();
        return;
      }
    }

    const dueDate =
      paymentStatus === "Debt"
        ? new Date(
            new Date(recordDate || Date.now()).getTime() +
              (parseInt(dueDays) || 5) * 24 * 60 * 60 * 1000,
          ).toISOString()
        : undefined;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playNice();
    await draftFormData.clearCurrent();
    onFinish?.({
      paymentMethod: primaryMethod,
      paymentStatus,
      customerName,
      customerPhone,
      discount: globalDiscount,
      taxType,
      vat: taxRate,
      totalPrice: total,
      dueDate,
      createdAt: recordDate || undefined,
      tenders: tenders.filter((r) => (parseFloat(r.amount) || 0) > 0),
      changeDue,
      taxAmount,
    });
    // Keep the guard set until the parent unmounts/reopens the form.
    setTimeout(resetGuard, 800);
  };

  const addAt = useCallback(
    (item: any) => {
      onAddItem?.(item);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [onAddItem],
  );

  const setLineQty = useCallback(
    (id: any, patchQty: number) => {
      const item = safeCart.find((i) => i.id === id);
      if (!item) return;
      const qty = Math.max(0, patchQty);
      const maxStock = getLineStock(item);
      if (qty > maxStock) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        onUpdateItem?.(id, { quantity: maxStock });
        return;
      }
      onUpdateItem?.(id, { quantity: qty });
    },
    [safeCart, onUpdateItem],
  );

  const toggleUnit = useCallback(
    (id: any) => {
      const item = safeCart.find((i) => i.id === id);
      if (!item) return;
      const wantPack = item.unitType !== "pack";
      const allowed =
        wantPack && item.allowSellByPackUnit
          ? true
          : !wantPack && item.allowSellByBaseUnit
            ? true
            : false;
      if (!allowed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      Haptics.selectionAsync();
      onUpdateItem?.(id, { unitType: wantPack ? "pack" : "base" });
    },
    [safeCart, onUpdateItem],
  );

  const removeLine = useCallback(
    (id: any) => {
      onRemoveItem?.(id);
      setEditingPrice((prev) => (prev?.id === id ? null : prev));
    },
    [onRemoveItem],
  );

  const commitPrice = useCallback(() => {
    if (!editingPrice) return;
    const id = editingPrice.id;
    const value = Math.max(0, parseFloat(editingPrice.value) || 0).toString();
    const item = safeCart.find((i) => i.id === id);
    if (item) {
      const field =
        item.unitType === "pack" ? "packSellingPrice" : "baseSellingPrice";
      onUpdateItem?.(id, { [field]: value });
    }
    setEditingPrice(null);
  }, [editingPrice, safeCart, onUpdateItem]);

  const runSearch = useCallback((q: string) => {
    const query = (q || "").trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const result = searchInventory(query);
    setSearchResults(result);
    setSearching(false);
  }, []);

  const searchTimer = useRef<any>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(searchQuery), 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, runSearch]);

  const handleBarcodeScan = useCallback(
    async (result: BarcodeScanResult) => {
      if (scanBusyRef.current) return;
      scanBusyRef.current = true;
      const code = result.barcode;
      const item = getItemByBarcode(code);
      if (item) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        addAt(item);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await dialog.alert({
          title: t("sale.not_found_title") || "Item not found",
          message:
            t("sale.not_found_msg") ||
            `No item matches barcode "${code}". Search the catalog below or register it as a new product.`,
          iconType: "warning",
        });
        setAddTab("search");
        setSearchQuery("");
      }
      setTimeout(() => {
        scanBusyRef.current = false;
      }, 1200);
    },
    [addAt, dialog, t],
  );

  const clearTenders = useCallback(() => {
    setTenders((prev) => prev.map((r) => ({ ...r, amount: "" })));
  }, []);

  const quickFillRemainder = useCallback(() => {
    setTenders((prev) => {
      const filled = prev.filter((r) => (parseFloat(r.amount) || 0) > 0);
      if (filled.length === 0) return prev;
      const rest = total - filled.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      if (rest <= 0.001) return prev;
      return prev.map((r) => {
        if (r.method !== filled[0].method && (parseFloat(r.amount) || 0) === 0) {
          return { ...r, amount: rest.toFixed(2) };
        }
        return r;
      });
    });
  }, [total]);

  return (
    <View style={[styles.container, { backgroundColor: SALES_GLASS.bg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: 'absolute', top: -80, left: -40, width: 280, height: 280, borderRadius: 140, backgroundColor: SALES_GLASS.mutedLight }} />
        <View style={{ position: 'absolute', bottom: -60, right: -30, width: 220, height: 220, borderRadius: 110, backgroundColor: SALES_GLASS.glow }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TutorialScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {draftFormData.showDrafts && (
            <DraftSection
              drafts={draftFormData.drafts}
              onRestore={async (draft) => {
                const d = draft.data;
                setPaymentMethod(d.paymentMethod || 'Cash');
                setPaymentStatus(d.paymentStatus || 'Paid');
                setCustomerName(d.customerName || '');
                setCustomerPhone(d.customerPhone || '');
                setGlobalDiscount(d.globalDiscount || '0');
                setTaxType(d.taxType || 'None');
                setTaxRate(d.taxRate || '0');
                setRecordDate(d.recordDate || '');
                setDueDays(d.dueDays || '5');
                await draftFormData.remove(draft.id);
              }}
              onDelete={async (id) => {
                await draftFormData.remove(id);
              }}
            />
          )}
          {/* Checkout Header */}
          <TutorialTarget id="sf-header">
          <Animated.View
            entering={FadeInDown.duration(600)}
            style={styles.header}
          >
            <View style={styles.headerRow}>
              <View>
                <AppText
                  variant="micro"
                  weight="bold"
                  transform="uppercase"
                  style={[styles.headerSub, { color: SALES_GLASS.fgSecondary }]}
                  numberOfLines={1}
                >
                  {t("sale.transaction_logic")}
                </AppText>
                <AppText
                  variant="title"
                  weight="bold"
                  style={[styles.headerTitle, { color: SALES_GLASS.fg }]}
                  numberOfLines={2}
                >
                  {t("sale.intelligence_setting")}
                </AppText>
              </View>
              <View
                style={[
                  styles.bagBadge,
                  { backgroundColor: SALES_GLASS.fg + "10" },
                ]}
              >
                <ShoppingBag size={20} color={SALES_GLASS.fg} />
                <AppNumber
                  value={cartUnitCount(safeCart)}
                  size="title"
                  weight="bold"
                  color={SALES_GLASS.fg}
                  style={styles.bagCount}
                />
              </View>
              <TutorialButton tutorialId="sale-form" screenName={t('screen.record_sale')} />
            </View>
          </Animated.View>
          </TutorialTarget>

          {/* Cart Lines — scan-to-add, editable rows */}
          <Animated.View
            entering={FadeInDown.delay(100)}
            style={styles.formSection}
          >
            <TutorialTarget id="sf-cart">
            <View style={styles.blockHeader}>
              <ShoppingBag size={18} color={colors.primary} />
              <AppText
                variant="body"
                weight="bold"
                style={[styles.blockTitle, { color: SALES_GLASS.fg }]}
                numberOfLines={2}
              >
                {t("sale.cart_title") || "Cart"}
              </AppText>
              <View style={styles.blockHeaderRight}>
                <TouchableOpacity
                  style={[
                    styles.addItemBtn,
                    { backgroundColor: colors.primary + "18" },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSearchQuery("");
                    setAddTab("scan");
                    setShowAddSheet(true);
                  }}
                >
                  <ScanLine size={16} color={colors.primary} />
                  <AppText
                    variant="body-sm"
                    weight="bold"
                    shrink={false}
                    style={{ color: colors.primary }}
                    numberOfLines={1}
                  >
                    {t("sale.add_items") || "Add items"}
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>

            {safeCart.length === 0 ? (
              <TouchableOpacity
                style={[
                  styles.emptyCart,
                  { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
                ]}
                onPress={() => setShowAddSheet(true)}
              >
                <Barcode size={28} color={SALES_GLASS.fgSecondary} />
                <AppText
                  variant="body"
                  weight="medium"
                  style={{ color: SALES_GLASS.fgSecondary, marginTop: 8, textAlign: "center" }}
                >
                  {t("sale.empty_cart_hint") || "No items yet — scan a barcode or search the catalog to start."}
                </AppText>
              </TouchableOpacity>
            ) : (
              safeCart.map((item: any) => {
                const linePrice = getLinePrice(item);
                const unitLabel = getLineUnitLabel(item) || "pcs";
                const stock = getLineStock(item);
                const isPack = item.unitType === "pack";
                return (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.duration(250)}
                    layout={Layout.springify()}
                    style={[
                      styles.cartRow,
                      { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
                    ]}
                  >
                    <View style={styles.cartThumb}>
                      {item.image ? (
                        <Image
                          source={{ uri: item.image }}
                          style={styles.cartThumbImg}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <PackageItem size={18} color={SALES_GLASS.fgSecondary} />
                      )}
                    </View>
                    <View style={styles.cartLineBody}>
                      <View style={styles.cartLineTop}>
                        <AppText
                          variant="body"
                          weight="bold"
                          style={[styles.cartLineName, { color: SALES_GLASS.fg }]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </AppText>
                        {item.taxType && item.taxType !== "None" ? (
                          <View
                            style={[
                              styles.taxChip,
                              { backgroundColor: colors.primary + "15" },
                            ]}
                          >
                            <AppText
                              variant="micro"
                              weight="bold"
                              transform="uppercase"
                              shrink={false}
                              style={{ color: colors.primary }}
                              numberOfLines={1}
                            >
                              {item.taxType}
                            </AppText>
                          </View>
                        ) : null}
                      </View>
                      <AppNumber
                        value={linePrice}
                        size="caption"
                        weight="medium"
                        color={SALES_GLASS.fgSecondary}
                      />
                      <AppText
                        variant="micro"
                        weight="medium"
                        style={{ color: stock <= 0 ? colors.error : SALES_GLASS.fgSecondary, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {t("sale.stock_hint") || "In stock"}: {Math.max(0, stock)} {stock === 1 ? unitLabel : ""}
                      </AppText>
                    </View>
                    <View style={styles.cartControls}>
                      <View style={styles.qtyStepper}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => setLineQty(item.id, (item.quantity || 0) - 1)}
                        >
                          <Minus size={14} color={SALES_GLASS.fg} />
                        </TouchableOpacity>
                        <AppNumber
                          value={item.quantity || 0}
                          size="body-sm"
                          weight="bold"
                          style={styles.qtyVal}
                          color={SALES_GLASS.fg}
                        />
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => setLineQty(item.id, (item.quantity || 0) + 1)}
                        >
                          <Plus size={14} color={SALES_GLASS.fg} />
                        </TouchableOpacity>
                      </View>
                      {(item.allowSellByPackUnit && item.allowSellByBaseUnit) ? (
                        <TouchableOpacity
                          style={[styles.unitToggleBtn, { borderColor: SALES_GLASS.border }]}
                          onPress={() => toggleUnit(item.id)}
                        >
                          <Repeat size={11} color={SALES_GLASS.fgSecondary} />
                          <AppText
                            variant="micro"
                            weight="bold"
                            shrink={false}
                            style={{ color: SALES_GLASS.fgSecondary }}
                            numberOfLines={1}
                          >
                            {isPack ? (item.purchaseUnit || "Pack") : (item.baseUnit || "Unit")}
                          </AppText>
                        </TouchableOpacity>
                      ) : (
                        <View>
                          <AppText
                            variant="micro"
                            weight="medium"
                            shrink={false}
                            style={{ color: SALES_GLASS.fgSecondary }}
                            numberOfLines={1}
                          >
                            {unitLabel}
                          </AppText>
                        </View>
                      )}
                      <View style={styles.cartRowActions}>
                        {canManageCatalog ? (
                          !!editingPrice && editingPrice.id === item.id ? (
                            <TextInput
                              style={[
                                styles.priceEditInput,
                                {
                                  color: SALES_GLASS.fg,
                                  borderColor: colors.primary,
                                  backgroundColor: SALES_GLASS.bgCard,
                                },
                              ]}
                              value={editingPrice.value}
                              onChangeText={(val) =>
                                setEditingPrice({ id: item.id, value: val })
                              }
                              keyboardType="decimal-pad"
                              autoFocus
                              onBlur={commitPrice}
                              onSubmitEditing={commitPrice}
                              returnKeyType="done"
                            />
                          ) : (
                            <TouchableOpacity
                              style={styles.iconBtn}
                              onPress={() => {
                                Haptics.selectionAsync();
                                setEditingPrice({
                                  id: item.id,
                                  value: String(linePrice),
                                });
                              }}
                            >
                              <Wallet size={13} color={SALES_GLASS.fgSecondary} />
                            </TouchableOpacity>
                          )
                        ) : null}
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            removeLine(item.id);
                          }}
                        >
                          <Trash2 size={14} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <AppNumber
                      value={calcLineTotal(item)}
                      size="body"
                      weight="bold"
                      style={styles.cartLineTotal}
                      color={SALES_GLASS.fg}
                    />
                  </Animated.View>
                );
              })
            )}
            </TutorialTarget>
          </Animated.View>

          {/* Settlement Blocks */}
          <Animated.View
            entering={FadeInDown.delay(200)}
            style={styles.formSection}
          >
            {/* Record Date */}
            <TouchableOpacity
              style={[
                {
                  backgroundColor: SALES_GLASS.bgCard,
                  borderColor: SALES_GLASS.border,
                  borderWidth: 1,
                  borderRadius: 20,
                  padding: 16,
                  marginBottom: 15,
                  flexDirection: "row",
                  alignItems: "center",
                },
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar
                size={18}
                color={colors.primary}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <AppText
                  variant="micro"
                  weight="bold"
                  transform="uppercase"
                  style={{ color: SALES_GLASS.fgSecondary }}
                  numberOfLines={1}
                >
                  {t("common.record_date") || "Record Date"}
                </AppText>
                <AppText
                  variant="body"
                  weight="bold"
                  style={{
                    color: recordDate ? SALES_GLASS.fg : SALES_GLASS.fgSecondary,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {recordDate ? formatDate(new Date(recordDate), calendarType, language) : t("common.today") || "Today (Default)"}
                </AppText>
              </View>
            </TouchableOpacity>
            <View
              style={[
                styles.intelligenceBlock,
                { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
              ]}
            >
              <View style={styles.blockHeader}>
                <ShieldCheck size={18} color={colors.primary} />
                <AppText
                  variant="body"
                  weight="bold"
                  style={[styles.blockTitle, { color: SALES_GLASS.fg }]}
                  numberOfLines={2}
                >
                  {t("sale.settlement_status")}
                </AppText>
              </View>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    paymentStatus === "Paid" && [
                      styles.modalActive,
                      { backgroundColor: SALES_GLASS.fg },
                    ],
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPaymentStatus("Paid");
                    setPaymentMethod("Cash");
                  }}
                >
                  <AppText
                    variant="body-sm"
                    weight="bold"
                    shrink={false}
                    style={[
                      styles.modalBtnText,
                      {
                        color:
                          paymentStatus === "Paid"
                            ? SALES_GLASS.bg
                            : SALES_GLASS.fgSecondary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {t("sale.settled_full")}
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    paymentStatus === "Debt" && [
                      styles.modalActive,
                      { backgroundColor: colors.warning },
                    ],
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPaymentStatus("Debt");
                    setPaymentMethod("");
                  }}
                >
                  <AppText
                    variant="body-sm"
                    weight="bold"
                    shrink={false}
                    style={[
                      styles.modalBtnText,
                      {
                        color:
                          paymentStatus === "Debt"
                            ? SALES_GLASS.fg
                            : SALES_GLASS.fgSecondary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {t("sale.debt_credit")}
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    paymentStatus === "Order" && [
                      styles.modalActive,
                      { backgroundColor: colors.primary },
                    ],
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPaymentStatus("Order");
                    setPaymentMethod("");
                  }}
                >
                  <AppText
                    variant="body-sm"
                    weight="bold"
                    shrink={false}
                    style={[
                      styles.modalBtnText,
                      {
                        color:
                          paymentStatus === "Order"
                            ? SALES_GLASS.bg
                            : SALES_GLASS.fgSecondary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {t('sale.order')}
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>

            <TutorialTarget id="sf-payment">
            {paymentStatus === "Paid" && (
              <View
                style={[
                  styles.intelligenceBlock,
                  {
                    backgroundColor: SALES_GLASS.bgCard,
                    borderColor: SALES_GLASS.border,
                    marginTop: 15,
                  },
                ]}
              >
                <View style={styles.blockHeader}>
                  <Zap size={18} color={colors.primary} />
                  <AppText
                    variant="body"
                    weight="bold"
                    style={[styles.blockTitle, { color: SALES_GLASS.fg }]}
                    numberOfLines={2}
                  >
                    {t("sale.payment_modality")}
                  </AppText>
                </View>
                <View style={styles.toggleRow}>
                  {([["Cash", Banknote, t("sale.physical_cash")],
                    ["Transfer", CreditCard, t("sale.digital_bank")],
                    ["Card", CreditCard, t("sale.card") || "Card"],
                    ["Mobile", Smartphone, t("sale.mobile") || "Mobile"]] as const).map(
                    ([m, Icon, label]) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.modalBtn,
                          paymentMethod === m && [
                            styles.modalActive,
                            { backgroundColor: SALES_GLASS.fg },
                          ],
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setPaymentMethod(m);
                          applyQuickTender(m);
                        }}
                      >
                        <Icon
                          size={16}
                          color={
                            paymentMethod === m
                              ? SALES_GLASS.bg
                              : SALES_GLASS.fgSecondary
                          }
                        />
                        <AppText
                          variant="body-sm"
                          weight="bold"
                          shrink={false}
                          style={[
                            styles.modalBtnText,
                            {
                              color:
                                paymentMethod === m
                                  ? SALES_GLASS.bg
                                  : SALES_GLASS.fgSecondary,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {label}
                        </AppText>
                      </TouchableOpacity>
                    ),
                  )}
                </View>
                <View
                  style={[
                    styles.tenderRows,
                    { borderTopColor: SALES_GLASS.border },
                  ]}
                >
                  {tenders.map((row) => (
                    <TenderInputRow
                      key={row.method}
                      row={row}
                      label={row.method === "Cash" ? t("sale.physical_cash") : row.method === "Transfer" ? t("sale.digital_bank") : row.method}
                      action={() => {
                        Haptics.selectionAsync();
                        applyQuickTender(row.method);
                      }}
                      onChange={(amount) =>
                        setTenders((prev) =>
                          prev.map((r) =>
                            r.method === row.method ? { ...r, amount } : r,
                          ),
                        )
                      }
                      activeColor={colors.primary}
                      glas={SALES_GLASS}
                    />
                  ))}
                </View>
                <View style={styles.tenderBalanceRow}>
                  {allocatedTotal >= total - 0.01 ? (
                    <>
                      <Wallet size={14} color={colors.success} />
                      <AppText
                        variant="caption"
                        weight="bold"
                        style={{ color: colors.success, flexShrink: 1 }}
                        numberOfLines={1}
                      >
                        {t("sale.change_due") || "Change due"}: ETB{" "}
                        <AppNumber value={changeDue} size="caption" weight="bold" color={colors.success} />
                      </AppText>
                    </>
                  ) : (
                    <>
                      <Wallet size={14} color={colors.warning} />
                      <AppText
                        variant="caption"
                        weight="bold"
                        style={{ color: colors.warning, flexShrink: 1 }}
                        numberOfLines={1}
                      >
                        {t("sale.outstanding") || "Outstanding"}: ETB{" "}
                        <AppNumber value={outstanding} size="caption" weight="bold" color={colors.warning} />
                      </AppText>
                    </>
                  )}
                  <View style={styles.tenderBalanceActions}>
                    <TouchableOpacity
                      style={[styles.smallActionBtn, { borderColor: SALES_GLASS.border }]}
                      onPress={quickFillRemainder}
                    >
                      <Split size={12} color={SALES_GLASS.fgSecondary} />
                      <AppText
                        variant="micro"
                        weight="bold"
                        shrink={false}
                        style={{ color: SALES_GLASS.fgSecondary }}
                        numberOfLines={1}
                      >
                        {t("sale.split_pay") || "Split"}
                      </AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallActionBtn, { borderColor: SALES_GLASS.border }]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        clearTenders();
                      }}
                    >
                      <X size={12} color={SALES_GLASS.fgSecondary} />
                      <AppText
                        variant="micro"
                        weight="bold"
                        shrink={false}
                        style={{ color: SALES_GLASS.fgSecondary }}
                        numberOfLines={1}
                      >
                        {t("common.reset") || "Reset"}
                      </AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
            </TutorialTarget>

            <TutorialTarget id="sf-customer-info">
            {(paymentStatus === "Debt" || paymentStatus === "Order") && (
              <Animated.View
                entering={FadeInDown}
                layout={Layout}
                style={styles.identityNodes}
              >
                <TouchableOpacity
                  style={[
                    {
                      backgroundColor: SALES_GLASS.bgCard,
                      borderColor: SALES_GLASS.border,
                      borderWidth: 1,
                      borderRadius: 14,
                      padding: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 10,
                    },
                  ]}
                  onPress={() => {
                    const customers = getDebtCustomers();
                    setExistingCustomers(customers);
                    setCustomerSearchQuery("");
                    setShowCustomerSearch(true);
                  }}
                >
                  <History size={16} color={colors.primary} />
                  <AppText
                    variant="body-sm"
                    weight="bold"
                    shrink={false}
                    style={[
                      styles.nodeLabel,
                      { color: colors.primary, marginLeft: 8 },
                    ]}
                    numberOfLines={1}
                  >
                    {t("sales.select_existing_customer")}
                  </AppText>
                </TouchableOpacity>
                <View style={styles.inputNode}>
                  <View style={styles.nodeHeader}>
                    <User size={14} color={SALES_GLASS.fgSecondary} />
                    <AppText
                      variant="caption"
                      weight="bold"
                      transform="uppercase"
                      style={[
                        styles.nodeLabel,
                        { color: SALES_GLASS.fgSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {t("sale.customer_identity")}
                    </AppText>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border },
                    ]}
                    placeholder={t("form.official_name")}
                    placeholderTextColor={SALES_GLASS.fgSecondary}
                    value={customerName}
                    onChangeText={(val) => {
                      if (val.length <= 50) setCustomerName(val);
                    }}
                    maxLength={50}
                  />
                  <AppText
                    variant="micro"
                    weight="medium"
                    align="right"
                    shrink={false}
                    style={{ color: SALES_GLASS.fgSecondary, marginTop: 4 }}
                    numberOfLines={1}
                  >
                    {customerName.length}/50
                  </AppText>
                </View>
                <View style={styles.inputNode}>
                  <View style={styles.nodeHeader}>
                    <Phone size={14} color={SALES_GLASS.fgSecondary} />
                    <AppText
                      variant="caption"
                      weight="bold"
                      transform="uppercase"
                      style={[
                        styles.nodeLabel,
                        { color: SALES_GLASS.fgSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {t("sale.contact_string")}
                    </AppText>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border },
                    ]}
                    placeholder={t("form.contact_placeholder")}
                    placeholderTextColor={SALES_GLASS.fgSecondary}
                    keyboardType="phone-pad"
                    value={customerPhone}
                    onChangeText={(val) => {
                      if (val.length <= 20) setCustomerPhone(val);
                    }}
                    maxLength={20}
                  />
                  <AppText
                    variant="micro"
                    weight="medium"
                    align="right"
                    shrink={false}
                    style={{ color: SALES_GLASS.fgSecondary, marginTop: 4 }}
                    numberOfLines={1}
                  >
                    {customerPhone.length}/20
                  </AppText>
                </View>
                <View style={[styles.adjRow, { marginTop: 12 }]}>
                  <View style={styles.adjLabelCol}>
                    <Calendar size={16} color={SALES_GLASS.fgSecondary} />
                    <AppText
                      variant="caption"
                      weight="bold"
                      transform="uppercase"
                      style={[styles.adjLabel, { color: SALES_GLASS.fgSecondary }]}
                      numberOfLines={2}
                    >
                      {t("sale.due_in_days")}
                    </AppText>
                  </View>
                  <View
                    style={[
                      styles.adjInputBox,
                      {
                        backgroundColor: SALES_GLASS.bgCard,
                        borderColor: SALES_GLASS.border,
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.adjInput, { color: SALES_GLASS.fg, textAlign: "right" }]}
                      placeholder="5"
                      placeholderTextColor={SALES_GLASS.fgSecondary}
                      keyboardType="numeric"
                      value={dueDays}
                      onChangeText={(val) => {
                        if (val.length <= 3)
                          setDueDays(val.replace(/[^0-9]/g, ""));
                      }}
                      maxLength={3}
                    />
                    <AppText
                      variant="body"
                      weight="bold"
                      shrink={false}
                      style={[styles.adjCurr, { color: SALES_GLASS.fgSecondary }]}
                      numberOfLines={1}
                    >
                      {t("common.days")}
                    </AppText>
                  </View>
                </View>
              </Animated.View>
            )}
            </TutorialTarget>

            {/* Customer Search Modal */}
            <Modal
              visible={showCustomerSearch}
              transparent
              animationType="fade"
            >
              <Pressable
                style={{
                  flex: 1,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  justifyContent: "center",
                }}
                onPress={() => setShowCustomerSearch(false)}
              >
                <View
                  style={[
                    {
                      backgroundColor: SALES_GLASS.bgCard,
                      margin: 30,
                      borderRadius: 24,
                      padding: 20,
                      maxHeight: 400,
                      borderWidth: 1,
                      borderColor: SALES_GLASS.border,
                    },
                  ]}
                >
                  <AppText
                    variant="title"
                    weight="bold"
                    style={[
                      styles.nodeLabel,
                      { color: SALES_GLASS.fg, marginBottom: 12 },
                    ]}
                    numberOfLines={2}
                  >
                    {t("sales.select_customer")}
                  </AppText>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: SALES_GLASS.fg,
                        borderColor: SALES_GLASS.border,
                        marginBottom: 12,
                      },
                    ]}
                    placeholder={t("sales.search_customers")}
                    placeholderTextColor={SALES_GLASS.fgSecondary}
                    value={customerSearchQuery}
                    onChangeText={setCustomerSearchQuery}
                  />
                  <ScrollView style={{ maxHeight: 250 }}>
                    {existingCustomers
                      .filter((c) =>
                        c.customerName
                          ?.toLowerCase()
                          .includes(customerSearchQuery.toLowerCase()),
                      )
                      .map((customer, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            {
                              flexDirection: "row",
                              alignItems: "center",
                              paddingVertical: 12,
                              borderBottomWidth: 1,
                              borderBottomColor: SALES_GLASS.border,
                            },
                          ]}
                          onPress={() => {
                            setCustomerName(customer.customerName);
                            setCustomerPhone(customer.customerPhone || "");
                            setShowCustomerSearch(false);
                          }}
                        >
                          <User size={16} color={SALES_GLASS.fgSecondary} />
                          <View style={{ marginLeft: 12, flex: 1 }}>
                            <AppText
                              variant="body"
                              weight="bold"
                              style={[styles.nodeLabel, { color: SALES_GLASS.fg }]}
                              numberOfLines={1}
                            >
                              {customer.customerName}
                            </AppText>
                            <AppText
                              variant="caption"
                              weight="medium"
                              style={{
                                color: SALES_GLASS.fgSecondary,
                                marginTop: 2,
                              }}
                              numberOfLines={2}
                            >
                              {customer.customerPhone || t('sale.no_phone')} •{" "}
                              <AppNumber value={customer.oweAmount || 0} size="caption" weight="medium" showCurrency color={SALES_GLASS.fgSecondary} />{" "}{t('sale.owed')}
                            </AppText>
                          </View>
                        </TouchableOpacity>
                      ))}
                    {existingCustomers.length === 0 && (
                      <AppText
                        variant="body"
                        weight="medium"
                        align="center"
                        style={{
                          color: SALES_GLASS.fgSecondary,
                          paddingVertical: 20,
                        }}
                        numberOfLines={2}
                      >
                        {t("sales.no_customers_found")}
                      </AppText>
                    )}
                  </ScrollView>
                  <TouchableOpacity
                    onPress={() => setShowCustomerSearch(false)}
                    style={{ marginTop: 20, alignSelf: "center" }}
                  >
                    <AppText
                      variant="body"
                      weight="bold"
                      shrink={false}
                      style={[styles.nodeLabel, { color: colors.primary }]}
                      numberOfLines={1}
                    >
                      {t("common.cancel")}
                    </AppText>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Modal>

            {/* Pricing Adjustments */}
            <TutorialTarget id="sf-pricing">
            <View style={styles.pricingSection}>
              <View style={styles.adjRow}>
                <View style={styles.adjLabelCol}>
                  <Ticket size={16} color={SALES_GLASS.fgSecondary} />
                  <AppText
                    variant="caption"
                    weight="bold"
                    transform="uppercase"
                    style={[styles.adjLabel, { color: SALES_GLASS.fgSecondary }]}
                    numberOfLines={2}
                  >
                    {t("sale.loyalty_discount")}
                  </AppText>
                </View>
                <View
                  style={[
                    styles.adjInputBox,
                    {
                      backgroundColor: SALES_GLASS.bgCard,
                      borderColor: SALES_GLASS.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.adjInput, { color: SALES_GLASS.fg }]}
                    value={globalDiscount}
                    onChangeText={setGlobalDiscount}
                    keyboardType="numeric"
                  />
                  <AppText
                    variant="body"
                    weight="bold"
                    shrink={false}
                    style={[styles.adjCurr, { color: SALES_GLASS.fgSecondary }]}
                    numberOfLines={1}
                  >
                    {t("common.etb")}
                  </AppText>
                </View>
              </View>

              {/* Tax Type */}
              <View style={[styles.adjRow, { marginTop: 15 }]}>
                <View style={styles.adjLabelCol}>
                  <Percent size={16} color={SALES_GLASS.fgSecondary} />
                  <AppText
                    variant="caption"
                    weight="bold"
                    transform="uppercase"
                    style={[styles.adjLabel, { color: SALES_GLASS.fgSecondary }]}
                    numberOfLines={2}
                  >
                    {t("sale.tax_type")}
                  </AppText>
                </View>
                <View style={[styles.adjInputBox, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border, width: 180, paddingHorizontal: 8 }]}>
                  {(["VAT", "TOT", "Other", "None"] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
                        taxType === type && { backgroundColor: SALES_GLASS.fg },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setTaxType(type);
                        if (type === "None") {
                          setTaxRate("0");
                        } else if (type === "VAT") {
                          setTaxRate("15");
                        }
                      }}
                    >
                      <AppText
                        variant="caption"
                        weight="bold"
                        shrink={false}
                        style={[
                          { fontSize: 11, fontFamily: Fonts.bold },
                          { color: taxType === type ? SALES_GLASS.bg : SALES_GLASS.fgSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {t(`sale.tax.${type.toLowerCase()}`)}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Tax Rate */}
              <View style={[styles.adjRow, { marginTop: 12 }]}>
                <View style={styles.adjLabelCol}>
                  <Percent size={16} color={SALES_GLASS.fgSecondary} />
                  <AppText
                    variant="caption"
                    weight="bold"
                    transform="uppercase"
                    style={[styles.adjLabel, { color: SALES_GLASS.fgSecondary }]}
                    numberOfLines={2}
                  >
                    {t("sale.tax_rate")}
                  </AppText>
                </View>
                <View
                  style={[
                    styles.adjInputBox,
                    {
                      backgroundColor: SALES_GLASS.bgCard,
                      borderColor: SALES_GLASS.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.adjInput, { color: SALES_GLASS.fg }]}
                    value={taxRate}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/[^0-9.]/g, "");
                      if (cleaned.split(".").length <= 2) setTaxRate(cleaned);
                    }}
                    keyboardType="decimal-pad"
                    editable={taxType !== "None"}
                  />
                  <AppText
                    variant="body"
                    weight="bold"
                    shrink={false}
                    style={[styles.adjCurr, { color: SALES_GLASS.fgSecondary }]}
                    numberOfLines={1}
                  >
                    %
                  </AppText>
                </View>
              </View>
            </View>
            </TutorialTarget>

            {/* Vault Summary */}
            <View
              style={[
                styles.vaultSummary,
                {
                  backgroundColor: SALES_GLASS.bgCard,
                  borderWidth: 1,
                  borderColor: SALES_GLASS.border,
                },
              ]}
            >
              <View style={styles.summaryLine}>
                <AppText
                  variant="caption"
                  weight="medium"
                  style={[styles.vLabel, { color: SALES_GLASS.fgSecondary }]}
                  numberOfLines={1}
                >
                  {t("sale.subtotal")}
                </AppText>
                <AppNumber
                  value={subtotal}
                  size="body"
                  weight="bold"
                  showCurrency
                  color={SALES_GLASS.fg}
                  style={styles.vValue}
                />
              </View>
              <View style={styles.summaryLine}>
                <AppText
                  variant="caption"
                  weight="medium"
                  style={[styles.vLabel, { color: SALES_GLASS.fgSecondary }]}
                  numberOfLines={1}
                >
                  {t("sale.discount")}
                </AppText>
                <AppNumber
                  value={-(Number(globalDiscount) || 0)}
                  size="body"
                  weight="bold"
                  showCurrency
                  color={SALES_GLASS.fg}
                  style={styles.vValue}
                />
              </View>
              <View style={styles.summaryLine}>
                <AppText
                  variant="caption"
                  weight="medium"
                  style={[styles.vLabel, { color: SALES_GLASS.fgSecondary }]}
                  numberOfLines={1}
                >
                  {taxType === "None" ? t("sale.tax_type") : `${t(`sale.tax.${taxType.toLowerCase()}`)} (${taxRate}%)`}
                </AppText>
                <AppNumber
                  value={taxAmount}
                  size="body"
                  weight="bold"
                  showCurrency
                  color={SALES_GLASS.fg}
                  style={styles.vValue}
                />
              </View>
              <View
                style={[styles.vDivider, { backgroundColor: SALES_GLASS.border }]}
              />
              <View style={styles.summaryLine}>
                <AppText
                  variant="title"
                  weight="bold"
                  style={[styles.vTotalLabel, { color: SALES_GLASS.fg }]}
                  numberOfLines={1}
                >
                  {t("sale.total_settlement")}
                </AppText>
                <AppNumber
                  value={total}
                  size="title"
                  weight="bold"
                  showCurrency
                  color={SALES_GLASS.fg}
                  style={styles.vTotalValue}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.receiptPreviewBtn,
                {
                  backgroundColor: SALES_GLASS.bgCard,
                  borderColor: SALES_GLASS.border,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setShowReceipt(true);
              }}
            >
              <Eye size={15} color={SALES_GLASS.fgSecondary} />
              <AppText
                variant="body-sm"
                weight="bold"
                style={{ color: SALES_GLASS.fgSecondary }}
                numberOfLines={1}
              >
                {t("sale.receipt_preview") || "Preview receipt"}
              </AppText>
            </TouchableOpacity>
          </Animated.View>

          <TutorialTarget id="sf-commit-btn">
          <TouchableOpacity
            onPress={handleCheckout}
            activeOpacity={0.9}
            style={{ marginTop: 35 }}
            disabled={paymentStatus === "Paid" && !allTenderFilled}
          >
            <View
              style={[
                styles.finishBtn,
                {
                  backgroundColor: SALES_GLASS.fg,
                  opacity: paymentStatus === "Paid" && !allTenderFilled ? 0.45 : 1,
                },
              ]}
            >
              <ShieldCheck size={22} color={SALES_GLASS.bg} />
              <AppText
                variant="body"
                weight="bold"
                shrink={false}
                style={[styles.finishBtnText, { color: SALES_GLASS.bg }]}
                numberOfLines={2}
              >
                {t("sale.authorize_settlement").toUpperCase()}
              </AppText>
            </View>
            {paymentStatus === "Paid" && !allTenderFilled ? (
              <AppText
                variant="micro"
                weight="medium"
                style={{ color: SALES_GLASS.fgSecondary, textAlign: "center", marginTop: 6 }}
                numberOfLines={1}
              >
                {outstanding > 0
                  ? `${t("sale.outstanding") || "Outstanding"} ETB ${outstanding.toFixed(2)}`
                  : `${t("sale.change_due") || "Change"} ETB ${(-outstanding).toFixed(2)}`}
              </AppText>
            ) : null}
          </TouchableOpacity>
          </TutorialTarget>

          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <ChevronLeft size={16} color={SALES_GLASS.fgSecondary} />
            <AppText
              variant="body-sm"
              weight="medium"
              style={[styles.backText, { color: SALES_GLASS.fgSecondary }]}
              numberOfLines={2}
            >
              {t("sale.modify_inventory_cart")}
            </AppText>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </TutorialScrollView>
      </KeyboardAvoidingView>

      <CustomDatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={(date) => {
          setRecordDate(date);
          setShowDatePicker(false);
        }}
        initialDate={recordDate}
      />

      {/* Add-items sheet: Scan + Search */}
      <Modal
        visible={showAddSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddSheet(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowAddSheet(false)}
        />
        <View
          style={[
            styles.addSheet,
            { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <AppText
              variant="body"
              weight="bold"
              style={{ color: SALES_GLASS.fg }}
              numberOfLines={1}
            >
              {t("sale.add_items") || "Add items"}
            </AppText>
            <TouchableOpacity onPress={() => setShowAddSheet(false)}>
              <X size={20} color={SALES_GLASS.fgSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.sheetTab,
                addTab === "scan" && [styles.modalActive, { backgroundColor: SALES_GLASS.fg }],
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setAddTab("scan");
              }}
            >
              <Barcode
                size={15}
                color={addTab === "scan" ? SALES_GLASS.bg : SALES_GLASS.fgSecondary}
              />
              <AppText
                variant="body-sm"
                weight="bold"
                shrink={false}
                style={{ color: addTab === "scan" ? SALES_GLASS.bg : SALES_GLASS.fgSecondary }}
                numberOfLines={1}
              >
                {t("sale.scan_barcode") || "Scan"}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sheetTab,
                addTab === "search" && [styles.modalActive, { backgroundColor: SALES_GLASS.fg }],
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setAddTab("search");
              }}
            >
              <Search
                size={15}
                color={addTab === "search" ? SALES_GLASS.bg : SALES_GLASS.fgSecondary}
              />
              <AppText
                variant="body-sm"
                weight="bold"
                shrink={false}
                style={{ color: addTab === "search" ? SALES_GLASS.bg : SALES_GLASS.fgSecondary }}
                numberOfLines={1}
              >
                {t("sale.search_catalog") || "Search"}
              </AppText>
            </TouchableOpacity>
          </View>

          {addTab === "scan" ? (
            <View style={[styles.scanArea, { borderColor: SALES_GLASS.border }]}>
              <BarcodeScannerView
                onScan={handleBarcodeScan}
                onClose={() => setShowAddSheet(false)}
                onManualEntry={() => {}}
                showTopBar={false}
              />
            </View>
          ) : (
            <View style={styles.searchArea}>
              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border },
                ]}
              >
                <Search size={16} color={SALES_GLASS.fgSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: SALES_GLASS.fg }]}
                  placeholder={t("sale.search_placeholder") || "Search product, SKU, barcode..."}
                  placeholderTextColor={SALES_GLASS.fgSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <X size={16} color={SALES_GLASS.fgSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {searching ? (
                <AppText
                  variant="caption"
                  weight="medium"
                  style={{ color: SALES_GLASS.fgSecondary, textAlign: "center", marginTop: 18 }}
                >
                  {t("common.searching") || "Searching..."}
                </AppText>
              ) : searchResults.length === 0 ? (
                <AppText
                  variant="caption"
                  weight="medium"
                  style={{ color: SALES_GLASS.fgSecondary, textAlign: "center", marginTop: 18 }}
                >
                  {searchQuery.trim()
                    ? t("sale.no_results") || "No products found."
                    : t("sale.search_hint") || "Type to search your catalog."}
                </AppText>
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.searchResults}
                  keyboardShouldPersistTaps="handled"
                >
                  {searchResults.map((r: any) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[
                        styles.resultRow,
                        { backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border },
                      ]}
                      onPress={() => addAt(r)}
                    >
                      <View style={styles.cartThumb}>
                        {r.image ? (
                          <Image source={{ uri: r.image }} style={styles.cartThumbImg} contentFit="cover" />
                        ) : (
                          <PackageItem size={16} color={SALES_GLASS.fgSecondary} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText
                          variant="body-sm"
                          weight="bold"
                          style={{ color: SALES_GLASS.fg }}
                          numberOfLines={1}
                        >
                          {r.name}
                        </AppText>
                        <AppText
                          variant="micro"
                          weight="medium"
                          style={{ color: SALES_GLASS.fgSecondary }}
                          numberOfLines={1}
                        >
                          {r.baseUnit || "pcs"}
                          {r.taxType && r.taxType !== "None" ? ` · ${r.taxType}` : ""}
                        </AppText>
                      </View>
                      <AppNumber
                        value={parseFloat(r.baseSellingPrice) || 0}
                        size="body-sm"
                        weight="bold"
                        showCurrency
                        color={SALES_GLASS.fg}
                      />
                      <View style={styles.addRowBtn}>
                        <Plus size={15} color={SALES_GLASS.bg} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* Receipt preview */}
      <Modal
        visible={showReceipt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReceipt(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowReceipt(false)} />
        <View
          style={[
            styles.receiptModal,
            { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
          ]}
        >
          <View style={styles.sheetHeader}>
            <AppText
              variant="body"
              weight="bold"
              style={{ color: SALES_GLASS.fg }}
              numberOfLines={1}
            >
              {t("sale.receipt_preview") || "Receipt preview"}
            </AppText>
            <TouchableOpacity onPress={() => setShowReceipt(false)}>
              <X size={20} color={SALES_GLASS.fgSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18 }}>
            <View style={styles.receiptStoreRow}>
              <ShoppingBag size={16} color={colors.primary} />
              <AppText
                variant="body"
                weight="bold"
                style={{ color: SALES_GLASS.fg, flex: 1 }}
                numberOfLines={1}
              >
                {t("app.name") || "Shega"}
              </AppText>
              <AppText
                variant="micro"
                weight="medium"
                style={{ color: SALES_GLASS.fgSecondary }}
                numberOfLines={1}
              >
                {recordDate ? formatDate(new Date(recordDate), calendarType, language) : new Date().toLocaleString()}
              </AppText>
            </View>
            {safeCart.map((item: any) => (
              <View
                key={item.id}
                style={[styles.receiptLine, { borderBottomColor: SALES_GLASS.border }]}
              >
                <View style={{ flex: 1 }}>
                  <AppText
                    variant="body-sm"
                    weight="bold"
                    style={{ color: SALES_GLASS.fg }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </AppText>
                  <AppText
                    variant="micro"
                    weight="medium"
                    style={{ color: SALES_GLASS.fgSecondary }}
                    numberOfLines={1}
                  >
                    {item.quantity} × {getLineUnitLabel(item) || "pcs"} · ETB {getLinePrice(item).toFixed(2)}
                    {item.taxType && item.taxType !== "None" ? ` · ${item.taxType}` : ""}
                  </AppText>
                </View>
                <AppNumber
                  value={calcLineTotal(item)}
                  size="body-sm"
                  weight="bold"
                  showCurrency
                  color={SALES_GLASS.fg}
                />
              </View>
            ))}
            <View style={[styles.vDivider, { backgroundColor: SALES_GLASS.border }]} />
            <View style={styles.summaryLine}>
              <AppText variant="caption" weight="medium" style={{ color: SALES_GLASS.fgSecondary }}>
                {t("sale.subtotal")}
              </AppText>
              <AppNumber value={subtotal} size="body-sm" weight="bold" showCurrency color={SALES_GLASS.fg} />
            </View>
            <View style={styles.summaryLine}>
              <AppText variant="caption" weight="medium" style={{ color: SALES_GLASS.fgSecondary }}>
                {t("sale.discount")}
              </AppText>
              <AppNumber value={-(Number(globalDiscount) || 0)} size="body-sm" weight="bold" showCurrency color={SALES_GLASS.fg} />
            </View>
            <View style={styles.summaryLine}>
              <AppText variant="caption" weight="medium" style={{ color: SALES_GLASS.fgSecondary }}>
                {taxType === "None" ? t("sale.tax_type") : `${t(`sale.tax.${taxType.toLowerCase()}`)} (${taxRate}%)`}
              </AppText>
              <AppNumber value={taxAmount} size="body-sm" weight="bold" showCurrency color={SALES_GLASS.fg} />
            </View>
            {allocatedTotal > 0 && paymentStatus === "Paid"
              ? tenders
                  .filter((r) => (parseFloat(r.amount) || 0) > 0)
                  .map((r) => (
                    <View key={r.method} style={styles.summaryLine}>
                      <AppText variant="caption" weight="medium" style={{ color: SALES_GLASS.fgSecondary }}>
                        {r.method}
                      </AppText>
                      <AppNumber value={parseFloat(r.amount) || 0} size="body-sm" weight="bold" showCurrency color={SALES_GLASS.fg} />
                    </View>
                  ))
              : null}
            {changeDue > 0 && paymentStatus === "Paid" ? (
              <View style={styles.summaryLine}>
                <AppText variant="caption" weight="bold" style={{ color: colors.success }}>
                  {t("sale.change_due") || "Change due"}
                </AppText>
                <AppNumber value={changeDue} size="body-sm" weight="bold" showCurrency color={colors.success} />
              </View>
            ) : null}
            <View style={[styles.vDivider, { backgroundColor: SALES_GLASS.border }]} />
            <View style={styles.summaryLine}>
              <AppText variant="title" weight="bold" style={{ color: SALES_GLASS.fg }}>
                {t("sale.total_settlement")}
              </AppText>
              <AppNumber value={total} size="title" weight="bold" showCurrency color={SALES_GLASS.fg} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const TenderInputRow: React.FC<{
  row: TenderRow;
  label: string;
  action: () => void;
  onChange: (amount: string) => void;
  activeColor: string;
  glas: any;
}> = ({ row, label, action, onChange, activeColor, glas }) => (
  <View style={styles.tenderRow}>
    <TouchableOpacity style={styles.tenderFillBtn} onPress={action} activeOpacity={0.6}>
      <AppText
        variant="micro"
        weight="bold"
        shrink={false}
        style={{ color: glas.fgSecondary }}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </TouchableOpacity>
    <TextInput
      style={[
        styles.tenderInput,
        {
          color: glas.fg,
          borderColor: glas.border,
          backgroundColor: glas.bg,
        },
      ]}
      value={row.amount}
      onChangeText={onChange}
      keyboardType="decimal-pad"
      placeholder="0.00"
      placeholderTextColor={glas.fgSecondary}
      onFocus={() => {
        if (!row.amount) onChange("0");
      }}
    />
    <TouchableOpacity
      style={[styles.tenderCheck, { backgroundColor: activeColor }]}
      onPress={action}
      activeOpacity={0.6}
    >
      <Plus size={12} color={glas.bg} />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  header: { marginTop: 10, marginBottom: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerSub: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 32, fontFamily: Fonts.bold, letterSpacing: -1 },
  bagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  bagCount: { fontSize: 15, fontFamily: Fonts.bold },
  formSection: {},
  intelligenceBlock: { borderRadius: 24, padding: 16, borderWidth: 1, overflow: 'hidden' },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  blockTitle: { fontSize: 15, fontFamily: Fonts.bold },
  toggleRow: { flexDirection: "row", gap: 10 },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalActive: { elevation: 4 },
  modalBtnText: { fontSize: 13, fontFamily: Fonts.bold },
  identityNodes: { marginTop: 16, gap: 10 },
  inputNode: { gap: 8 },
  nodeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 5,
  },
  nodeLabel: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
  },
  input: {
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontSize: 16,
    fontFamily: Fonts.medium,
  },
  pricingSection: { marginVertical: 16 },
  adjRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  adjLabelCol: { flexDirection: "row", alignItems: "center", gap: 8 },
  adjLabel: { fontSize: 14, fontFamily: Fonts.bold },
  adjInputBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 15,
    width: 140,
  },
  adjInput: {
    flex: 1,
    textAlign: "right",
    fontSize: 16,
    fontFamily: Fonts.bold,
    paddingRight: 5,
  },
  adjCurr: { fontSize: 11, fontFamily: Fonts.bold },
  vaultSummary: {
    borderRadius: 32,
    padding: 18,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  vLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: SALES_GLASS.fgSecondary,
    letterSpacing: 1,
  },
  vValue: { fontSize: 15, fontFamily: Fonts.bold, color: SALES_GLASS.fg },
  vDivider: {
    height: 1,
    backgroundColor: SALES_GLASS.border,
    marginVertical: 15,
  },
  vTotalLabel: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: SALES_GLASS.fg,
    letterSpacing: 0.5,
  },
  vTotalValue: { fontSize: 24, fontFamily: Fonts.bold, color: SALES_GLASS.fg },
  finishBtn: {
    height: 56,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 20,
  },
  finishBtnText: { fontSize: 17, fontFamily: Fonts.bold },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  backText: { fontSize: 14, fontFamily: Fonts.bold },
  blockHeaderRight: { marginLeft: "auto" },
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  emptyCart: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 24,
    alignItems: "center",
  },
  cartRow: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cartThumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(120,120,120,0.10)",
  },
  cartThumbImg: { width: 46, height: 46 },
  cartLineBody: { flex: 1, minWidth: 0 },
  cartLineTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cartLineName: { flex: 1, fontSize: 14, fontFamily: Fonts.bold },
  taxChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  cartControls: { alignItems: "flex-end", gap: 6 },
  qtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(120,120,120,0.10)",
  },
  qtyVal: { minWidth: 22, textAlign: "center", fontSize: 14, fontFamily: Fonts.bold },
  unitToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
  },
  cartRowActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(120,120,120,0.10)",
  },
  cartLineTotal: { minWidth: 70, textAlign: "right", fontSize: 14, fontFamily: Fonts.bold },
  priceEditInput: {
    width: 74,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 8,
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  tenderRows: {
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
    gap: 8,
  },
  tenderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tenderFillBtn: {
    width: 96,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(120,120,120,0.10)",
    alignItems: "center",
  },
  tenderInput: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: Fonts.bold,
    textAlign: "right",
  },
  tenderCheck: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tenderBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  tenderBalanceActions: {
    flexDirection: "row",
    gap: 8,
    marginLeft: "auto",
  },
  smallActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 11,
  },
  receiptPreviewBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  modalBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  addSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    padding: 18,
    paddingBottom: 34,
    maxHeight: "70%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(120,120,120,0.35)",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTab: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  scanArea: {
    height: 300,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 12,
  },
  searchArea: { marginTop: 12, height: 320 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.medium,
  },
  searchResults: { paddingTop: 12, gap: 8, paddingBottom: 20 },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  addRowBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SALES_GLASS.fg,
  },
  receiptModal: {
    position: "absolute",
    left: 20,
    right: 20,
    top: 90,
    bottom: 90,
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 16,
  },
  receiptStoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  receiptLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
});

export default GlobalCheckout;