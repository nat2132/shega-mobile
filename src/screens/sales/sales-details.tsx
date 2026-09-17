import { PDFLanguageModal } from "@/components/PDFLanguageModal";
import PremiumActionModal from "@/components/PremiumActionModal";
import { Fonts, LightTheme } from "@/constants/theme";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/context/ToastContext";
import {
  deleteSale,
  deleteSalesByBatchId,
  getItems,
  getReturnsBySaleId,
  getReturnStats,
  insertSale,
  processReturn,
  updateSale,
  updateSaleItem,
} from "@/database/db";
import { formatDate } from "@/utils/date-utils";
import { generateReceiptPDF } from "@/utils/pdf-utils";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
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
import { ProductImageStack } from "@/components/ProductImageStack";
import { getSalesGlass } from './glass-sales';
import { getActiveTaxType } from '@/services/taxService';
import { getScopedBusinessId } from "@/database/db";
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
  const bizTax = useMemo(() => {
    const at = getActiveTaxType();
    return { name: at?.name || 'VAT', rate: at?.rate ?? 15 };
  }, [getScopedBusinessId()]);
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
  const [returnItemCondition, setReturnItemCondition] = useState("Resellable");
  const [returnRefundType, setReturnRefundType] = useState("Full Refund");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnRefundAmount, setReturnRefundAmount] = useState("0");
  const [returnStats, setReturnStats] = useState<{
    totalReturnedQty: number;
    totalRefundAmount: number;
    returnCount: number;
    originalQty: number;
    remainingQty: number;
    status: 'no_return' | 'partial' | 'full';
  } | null>(null);
  const [returnHistory, setReturnHistory] = useState<any[]>([]);
  const [showReturnHistory, setShowReturnHistory] = useState(false);
  const [returnReasonPicker, setReturnReasonPicker] = useState<'Damaged' | 'Defective' | 'Wrong Item' | 'Customer Changed Mind' | 'Expired' | 'Other'>("Other");
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

  // Load return stats and history
  const loadReturnData = React.useCallback(() => {
    if (sale?.id) {
      const stats = getReturnStats(sale.id);
      setReturnStats(stats as any);
      setReturnHistory(getReturnsBySaleId(sale.id) as any[]);
    }
  }, [sale?.id]);
  React.useEffect(() => { loadReturnData(); }, [loadReturnData]);

  // Return status badge config
  const returnBadge = returnStats?.status === 'full' ? {
    label: t('sales.fully_returned'),
    color: colors.warning,
  } : returnStats?.status === 'partial' ? {
    label: t('sales.partially_returned') + ` (${returnStats.remainingQty} ${t('common.remaining').toLowerCase()})`,
    color: colors.primary,
  } : null;

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
            vat: ni.vat ?? 0,
            taxType: ni.taxType || bizTax.name,
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
        showToast({
          title: t('sale.error.save_failed_title'),
          message: t('sale.error.save_failed_batch'),
          type: "error",
        });
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
      showToast({
        title: t('sale.error.save_failed_title'),
        message: t('sale.error.save_failed_single'),
        type: "error",
      });
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
      showToast({
        title: t('sale.error.delete_failed_title'),
        message: t('sale.error.delete_failed'),
        type: "error",
      });
    }
  };

  const handleReturn = () => {
    const qty = parseInt(returnQty) || 0;
    const originalQty = isBatch ? batchItems[0]?.quantity || 1 : sale.quantity || 1;
    const alreadyReturned = returnStats?.totalReturnedQty || 0;
    const remainingQty = Math.max(0, originalQty - alreadyReturned);

    if (remainingQty <= 0) {
      showToast({
        title: t('sale.error.invalid_qty_title'),
        message: t('sales.fully_returned'),
        type: "error",
      });
      return;
    }

    if (qty <= 0 || qty > remainingQty) {
      showToast({
        title: t('sale.error.invalid_qty_title'),
        message: t('sale.error.invalid_qty', { max: String(remainingQty) }),
        type: "error",
      });
      return;
    }
    if (!returnReasonPicker) {
      showToast({
        title: t('sale.error.reason_required_title'),
        message: t('sale.error.reason_required'),
        type: "error",
      });
      return;
    }

    const saleTarget = isBatch ? batchItems[0] : sale;
    const unitPrice = (saleTarget.totalPrice || 0) / Math.max(1, saleTarget.quantity || 1);
    const refundAmount = parseFloat(returnRefundAmount) || (unitPrice * qty);

    const success = processReturn({
      saleId: saleTarget.id,
      itemId: saleTarget.itemId,
      quantity: qty,
      unit: saleTarget.unit || saleTarget.baseUnit || "pcs",
      unitType: saleTarget.unitType || "base",
      totalRefund: refundAmount,
      reason: returnReasonPicker + (returnReason.trim() ? ` - ${returnReason.trim()}` : ""),
      itemCondition: returnItemCondition,
      refundType: returnRefundType,
      notes: returnNotes.trim() || undefined,
      returnDate: returnDate,
      createdAt: new Date().toISOString(),
    });

    if (success) {
      setShowReturnModal(false);
      setReturnQty(String(remainingQty));
      setReturnReason("");
      setReturnItemCondition("Resellable");
      setReturnRefundType("Full Refund");
      setReturnNotes("");
      setReturnRefundAmount("0");
      setReturnReasonPicker("Other");
      setShowReturnSuccess(true);
      // Reload return stats
      const stats = getReturnStats(sale.id);
      setReturnStats(stats as any);
      setReturnHistory(getReturnsBySaleId(sale.id) as any[]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        title: t('sale.error.return_failed_title'),
        message: t('sale.error.return_failed'),
        type: "error",
      });
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

  const debtFieldsSection = editForm.paymentStatus === "Debt" && (
    <Animated.View style={styles.section}>
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

        <Animated.View style={styles.heroContent}>
          {(() => {
            const statusColor =
              editForm.paymentStatus === "Paid"
                ? colors.success
                : editForm.paymentStatus === "Cancelled"
                  ? colors.error
                  : colors.warning;
            const statusBg = statusColor + "15";
            const heroImages = isBatch
              ? batchItems.map((it: any) => it.image).filter((x: any) => typeof x === "string" && x.trim().length > 0)
              : sale?.image
                ? [sale.image]
                : [];
            return (
              <View
                style={[
                  styles.badgeContainer,
                  { backgroundColor: statusBg, overflow: heroImages.length ? "hidden" : "visible" },
                ]}
              >
                {heroImages.length ? (
                  <>
                    <ProductImageStack
                      images={heroImages}
                      totalCount={isBatch ? batchItems.length : 1}
                      size={56}
                      radius={14}
                      ringColor={statusColor + "22"}
                      backgroundColor={statusBg}
                      iconColor={statusColor}
                    />
                    <View style={[styles.payDot, { backgroundColor: statusColor, borderColor: SALES_GLASS.bgCard }]} />
                  </>
                ) : (
                  <BadgeCheck size={24} color={statusColor} />
                )}
              </View>
            );
          })()}
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
              prefix={t('common.etb') + ' '}
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
          {returnBadge && (
            <View style={[styles.returnBadge, { backgroundColor: returnBadge.color + "15" }]}>
              <RotateCcw size={12} color={returnBadge.color} />
              <AppText variant="micro" weight="bold" style={{ color: returnBadge.color }}>
                {returnBadge.label}
              </AppText>
            </View>
          )}
        </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Settlement Intelligence */}
        <Animated.View style={styles.section}>
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
                          : editForm.paymentStatus === "Cancelled"
                            ? colors.error
                            : colors.warning,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {editForm.paymentStatus === "Paid"
                    ? t("sale.settled")
                    : editForm.paymentStatus === "Cancelled"
                      ? t("sale.cancelled")
                      : t("sale.credit")}
                </AppText>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Intelligence Nodes - Batch Items or Single Item */}
        <Animated.View style={styles.section}>
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
                          <View style={[styles.nodeThumb, { backgroundColor: SALES_GLASS.bgCard }]}>
                            {item.image ? (
                              <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                            ) : (
                              <Package size={16} color={SALES_GLASS.fgSecondary} />
                            )}
                          </View>
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
                              <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                                {item.taxType || (bizTax.name !== 'VAT' ? bizTax.name : "VAT")}
                              </AppText>
                            </View>
                            {(item.taxType || "VAT") !== "None" && (
                              <View style={styles.expandedRow}>
                                <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>
                                  {t("sale.tax_rate")}
                                </AppText>
                                <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                                  {item.vat || 0}%
                                </AppText>
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
                        vat: bizTax.rate,
                        taxType: bizTax.name,
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
                        <View style={styles.itemSearchThumb}>
                          {ni?.image ? (
                            <Image source={{ uri: ni.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                          ) : (
                            <Package size={14} color={SALES_GLASS.fgSecondary} />
                          )}
                        </View>
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
                          <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                            {bizTax.name} ({bizTax.rate}%)
                          </AppText>
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
                    <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                      {editForm.taxType || (bizTax.name !== 'VAT' ? bizTax.name : "VAT")}
                    </AppText>
                  </View>
                  {(editForm.taxType || "VAT") !== "None" && (
                    <>
                      <View style={styles.nodeDivider} />
                      <View style={styles.node}>
                        <View style={styles.nodeInfo}>
                          <Percent size={16} color={SALES_GLASS.fgSecondary} />
                          <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>{t("sale.tax_rate")}</AppText>
                        </View>
                        <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                          {editForm.vat ?? 0}%
                        </AppText>
                      </View>
                    </>
                  )}
                </View>
              </>
            ) : null}
          </View>
        </Animated.View>

        {debtFieldsSection}

        {/* Return History */}
        {returnHistory.length > 0 && (
          <Animated.View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <AppText
                variant="micro"
                weight="bold"
                transform="uppercase"
                style={[styles.sectionTitle, { color: SALES_GLASS.fgSecondary }]}
              >
                {t('sales.return_history')}
              </AppText>
              <TouchableOpacity
                onPress={() => setShowReturnHistory(!showReturnHistory)}
                style={[styles.returnHistoryToggle, { borderColor: SALES_GLASS.border }]}
              >
                <AppText variant="caption" weight="bold" style={{ color: SALES_GLASS.fgSecondary }}>
                  {showReturnHistory ? t('common.hide') : t('common.show')} ({returnHistory.length})
                </AppText>
              </TouchableOpacity>
            </View>
            {showReturnHistory && (
              <View style={[styles.intelligenceBlock, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
                {returnHistory.map((ret: any, idx: number) => (
                  <View key={ret.id || idx} style={[styles.returnHistoryItem, idx < returnHistory.length - 1 && { borderBottomWidth: 1, borderBottomColor: SALES_GLASS.border, paddingBottom: 12, marginBottom: 12 }]}>
                    <View style={styles.returnHistoryHeader}>
                      <View style={[styles.returnHistoryIcon, { backgroundColor: 'transparent' }]}>
                        {ret.image ? (
                          <ProductImageStack
                            images={[ret.image]}
                            size={34}
                            radius={9}
                            ringColor={SALES_GLASS.bgCard}
                            backgroundColor={ret.itemCondition === 'Resellable' ? colors.success + '15' : colors.warning + '15'}
                            iconColor={ret.itemCondition === 'Resellable' ? colors.success : colors.warning}
                          />
                        ) : (
                          <View style={[styles.returnHistoryIconInner, { backgroundColor: ret.itemCondition === 'Resellable' ? colors.success + '15' : colors.warning + '15' }]}>
                            <RotateCcw size={16} color={ret.itemCondition === 'Resellable' ? colors.success : colors.warning} />
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        {ret.itemName ? (
                          <AppText variant="micro" weight="bold" style={{ color: SALES_GLASS.fg, marginBottom: 2 }} numberOfLines={1}>
                            {ret.itemName}
                          </AppText>
                        ) : null}
                        <AppText variant="body" weight="bold" style={{ color: SALES_GLASS.fg }}>
                          {ret.quantity} {ret.unit || 'pcs'} {t('common.returned')}
                        </AppText>
                        <AppText variant="caption" weight="medium" style={{ color: SALES_GLASS.fgSecondary }}>
                          {ret.reason}
                        </AppText>
                      </View>
                    </View>
                    <View style={styles.returnHistoryDetails}>
                      <View style={styles.returnHistoryChip}>
                        <AppText variant="micro" weight="bold" style={{ color: ret.itemCondition === 'Resellable' ? colors.success : colors.warning }}>
                          {ret.itemCondition}
                        </AppText>
                      </View>
                      <View style={styles.returnHistoryChip}>
                        <AppText variant="micro" weight="bold" style={{ color: ret.refundType === 'Store Credit' ? colors.primary : SALES_GLASS.fgSecondary }}>
                          {ret.refundType}
                        </AppText>
                      </View>
                      <View style={styles.returnHistoryChip}>
                        <AppText variant="micro" weight="bold" style={{ color: SALES_GLASS.fgSecondary }}>
                          <AppNumber value={ret.totalRefund} size="micro" weight="bold" prefix={t('common.etb') + ' '} />
                        </AppText>
                      </View>
                    </View>
                    {ret.createdAt && (
                      <AppText variant="micro" weight="medium" style={{ color: SALES_GLASS.fgSecondary, marginTop: 6 }}>
                        {formatDate(new Date(ret.createdAt), calendarType, language)}
                      </AppText>
                    )}
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Float */}
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

              {/* Sale Info Summary */}
              <View style={[styles.returnInfoBox, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
                <View style={styles.returnInfoRow}>
                  <AppText variant="caption" weight="medium" style={{ color: SALES_GLASS.fgSecondary }}>
                    {t('sales.sale')} #{sale.id}
                  </AppText>
                  <AppText variant="caption" weight="bold" style={{ color: SALES_GLASS.fg }}>
                    {formatDate(new Date(sale.createdAt || Date.now()), calendarType, language)}
                  </AppText>
                </View>
                <View style={[styles.returnInfoRow, { marginTop: 4 }]}>
                  <AppText variant="caption" weight="medium" style={{ color: SALES_GLASS.fgSecondary }}>
                    {t('common.customer')}
                  </AppText>
                  <AppText variant="caption" weight="bold" style={{ color: SALES_GLASS.fg }}>
                    {sale.customerName || t('common.walk_in')}
                  </AppText>
                </View>
                <View style={[styles.returnInfoRow, { marginTop: 4 }]}>
                  <AppText variant="caption" weight="medium" style={{ color: SALES_GLASS.fgSecondary }}>
                    {t('common.item')}
                  </AppText>
                  <AppText variant="caption" weight="bold" style={{ color: SALES_GLASS.fg }} numberOfLines={1}>
                    {isBatch ? batchItems[0]?.itemName || t('common.items') : editForm.itemName}
                  </AppText>
                </View>
                {returnStats && returnStats.totalReturnedQty > 0 && (
                  <View style={[styles.returnInfoRow, { marginTop: 4, backgroundColor: colors.warning + '10', borderRadius: 8, padding: 6 }]}>
                    <AppText variant="caption" weight="medium" style={{ color: colors.warning }}>
                      {t('sales.already_returned')}
                    </AppText>
                    <AppText variant="caption" weight="bold" style={{ color: colors.warning }}>
                      {returnStats.totalReturnedQty} {isBatch ? batchItems[0]?.baseUnit || 'pcs' : sale.unit || 'pcs'} ({t('common.remaining')}: {returnStats.remainingQty})
                    </AppText>
                  </View>
                )}
              </View>

              {/* Quantity Returned */}
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
                <View style={styles.returnQtyRow}>
                  <TextInput
                    style={[
                      styles.returnInput,
                      { flex: 1, color: SALES_GLASS.fg, borderColor: SALES_GLASS.border },
                    ]}
                    value={returnQty}
                    keyboardType="numeric"
                    onChangeText={(v) => {
                      setReturnQty(v);
                      const q = parseInt(v) || 0;
                      const unitPrice = ((isBatch ? batchItems[0] : sale).totalPrice || 0) / Math.max(1, (isBatch ? batchItems[0] : sale).quantity || 1);
                      setReturnRefundAmount(String(unitPrice * q));
                    }}
                  />
                  <TouchableOpacity
                    style={[styles.returnQtyMaxBtn, { backgroundColor: colors.primary + '15' }]}
                    onPress={() => {
                      const maxQty = isBatch ? batchItems[0]?.quantity || 1 : sale.quantity || 1;
                      const avail = Math.max(0, maxQty - (returnStats?.totalReturnedQty || 0));
                      setReturnQty(String(avail));
                      const unitPrice = ((isBatch ? batchItems[0] : sale).totalPrice || 0) / Math.max(1, (isBatch ? batchItems[0] : sale).quantity || 1);
                      setReturnRefundAmount(String(unitPrice * avail));
                    }}
                  >
                    <AppText variant="caption" weight="bold" style={{ color: colors.primary }}>
                      {t('common.max')}
                    </AppText>
                  </TouchableOpacity>
                </View>
                <AppText
                  variant="caption"
                  weight="medium"
                  style={[styles.returnHint, { color: SALES_GLASS.fgSecondary }]}
                  numberOfLines={1}
                >
                  {t("sales.return_available", {
                    qty: String(Math.max(0, (isBatch ? batchItems[0]?.quantity || 1 : sale.quantity || 1) - (returnStats?.totalReturnedQty || 0))),
                    unit: isBatch ? batchItems[0]?.baseUnit || "pcs" : sale.unit || "pcs",
                  })}
                </AppText>
              </View>

              {/* Return Reason Picker */}
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
                <View style={styles.pickerGrid}>
                  {(['Damaged', 'Defective', 'Wrong Item', 'Customer Changed Mind', 'Expired', 'Other'] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.pickerOption,
                        {
                          backgroundColor: returnReasonPicker === opt ? colors.primary + '15' : SALES_GLASS.border,
                          borderColor: returnReasonPicker === opt ? colors.primary : 'transparent',
                        },
                      ]}
                      onPress={() => setReturnReasonPicker(opt)}
                    >
                      <AppText
                        variant="caption"
                        weight={returnReasonPicker === opt ? 'bold' : 'medium'}
                        style={{ color: returnReasonPicker === opt ? colors.primary : SALES_GLASS.fgSecondary }}
                        numberOfLines={1}
                      >
                        {t(`return_reason.${opt.toLowerCase().replace(/\s+/g, '_')}`)}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>
                {returnReasonPicker === 'Other' && (
                  <TextInput
                    style={[
                      styles.returnInput,
                      styles.returnTextAreaShort,
                      { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border, marginTop: 8 },
                    ]}
                    value={returnReason}
                    onChangeText={setReturnReason}
                    placeholder={t("sales.refund_reason")}
                    placeholderTextColor={SALES_GLASS.fgSecondary}
                    multiline
                    numberOfLines={2}
                  />
                )}
              </View>

              {/* Item Condition Picker */}
              <View style={styles.returnField}>
                <AppText
                  variant="caption"
                  weight="bold"
                  transform="uppercase"
                  style={[styles.returnLabel, { color: SALES_GLASS.fgSecondary }]}
                  numberOfLines={1}
                >
                  {t("sales.item_condition")}
                </AppText>
                <View style={styles.pickerRow}>
                  {(['Resellable', 'Damaged', 'Expired', 'Missing Parts'] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.pickerOptionCompact,
                        {
                          backgroundColor: returnItemCondition === opt ? (
                            opt === 'Resellable' ? colors.success + '15' : colors.warning + '15'
                          ) : SALES_GLASS.border,
                          borderColor: returnItemCondition === opt ? (
                            opt === 'Resellable' ? colors.success : colors.warning
                          ) : 'transparent',
                        },
                      ]}
                      onPress={() => {
                        setReturnItemCondition(opt);
                        if (opt !== 'Resellable' && returnRefundType === 'Full Refund') {
                          showToast({
                            title: t('sales.condition_note_title'),
                            message: t('sales.condition_note_msg', { condition: t(`condition.${opt.toLowerCase().replace(/\s+/g, '_')}`) }),
                            type: 'info',
                          });
                        }
                      }}
                    >
                      <AppText
                        variant="micro"
                        weight={returnItemCondition === opt ? 'bold' : 'medium'}
                        style={{ color: returnItemCondition === opt ? (opt === 'Resellable' ? colors.success : colors.warning) : SALES_GLASS.fgSecondary }}
                        numberOfLines={1}
                      >
                        {t(`condition.${opt.toLowerCase().replace(/\s+/g, '_')}`)}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Refund Type Picker */}
              <View style={styles.returnField}>
                <AppText
                  variant="caption"
                  weight="bold"
                  transform="uppercase"
                  style={[styles.returnLabel, { color: SALES_GLASS.fgSecondary }]}
                  numberOfLines={1}
                >
                  {t("sales.refund_type")}
                </AppText>
                <View style={styles.pickerRow}>
                  {(['Full Refund', 'Partial Refund', 'Store Credit', 'Exchange', 'No Refund'] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.pickerOptionCompact,
                        {
                          backgroundColor: returnRefundType === opt ? colors.warning + '15' : SALES_GLASS.border,
                          borderColor: returnRefundType === opt ? colors.warning : 'transparent',
                        },
                      ]}
                      onPress={() => setReturnRefundType(opt)}
                    >
                      <AppText
                        variant="micro"
                        weight={returnRefundType === opt ? 'bold' : 'medium'}
                        style={{ color: returnRefundType === opt ? colors.warning : SALES_GLASS.fgSecondary }}
                        numberOfLines={1}
                      >
                        {t(`refund_type.${opt.toLowerCase().replace(/\s+/g, '_')}`)}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Refund Amount */}
              {returnRefundType !== 'No Refund' && returnRefundType !== 'Exchange' && (
                <View style={styles.returnField}>
                  <AppText
                    variant="caption"
                    weight="bold"
                    transform="uppercase"
                    style={[styles.returnLabel, { color: SALES_GLASS.fgSecondary }]}
                    numberOfLines={1}
                  >
                    {t("sales.refund_amount")}
                  </AppText>
                  <TextInput
                    style={[
                      styles.returnInput,
                      { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border },
                    ]}
                    value={returnRefundAmount}
                    keyboardType="numeric"
                    onChangeText={setReturnRefundAmount}
                    editable={returnRefundType === 'Partial Refund'}
                  />
                  <AppText
                    variant="caption"
                    weight="medium"
                    style={[styles.returnHint, { color: SALES_GLASS.fgSecondary }]}
                    numberOfLines={1}
                  >
                    {returnRefundType === 'Partial Refund'
                      ? t('sales.edit_amount_hint')
                      : t('sales.auto_calculated')}
                  </AppText>
                </View>
              )}

              {/* Notes */}
              <View style={styles.returnField}>
                <AppText
                  variant="caption"
                  weight="bold"
                  transform="uppercase"
                  style={[styles.returnLabel, { color: SALES_GLASS.fgSecondary }]}
                  numberOfLines={1}
                >
                  {t("common.notes")}
                </AppText>
                <TextInput
                  style={[
                    styles.returnInput,
                    styles.returnTextAreaShort,
                    { color: SALES_GLASS.fg, borderColor: SALES_GLASS.border },
                  ]}
                  value={returnNotes}
                  onChangeText={setReturnNotes}
                  placeholder={t("common.optional")}
                  placeholderTextColor={SALES_GLASS.fgSecondary}
                  multiline
                  numberOfLines={2}
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
                    unit: sale.unit || "pcs",
                    itemName: editForm.itemName,
                  })}
            </AppText>
            <View style={styles.returnSuccessDetails}>
              {returnItemCondition && (
                <View style={[styles.returnSuccessChip, { backgroundColor: returnItemCondition === 'Resellable' ? colors.success + '15' : colors.warning + '15' }]}>
                  <AppText variant="micro" weight="bold" style={{ color: returnItemCondition === 'Resellable' ? colors.success : colors.warning }}>
                    {t(`condition.${returnItemCondition.toLowerCase().replace(/\s+/g, '_')}`)}
                  </AppText>
                </View>
              )}
              {returnRefundType && (
                <View style={[styles.returnSuccessChip, { backgroundColor: colors.warning + '15' }]}>
                  <AppText variant="micro" weight="bold" style={{ color: colors.warning }}>
                    {t(`refund_type.${returnRefundType.toLowerCase().replace(/\s+/g, '_')}`)}
                  </AppText>
                </View>
              )}
              {parseFloat(returnRefundAmount) > 0 && (
                <View style={[styles.returnSuccessChip, { backgroundColor: SALES_GLASS.bgCard }]}>
                  <AppText variant="micro" weight="bold" style={{ color: SALES_GLASS.fg }}>
                    <AppNumber value={parseFloat(returnRefundAmount)} size="micro" weight="bold" prefix={t('common.etb') + ' '} />
                  </AppText>
                </View>
              )}
            </View>
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
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                      ) : (
                        <Package size={14} color={colors.primary} />
                      )}
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
                        <AppNumber value={item.baseSellingPrice || 0} size="micro" weight="medium" prefix={t('common.etb') + ' '} color={SALES_GLASS.fgSecondary} />
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
  payDot: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
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
  nodeThumb: {
    width: 28,
    height: 28,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  itemSearchThumb: {
    width: 28,
    height: 28,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
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
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  itemSearchInfo: { flex: 1, marginLeft: 10, gap: 2 },
  emptyState: { alignItems: "center", marginTop: 40, gap: 8 },

  // Return badges
  returnBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 12,
  },

  // Return info box
  returnInfoBox: {
    width: "100%",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  returnInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  // Quantity row
  returnQtyRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  returnQtyMaxBtn: {
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  // Picker grid (2-column)
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pickerOptionCompact: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },

  // Return textarea short
  returnTextAreaShort: {
    height: 70,
    textAlignVertical: "top",
    paddingTop: 12,
  },

  // Success details
  returnSuccessDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 25,
  },
  returnSuccessChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },

  // Return history
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  returnHistoryToggle: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  returnHistoryItem: {
    // base
  },
  returnHistoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  returnHistoryIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
  returnHistoryIconInner: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  returnHistoryDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginLeft: 46,
  },
  returnHistoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
});

export default SaleDetailsScreen;