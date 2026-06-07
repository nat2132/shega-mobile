import { PDFLanguageModal } from '@/components/PDFLanguageModal';
import PremiumActionModal from '@/components/PremiumActionModal';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { deleteSale, insertReturn, updateSale } from '@/database/db';
import { formatDate } from '@/utils/date-utils';
import { generateReceiptPDF } from '@/utils/pdf-utils';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  BadgeCheck,
  Banknote,
  Check,
  ChevronLeft,
  CreditCard,
  Download,
  Edit2,
  LayoutGrid,
  Package,
  Percent,
  Phone,
  RotateCcw,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  X,
  Zap
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
import Animated, {
  FadeInDown,
  ZoomIn
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const SaleDetailsScreen = ({ sale, onClose }: { sale: any, onClose?: () => void }) => {
  const { userProfile, colors, calendarType, language, timeSystem, t, theme } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(sale);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [activeBusiness] = useState<any>({ businessName: userProfile.businessName || 'My Store', storeName: 'Main Branch' });

  // Store the original unit price when entering edit mode (before discount)
  const [editingBaseUnitPrice, setEditingBaseUnitPrice] = useState(0);

  // Return state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnQty, setReturnQty] = useState(String(sale?.quantity || 1));
  const [showReturnSuccess, setShowReturnSuccess] = useState(false);

  if (!sale) return null;

  // Calculate the original unit price BEFORE discount from the original sale data
  const originalUnitPrice = useMemo(() => {
    const price = parseFloat(sale.totalPrice) || 0;
    const discount = parseFloat(sale.discount) || 0;
    const qty = Math.max(1, parseInt(sale.quantity) || 1);
    return (price + discount) / qty;
  }, [sale]);

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Calculate totalPrice: (unitPrice * quantity) - discount
    const unitPrice = editingBaseUnitPrice || originalUnitPrice;
    const qty = Math.max(1, parseInt(editForm.quantity) || 1);
    const discount = parseFloat(editForm.discount) || 0;
    const computedTotal = Math.max(0, (unitPrice * qty) - discount);
    
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
      alert(t('common.error'));
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditForm(sale);
    setIsEditing(false);
  };

  const handleDelete = () => {
    const success = deleteSale(sale.id);
    if (success) {
      setShowDeleteConfirm(false);
      if (onClose) onClose();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('common.error'));
    }
  };

  const handleReturn = () => {
    const qty = parseInt(returnQty) || 0;
    if (qty <= 0 || qty > (sale.quantity || 1)) {
      alert(t('common.error'));
      return;
    }
    if (!returnReason.trim()) {
      alert(t('common.error'));
      return;
    }

    const unitPrice = (sale.totalPrice || 0) / Math.max(1, sale.quantity || 1);
    const totalRefund = unitPrice * qty;

    const success = insertReturn({
      saleId: sale.id,
      itemId: sale.itemId,
      quantity: qty,
      unit: sale.unit || 'pcs',
      unitType: sale.unitType || 'base',
      totalRefund: totalRefund,
      reason: returnReason.trim(),
      createdAt: new Date().toISOString(),
    });

    if (success) {
      setShowReturnModal(false);
      setReturnReason('');
      setReturnQty(String(sale.quantity || 1));
      setShowReturnSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('common.error'));
    }
  };

  // Show computed total price based on edited fields
  const computedTotalPrice = useMemo(() => {
    if (!isEditing) return editForm.totalPrice;
    const unitPrice = editingBaseUnitPrice || originalUnitPrice;
    const qty = Math.max(1, parseInt(editForm.quantity) || 1);
    const discount = parseFloat(editForm.discount) || 0;
    return Math.max(0, (unitPrice * qty) - discount);
  }, [isEditing, editForm.quantity, editForm.discount, editingBaseUnitPrice, originalUnitPrice]);

  const calculatedUnitPrice = useMemo(() => {
    if (isEditing) return editingBaseUnitPrice || originalUnitPrice;
    const price = parseFloat(editForm.totalPrice) || 0;
    const discount = parseFloat(editForm.discount) || 0;
    const qty = Math.max(1, parseInt(editForm.quantity) || 1);
    return (price + discount) / qty;
  }, [isEditing, editForm.totalPrice, editForm.discount, editForm.quantity, editingBaseUnitPrice, originalUnitPrice]);

  const handleEditClick = () => {
    Haptics.selectionAsync();
    setEditingBaseUnitPrice(originalUnitPrice);
    // Reset editForm to original sale data
    setEditForm(sale);
    setIsEditing(true);
  };

  const debtFieldsSection = editForm.paymentStatus === 'Debt' && (
    <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
      <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.customer_identity')}</AppText>
      <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.node}>
          <View style={styles.nodeInfo}>
            <User size={16} color={colors.textSecondary} />
            <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.legal_name')}</AppText>
          </View>
          {isEditing ? (
            <TextInput
              style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]}
              value={editForm.customerName || ''}
              onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, customerName: t }))}
              placeholder={t('sales.customer_name_ph')}
              placeholderTextColor={colors.textSecondary}
            />
          ) : (
            <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: colors.text }]} numberOfLines={2}>{editForm.customerName || t('common.none')}</AppText>
          )}
        </View>
        <View style={styles.nodeDivider} />
        <View style={styles.node}>
          <View style={styles.nodeInfo}>
            <Phone size={16} color={colors.textSecondary} />
            <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.contact_string')}</AppText>
          </View>
          {isEditing ? (
            <TextInput
              style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]}
              value={editForm.customerPhone || ''}
              keyboardType="phone-pad"
              onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, customerPhone: t }))}
              placeholder={t('sales.phone_ph')}
              placeholderTextColor={colors.textSecondary}
            />
          ) : (
            <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: colors.text }]} numberOfLines={2}>{editForm.customerPhone || t('common.na')}</AppText>
          )}
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Transaction Insight Header */}
      <View style={styles.heroContainer}>
        <View style={[styles.heroWash, { backgroundColor: colors.text + '05' }]} />
        <View style={styles.topActions}>
          <TouchableOpacity onPress={onClose} style={[styles.circleBtn, { backgroundColor: colors.background + '80' }]}>
            <ChevronLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.row}>
            {isEditing ? (
              <View style={styles.editActions}>
                <TouchableOpacity onPress={handleCancel} style={[styles.circleBtn, { backgroundColor: '#FF3B3015', marginRight: 10 }]}>
                  <X size={20} color="#FF3B30" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={[styles.circleBtn, { backgroundColor: '#34C75915' }]}>
                  <Check size={20} color="#34C759" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowLangModal(true); }} style={[styles.circleBtn, { backgroundColor: colors.primary + '15', marginRight: 10 }]}>
                  <Download size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowReturnModal(true); }} style={[styles.circleBtn, { backgroundColor: '#FF950015', marginRight: 10 }]}>
                  <RotateCcw size={18} color="#FF9500" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={[styles.circleBtn, { backgroundColor: '#FF3B3015', marginRight: 10 }]}>
                  <Trash2 size={18} color="#FF3B30" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleEditClick} style={[styles.circleBtn, { backgroundColor: colors.background + '80' }]}>
                  <Edit2 size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <Animated.View entering={ZoomIn} style={styles.heroContent}>
          <View style={[styles.badgeContainer, { backgroundColor: editForm.paymentStatus === 'Paid' ? '#34C75915' : '#FF950015' }]}>
            <BadgeCheck size={24} color={editForm.paymentStatus === 'Paid' ? '#34C759' : '#FF9500'} />
          </View>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.heroSub, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.transaction_insight')}</AppText>
          {isEditing ? (
            <AppText variant="display" weight="bold" align="center" style={[styles.heroTitle, { color: colors.text }]} numberOfLines={1}>
              {computedTotalPrice.toLocaleString()} <AppText variant="heading" weight="medium" shrink={false} style={{ opacity: 0.6 }}>{t('common.etb')}</AppText>
            </AppText>
          ) : (
            <AppText variant="display" weight="bold" align="center" style={[styles.heroTitle, { color: colors.text }]} numberOfLines={1}>{editForm.totalPrice.toLocaleString()} <AppText variant="heading" weight="medium" shrink={false} style={{ opacity: 0.6 }}>{t('common.etb')}</AppText></AppText>
          )}
          <AppText variant="body-sm" weight="bold" style={[styles.heroMeta, { color: colors.textSecondary }]} numberOfLines={1}>
            {editForm.createdAt ? formatDate(new Date(editForm.createdAt), calendarType, language) : t('common.loading')}
          </AppText>
        </Animated.View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Settlement Intelligence */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.settlement_modality')}</AppText>
          <View style={styles.row}>
            <View style={[styles.modalityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.mIconBox}>
                {editForm.paymentMethod === 'Cash' ? <Banknote size={18} color={colors.primary} /> : <CreditCard size={18} color={colors.primary} />}
              </View>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.mLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.method')}</AppText>
              {isEditing ? (
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, editForm.paymentMethod === 'Cash' && styles.toggleBtnActive]}
                    onPress={() => setEditForm((prev: any) => ({ ...prev, paymentMethod: 'Cash' }))}
                  >
                    <Banknote size={14} color={editForm.paymentMethod === 'Cash' ? '#FFF' : colors.textSecondary} />
                    <AppText variant="caption" weight="bold" shrink={false} style={[styles.toggleBtnText, { color: editForm.paymentMethod === 'Cash' ? '#FFF' : colors.textSecondary }]} numberOfLines={1}>{t('sale.physical_cash')}</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, editForm.paymentMethod === 'Transfer' && styles.toggleBtnActive]}
                    onPress={() => setEditForm((prev: any) => ({ ...prev, paymentMethod: 'Transfer' }))}
                  >
                    <CreditCard size={14} color={editForm.paymentMethod === 'Transfer' ? '#FFF' : colors.textSecondary} />
                    <AppText variant="caption" weight="bold" shrink={false} style={[styles.toggleBtnText, { color: editForm.paymentMethod === 'Transfer' ? '#FFF' : colors.textSecondary }]} numberOfLines={1}>{t('sale.digital_bank')}</AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <AppText variant="body" weight="bold" style={[styles.mValue, { color: colors.text }]} numberOfLines={1}>{editForm.paymentMethod === 'Cash' ? t('sale.physical_cash') : t('sale.digital_bank')}</AppText>
              )}
            </View>
            <View style={[styles.modalityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.mIconBox}>
                <ShieldCheck size={18} color={editForm.paymentStatus === 'Paid' ? '#34C759' : '#FF9500'} />
              </View>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.mLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.status')}</AppText>
              {isEditing ? (
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, editForm.paymentStatus === 'Paid' && { backgroundColor: '#34C759' }]}
                    onPress={() => setEditForm((prev: any) => ({ ...prev, paymentStatus: 'Paid' }))}
                  >
                    <AppText variant="caption" weight="bold" shrink={false} style={[styles.toggleBtnText, { color: editForm.paymentStatus === 'Paid' ? '#FFF' : colors.textSecondary }]} numberOfLines={1}>{t('sale.settled')}</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, editForm.paymentStatus === 'Debt' && { backgroundColor: '#FF9500' }]}
                    onPress={() => setEditForm((prev: any) => ({ ...prev, paymentStatus: 'Debt' }))}
                  >
                    <AppText variant="caption" weight="bold" shrink={false} style={[styles.toggleBtnText, { color: editForm.paymentStatus === 'Debt' ? '#FFF' : colors.textSecondary }]} numberOfLines={1}>{t('sale.credit')}</AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <AppText variant="body" weight="bold" style={[styles.mValue, { color: editForm.paymentStatus === 'Paid' ? '#34C759' : '#FF9500' }]} numberOfLines={1}>
                  {editForm.paymentStatus === 'Paid' ? t('sale.settled') : t('sale.credit')}
                </AppText>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Intelligence Nodes */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.asset_metrics')}</AppText>
          <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.node}>
              <View style={styles.nodeInfo}>
                <Package size={16} color={colors.textSecondary} />
                <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.asset_name')}</AppText>
              </View>
              <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: colors.text }]} numberOfLines={2}>{editForm.itemName}</AppText>
            </View>
            <View style={styles.nodeDivider} />
            <View style={styles.node}>
              <View style={styles.nodeInfo}>
                <LayoutGrid size={16} color={colors.textSecondary} />
                <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('form.quantity')}</AppText>
              </View>
              {isEditing ? (
                <TextInput
                  style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]}
                  value={String(editForm.quantity)}
                  keyboardType="numeric"
                  onChangeText={(t) => {
                    const val = parseInt(t);
                    setEditForm((prev: any) => ({ ...prev, quantity: isNaN(val) || val < 1 ? 1 : val }));
                  }}
                />
              ) : (
                <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.nodeValue, { color: colors.text }]} numberOfLines={1}>{editForm.quantity} <AppText variant="micro" weight="medium" shrink={false} style={styles.curr}>{editForm.unit}</AppText></AppText>
              )}
            </View>
            <View style={styles.nodeDivider} />
            <View style={styles.node}>
              <View style={styles.nodeInfo}>
                <Zap size={16} color={colors.textSecondary} />
                <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.calculated_unit_price')}</AppText>
              </View>
              <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.nodeValue, { color: colors.text }]} numberOfLines={1}>{calculatedUnitPrice.toFixed(2)} <AppText variant="micro" weight="medium" shrink={false} style={styles.curr}>{t('common.etb')}</AppText></AppText>
            </View>
            <View style={styles.nodeDivider} />
            <View style={styles.node}>
              <View style={styles.nodeInfo}>
                <Percent size={16} color={colors.textSecondary} />
                <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.vat')}</AppText>
              </View>
              {isEditing ? (
                <TextInput
                  style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]}
                  value={String(editForm.vat || 0)}
                  keyboardType="numeric"
                  onChangeText={(t) => {
                    const val = parseFloat(t);
                    setEditForm((prev: any) => ({ ...prev, vat: isNaN(val) ? 0 : val }));
                  }}
                />
              ) : (
                <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.nodeValue, { color: colors.text }]} numberOfLines={1}>{editForm.vat || 0} <AppText variant="micro" weight="medium" shrink={false} style={styles.curr}>{t('common.etb')}</AppText></AppText>
              )}
            </View>
            <View style={styles.nodeDivider} />
            <View style={styles.node}>
              <View style={styles.nodeInfo}>
                <Tag size={16} color={colors.textSecondary} />
                <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.adjusted_discount')}</AppText>
              </View>
              {isEditing ? (
                <TextInput
                  style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]}
                  value={String(editForm.discount || 0)}
                  keyboardType="numeric"
                  onChangeText={(t) => {
                    const val = parseFloat(t);
                    setEditForm((prev: any) => ({ ...prev, discount: isNaN(val) ? 0 : val }));
                  }}
                />
              ) : (
                <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.nodeValue, { color: colors.text }]} numberOfLines={1}>{editForm.discount || 0} <AppText variant="micro" weight="medium" shrink={false} style={styles.curr}>{t('common.etb')}</AppText></AppText>
              )}
            </View>
          </View>
        </Animated.View>

        {debtFieldsSection}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Float */}
      <BlurView intensity={theme === 'dark' ? 40 : 80} tint={theme === 'dark' ? 'dark' : 'light'} style={styles.actionFloat}>
        <TouchableOpacity
          style={[styles.primaryAction, { backgroundColor: colors.text }]}
          onPress={isEditing ? handleSave : handleEditClick}
        >
          {isEditing ? (
            <ShieldCheck size={20} color={colors.background} />
          ) : (
            <Edit2 size={18} color={colors.background} />
          )}
          <AppText variant="body" weight="bold" shrink={false} style={[styles.actionText, { color: colors.background }]} numberOfLines={1}>
            {isEditing ? t('sale.commit_settlement') : t('sale.modify_transaction')}
          </AppText>
        </TouchableOpacity>
      </BlurView>

      {/* Return Item Modal */}
      <Modal visible={showReturnModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowReturnModal(false)} />
          <View style={[styles.returnSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <ScrollView contentContainerStyle={styles.returnContent}>
              <View style={[styles.returnIconBox, { backgroundColor: '#FF950015' }]}>
                <RotateCcw size={32} color="#FF9500" />
              </View>
              <AppText variant="heading" weight="bold" align="center" style={[styles.returnTitle, { color: colors.text }]} numberOfLines={2}>{t('sales.return_item')}</AppText>
              <AppText variant="body" weight="medium" align="center" style={[styles.returnSubtitle, { color: colors.textSecondary }]} numberOfLines={3}>
                {t('sales.return_for', { itemName: editForm.itemName })}
              </AppText>

              <View style={styles.returnField}>
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.returnLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sales.return_quantity')}</AppText>
                <TextInput
                  style={[styles.returnInput, { color: colors.text, borderColor: colors.border }]}
                  value={returnQty}
                  keyboardType="numeric"
                  onChangeText={setReturnQty}
                />
                <AppText variant="caption" weight="medium" style={[styles.returnHint, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t('sales.return_max', { qty: String(sale.quantity), unit: sale.unit || 'pcs' })}
                </AppText>
              </View>

              <View style={styles.returnField}>
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.returnLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sales.return_reason_label')}</AppText>
                <TextInput
                  style={[styles.returnInput, styles.returnTextArea, { color: colors.text, borderColor: colors.border }]}
                  value={returnReason}
                  onChangeText={setReturnReason}
                  placeholder={t('sales.refund_reason')}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={[styles.returnSubmitBtn, { backgroundColor: '#FF9500' }]}
                onPress={handleReturn}
              >
                <RotateCcw size={20} color="#FFF" />
                <AppText variant="body" weight="bold" shrink={false} style={styles.returnSubmitText} numberOfLines={1}>{t('sales.process_return')}</AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.returnCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowReturnModal(false)}
              >
                <AppText variant="body" weight="bold" shrink={false} style={[styles.returnCancelText, { color: colors.text }]} numberOfLines={1}>{t('common.cancel')}</AppText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Return Success Modal */}
      <Modal visible={showReturnSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.successSheet, { backgroundColor: colors.background }]}>
            <View style={[styles.successIconBox, { backgroundColor: '#34C75915' }]}>
              <RotateCcw size={48} color="#34C759" />
            </View>
            <AppText variant="heading" weight="bold" align="center" style={[styles.successTitle, { color: colors.text }]} numberOfLines={2}>{t('sales.return_processed')}</AppText>
            <AppText variant="body" weight="medium" align="center" style={[styles.successSubtitle, { color: colors.textSecondary }]} numberOfLines={4}>
              {t('sales.return_success', { qty: returnQty, unit: sale.unit, itemName: editForm.itemName })}
            </AppText>
            <TouchableOpacity
              style={[styles.successBtn, { backgroundColor: colors.text }]}
              onPress={() => {
                setShowReturnSuccess(false);
                if (onClose) onClose();
              }}
            >
              <AppText variant="body" weight="bold" shrink={false} style={[styles.successBtnText, { color: colors.background }]} numberOfLines={1}>{t('common.done')}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <PremiumActionModal
          title={t('sale.delete_ledger')}
          subtitle={t('sale.delete_confirm', { amount: editForm.totalPrice })}
          actionText={t('sale.nullify_transaction')}
          cancelText={t('common.cancel')}
          iconType="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </Modal>

      <PDFLanguageModal
        visible={showLangModal}
        onClose={() => setShowLangModal(false)}
        onSelect={(lang, action) => generateReceiptPDF(editForm, activeBusiness, lang, action, timeSystem)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroContainer: { height: 320, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 25, position: 'relative' },
  heroWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 260, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  topActions: { position: 'absolute', top: 50, left: 25, right: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  circleBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  heroContent: { alignItems: 'center' },
  badgeContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  heroSub: { fontSize: 13, fontFamily: Fonts.bold, letterSpacing: 1.5, marginBottom: 5 },
  heroTitle: { fontSize: 44, fontFamily: Fonts.bold, letterSpacing: -2, textAlign: 'center' },
  priceEditRow: { flexDirection: 'row', alignItems: 'baseline' },
  heroInput: { fontSize: 32, fontFamily: Fonts.bold, textAlign: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', borderRadius: 12, paddingHorizontal: 20, minWidth: 150 },
  heroMeta: { fontSize: 13, fontFamily: Fonts.bold, marginTop: 10, opacity: 0.6 },
  scrollContent: { padding: 25 },
  section: { marginBottom: 35 },
  sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15, marginLeft: 5 },
  row: { flexDirection: 'row', gap: 15 },
  modalityCard: { flex: 1, borderRadius: 24, padding: 20, borderWidth: 1, alignItems: 'center' },
  mIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.03)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  mLabel: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.5, marginBottom: 4 },
  mValue: { fontSize: 16, fontFamily: Fonts.bold },
  intelligenceBlock: { borderRadius: 28, padding: 20, borderWidth: 1 },
  node: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  nodeInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nodeLabel: { fontSize: 11, fontFamily: Fonts.bold },
  nodeValue: { fontSize: 15, fontFamily: Fonts.bold },
  nodeInput: { fontSize: 14, fontFamily: Fonts.bold, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, minWidth: 100, textAlign: 'right' },
  curr: { fontSize: 10, fontFamily: Fonts.medium, opacity: 0.6 },
  nodeDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 4 },
  actionFloat: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 25, paddingTop: 20, paddingBottom: 40 },
  primaryAction: { height: 65, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  actionText: { fontSize: 16, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  editActions: { flexDirection: 'row', alignItems: 'center' },
  toggleRow: { flexDirection: 'column', gap: 6, marginTop: 8, width: '100%' },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)' },
  toggleBtnActive: { backgroundColor: '#000' },
  toggleBtnText: { fontSize: 11, fontFamily: Fonts.bold },
  // Return modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, width: '100%' },
  modalHandleRow: { alignItems: 'center', paddingTop: 15, paddingBottom: 5 },
  modalHandle: { width: 40, height: 4, borderRadius: 2 },
  returnSheet: { width: '100%', borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '85%' },
  returnContent: { padding: 25, alignItems: 'center' },
  returnIconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  returnTitle: { fontSize: 22, fontFamily: Fonts.bold, marginBottom: 4 },
  returnSubtitle: { fontSize: 14, fontFamily: Fonts.medium, textAlign: 'center', marginBottom: 25, paddingHorizontal: 20 },
  returnField: { width: '100%', marginBottom: 20 },
  returnLabel: { fontSize: 13, fontFamily: Fonts.bold, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  returnInput: { height: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 15, fontFamily: Fonts.medium, fontSize: 16 },
  returnTextArea: { height: 100, textAlignVertical: 'top', paddingTop: 12 },
  returnHint: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 6, opacity: 0.6 },
  returnSubmitBtn: { width: '100%', height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  returnSubmitText: { color: '#FFF', fontSize: 16, fontFamily: Fonts.bold },
  returnCancelBtn: { width: '100%', height: 50, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  returnCancelText: { fontSize: 15, fontFamily: Fonts.bold },
  successSheet: { marginHorizontal: 30, marginBottom: 60, borderRadius: 28, padding: 30, alignItems: 'center' },
  successIconBox: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 24, fontFamily: Fonts.bold, marginBottom: 8 },
  successSubtitle: { fontSize: 15, fontFamily: Fonts.medium, textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  successBtn: { height: 52, borderRadius: 16, paddingHorizontal: 40, justifyContent: 'center', alignItems: 'center', width: '100%' },
  successBtnText: { fontSize: 16, fontFamily: Fonts.bold },
});

export default SaleDetailsScreen;
