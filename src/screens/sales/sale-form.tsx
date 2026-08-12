import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  Calendar,
  CreditCard,
  Banknote,
  User,
  ShoppingBag,
  Ticket,
  ShieldCheck,
  Phone,
  History,
  ChevronLeft,
  Zap,
  Percent,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { getDebtCustomers } from "@/database/db";
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
import { getSalesGlass } from './glass-sales';
import { useTutorial, useTutorialExample, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { saleFormTutorial } from '@/tutorials/definitions';
const SALES_GLASS = getSalesGlass(LightTheme);
interface SaleFormProps {
  cart: any[];
  onFinish?: (saleData: any) => void;
  onBack?: () => void;
}

const GlobalCheckout: React.FC<SaleFormProps> = ({
  cart,
  onFinish,
  onBack,
}) => {
  const { colors, t, theme, calendarType, language } = useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);
  const tutorial = useTutorial({ tutorial: saleFormTutorial });
  const dialog = useDialog();

  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Transfer" | "">(
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

  const calculateTotals = () => {
    // Ensure cart is valid
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return { subtotal: 0, vatAmount: 0, total: 0 };
    }

    const subtotal = cart.reduce((sum, item) => {
      const price =
        item.unitType === "pack"
          ? item.packSellingPrice
          : item.baseSellingPrice;
      const qty = Math.max(0, item.quantity || 0);
      return sum + (parseFloat(price) || 0) * qty;
    }, 0);

    const disc = Math.max(0, parseFloat(globalDiscount) || 0);
    const rate = Math.min(100, Math.max(0, parseFloat(taxRate) || 0));
    const taxAmount = taxType === "None" ? 0 : (subtotal - disc) * (rate / 100);
    const total = Math.max(0, subtotal - disc + taxAmount);

    return { subtotal, taxAmount, total };
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  const handleCheckout = async () => {
    // Validate cart is not empty
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({
        title: t("common.error"),
        message: t('sale.empty_cart_error'),
        iconType: "danger",
      });
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
    for (const item of cart) {
      const requiredQty =
        item.unitType === "pack" ? item.quantity : item.quantity;
      const availableStock =
        item.unitType === "pack"
          ? Math.floor(item.totalPackQuantity || 0)
          : Math.floor(item.totalBaseQuantity || 0);
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
      paymentMethod,
      paymentStatus,
      customerName,
      customerPhone,
      discount: globalDiscount,
      taxType,
      vat: taxRate,
      totalPrice: total,
      dueDate,
      createdAt: recordDate || undefined,
    });
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
                  value={cart.length}
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
                  <TouchableOpacity
                    style={[
                      styles.modalBtn,
                      paymentMethod === "Cash" && [
                        styles.modalActive,
                        { backgroundColor: SALES_GLASS.fg },
                      ],
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPaymentMethod("Cash");
                    }}
                  >
                    <Banknote
                      size={16}
                      color={
                        paymentMethod === "Cash"
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
                            paymentMethod === "Cash"
                              ? SALES_GLASS.bg
                              : SALES_GLASS.fgSecondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {t("sale.physical_cash")}
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalBtn,
                      paymentMethod === "Transfer" && [
                        styles.modalActive,
                        { backgroundColor: SALES_GLASS.fg },
                      ],
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPaymentMethod("Transfer");
                    }}
                  >
                    <CreditCard
                      size={16}
                      color={
                        paymentMethod === "Transfer"
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
                            paymentMethod === "Transfer"
                              ? SALES_GLASS.bg
                              : SALES_GLASS.fgSecondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {t("sale.digital_bank")}
                    </AppText>
                  </TouchableOpacity>
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
          </Animated.View>

          <TutorialTarget id="sf-commit-btn">
          <TouchableOpacity
            onPress={handleCheckout}
            activeOpacity={0.9}
            style={{ marginTop: 35 }}
          >
            <View
              style={[styles.finishBtn, { backgroundColor: SALES_GLASS.fg }]}
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
});

export default GlobalCheckout;