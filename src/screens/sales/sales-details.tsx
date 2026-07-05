import { PDFLanguageModal } from "@/components/PDFLanguageModal";
import PremiumActionModal from "@/components/PremiumActionModal";
import { Fonts, LightTheme } from "@/constants/theme";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/context/ToastContext";
import {
  cancelOrder,
  convertOrderToDebt,
  convertOrderToSale,
  deleteSale,
  deleteSalesByBatchId,
  getItems,
  insertReturn,
  insertSale,
  updateSale,
  updateSaleItem,
} from "@/database/db";
import { formatDate } from "@/utils/date-utils";
import { generateReceiptPDF } from "@/utils/pdf-utils";
import * as Haptics from "expo-haptics";
import {
  Activity,
  AlertCircle,
  BadgeCheck,
  Banknote,
  Calendar,
  Check,
  ChevronLeft,
  CreditCard,
  DollarSign,
  Download,
  Edit2,
  LayoutGrid,
  Package,
  Percent,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  User,
  Zap,
  X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AppText, AppNumber } from "@/components/ui";
import { getSalesGlass } from './glass-sales';
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
const SALES_GLASS = getSalesGlass(LightTheme);

const SaleDetailsScreen = ({
  sale,
  onClose,
}: {
  sale: any;
  onClose?: () => void;
}) => {
  const { userProfile, colors, calendarType, language, timeSystem, t, theme } =
    useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(sale);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [activeBusiness] = useState<any>({
    businessName: userProfile.businessName || t('sales.my_store'),
    storeName: t('sales.main_branch'),
  });
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  // Store the original unit price when entering edit mode (before discount)
  const [editingBaseUnitPrice, setEditingBaseUnitPrice] = useState(0);

  // Return state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnQty, setReturnQty] = useState(String(sale?.quantity || 1));
  const [showReturnSuccess, setShowReturnSuccess] = useState(false);
  const [itemEdits, setItemEdits] = useState<Record<number, any>>({});
  const [newItems, setNewItems] = useState<any[]>([]);
  const [itemSearchVisible, setItemSearchVisible] = useState<number | null>(
    null,
  );
  const [itemSearchQuery, setItemSearchQuery] = useState("");

  const isBatch = sale?.isBatch === true || !!sale?.items;
  const batchItems = isBatch ? sale?.items || [] : [];

  const allItems = useMemo(() => getItems(), []);
  const filteredItems = useMemo(() => {
    if (!itemSearchQuery.trim()) return allItems;
    const q = itemSearchQuery.toLowerCase();
    return allItems.filter(
      (i: any) =>
        i.name?.toLowerCase().includes(q) ||
        i.categoryName?.toLowerCase().includes(q),
    );
  }, [allItems, itemSearchQuery]);

  const originalUnitPrice = useMemo(() => {
    if (!sale || isBatch) return 0;
    const price = parseFloat(sale.totalPrice) || 0;
    const discount = parseFloat(sale.discount) || 0;
    const qty = Math.max(1, parseInt(sale.quantity) || 1);
    return (price + discount) / qty;
  }, [sale, isBatch]);

  const computedTotalPrice = useMemo(() => {
    if (!sale) return '0';
    if (isBatch) return sale.totalPrice;
    if (!isEditing) return editForm.totalPrice;
    const unitPrice = editingBaseUnitPrice || originalUnitPrice;
    const qty = Math.max(1, parseInt(editForm.quantity) || 1);
    const discount = parseFloat(editForm.discount) || 0;
    return Math.max(0, unitPrice * qty - discount);
  }, [
    isBatch,
    isEditing,
    editForm,
    editingBaseUnitPrice,
    originalUnitPrice,
    sale,
  ]);

  const calculatedUnitPrice = useMemo(() => {
    if (!sale || isBatch) return 0;
    if (isEditing) return editingBaseUnitPrice || originalUnitPrice;
    const price = parseFloat(editForm.totalPrice) || 0;
    const discount = parseFloat(editForm.discount) || 0;
    const qty = Math.max(1, parseInt(editForm.quantity) || 1);
    return (price + discount) / qty;
  }, [isBatch, isEditing, editForm, editingBaseUnitPrice, originalUnitPrice, sale]);

  if (!sale) return null;

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (isBatch) {
      let allSuccess = batchItems.every((item: any) => {
        const edits = itemEdits[item.id] || {};
        const qty =
          edits.quantity !== undefined ? edits.quantity : item.quantity;
        const discount =
          edits.discount !== undefined ? edits.discount : item.discount || 0;
        const vat = edits.vat !== undefined ? edits.vat : item.vat || 0;
        const taxType = edits.taxType !== undefined ? edits.taxType : item.taxType || "VAT";
        const unitPrice =
          ((item.totalPrice || 0) + (item.discount || 0)) /
          Math.max(1, item.quantity || 1);
        const totalPrice = Math.max(0, unitPrice * qty - discount);
        return updateSaleItem(item.id, {
          paymentMethod: editForm.paymentMethod,
          paymentStatus: editForm.paymentStatus,
          customerName: editForm.customerName,
          customerPhone: editForm.customerPhone,
          dueDate: editForm.dueDate,
          quantity: qty,
          discount,
          vat,
          taxType,
          totalPrice,
        });
      });
      if (allSuccess) {
        const batchId = sale.batchId;
        const allItems = getItems();
        for (const ni of newItems) {
          if (!ni.itemName?.trim()) continue;
          const found = allItems.find(
            (i: any) =>
              i.name?.toLowerCase() === ni.itemName.trim().toLowerCase(),
          ) as any;
          if (!found) continue;
          const unitPrice = found.baseSellingPrice || 0;
          const totalPrice = Math.max(
            0,
            unitPrice * ni.quantity - (ni.discount || 0),
          );
          const ins = insertSale({
            itemId: found.id,
            quantity: ni.quantity,
            unit: found.baseUnit,
            unitType: found.unitType || "base",
            discount: ni.discount || 0,
            vat: ni.vat || 0,
            taxType: ni.taxType || "VAT",
            totalPrice,
            paymentMethod: editForm.paymentMethod,
            paymentStatus: editForm.paymentStatus,
            customerName: editForm.customerName,
            customerPhone: editForm.customerPhone,
            batchId,
          });
          if (!ins) {
            allSuccess = false;
            break;
          }
        }
      }
      if (allSuccess) {
        setIsEditing(false);
        if (onClose) onClose();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        alert(t("common.error"));
      }
      return;
    }

    // Calculate totalPrice: (unitPrice * quantity) - discount
    const unitPrice = editingBaseUnitPrice || originalUnitPrice;
    const qty = Math.max(1, parseInt(editForm.quantity) || 1);
    const discount = parseFloat(editForm.discount) || 0;
    const computedTotal = Math.max(0, unitPrice * qty - discount);

    const updatedSale = {
      ...editForm,
      totalPrice: computedTotal,
    };

    const success = updateSale(sale.id, updatedSale);
    if (success) {
      setIsEditing(false);
      if (onClose) onClose();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t("common.error"));
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditForm(sale);
    setItemEdits({});
    setNewItems([]);
    setIsEditing(false);
  };

  const handleDelete = () => {
    const success = isBatch
      ? deleteSalesByBatchId(sale.batchId)
      : deleteSale(sale.id);
    if (success) {
      setShowDeleteConfirm(false);
      if (onClose) onClose();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t("common.error"));
    }
  };

  const handleReturn = () => {
    const qty = parseInt(returnQty) || 0;
    const maxQty = isBatch ? batchItems[0]?.quantity || 1 : sale.quantity || 1;
    if (qty <= 0 || qty > maxQty) {
      alert(t("common.error"));
      return;
    }
    if (!returnReason.trim()) {
      alert(t("common.error"));
      return;
    }

    if (isBatch) {
      const firstItem = batchItems[0];
      const unitPrice =
        (firstItem.totalPrice || 0) / Math.max(1, firstItem.quantity || 1);
      const totalRefund = unitPrice * qty;
      const success = insertReturn({
        saleId: firstItem.id,
        itemId: firstItem.itemId,
        quantity: qty,
        unit: firstItem.baseUnit || "pcs",
        unitType: "base",
        totalRefund: totalRefund,
        reason: returnReason.trim(),
        createdAt: new Date().toISOString(),
      });
      if (success) {
        setShowReturnModal(false);
        setReturnReason("");
        setReturnQty(String(maxQty));
        setShowReturnSuccess(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        alert(t("common.error"));
      }
      return;
    }

    const unitPrice = (sale.totalPrice || 0) / Math.max(1, sale.quantity || 1);
    const totalRefund = unitPrice * qty;

    const success = insertReturn({
      saleId: sale.id,
      itemId: sale.itemId,
      quantity: qty,
      unit: sale.unit || "pcs",
      unitType: sale.unitType || "base",
      totalRefund: totalRefund,
      reason: returnReason.trim(),
      createdAt: new Date().toISOString(),
    });

    if (success) {
      setShowReturnModal(false);
      setReturnReason("");
      setReturnQty(String(sale.quantity || 1));
      setShowReturnSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t("common.error"));
    }
  };

  const handleEditClick = () => {
    Haptics.selectionAsync();
    setEditForm(sale);
    setItemEdits({});
    setIsEditing(true);
    if (!isBatch) {
      setEditingBaseUnitPrice(originalUnitPrice);
    }
  };

  const debtFieldsSection = (editForm.paymentStatus === "Debt" ||
    editForm.paymentStatus === "Order") && (
    <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
      <AppText
        variant="micro"
        weight="bold"
        transform="uppercase"
        style={[styles.sectionTitle, { color: SALES_GLASS.fgSecondary }]}
        numberOfLines={1}
      >
        {t("sale.customer_identity")}
      </AppText>
      <View
        style={[
          styles.intelligenceBlock,
          { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
        ]}
      >
        <View style={styles.node}>
          <View style={styles.nodeInfo}>
            <User size={16} color={SALES_GLASS.fgSecondary} />
            <AppText
              variant="caption"
              weight="bold"
              style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]}
              numberOfLines={1}
            >
              {t("sale.legal_name")}
            </AppText>
          </View>
          {isEditing ? (
            <TextInput
              style={[
                styles.nodeInput,
                { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border },
              ]}
              value={editForm.customerName || ""}
              onChangeText={(t) =>
                setEditForm((prev: any) => ({ ...prev, customerName: t }))
              }
              placeholder={t("sales.customer_name_ph")}
              placeholderTextColor={SALES_GLASS.fgSecondary}
            />
          ) : (
            <AppText
              variant="body-sm"
              weight="bold"
              style={[styles.nodeValue, { color: SALES_GLASS.fg }]}
              numberOfLines={2}
            >
              {editForm.customerName || t("common.none")}
            </AppText>
          )}
        </View>
        <View style={styles.nodeDivider} />
        <View style={styles.node}>
          <View style={styles.nodeInfo}>
            <Phone size={16} color={SALES_GLASS.fgSecondary} />
            <AppText
              variant="caption"
              weight="bold"
              style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]}
              numberOfLines={1}
            >
              {t("sale.contact_string")}
            </AppText>
          </View>
          {isEditing ? (
            <TextInput
              style={[
                styles.nodeInput,
                { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border },
              ]}
              value={editForm.customerPhone || ""}
              keyboardType="phone-pad"
              onChangeText={(t) =>
                setEditForm((prev: any) => ({ ...prev, customerPhone: t }))
              }
              placeholder={t("sales.phone_ph")}
              placeholderTextColor={SALES_GLASS.fgSecondary}
            />
          ) : (
            <AppText
              variant="body-sm"
              weight="bold"
              style={[styles.nodeValue, { color: SALES_GLASS.fg }]}
              numberOfLines={2}
            >
              {editForm.customerPhone || t("common.not_provided")}
            </AppText>
          )}
        </View>
        <View style={styles.nodeDivider} />
        <View style={styles.node}>
          <View style={styles.nodeInfo}>
            <Calendar size={16} color={SALES_GLASS.fgSecondary} />
            <AppText
              variant="caption"
              weight="bold"
              style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]}
              numberOfLines={1}
            >
              {t("sale.due_date")}
            </AppText>
          </View>
          {isEditing ? (
            <TextInput
              style={[
                styles.nodeInput,
                { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border },
              ]}
              value={
                editForm.dueDate
                  ? formatDate(
                      new Date(editForm.dueDate),
                      calendarType,
                      language,
                    )
                  : ""
              }
              editable={false}
              placeholder={t("sales.no_due_date")}
              placeholderTextColor={SALES_GLASS.fgSecondary}
            />
          ) : (
            <AppText
              variant="body-sm"
              weight="bold"
              style={[
                styles.nodeValue,
                {
                  color:
                    editForm.dueDate && new Date(editForm.dueDate) < new Date()
                      ? colors.error
                      : SALES_GLASS.fg,
                },
              ]}
              numberOfLines={2}
            >
              {editForm.dueDate
                ? formatDate(new Date(editForm.dueDate), calendarType, language)
                : t("sales.no_due_date")}
            </AppText>
          )}
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: SALES_GLASS.bg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: 'absolute', top: -100, left: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: SALES_GLASS.mutedLight }} />
        <View style={{ position: 'absolute', bottom: -80, right: -40, width: 250, height: 250, borderRadius: 125, backgroundColor: SALES_GLASS.glow }} />
      </View>
      {/* Transaction Insight Header */}
      <View style={styles.heroContainer}>
        <View
          style={[styles.heroWash, { backgroundColor: SALES_GLASS.fg + "05" }]}
        />
        <View style={styles.topActions}>
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.circleBtn,
              { backgroundColor: SALES_GLASS.bg + "80" },
            ]}
          >
            <ChevronLeft size={20} color={SALES_GLASS.fg} />
          </TouchableOpacity>
          <View style={styles.row}>
            {isEditing ? (
              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={handleCancel}
                  style={[
                    styles.circleBtn,
                    { backgroundColor: colors.error + "15", marginRight: 10 },
                  ]}
                >
                  <X size={20} color={colors.error} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  style={[
                    styles.circleBtn,
                    { backgroundColor: colors.success + "15" },
                  ]}
                >
                  <Check size={20} color={colors.success} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowLangModal(true);
                  }}
                  style={[
                    styles.circleBtn,
                    { backgroundColor: colors.primary + "15", marginRight: 10 },
                  ]}
                >
                  <Download size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowReturnModal(true);
                  }}
                  style={[
                    styles.circleBtn,
                    { backgroundColor: colors.warning + "15", marginRight: 10 },
                  ]}
                >
                  <RotateCcw size={18} color={colors.warning} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowDeleteConfirm(true)}
                  style={[
                    styles.circleBtn,
                    { backgroundColor: colors.error + "15", marginRight: 10 },
                  ]}
                >
                  <Trash2 size={18} color={colors.error} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleEditClick}
                  style={[
                    styles.circleBtn,
                    { backgroundColor: SALES_GLASS.bg + "80" },
                  ]}
                >
                  <Edit2 size={18} color={SALES_GLASS.fg} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <Animated.View entering={ZoomIn} style={styles.heroContent}>
          <View
            style={[
              styles.badgeContainer,
              {
                backgroundColor:
                  editForm.paymentStatus === "Paid"
                    ? colors.success + "15"
                    : editForm.paymentStatus === "Order"
                      ? colors.primary + "15"
                      : editForm.paymentStatus === "Cancelled"
                        ? colors.error + "15"
                        : colors.warning + "15",
              },
            ]}
          >
            <BadgeCheck
              size={24}
              color={
                editForm.paymentStatus === "Paid"
                  ? colors.success
                  : editForm.paymentStatus === "Order"
                    ? colors.primary
                    : editForm.paymentStatus === "Cancelled"
                      ? colors.error
                      : colors.warning
              }
            />
          </View>
          <AppText
            variant="micro"
            weight="bold"
            transform="uppercase"
            style={[styles.heroSub, { color: SALES_GLASS.fgSecondary }]}
            numberOfLines={1}
          >
            {isBatch
              ? t("sales.batch_transaction")
              : t("sale.transaction_insight")}
          </AppText>
          {isEditing ? (
              <AppNumber
                value={computedTotalPrice}
                size="display"
                weight="bold"
                prefix={t('common.etb') + ' '}
                color={SALES_GLASS.fg}
                style={styles.heroTitle}
              />
          ) : (
            <AppNumber
              value={editForm.totalPrice}
              size="display"
              weight="bold"
              prefix={"ETB "}
              color={SALES_GLASS.fg}
              style={styles.heroTitle}
            />
          )}
          <AppText
            variant="body-sm"
            weight="bold"
            style={[styles.heroMeta, { color: SALES_GLASS.fgSecondary }]}
            numberOfLines={1}
          >
            {editForm.createdAt
              ? formatDate(new Date(editForm.createdAt), calendarType, language)
              : t("common.loading")}
          </AppText>
          {isBatch && (
            <AppText
              variant="body-sm"
              weight="bold"
              style={[
                styles.heroMeta,
                { color: SALES_GLASS.fgSecondary, marginTop: 4 },
              ]}
              numberOfLines={1}
            >
              <AppNumber value={batchItems.length} size="body-sm" weight="bold" color={SALES_GLASS.fgSecondary} />{" "}{t("common.items")}{" "}
              {sale.customerName ? `• ${sale.customerName}` : ""}
            </AppText>
          )}
        </Animated.View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Settlement Intelligence */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <AppText
            variant="micro"
            weight="bold"
            transform="uppercase"
            style={[styles.sectionTitle, { color: SALES_GLASS.fgSecondary }]}
            numberOfLines={1}
          >
            {t("sale.settlement_modality")}
          </AppText>
          <View style={styles.row}>
            <View
              style={[
                styles.modalityCard,
                { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
              ]}
            >
              <View style={styles.mIconBox}>
                {editForm.paymentMethod === "Cash" ? (
                  <Banknote size={18} color={colors.primary} />
                ) : (
                  <CreditCard size={18} color={colors.primary} />
                )}
              </View>
              <AppText
                variant="micro"
                weight="bold"
                transform="uppercase"
                style={[styles.mLabel, { color: SALES_GLASS.fgSecondary }]}
                numberOfLines={1}
              >
                {t("sale.method")}
              </AppText>
              {isEditing ? (
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      editForm.paymentMethod === "Cash" && {
                        backgroundColor: SALES_GLASS.fg,
                      },
                    ]}
                    onPress={() =>
                      setEditForm((prev: any) => ({
                        ...prev,
                        paymentMethod: "Cash",
                      }))
                    }
                  >
                    <Banknote
                      size={14}
                      color={
                        editForm.paymentMethod === "Cash"
                          ? SALES_GLASS.fg
                          : SALES_GLASS.fgSecondary
                      }
                    />
                    <AppText
                      variant="caption"
                      weight="bold"
                      shrink={false}
                      style={[
                        styles.toggleBtnText,
                        {
                          color:
                            editForm.paymentMethod === "Cash"
                              ? SALES_GLASS.fg
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
                      styles.toggleBtn,
                      editForm.paymentMethod === "Transfer" && {
                        backgroundColor: SALES_GLASS.fg,
                      },
                    ]}
                    onPress={() =>
                      setEditForm((prev: any) => ({
                        ...prev,
                        paymentMethod: "Transfer",
                      }))
                    }
                  >
                    <CreditCard
                      size={14}
                      color={
                        editForm.paymentMethod === "Transfer"
                          ? SALES_GLASS.fg
                          : SALES_GLASS.fgSecondary
                      }
                    />
                    <AppText
                      variant="caption"
                      weight="bold"
                      shrink={false}
                      style={[
                        styles.toggleBtnText,
                        {
                          color:
                            editForm.paymentMethod === "Transfer"
                              ? SALES_GLASS.fg
                              : SALES_GLASS.fgSecondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {t("sale.digital_bank")}
                    </AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <AppText
                  variant="body"
                  weight="bold"
                  style={[styles.mValue, { color: SALES_GLASS.fg }]}
                  numberOfLines={1}
                >
                  {editForm.paymentMethod === "Cash"
                    ? t("sale.physical_cash")
                    : t("sale.digital_bank")}
                </AppText>
              )}
            </View>
            <View
              style={[
                styles.modalityCard,
                { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
              ]}
            >
              <View style={styles.mIconBox}>
                <ShieldCheck
                  size={18}
                  color={
                    editForm.paymentStatus === "Paid"
                      ? colors.success
                      : editForm.paymentStatus === "Order"
                        ? colors.primary
                        : colors.warning
                  }
                />
              </View>
              <AppText
                variant="micro"
                weight="bold"
                transform="uppercase"
                style={[styles.mLabel, { color: SALES_GLASS.fgSecondary }]}
                numberOfLines={1}
              >
                {t("sale.status")}
              </AppText>
              {isEditing ? (
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      editForm.paymentStatus === "Paid" && {
                        backgroundColor: colors.success,
                      },
                    ]}
                    onPress={() =>
                      setEditForm((prev: any) => ({
                        ...prev,
                        paymentStatus: "Paid",
                      }))
                    }
                  >
                    <AppText
                      variant="caption"
                      weight="bold"
                      shrink={false}
                      style={[
                        styles.toggleBtnText,
                        {
                          color:
                            editForm.paymentStatus === "Paid"
                              ? SALES_GLASS.fg
                              : SALES_GLASS.fgSecondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {t("sale.settled")}
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      editForm.paymentStatus === "Debt" && {
                        backgroundColor: colors.warning,
                      },
                    ]}
                    onPress={() =>
                      setEditForm((prev: any) => ({
                        ...prev,
                        paymentStatus: "Debt",
                      }))
                    }
                  >
                    <AppText
                      variant="caption"
                      weight="bold"
                      shrink={false}
                      style={[
                        styles.toggleBtnText,
                        {
                          color:
                            editForm.paymentStatus === "Debt"
                              ? SALES_GLASS.fg
                              : SALES_GLASS.fgSecondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {t("sale.credit")}
                    </AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <AppText
                  variant="body"
                  weight="bold"
                  style={[
                    styles.mValue,
                    {
                      color:
                        editForm.paymentStatus === "Paid"
                          ? colors.success
                          : editForm.paymentStatus === "Order"
                            ? colors.primary
                            : editForm.paymentStatus === "Cancelled"
                              ? colors.error
                              : colors.warning,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {editForm.paymentStatus === "Paid"
                    ? t("sale.settled")
                    : editForm.paymentStatus === "Order"
                      ? t("sale.order")
                      : editForm.paymentStatus === "Cancelled"
                        ? t("sale.cancelled")
                        : t("sale.credit")}
                </AppText>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Intelligence Nodes - Batch Items or Single Item */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <AppText
            variant="micro"
            weight="bold"
            transform="uppercase"
            style={[styles.sectionTitle, { color: SALES_GLASS.fgSecondary }]}
            numberOfLines={1}
          >
            {isBatch ? t("sales.items_purchased") : t("sale.asset_metrics")}
          </AppText>
          <View
            style={[
              styles.intelligenceBlock,
              { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
            ]}
          >
            {isBatch
              ? batchItems.map((item: any, idx: number) => {
                  const unitPrice =
                    ((item.totalPrice || 0) + (item.discount || 0)) /
                    Math.max(1, item.quantity || 1);
                  const isExpanded = expandedItemId === item.id;
                  return (
                    <React.Fragment key={item.id || idx}>
                      {idx > 0 && <View style={styles.nodeDivider} />}
                      <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() =>
                          setExpandedItemId(isExpanded ? null : item.id)
                        }
                        style={styles.node}
                      >
                        <View style={styles.nodeInfo}>
                          <Package size={16} color={SALES_GLASS.fgSecondary} />
                          <View style={{ flex: 1 }}>
                            <AppText
                              variant="body-sm"
                              weight="bold"
                              style={[styles.nodeValue, { color: SALES_GLASS.fg }]}
                              numberOfLines={1}
                            >
                              {item.itemName}
                            </AppText>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                              <AppNumber
                                value={item.quantity}
                                size="caption"
                                weight="medium"
                                color={SALES_GLASS.fgSecondary}
                                style={styles.nodeLabel}
                              />
                              <AppText
                                variant="caption"
                                weight="medium"
                                style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]}
                                numberOfLines={1}
                              >
                                {" "}{item.baseUnit || ""}
                              </AppText>
                            </View>
                          </View>
                        </View>
                        <AppNumber
                          value={item.totalPrice || 0}
                          size="body-sm"
                          weight="bold"
                          prefix={t('common.etb') + ' '}
                          color={SALES_GLASS.fg}
                          style={styles.nodeValue}
                        />
                      </TouchableOpacity>
                      {isExpanded && (
                        <Animated.View
                          entering={FadeInDown}
                          style={[
                            styles.expandedSection,
                            {
                              backgroundColor: SALES_GLASS.bg,
                              borderTopWidth: 1,
                              borderTopColor: SALES_GLASS.border,
                            },
                          ]}
                        >
                          {/* Quantity */}
                          <View style={styles.expandedRow}>
                            <AppText
                              variant="caption"
                              weight="bold"
                              style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]}
                              numberOfLines={1}
                            >
                              <Activity size={12} color={SALES_GLASS.fgSecondary} /> {t("form.quantity")}
                            </AppText>
                            {isEditing ? (
                              <TextInput
                                style={[styles.nodeInput, { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border }]}
                                value={String(itemEdits[item.id]?.quantity ?? item.quantity)}
                                keyboardType="numeric"
                                onChangeText={(t) => {
                                  const val = parseInt(t) || 0;
                                  setItemEdits((prev: any) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], quantity: val },
                                  }));
                                }}
                              />
                            ) : (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <AppNumber value={item.quantity} size="body-sm" weight="bold" color={SALES_GLASS.fg} style={styles.nodeValue} />
                                <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                                  {" "}{item.baseUnit || ""}
                                </AppText>
                              </View>
                            )}
                          </View>

                          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.expandedSectionTitle, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t('detail.financial_core')}</AppText>
                          <View style={{ paddingLeft: 4 }}>
                            <View style={styles.expandedRow}>
                              <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>
                                {t("sale.calculated_unit_price")}
                              </AppText>
                              <AppNumber value={unitPrice} size="body-sm" weight="bold" decimals={2} prefix={t('common.etb') + ' '} color={SALES_GLASS.fg} style={styles.nodeValue} />
                            </View>
                            <View style={styles.expandedRow}>
                              <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>
                                {t("sale.adjusted_discount")}
                              </AppText>
                              {isEditing ? (
                                <TextInput
                                  style={[styles.nodeInput, { color: colors.warning, borderColor: SALES_GLASS.border }]}
                                  value={String(itemEdits[item.id]?.discount ?? (item.discount || 0))}
                                  keyboardType="numeric"
                                  onChangeText={(t) => {
                                    const val = parseFloat(t) || 0;
                                    setItemEdits((prev: any) => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], discount: val },
                                    }));
                                  }}
                                />
                              ) : (
                                <AppNumber value={-(item.discount || 0)} size="body-sm" weight="bold" prefix={t('common.etb') + ' '} color={colors.warning} style={styles.nodeValue} />
                              )}
                            </View>
                          </View>

                          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.expandedSectionTitle, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t('detail.tax_config')}</AppText>
                          <View style={{ paddingLeft: 4 }}>
                            <View style={styles.expandedRow}>
                              <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>
                                {t("sale.tax_type")}
                              </AppText>
                              {isEditing ? (
                                <View style={{ flexDirection: "row", gap: 4 }}>
                                  {(["VAT", "TOT", "Other", "None"] as const).map((type) => {
                                    const current = itemEdits[item.id]?.taxType ?? (item.taxType || "VAT");
                                    return (
                                      <TouchableOpacity
                                        key={type}
                                        style={[
                                          { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: SALES_GLASS.border },
                                          current === type && { backgroundColor: SALES_GLASS.fg, borderColor: SALES_GLASS.fg },
                                        ]}
                                        onPress={() => {
                                          const edits = { ...(itemEdits[item.id] || {}), taxType: type };
                                          if (type === "None") edits.vat = 0;
                                          if (type === "VAT" && (!itemEdits[item.id]?.vat || itemEdits[item.id]?.vat === 0)) edits.vat = 15;
                                          setItemEdits((prev: any) => ({ ...prev, [item.id]: edits }));
                                        }}
                                      >
                                        <AppText variant="micro" weight="bold" shrink={false} style={{ fontSize: 10, color: current === type ? SALES_GLASS.bg : SALES_GLASS.fgSecondary }} numberOfLines={1}>
                                          {type}
                                        </AppText>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              ) : (
                                <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                                  {item.taxType || "VAT"}
                                </AppText>
                              )}
                            </View>
                            {(itemEdits[item.id]?.taxType ?? (item.taxType || "VAT")) !== "None" && (
                              <View style={styles.expandedRow}>
                                <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>
                                  {t("sale.tax_rate")}
                                </AppText>
                                {isEditing ? (
                                  <TextInput
                                    style={[styles.nodeInput, { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border }]}
                                    value={String(itemEdits[item.id]?.vat !== undefined ? itemEdits[item.id].vat : (item.vat || 0))}
                                    keyboardType="numeric"
                                    onChangeText={(t) => {
                                      const val = parseFloat(t) || 0;
                                      setItemEdits((prev: any) => ({ ...prev, [item.id]: { ...prev[item.id], vat: val } }));
                                    }}
                                  />
                                ) : (
                                  <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                                    {item.vat || 0}%
                                  </AppText>
                                )}
                              </View>
                            )}
                          </View>

                          <View style={{ borderTopWidth: 1, borderTopColor: SALES_GLASS.border, paddingTop: 10, marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <AppText variant="body-sm" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                              {t("sale.total_settlement")}
                            </AppText>
                            <AppNumber
                              value={(() => {
                                const edits = itemEdits[item.id] || {};
                                const q = edits.quantity !== undefined ? edits.quantity : item.quantity;
                                const d = edits.discount !== undefined ? edits.discount : item.discount || 0;
                                return Math.max(0, unitPrice * q - d);
                              })()}
                              size="body-sm"
                              weight="bold"
                              prefix={t('common.etb') + ' '}
                              color={SALES_GLASS.fg}
                              style={styles.nodeValue}
                            />
                          </View>
                        </Animated.View>
                      )}
                    </React.Fragment>
                  );
                })
              : null}
            {isBatch && isEditing && (
              <>
                <View style={styles.nodeDivider} />
                <TouchableOpacity
                  onPress={() =>
                    setNewItems([
                      ...newItems,
                      {
                        _tempId: Date.now(),
                        itemName: "",
                        quantity: 1,
                        discount: 0,
                        vat: 15,
                        taxType: "VAT",
                      },
                    ])
                  }
                  style={[styles.addItemBtn, { borderColor: colors.primary }]}
                >
                  <AppText
                    variant="body"
                    weight="bold"
                    style={[styles.addItemText, { color: colors.primary }]}
                    numberOfLines={1}
                  >
                    + {t('reports.add_item')}
                  </AppText>
                </TouchableOpacity>
                {newItems.map((ni: any, niIdx: number) => (
                  <React.Fragment key={ni._tempId}>
                    <View style={styles.nodeDivider} />
                    <View
                      style={[
                        styles.newItemForm,
                        { backgroundColor: SALES_GLASS.bg },
                      ]}
                    >
                      <View style={styles.newItemHeader}>
                        <AppText
                          variant="micro"
                          weight="bold"
                          transform="uppercase"
                          style={[
                            styles.newItemLabel,
                            { color: SALES_GLASS.fgSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {t("sale.asset_name")}
                        </AppText>
                        <TouchableOpacity
                          onPress={() =>
                            setNewItems(
                              newItems.filter(
                                (_: any, i: number) => i !== niIdx,
                              ),
                            )
                          }
                          style={[
                            styles.circleBtn,
                            {
                              backgroundColor: colors.error + "15",
                              width: 28,
                              height: 28,
                            },
                          ]}
                        >
                          <X size={14} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.itemSearchInput,
                          {
                            borderColor: ni.selectedItemId
                              ? colors.primary
                              : SALES_GLASS.border,
                            backgroundColor: SALES_GLASS.bgCard,
                          },
                        ]}
                        onPress={() => {
                          setItemSearchVisible(ni._tempId);
                          setItemSearchQuery("");
                        }}
                        activeOpacity={0.7}
                      >
                        <Package size={14} color={SALES_GLASS.fgSecondary} />
                        <AppText
                          variant="body-sm"
                          weight="medium"
                          style={[
                            {
                              flex: 1,
                              marginLeft: 8,
                              color: ni.selectedItemId
                                ? SALES_GLASS.fg
                                : SALES_GLASS.fgSecondary,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {ni.itemName || t("sales.search_select_item")}
                        </AppText>
                        <Search size={14} color={SALES_GLASS.fgSecondary} />
                      </TouchableOpacity>

                      <View style={styles.newItemFieldRow}>
                        <View style={styles.newItemField}>
                          <AppText
                            variant="micro"
                            weight="bold"
                            transform="uppercase"
                            style={[
                              styles.newItemFieldLabel,
                              { color: SALES_GLASS.fgSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {t("form.quantity")}
                          </AppText>
                          <TextInput
                            style={[
                              styles.newItemFieldInput,
                              {
                                color: SALES_GLASS.fg,
                                borderColor: SALES_GLASS.border,
                              },
                            ]}
                            value={String(ni.quantity)}
                            keyboardType="numeric"
                            onChangeText={(text) => {
                              const val = parseInt(text) || 0;
                              const copy = [...newItems];
                              copy[niIdx] = { ...copy[niIdx], quantity: val };
                              setNewItems(copy);
                            }}
                          />
                        </View>
                        <View style={styles.newItemField}>
                          <AppText
                            variant="micro"
                            weight="bold"
                            transform="uppercase"
                            style={[
                              styles.newItemFieldLabel,
                              { color: SALES_GLASS.fgSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {t("common.unit")}
                          </AppText>
                          <View style={styles.unitToggleRow}>
                            <TouchableOpacity
                              style={[
                                styles.unitToggle,
                                { borderColor: SALES_GLASS.border },
                                ni.unitType === "base" && {
                                  backgroundColor: colors.primary,
                                  borderColor: colors.primary,
                                },
                              ]}
                              onPress={() => {
                                const copy = [...newItems];
                                copy[niIdx] = {
                                  ...copy[niIdx],
                                  unitType: "base",
                                  unit: ni.baseUnit || "pcs",
                                };
                                setNewItems(copy);
                              }}
                            >
                              <AppText
                                variant="micro"
                                weight="bold"
                                style={{
                                  color:
                                    ni.unitType === "base"
                                      ? SALES_GLASS.fg
                                      : SALES_GLASS.fgSecondary,
                                }}
                                numberOfLines={1}
                              >
                                {ni.baseUnit || "pcs"}
                              </AppText>
                            </TouchableOpacity>
                            {ni.unitsPerPack ? (
                              <TouchableOpacity
                                style={[
                                  styles.unitToggle,
                                  { borderColor: SALES_GLASS.border },
                                  ni.unitType === "pack" && {
                                    backgroundColor: colors.primary,
                                    borderColor: colors.primary,
                                  },
                                ]}
                                onPress={() => {
                                  const copy = [...newItems];
                                  copy[niIdx] = {
                                    ...copy[niIdx],
                                    unitType: "pack",
                                    unit: "pack",
                                  };
                                  setNewItems(copy);
                                }}
                              >
                                <AppText
                                  variant="micro"
                                  weight="bold"
                                  style={{
                                    color:
                                      ni.unitType === "pack"
                                        ? SALES_GLASS.fg
                                        : SALES_GLASS.fgSecondary,
                                  }}
                                  numberOfLines={1}
                                >
                                  {t('form.pack')}
                                </AppText>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      </View>

                      <View style={styles.newItemFieldRow}>
                        <View style={styles.newItemField}>
                          <AppText
                            variant="micro"
                            weight="bold"
                            transform="uppercase"
                            style={[
                              styles.newItemFieldLabel,
                              { color: SALES_GLASS.fgSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {t("sale.adjusted_discount")}
                          </AppText>
                          <TextInput
                            style={[
                              styles.newItemFieldInput,
                              {
                                color: colors.warning,
                                borderColor: SALES_GLASS.border,
                              },
                            ]}
                            value={String(ni.discount)}
                            keyboardType="numeric"
                            onChangeText={(text) => {
                              const val = parseFloat(text) || 0;
                              const copy = [...newItems];
                              copy[niIdx] = { ...copy[niIdx], discount: val };
                              setNewItems(copy);
                            }}
                          />
                        </View>
                        <View style={styles.newItemField}>
                          <AppText
                            variant="micro"
                            weight="bold"
                            transform="uppercase"
                            style={[
                              styles.newItemFieldLabel,
                              { color: SALES_GLASS.fgSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {t("sale.tax_type")}
                          </AppText>
                          <View style={{ flexDirection: "row", gap: 4 }}>
                            {(["VAT", "TOT", "Other", "None"] as const).map((type) => (
                              <TouchableOpacity
                                key={type}
                                style={[
                                  styles.unitToggle,
                                  { borderColor: SALES_GLASS.border },
                                  (ni.taxType || "VAT") === type && {
                                    backgroundColor: colors.primary,
                                    borderColor: colors.primary,
                                  },
                                ]}
                                onPress={() => {
                                  const copy = [...newItems];
                                  copy[niIdx] = { ...copy[niIdx], taxType: type };
                                  if (type === "None") copy[niIdx].vat = 0;
                                  if (type === "VAT" && (!ni.vat || ni.vat === 0)) copy[niIdx].vat = 15;
                                  setNewItems(copy);
                                }}
                              >
                                <AppText
                                  variant="micro"
                                  weight="bold"
                                  style={{
                                    color:
                                      (ni.taxType || "VAT") === type
                                        ? SALES_GLASS.fg
                                        : SALES_GLASS.fgSecondary,
                                  }}
                                  numberOfLines={1}
                                >
                                  {type}
                                </AppText>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        <View style={styles.newItemField}>
                          <AppText
                            variant="micro"
                            weight="bold"
                            transform="uppercase"
                            style={[
                              styles.newItemFieldLabel,
                              { color: SALES_GLASS.fgSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {t("sale.tax_rate")}
                          </AppText>
                          <TextInput
                            style={[
                              styles.newItemFieldInput,
                              {
                                color: SALES_GLASS.fg,
                                borderColor: SALES_GLASS.border,
                              },
                            ]}
                            value={String(ni.vat ?? 0)}
                            keyboardType="numeric"
                            onChangeText={(text) => {
                              const val = parseFloat(text) || 0;
                              const copy = [...newItems];
                              copy[niIdx] = { ...copy[niIdx], vat: val };
                              setNewItems(copy);
                            }}
                            editable={(ni.taxType || "VAT") !== "None"}
                          />
                        </View>
                      </View>

                      {ni.selectedItemId ? (
                        <View
                          style={[
                            styles.newItemPreview,
                            {
                              backgroundColor: SALES_GLASS.bgCard,
                              borderColor: SALES_GLASS.border,
                            },
                          ]}
                        >
                          <AppText
                            variant="micro"
                            weight="medium"
                            style={{ color: SALES_GLASS.fgSecondary }}
                            numberOfLines={1}
                          >
                            {t("sale.calculated_unit_price")}
                          </AppText>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <AppNumber
                              value={ni.unitPrice || 0}
                              size="body-sm"
                              weight="bold"
                              prefix={t('common.etb') + ' '}
                              color={SALES_GLASS.fg}
                            />
                            <AppText
                              variant="body-sm"
                              weight="bold"
                              style={{ color: SALES_GLASS.fg }}
                              numberOfLines={1}
                            >
                              {" / "}{ni.unit || ni.baseUnit || "pcs"}
                            </AppText>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  </React.Fragment>
                ))}
              </>
            )}
            {!isBatch ? (
              <>
                {/* Magnitude Cards */}
                <View style={styles.row}>
                  <View style={[styles.magnitudeCard, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
                    <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.mLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t('sale.calculated_unit_price')}</AppText>
                    <AppNumber value={calculatedUnitPrice} prefix={t('common.etb') + ' '} decimals={2} size="heading" style={styles.mValue} />
                    <View style={styles.mFooter}>
                      <Zap size={12} color={SALES_GLASS.fgSecondary} />
                      <AppText variant="micro" weight="medium" style={[styles.mFooterText, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t('common.unit')}</AppText>
                    </View>
                  </View>
                  <View style={[styles.magnitudeCard, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
                    <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.mLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t('sale.total_settlement')}</AppText>
                    <AppNumber value={editForm.totalPrice || 0} prefix={t('common.etb') + ' '} size="heading" style={styles.mValue} />
                    <View style={styles.mFooter}>
                      <DollarSign size={12} color={SALES_GLASS.fgSecondary} />
                      <AppNumber value={editForm.quantity} size="micro" weight="medium" style={[styles.mFooterText, { color: SALES_GLASS.fgSecondary }]} />
                      <AppText variant="micro" weight="medium" style={[styles.mFooterText, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}> {editForm.unit || t('form.units')}</AppText>
                    </View>
                  </View>
                </View>

                {/* Transaction Info */}
                <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t('detail.logistics_scale')}</AppText>
                <View style={[styles.intelligenceBlock, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
                  <View style={styles.node}>
                    <View style={styles.nodeInfo}>
                      <Package size={16} color={SALES_GLASS.fgSecondary} />
                      <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t("sale.asset_name")}</AppText>
                    </View>
                    <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: SALES_GLASS.fg }]} numberOfLines={2}>
                      {editForm.itemName}
                    </AppText>
                  </View>
                  <View style={styles.nodeDivider} />
                  <View style={styles.node}>
                    <View style={styles.nodeInfo}>
                      <Activity size={16} color={SALES_GLASS.fgSecondary} />
                      <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t("form.quantity")}</AppText>
                    </View>
                    {isEditing ? (
                      <TextInput
                        style={[styles.nodeInput, { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border }]}
                        value={String(editForm.quantity)}
                        keyboardType="numeric"
                        onChangeText={(t) => {
                          const val = parseInt(t);
                          setEditForm((prev: any) => ({ ...prev, quantity: isNaN(val) || val < 1 ? 1 : val }));
                        }}
                      />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <AppNumber value={editForm.quantity} size="body-sm" weight="bold" color={SALES_GLASS.fg} style={styles.nodeValue} />
                        <AppText variant="micro" weight="medium" shrink={false} style={styles.curr}> {editForm.unit}</AppText>
                      </View>
                    )}
                  </View>
                </View>

                {/* Financial Core */}
                <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t('detail.financial_core')}</AppText>
                <View style={[styles.intelligenceBlock, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
                  <View style={styles.node}>
                    <View style={styles.nodeInfo}>
                      <Zap size={16} color={SALES_GLASS.fgSecondary} />
                      <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t("sale.calculated_unit_price")}</AppText>
                    </View>
                    <AppNumber value={calculatedUnitPrice} size="body-sm" weight="bold" decimals={2} prefix={t('common.etb') + ' '} color={SALES_GLASS.fg} style={styles.nodeValue} />
                  </View>
                  <View style={styles.nodeDivider} />
                  <View style={styles.node}>
                    <View style={styles.nodeInfo}>
                      <Tag size={16} color={SALES_GLASS.fgSecondary} />
                      <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t("sale.adjusted_discount")}</AppText>
                    </View>
                    {isEditing ? (
                      <TextInput
                        style={[styles.nodeInput, { color: colors.warning, borderColor: SALES_GLASS.border }]}
                        value={String(editForm.discount || 0)}
                        keyboardType="numeric"
                        onChangeText={(t) => {
                          const val = parseFloat(t);
                          setEditForm((prev: any) => ({ ...prev, discount: isNaN(val) ? 0 : val }));
                        }}
                      />
                    ) : (
                      <AppNumber value={editForm.discount || 0} size="body-sm" weight="bold" prefix={t('common.etb') + ' '} color={colors.warning} style={styles.nodeValue} />
                    )}
                  </View>
                  <View style={styles.nodeDivider} />
                  <View style={styles.node}>
                    <View style={styles.nodeInfo}>
                      <BadgeCheck size={16} color={SALES_GLASS.fgSecondary} />
                      <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t("sale.total_settlement")}</AppText>
                    </View>
                    <AppNumber value={Math.max(0, (editForm.totalPrice || 0))} size="body-sm" weight="bold" prefix={t('common.etb') + ' '} color={SALES_GLASS.fg} style={styles.nodeValue} />
                  </View>
                </View>

                {/* Tax Configuration */}
                <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t('detail.tax_config')}</AppText>
                <View style={[styles.intelligenceBlock, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
                  <View style={styles.node}>
                    <View style={styles.nodeInfo}>
                      <Percent size={16} color={SALES_GLASS.fgSecondary} />
                      <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t("sale.tax_type")}</AppText>
                    </View>
                    {isEditing ? (
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        {(["VAT", "TOT", "Other", "None"] as const).map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={[
                              { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: SALES_GLASS.border },
                              (editForm.taxType || "VAT") === type && { backgroundColor: SALES_GLASS.fg, borderColor: SALES_GLASS.fg },
                            ]}
                            onPress={() => {
                              setEditForm((prev: any) => ({
                                ...prev, taxType: type,
                                vat: type === "None" ? 0 : type === "VAT" && (!prev.vat || prev.vat === 0) ? 15 : prev.vat,
                              }));
                            }}
                          >
                            <AppText variant="micro" weight="bold" shrink={false} style={{ fontSize: 10, color: (editForm.taxType || "VAT") === type ? SALES_GLASS.bg : SALES_GLASS.fgSecondary }} numberOfLines={1}>
                              {type}
                            </AppText>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                        {editForm.taxType || "VAT"}
                      </AppText>
                    )}
                  </View>
                  {(editForm.taxType || "VAT") !== "None" && (
                    <>
                      <View style={styles.nodeDivider} />
                      <View style={styles.node}>
                        <View style={styles.nodeInfo}>
                          <Percent size={16} color={SALES_GLASS.fgSecondary} />
                          <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t("sale.tax_rate")}</AppText>
                        </View>
                        {isEditing ? (
                          <TextInput
                            style={[styles.nodeInput, { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border }]}
                            value={String(editForm.vat ?? 0)}
                            keyboardType="numeric"
                            onChangeText={(t) => {
                              const val = parseFloat(t);
                              setEditForm((prev: any) => ({ ...prev, vat: isNaN(val) ? 0 : val }));
                            }}
                          />
                        ) : (
                          <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                            {editForm.vat ?? 0}%
                          </AppText>
                        )}
                      </View>
                    </>
                  )}
                </View>
              </>
            ) : null}
          </View>
        </Animated.View>

        {debtFieldsSection}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Float */}
      {editForm.paymentStatus === "Order" ? (
        <View
          style={[styles.actionFloat, { backgroundColor: colors.background }]}
        >
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              style={[
                styles.primaryAction,
                { backgroundColor: colors.success, flex: 1 },
              ]}
              onPress={() => {
                const ref = sale.batchId || sale.id;
                const res = convertOrderToSale(ref);
                if (res.success) {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                  if (onClose) onClose();
                } else {
                  alert(res.error || t("common.error"));
                }
              }}
            >
              <Check size={18} color={SALES_GLASS.fg} />
              <AppText
                variant="body"
                weight="bold"
                shrink={false}
                style={[styles.actionText, { color: SALES_GLASS.fg }]}
                numberOfLines={1}
              >
                {t("sale.convert_to_sale")}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryAction,
                { backgroundColor: colors.warning, flex: 1 },
              ]}
              onPress={() => {
                const ref = sale.batchId || sale.id;
                const res = convertOrderToDebt(ref);
                if (res.success) {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                  if (onClose) onClose();
                } else {
                  alert(res.error || t("common.error"));
                }
              }}
            >
              <CreditCard size={18} color={SALES_GLASS.fg} />
              <AppText
                variant="body"
                weight="bold"
                shrink={false}
                style={[styles.actionText, { color: SALES_GLASS.fg }]}
                numberOfLines={1}
              >
                {t("sale.convert_to_debt")}
              </AppText>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.primaryAction,
              { backgroundColor: colors.error, marginTop: 10 },
            ]}
            onPress={() => {
              const ref = sale.batchId || sale.id;
              const res = cancelOrder(ref);
              if (res.success) {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                if (onClose) onClose();
              } else {
                alert(res.error || t("common.error"));
              }
            }}
          >
            <X size={18} color={SALES_GLASS.fg} />
            <AppText
              variant="body"
              weight="bold"
              shrink={false}
              style={[styles.actionText, { color: SALES_GLASS.fg }]}
              numberOfLines={1}
            >
              {t("sale.cancel_order")}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={[styles.actionFloat, { backgroundColor: colors.background }]}
        >
          <TouchableOpacity
            style={[styles.primaryAction, { backgroundColor: SALES_GLASS.fg }]}
            onPress={isEditing ? handleSave : handleEditClick}
          >
            {isEditing ? (
              <ShieldCheck size={20} color={SALES_GLASS.bg} />
            ) : (
              <Edit2 size={18} color={SALES_GLASS.bg} />
            )}
            <AppText
              variant="body"
              weight="bold"
              shrink={false}
              style={[styles.actionText, { color: SALES_GLASS.bg }]}
              numberOfLines={1}
            >
              {isEditing
                ? t("sale.commit_settlement")
                : t("sale.modify_transaction")}
            </AppText>
          </TouchableOpacity>
        </View>
      )}

      {/* Return Item Modal */}
      <Modal visible={showReturnModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowReturnModal(false)}
          />
          <View
            style={[styles.returnSheet, { backgroundColor: SALES_GLASS.bg }]}
          >
            <View style={styles.modalHandleRow}>
              <View
                style={[styles.modalHandle, { backgroundColor: SALES_GLASS.border }]}
              />
            </View>
            <ScrollView contentContainerStyle={styles.returnContent}>
              <View
                style={[
                  styles.returnIconBox,
                  { backgroundColor: colors.warning + "15" },
                ]}
              >
                <RotateCcw size={32} color={colors.warning} />
              </View>
              <AppText
                variant="heading"
                weight="bold"
                align="center"
                style={[styles.returnTitle, { color: SALES_GLASS.fg }]}
                numberOfLines={2}
              >
                {t("sales.return_item")}
              </AppText>
              <AppText
                variant="body"
                weight="medium"
                align="center"
                style={[styles.returnSubtitle, { color: SALES_GLASS.fgSecondary }]}
                numberOfLines={3}
              >
                {isBatch
                  ? t("sales.return_for", {
                      itemName: batchItems[0]?.itemName || t("common.items"),
                    })
                  : t("sales.return_for", { itemName: editForm.itemName })}
              </AppText>

              <View style={styles.returnField}>
                <AppText
                  variant="caption"
                  weight="bold"
                  transform="uppercase"
                  style={[styles.returnLabel, { color: SALES_GLASS.fgSecondary }]}
                  numberOfLines={1}
                >
                  {t("sales.return_quantity")}
                </AppText>
                <TextInput
                  style={[
                    styles.returnInput,
                    { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border },
                  ]}
                  value={returnQty}
                  keyboardType="numeric"
                  onChangeText={setReturnQty}
                />
                <AppText
                  variant="caption"
                  weight="medium"
                  style={[styles.returnHint, { color: SALES_GLASS.fgSecondary }]}
                  numberOfLines={1}
                >
                  {isBatch
                    ? t("sales.return_max", {
                        qty: String(batchItems[0]?.quantity || 1),
                        unit: batchItems[0]?.baseUnit || "pcs",
                      })
                    : t("sales.return_max", {
                        qty: String(sale.quantity),
                        unit: sale.unit || "pcs",
                      })}
                </AppText>
              </View>

              <View style={styles.returnField}>
                <AppText
                  variant="caption"
                  weight="bold"
                  transform="uppercase"
                  style={[styles.returnLabel, { color: SALES_GLASS.fgSecondary }]}
                  numberOfLines={1}
                >
                  {t("sales.return_reason_label")}
                </AppText>
                <TextInput
                  style={[
                    styles.returnInput,
                    styles.returnTextArea,
                    { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border },
                  ]}
                  value={returnReason}
                  onChangeText={setReturnReason}
                  placeholder={t("sales.refund_reason")}
                  placeholderTextColor={SALES_GLASS.fgSecondary}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.returnSubmitBtn,
                  { backgroundColor: colors.warning },
                ]}
                onPress={handleReturn}
              >
                <RotateCcw size={20} color={SALES_GLASS.fg} />
                <AppText
                  variant="body"
                  weight="bold"
                  shrink={false}
                  style={styles.returnSubmitText}
                  numberOfLines={1}
                >
                  {t("sales.process_return")}
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.returnCancelBtn, { borderColor: SALES_GLASS.border }]}
                onPress={() => setShowReturnModal(false)}
              >
                <AppText
                  variant="body"
                  weight="bold"
                  shrink={false}
                  style={[styles.returnCancelText, { color: SALES_GLASS.fg }]}
                  numberOfLines={1}
                >
                  {t("common.cancel")}
                </AppText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Return Success Modal */}
      <Modal visible={showReturnSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.successSheet,
              { backgroundColor: SALES_GLASS.bg },
            ]}
          >
            <View
              style={[
                styles.successIconBox,
                { backgroundColor: colors.success + "15" },
              ]}
            >
              <RotateCcw size={48} color={colors.success} />
            </View>
            <AppText
              variant="heading"
              weight="bold"
              align="center"
              style={[styles.successTitle, { color: SALES_GLASS.fg }]}
              numberOfLines={2}
            >
              {t("sales.return_processed")}
            </AppText>
            <AppText
              variant="body"
              weight="medium"
              align="center"
              style={[styles.successSubtitle, { color: SALES_GLASS.fgSecondary }]}
              numberOfLines={4}
            >
              {isBatch
                ? t("sales.return_success", {
                    qty: returnQty,
                    unit: batchItems[0]?.baseUnit || "pcs",
                    itemName: batchItems[0]?.itemName || t("common.items"),
                  })
                : t("sales.return_success", {
                    qty: returnQty,
                    unit: sale.unit,
                    itemName: editForm.itemName,
                  })}
            </AppText>
            <TouchableOpacity
              style={[styles.successBtn, { backgroundColor: SALES_GLASS.fg }]}
              onPress={() => {
                setShowReturnSuccess(false);
                if (onClose) onClose();
              }}
            >
              <AppText
                variant="body"
                weight="bold"
                shrink={false}
                style={[styles.successBtnText, { color: SALES_GLASS.bg }]}
                numberOfLines={1}
              >
                {t("common.done")}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <PremiumActionModal
          title={t("sale.delete_ledger")}
          subtitle={
            isBatch
              ? `${t("sales.delete_batch_confirm")} (${batchItems.length} ${t("common.items")})`
              : t("sale.delete_confirm", { amount: editForm.totalPrice })
          }
          actionText={t("sale.nullify_transaction")}
          cancelText={t("common.cancel")}
          iconType="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </Modal>

      <PDFLanguageModal
        visible={showLangModal}
        onClose={() => setShowLangModal(false)}
        onSelect={async (lang, calendar, action) => {
          try {
            const ts = calendar === "ethiopian" ? "ethiopian" : "device";
            await generateReceiptPDF(
              editForm,
              activeBusiness,
              lang,
              action,
              ts,
            );
            showToast({
              title: t('receipt.ready'),
              message: t('receipt.generated'),
              type: "success",
            });
          } catch {
            showToast(t('receipt.failed'), "error");
          }
        }}
      />

      {/* Item Search Modal */}
      <Modal
        visible={itemSearchVisible !== null}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setItemSearchVisible(null)}
          />
          <View
            style={[
              styles.itemSearchSheet,
              { backgroundColor: SALES_GLASS.bg },
            ]}
          >
            <View style={styles.modalHandleRow}>
              <View
                style={[styles.modalHandle, { backgroundColor: SALES_GLASS.border }]}
              />
            </View>
            <View style={styles.itemSearchHeader}>
              <AppText
                variant="heading"
                weight="bold"
                style={[{ color: SALES_GLASS.fg }]}
                numberOfLines={1}
              >
                {t("sales.select_item")}
              </AppText>
              <TouchableOpacity
                onPress={() => setItemSearchVisible(null)}
                style={[styles.circleBtn, { backgroundColor: SALES_GLASS.bgCard }]}
              >
                <X size={18} color={SALES_GLASS.fg} />
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.itemSearchBox,
                { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
              ]}
            >
              <Search size={16} color={SALES_GLASS.fgSecondary} />
              <TextInput
                style={[styles.itemSearchInputText, { color: SALES_GLASS.fg }]}
                placeholder={t("sales.search_items")}
                placeholderTextColor={SALES_GLASS.fgSecondary}
                value={itemSearchQuery}
                onChangeText={setItemSearchQuery}
                autoFocus
              />
              {itemSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setItemSearchQuery("")}>
                  <X size={14} color={SALES_GLASS.fgSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filteredItems}
              keyExtractor={(item: any) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.itemListContent}
              renderItem={({ item }: { item: any }) => {
                const niIdx = newItems.findIndex(
                  (ni: any) => ni._tempId === itemSearchVisible,
                );
                const isSelected =
                  niIdx >= 0 && newItems[niIdx]?.selectedItemId === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.itemSearchOption,
                      {
                        backgroundColor: isSelected
                          ? colors.primary + "15"
                          : SALES_GLASS.bgCard,
                        borderColor: isSelected
                          ? colors.primary
                          : SALES_GLASS.border,
                      },
                    ]}
                    onPress={() => {
                      if (niIdx < 0) return;
                      const copy = [...newItems];
                      copy[niIdx] = {
                        ...copy[niIdx],
                        itemName: item.name,
                        selectedItemId: item.id,
                        baseUnit: item.baseUnit || "pcs",
                        baseSellingPrice: item.baseSellingPrice || 0,
                        unitPrice: item.baseSellingPrice || 0,
                        unit: item.baseUnit || "pcs",
                        unitType: "base",
                        unitsPerPack: item.unitsPerPack || 0,
                      };
                      setNewItems(copy);
                      setItemSearchVisible(null);
                      setItemSearchQuery("");
                    }}
                  >
                    <View
                      style={[
                        styles.itemSearchIcon,
                        { backgroundColor: colors.primary + "15" },
                      ]}
                    >
                      <Package size={14} color={colors.primary} />
                    </View>
                    <View style={styles.itemSearchInfo}>
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
                        <AppNumber value={item.baseSellingPrice || 0} size="micro" weight="medium" prefix={"ETB "} color={SALES_GLASS.fgSecondary} />
                        {" / "}{item.baseUnit || "pcs"}
                        {item.categoryName ? ` • ${item.categoryName}` : ""}
                      </AppText>
                    </View>
                    {isSelected && <Check size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Package size={40} color={SALES_GLASS.border} />
                  <AppText
                    variant="body-sm"
                    weight="medium"
                    align="center"
                    style={{ color: SALES_GLASS.fgSecondary }}
                    numberOfLines={2}
                  >
                    {t("sales.no_items_found")}
                  </AppText>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroContainer: {
    height: 320,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 25,
    position: "relative",
  },
  heroWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  topActions: {
    position: "absolute",
    top: 50,
    left: 25,
    right: 25,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  heroContent: { alignItems: "center" },
  badgeContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  heroSub: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  heroTitle: {
    fontSize: 44,
    fontFamily: Fonts.bold,
    letterSpacing: -2,
    textAlign: "center",
  },
  priceEditRow: { flexDirection: "row", alignItems: "baseline" },
  heroInput: {
    fontSize: 32,
    fontFamily: Fonts.bold,
    textAlign: "center",
    borderWidth: 1,
    borderColor: SALES_GLASS.border,
    borderRadius: 12,
    paddingHorizontal: 20,
    minWidth: 150,
  },
  heroMeta: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    marginTop: 10,
    opacity: 0.6,
  },
  scrollContent: { padding: 25 },
  section: { marginBottom: 35 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 15,
    marginLeft: 5,
  },
  row: { flexDirection: "row", gap: 15 },
  modalityCard: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    alignItems: "center",
    overflow: 'hidden',
  },
  mIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SALES_GLASS.bgCard,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  mLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  mValue: { fontSize: 16, fontFamily: Fonts.bold },
  magnitudeCard: { flex: 1, borderRadius: 24, padding: 20, borderWidth: 1, marginBottom: 30, overflow: 'hidden' },
  mFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  mFooterText: { fontSize: 10, fontFamily: Fonts.bold },
  expandedSectionTitle: { fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 0.8, marginTop: 10, marginBottom: 4, marginLeft: 4 },
  intelligenceBlock: { borderRadius: 28, padding: 20, borderWidth: 1, overflow: 'hidden' },
  node: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  nodeInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  nodeLabel: { fontSize: 11, fontFamily: Fonts.bold },
  nodeValue: { fontSize: 15, fontFamily: Fonts.bold },
  nodeInput: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 100,
    textAlign: "right",
  },
  curr: { fontSize: 10, fontFamily: Fonts.medium, opacity: 0.6 },
  nodeDivider: {
    height: 1,
    backgroundColor: SALES_GLASS.border,
    marginVertical: 4,
  },
  actionFloat: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 25,
    paddingTop: 20,
    paddingBottom: 40,
  },
  primaryAction: {
    height: 65,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  actionText: { fontSize: 16, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  editActions: { flexDirection: "row", alignItems: "center" },
  toggleRow: { flexDirection: "column", gap: 6, marginTop: 8, width: "100%" },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: SALES_GLASS.border,
  },
  // toggleBtnActive is now inline to use SALES_GLASS.fg
  toggleBtnText: { fontSize: 11, fontFamily: Fonts.bold },
  // Return modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalBackdrop: { flex: 1, width: "100%" },
  modalHandleRow: { alignItems: "center", paddingTop: 15, paddingBottom: 5 },
  modalHandle: { width: 40, height: 4, borderRadius: 2 },
  returnSheet: {
    width: "100%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: "85%",
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: SALES_GLASS.border,
  },
  returnContent: { padding: 25, alignItems: "center" },
  returnIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  returnTitle: { fontSize: 22, fontFamily: Fonts.bold, marginBottom: 4 },
  returnSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    textAlign: "center",
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  returnField: { width: "100%", marginBottom: 20 },
  returnLabel: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  returnInput: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 15,
    fontFamily: Fonts.medium,
    fontSize: 16,
  },
  returnTextArea: { height: 100, textAlignVertical: "top", paddingTop: 12 },
  returnHint: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginTop: 6,
    opacity: 0.6,
  },
  returnSubmitBtn: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
  },
  returnSubmitText: { color: SALES_GLASS.fg, fontSize: 16, fontFamily: Fonts.bold },
  returnCancelBtn: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  returnCancelText: { fontSize: 15, fontFamily: Fonts.bold },
  successSheet: {
    marginHorizontal: 30,
    marginBottom: 60,
    borderRadius: 28,
    padding: 30,
    alignItems: "center",
  },
  successIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: { fontSize: 24, fontFamily: Fonts.bold, marginBottom: 8 },
  successSubtitle: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 22,
  },
  successBtn: {
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 40,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  successBtnText: { fontSize: 16, fontFamily: Fonts.bold },
  expandedSection: {
    padding: 15,
    paddingHorizontal: 10,
    marginTop: 4,
    borderRadius: 12,
    marginHorizontal: 4,
    overflow: 'hidden',
  },
  expandedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  addItemBtn: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  addItemText: { fontSize: 14, fontFamily: Fonts.bold },
  newItemForm: { padding: 12, borderRadius: 12, marginTop: 8 },
  newItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  newItemLabel: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  itemSearchInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  newItemFieldRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  newItemField: { flex: 1 },
  newItemFieldLabel: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  newItemFieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  unitToggleRow: { flexDirection: "row", gap: 4 },
  unitToggle: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: "center",
  },
  newItemPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  itemSearchSheet: {
    width: "100%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: "75%",
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: SALES_GLASS.border,
  },
  itemSearchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 25,
    paddingTop: 10,
    paddingBottom: 10,
  },
  itemSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginHorizontal: 25,
    marginBottom: 10,
  },
  itemSearchInputText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  itemListContent: { paddingHorizontal: 25, paddingBottom: 40 },
  itemSearchOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  itemSearchIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  itemSearchInfo: { flex: 1, marginLeft: 10, gap: 2 },
  emptyState: { alignItems: "center", marginTop: 40, gap: 8 },
});

export default SaleDetailsScreen;