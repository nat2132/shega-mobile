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
  Calendar,
  Check,
  ChevronLeft,
  Eye,
  History,
  Phone,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  User,
  X,
  Zap,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { getDebtCustomers, getComplianceSettings, getScopedBusinessId } from "@/database/db";
import { useSettings } from "@/context/SettingsContext";
import { useDialog } from "@/context/DialogContext";
import { playNice, playBad } from "@/services/soundService";
import { Fonts, LightTheme } from "@/constants/theme";
import { AppText, AppNumber } from "@/components/ui";
import { DraftSection } from '@/components/DraftSection';
import { Draft } from '@/services/draftService';
import { useFormDrafts } from '@/hooks/useFormDrafts';
import { getLinePrice, getLineUnitLabel, getLineStock, calcLineTotal, cartSubtotal, cartUnitCount } from '@/utils/cartUtils';
import { getSalesGlass } from './glass-sales';
import { getSaleTaxConfig } from "@/services/taxService";
import { usePermissions } from "@/hooks/usePermissions";
import {
  getMobileBankingProviders,
  addMobileBankingProvider,
  removeMobileBankingProvider,
  MobileBankingProvider,
} from "@/services/mobileBankingService";
const SALES_GLASS = getSalesGlass(LightTheme);

type PaymentMethod = "Cash" | "Mobile" | "";
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
}) => {
  const { colors, t, theme, featureFlags } = useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);
  const dialog = useDialog();
  // Domain gate: no sales.create permission, no settlement — this is the
  // single checkout surface every sale flow funnels through.
  const { canSell } = usePermissions();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    "Cash",
  );
  const [paymentStatus, setPaymentStatus] = useState<"Paid" | "Debt" | "Order">(
    "Paid",
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState("0");
  const [dueDays, setDueDays] = useState("5");

  // Tax comes from the business configuration (Settings → Tax Center, or the
  // initial setup step) — the cashier never picks tax type/rate per sale.
  // Keyed to the active business so switching businesses reloads the config.
  const saleTax = useMemo(() => getSaleTaxConfig(), [getScopedBusinessId()]);
  const taxType = saleTax.taxType;
  const taxRate = saleTax.taxRate;

  // Saved mobile-banking providers (Telebirr, CBE Birr, …) picked at checkout.
  const [mbProviders, setMbProviders] = useState<MobileBankingProvider[]>(() => getMobileBankingProviders());
  const [selectedMbProvider, setSelectedMbProvider] = useState<string>("");
  const [showAddMbProvider, setShowAddMbProvider] = useState(false);
  const [newMbName, setNewMbName] = useState("");
  const [newMbAccount, setNewMbAccount] = useState("");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [existingCustomers, setExistingCustomers] = useState<any[]>([]);

  // Receipt preview + duplicate-submit guard
  const [showReceipt, setShowReceipt] = useState(false);
  const submittingRef = useRef(false);

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
      dueDays,
    }), [paymentMethod, paymentStatus, customerName, customerPhone, globalDiscount, dueDays]),
    getTitle: useCallback(() => t('sale.draft_title', { count: String(cart.length) }), [cart.length, t]),
    getSubtitle: useCallback(() => {
      if (paymentStatus === 'Paid') return `${paymentMethod} • ${t('sale.settled_full')}`;
      return `${customerName || t('sale.no_name')} • ${t('sale.debt_credit')}`;
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
    // The business-level tax (Settings → Tax Centre) applies to every line.
    let vatAmount = 0;
    if (taxType !== "None" && safeCart.length > 0) {
      for (const item of safeCart) {
        const lineSubtotal = calcLineTotal(item);
        const itemDisc =
          subtotal > 0 ? (lineSubtotal / subtotal) * Math.max(0, disc) : 0;
        const taxable = Math.max(0, lineSubtotal - itemDisc);
        vatAmount += taxable * (rate / 100);
      }
    }
    const total = Math.max(0, subtotal - disc + vatAmount);
    return { subtotal, vatAmount, total, discounted: Math.max(0, subtotal - disc) };
  };

  const { subtotal, vatAmount: taxAmount, total } = calculateTotals();

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
        const unitLabel = item.baseUnit;
        await dialog.alert({
          title: t('dialog.insufficient_stock'),
          message: t('dialog.insufficient_stock_desc', { name: item.name, required: String(requiredQty), unit: unitLabel, available: String(availableStock) }),
          iconType: "danger",
        });
        resetGuard();
        return;
      }
    }

    // Mobile sales require choosing a saved mobile-banking method.
    if (paymentStatus === "Paid" && paymentMethod === "Mobile" && !selectedMbProvider) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await dialog.alert({
        title: t("common.error"),
        message: t("sale.select_mb_provider") || "Select a mobile banking method to continue.",
        iconType: "warning",
      });
      resetGuard();
      return;
    }

    // ETB cash-transaction guardrail (National Bank of Ethiopia DAB limit).
    // Cash-only sales above the configured threshold require a digital method.
    if (paymentStatus === "Paid" && paymentMethod === "Cash") {
      const compliance = getComplianceSettings();
      if (total > compliance.cashTransactionLimit) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        playBad();
        const switchToTransfer = await dialog.confirm({
          title: t("sale.cash_limit_title") || "Cash Limit Exceeded",
          message:
            t("sale.cash_limit_msg") ||
            `This cash sale (ETB ${total.toLocaleString()}) exceeds the ETB ${compliance.cashTransactionLimit.toLocaleString()} cash transaction limit. Switch to Mobile Banking to continue.`,
          confirmText: t("sale.cash_limit_switch") || "Switch to Mobile Banking",
          cancelText: t("common.cancel") || "Cancel",
          iconType: "warning",
        });
        if (switchToTransfer) {
          setPaymentMethod("Mobile");
          setSelectedMbProvider(
            (prev) => prev || mbProviders[0]?.id || "",
          );
        }
        resetGuard();
        return;
      }
    }

    const dueDate =
      paymentStatus === "Debt"
        ? new Date(
            Date.now() +
              (parseInt(dueDays) || 5) * 24 * 60 * 60 * 1000,
          ).toISOString()
        : undefined;

    if (!canSell) {
      playBad();
      dialog.alert({
        title: t("common.error"),
        message: t("sale.no_permission") || "You do not have permission to make sales.",
        iconType: "warning",
      });
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playNice();
    await draftFormData.clearCurrent();
    // Record the chosen mobile-banking provider as the payment method so
    // reports show e.g. "Telebirr" instead of a generic "Mobile". The whole
    // sale settles in one method — no split tender entry.
    const resolvedPaymentMethod =
      paymentMethod === "Mobile"
        ? (mbProviders.find((p) => p.id === selectedMbProvider)?.name || "Mobile")
        : paymentMethod;
    onFinish?.({
      paymentMethod: resolvedPaymentMethod,
      paymentStatus,
      customerName,
      customerPhone,
      discount: globalDiscount,
      taxType,
      vat: taxRate,
      totalPrice: total,
      dueDate,
      tenders: [{ method: resolvedPaymentMethod, amount: total.toFixed(2) }],
      changeDue: 0,
      taxAmount,
    });
    // Keep the guard set until the parent unmounts/reopens the form.
    setTimeout(resetGuard, 800);
  };

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
        <ScrollView
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
                setPaymentStatus(featureFlags.customersEnabled ? (d.paymentStatus || 'Paid') : 'Paid');
                setCustomerName(d.customerName || '');
                setCustomerPhone(d.customerPhone || '');
                setGlobalDiscount(d.globalDiscount || '0');
                setDueDays(d.dueDays || '5');
                await draftFormData.remove(draft.id);
              }}
              onDelete={async (id) => {
                await draftFormData.remove(id);
              }}
            />
          )}
          {/* Checkout Header */}
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
            </View>
          </Animated.View>

          {/* Settlement Blocks */}
          <Animated.View
            entering={FadeInDown.delay(200)}
            style={styles.formSection}
          >
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
                {featureFlags.customersEnabled && (
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
                )}
              </View>
            </View>

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
                    ["Mobile", Smartphone, t("sale.mobile") || "Mobile Banking"]] as const).map(
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
                          if (m === "Mobile") {
                            setSelectedMbProvider(
                              (prev) => prev || mbProviders[0]?.id || "",
                            );
                          }
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
                {paymentMethod === "Mobile" && (
                  <View style={[styles.mbProviderBlock, { borderTopColor: SALES_GLASS.border }]}>
                    <AppText
                      variant="micro"
                      weight="bold"
                      transform="uppercase"
                      style={{ color: SALES_GLASS.fgSecondary, marginBottom: 8 }}
                      numberOfLines={1}
                    >
                      {t("sale.mobile_provider") || "Mobile Banking Provider"}
                    </AppText>
                    <View style={styles.mbProviderList}>
                      {mbProviders.map((p) => {
                        const selected = selectedMbProvider === p.id;
                        return (
                          <TouchableOpacity
                            key={p.id}
                            activeOpacity={0.7}
                            style={[
                              styles.mbProviderCard,
                              {
                                backgroundColor: selected
                                  ? SALES_GLASS.fg
                                  : SALES_GLASS.bgCard,
                                borderColor: selected
                                  ? SALES_GLASS.fg
                                  : SALES_GLASS.border,
                              },
                            ]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setSelectedMbProvider(p.id);
                            }}
                          >
                            <AppText
                              variant="body-sm"
                              weight="bold"
                              style={[
                                styles.mbProviderCardText,
                                {
                                  color: selected
                                    ? SALES_GLASS.bg
                                    : SALES_GLASS.fg,
                                },
                              ]}
                            >
                              {p.name}
                            </AppText>
                            {selected && (
                              <Check size={16} color={SALES_GLASS.bg} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <TouchableOpacity
                      style={[styles.mbAddBtn, { borderColor: SALES_GLASS.border }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowAddMbProvider(!showAddMbProvider);
                      }}
                    >
                      <Plus size={15} color={colors.primary} />
                      <AppText
                        variant="body-sm"
                        weight="bold"
                        shrink={false}
                        style={{ color: colors.primary }}
                        numberOfLines={1}
                      >
                        {t("sale.add_provider") || "Add New"}
                      </AppText>
                    </TouchableOpacity>
                    {showAddMbProvider && (
                      <View style={[styles.mbAddRow, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
                        <TextInput
                          style={[styles.mbInput, { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border, backgroundColor: SALES_GLASS.bg }]}
                          placeholder={t("sale.provider_name") || "Provider (e.g. Telebirr)"}
                          placeholderTextColor={SALES_GLASS.fgSecondary}
                          value={newMbName}
                          onChangeText={setNewMbName}
                        />
                        <TextInput
                          style={[styles.mbInput, { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border, backgroundColor: SALES_GLASS.bg }]}
                          placeholder={t("sale.provider_account") || "Account / phone (optional)"}
                          placeholderTextColor={SALES_GLASS.fgSecondary}
                          value={newMbAccount}
                          onChangeText={setNewMbAccount}
                        />
                        <TouchableOpacity
                          style={[styles.mbSaveBtn, { backgroundColor: SALES_GLASS.fg }]}
                          onPress={() => {
                            if (!newMbName.trim()) return;
                            const added = addMobileBankingProvider(newMbName, newMbAccount);
                            setMbProviders(getMobileBankingProviders());
                            setSelectedMbProvider(added.id);
                            setNewMbName("");
                            setNewMbAccount("");
                            setShowAddMbProvider(false);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }}
                        >
                          <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: SALES_GLASS.bg }} numberOfLines={1}>
                            {t("common.save") || "Save"}
                          </AppText>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {featureFlags.customersEnabled && paymentStatus === "Debt" && (
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

          <TouchableOpacity
            onPress={handleCheckout}
            activeOpacity={0.9}
            style={{ marginTop: 35 }}
          >
            <View
              style={[
                styles.finishBtn,
                {
                  backgroundColor: SALES_GLASS.fg,
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
          </TouchableOpacity>

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
        </ScrollView>
      </KeyboardAvoidingView>

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
                {new Date().toLocaleString()}
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
            {paymentStatus === "Paid" ? (
              <View style={styles.summaryLine}>
                <AppText variant="caption" weight="medium" style={{ color: SALES_GLASS.fgSecondary }}>
                  {paymentMethod === "Mobile"
                    ? (mbProviders.find((p) => p.id === selectedMbProvider)?.name || t("sale.mobile") || "Mobile")
                    : t("sale.physical_cash")}
                </AppText>
                <AppNumber value={total} size="body-sm" weight="bold" showCurrency color={SALES_GLASS.fg} />
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
  tenderRows: {
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
    gap: 8,
  },
  mbProviderBlock: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
    marginBottom: 12,
  },
  mbProviderList: { gap: 8, marginTop: 2 },
  mbProviderCard: {
    width: "100%",
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  mbProviderCardText: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: Fonts.bold,
    lineHeight: 20,
  },
  mbAddBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: 4,
  },
  mbAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  mbInput: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  mbSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
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