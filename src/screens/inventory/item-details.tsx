import { CustomDatePicker } from '@/components/CustomDatePicker';
import ManageBarcodesModal from '@/components/ManageBarcodesModal';
import { AppNumber, AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useDialog } from '@/context/DialogContext';
import { useSettings } from '@/context/SettingsContext';
import { deleteItem, ItemData, updateItem } from '@/database/db';
import { playBad, playNice } from '@/services/soundService';
import { ProductImageGallery } from '@/components/ProductImageGallery';
import { parseProductImages, serializeProductImages } from '@/utils/productImages';
import { formatDate } from '@/utils/date-utils';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import {
  AlertCircle,
  Award,
  Barcode,
  Boxes,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Edit2,
  FileText,
  History,
  Package,
  PhoneCall,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  User,
  X,
  Zap,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getInventoryGlass } from './glass-inventory';

const ItemDetailsScreen = ({ item, onClose }: { item: ItemData; onClose?: () => void }) => {
  const { colors, calendarType, language, t } = useSettings();
  const G = getInventoryGlass(colors);
  const styles = useMemo(() => createStyles(colors, G), [colors, G]);
  const dialog = useDialog();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(item);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [showBarcodes, setShowBarcodes] = useState(false);

  const initialImages = useMemo(() => parseProductImages(item?.image), [item?.image]);
  const [productImages, setProductImages] = useState<string[]>(initialImages.images);
  const [primaryImageIdx, setPrimaryImageIdx] = useState<number>(0);

  if (!item) return null;

  const handleSave = () => {
    if (!editForm.name || !editForm.name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      dialog.alert({ title: t('common.error'), message: 'Product name is required', iconType: 'danger' });
      return;
    }
    const cost = Number(editForm.basePurchasePrice);
    const price = Number(editForm.baseSellingPrice);
    const qty = Number(editForm.totalBaseQuantity);

    if (isNaN(cost) || cost < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      dialog.alert({ title: t('common.error'), message: 'Cost price cannot be negative', iconType: 'danger' });
      return;
    }
    if (isNaN(price) || price <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      dialog.alert({ title: t('common.error'), message: 'Selling price must be greater than 0', iconType: 'danger' });
      return;
    }
    if (isNaN(qty) || qty < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      dialog.alert({ title: t('common.error'), message: 'Quantity cannot be negative', iconType: 'danger' });
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playNice();
    const finalImage = serializeProductImages(productImages, primaryImageIdx);
    const updatedPayload = { ...editForm, image: finalImage };
    const success = updateItem(item.id, updatedPayload);
    if (success) {
      setIsEditing(false);
      if (onClose) onClose();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      dialog.alert({ title: t('common.error'), message: 'Failed to update product details', iconType: 'danger' });
    }
  };

  const handleDelete = () => {
    const success = deleteItem(item.id);
    if (success) {
      setShowDeleteConfirm(false);
      if (onClose) onClose();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      dialog.alert({ title: t('common.error'), message: 'Failed to delete product', iconType: 'danger' });
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditForm(item);
    const resetImgs = parseProductImages(item.image);
    setProductImages(resetImgs.images);
    setPrimaryImageIdx(0);
    setIsEditing(false);
  };

  const profit = Number(editForm.baseSellingPrice || 0) - Number(editForm.basePurchasePrice || 0);
  const margin = Number(editForm.basePurchasePrice || 0) > 0
    ? (profit / Number(editForm.basePurchasePrice)) * 100
    : (Number(editForm.baseSellingPrice || 0) > 0 ? 100 : 0);
  const totalValuation = Number(editForm.baseSellingPrice || 0) * Number(editForm.totalBaseQuantity || 0);

  const expiryDateObj = editForm.expiryDate ? new Date(editForm.expiryDate) : null;
  const daysUntilExpiry = expiryDateObj ? Math.ceil((expiryDateObj.getTime() - Date.now()) / 86400000) : null;

  const currentCoverUri = productImages[primaryImageIdx] || initialImages.primary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Navigation Bar */}
        <View style={[styles.navBar, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ChevronLeft size={20} color={colors.text} />
          </TouchableOpacity>

          <AppText variant="title" weight="bold" style={{ color: colors.text }}>
            {isEditing ? 'Edit Specifications' : 'Product Details'}
          </AppText>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {isEditing ? (
              <>
                <TouchableOpacity onPress={handleCancel} style={[styles.navBtn, { backgroundColor: colors.error + '18' }]}>
                  <X size={18} color={colors.error} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={[styles.navBtn, { backgroundColor: colors.primary }]}>
                  <Check size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setShowBarcodes(true)} style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Barcode size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={[styles.navBtn, { backgroundColor: colors.error + '18' }]}>
                  <Trash2 size={18} color={colors.error} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setIsEditing(true); }} style={[styles.navBtn, { backgroundColor: colors.primary }]}>
                  <Edit2 size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* Cover Hero Card & Image Gallery */}
          <Animated.View entering={FadeInDown.duration(400)} style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.imageHeaderRow}>
              <View style={[styles.coverBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {currentCoverUri ? (
                  <Image source={{ uri: currentCoverUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                ) : (
                  <Package size={36} color={colors.primary} />
                )}
              </View>

              <View style={{ flex: 1 }}>
                {isEditing ? (
                  <TextInput
                    style={[styles.inputTitle, { color: colors.text, borderColor: colors.border }]}
                    value={editForm.name}
                    onChangeText={(v) => setEditForm((prev: any) => ({ ...prev, name: v }))}
                    placeholder="Product Name *"
                    placeholderTextColor={colors.textSecondary}
                  />
                ) : (
                  <AppText variant="title" weight="bold" style={{ color: colors.text }} numberOfLines={2}>
                    {editForm.name}
                  </AppText>
                )}

                {isEditing ? (
                  <TextInput
                    style={[styles.inputSub, { color: colors.textSecondary, borderColor: colors.border, marginTop: 6 }]}
                    value={editForm.companyName || ''}
                    onChangeText={(v) => setEditForm((prev: any) => ({ ...prev, companyName: v }))}
                    placeholder="Brand / Company"
                    placeholderTextColor={colors.textSecondary}
                  />
                ) : editForm.companyName ? (
                  <AppText variant="body-sm" weight="semibold" style={{ color: colors.primary, marginTop: 4 }}>
                    {editForm.companyName}
                  </AppText>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <View style={[styles.statusBadge, { backgroundColor: Number(editForm.totalBaseQuantity) > 0 ? colors.success + '18' : colors.error + '18' }]}>
                    <View style={[styles.statusDot, { backgroundColor: Number(editForm.totalBaseQuantity) > 0 ? colors.success : colors.error }]} />
                    <AppText variant="micro" weight="bold" style={{ color: Number(editForm.totalBaseQuantity) > 0 ? colors.success : colors.error }}>
                      {Number(editForm.totalBaseQuantity) > 0 ? `${editForm.totalBaseQuantity} ${editForm.baseUnit || 'pcs'} IN STOCK` : 'OUT OF STOCK'}
                    </AppText>
                  </View>
                </View>
              </View>
            </View>

            {/* Product Image Gallery (up to 5 images) */}
            <View style={{ marginTop: 14 }}>
              <ProductImageGallery
                images={productImages}
                primaryIndex={primaryImageIdx}
                isEditing={isEditing}
                onImagesChange={(imgs, pIdx) => {
                  setProductImages(imgs);
                  setPrimaryImageIdx(pIdx);
                }}
                colors={{
                  primary: colors.primary,
                  border: colors.border,
                  card: colors.background,
                  text: colors.text,
                  textSecondary: colors.textSecondary,
                  warning: colors.warning,
                }}
              />
            </View>
          </Animated.View>

          {/* Financial Core Cards */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Financial Metrics
            </AppText>

            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Zap size={15} color={colors.primary} />
                  <AppText variant="micro" weight="bold" style={{ color: colors.textSecondary }}>SELLING PRICE</AppText>
                </View>
                {isEditing ? (
                  <TextInput
                    style={[styles.inputMetric, { color: colors.text, borderColor: colors.border }]}
                    value={String(editForm.baseSellingPrice ?? '')}
                    onChangeText={(v) => setEditForm((prev: any) => ({ ...prev, baseSellingPrice: v.replace(/[^0-9.]/g, '') }))}
                    keyboardType="decimal-pad"
                  />
                ) : (
                  <AppText variant="title" weight="bold" style={{ color: colors.primary }}>
                    ETB {Number(editForm.baseSellingPrice || 0).toLocaleString()} <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>/ {editForm.baseUnit || 'pcs'}</AppText>
                  </AppText>
                )}
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Tag size={15} color={colors.textSecondary} />
                  <AppText variant="micro" weight="bold" style={{ color: colors.textSecondary }}>COST PRICE</AppText>
                </View>
                {isEditing ? (
                  <TextInput
                    style={[styles.inputMetric, { color: colors.text, borderColor: colors.border }]}
                    value={String(editForm.basePurchasePrice ?? '')}
                    onChangeText={(v) => setEditForm((prev: any) => ({ ...prev, basePurchasePrice: v.replace(/[^0-9.]/g, '') }))}
                    keyboardType="decimal-pad"
                  />
                ) : (
                  <AppText variant="title" weight="bold" style={{ color: colors.text }}>
                    ETB {Number(editForm.basePurchasePrice || 0).toLocaleString()}
                  </AppText>
                )}
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <TrendingUp size={15} color={profit >= 0 ? colors.success : colors.error} />
                  <AppText variant="micro" weight="bold" style={{ color: colors.textSecondary }}>UNIT PROFIT / MARGIN</AppText>
                </View>
                <AppText variant="body" weight="bold" style={{ color: profit >= 0 ? colors.success : colors.error }}>
                  +ETB {profit.toLocaleString()} ({margin.toFixed(1)}%)
                </AppText>
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <DollarSign size={15} color={colors.primary} />
                  <AppText variant="micro" weight="bold" style={{ color: colors.textSecondary }}>TOTAL ASSET VALUATION</AppText>
                </View>
                <AppText variant="body" weight="bold" style={{ color: colors.text }}>
                  ETB {totalValuation.toLocaleString()}
                </AppText>
              </View>
            </View>
          </Animated.View>

          {/* Stock & Logistics Section */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Logistics & Stock Control
            </AppText>

            <View style={[styles.detailBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.detailRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Boxes size={16} color={colors.primary} />
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>Stock Quantity</AppText>
                </View>
                {isEditing ? (
                  <TextInput
                    style={[styles.inputRow, { color: colors.text, borderColor: colors.border }]}
                    value={String(editForm.totalBaseQuantity ?? '')}
                    onChangeText={(v) => setEditForm((prev: any) => ({ ...prev, totalBaseQuantity: v.replace(/[^0-9.]/g, '') }))}
                    keyboardType="decimal-pad"
                  />
                ) : (
                  <AppText variant="body" weight="bold" style={{ color: colors.text }}>
                    {editForm.totalBaseQuantity} {editForm.baseUnit || 'pcs'}
                  </AppText>
                )}
              </View>

              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

              <View style={styles.detailRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Tag size={16} color={colors.textSecondary} />
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>Base Unit</AppText>
                </View>
                {isEditing ? (
                  <TextInput
                    style={[styles.inputRow, { color: colors.text, borderColor: colors.border }]}
                    value={editForm.baseUnit || ''}
                    onChangeText={(v) => setEditForm((prev: any) => ({ ...prev, baseUnit: v }))}
                  />
                ) : (
                  <AppText variant="body-sm" weight="semibold" style={{ color: colors.text }}>
                    {editForm.baseUnit || 'pcs'}
                  </AppText>
                )}
              </View>

              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

              <View style={styles.detailRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} color={colors.warning} />
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>Low Stock Warning Level</AppText>
                </View>
                {isEditing ? (
                  <TextInput
                    style={[styles.inputRow, { color: colors.text, borderColor: colors.border }]}
                    value={String(editForm.lowStockThreshold ?? '0')}
                    onChangeText={(v) => setEditForm((prev: any) => ({ ...prev, lowStockThreshold: v.replace(/[^0-9.]/g, '') }))}
                    keyboardType="decimal-pad"
                  />
                ) : (
                  <AppText variant="body-sm" weight="semibold" style={{ color: colors.warning }}>
                    {editForm.lowStockThreshold ?? 0} {editForm.baseUnit || 'pcs'}
                  </AppText>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Barcode & Identification */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Barcode & SKU Identification
            </AppText>

            <View style={[styles.detailBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.detailRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Barcode size={16} color={colors.primary} />
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>Barcode / SKU</AppText>
                </View>
                {isEditing ? (
                  <TextInput
                    style={[styles.inputRow, { color: colors.text, borderColor: colors.border }]}
                    value={editForm.barcode || editForm.sku || ''}
                    onChangeText={(v) => setEditForm((prev: any) => ({ ...prev, barcode: v, sku: v }))}
                  />
                ) : (
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.primary, fontFamily: Fonts.bold }}>
                    {editForm.barcode || editForm.sku || 'No Barcode Set'}
                  </AppText>
                )}
              </View>

              <TouchableOpacity style={styles.manageBarcodesBtn} onPress={() => setShowBarcodes(true)}>
                <AppText variant="caption" weight="bold" style={{ color: colors.primary }}>
                  Manage Additional Barcodes
                </AppText>
                <ChevronRight size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Supplier & Expiry Section */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.section}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              Supplier & Expiry Information
            </AppText>

            <View style={[styles.detailBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {editForm.supplierPhone ? (
                <TouchableOpacity
                  style={[styles.callSupplierCard, { backgroundColor: colors.primary }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    const phone = String(editForm.supplierPhone).replace(/[^0-9+]/g, '');
                    if (phone) Linking.openURL(`tel:${phone}`);
                  }}
                >
                  <PhoneCall size={18} color="#FFFFFF" />
                  <AppText variant="body-sm" weight="bold" style={{ color: '#FFFFFF', flex: 1 }}>
                    Call Supplier ({editForm.supplierPhone})
                  </AppText>
                  <ChevronRight size={16} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}

              <View style={styles.detailRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} color={colors.textSecondary} />
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>Expiry Date</AppText>
                </View>
                {isEditing ? (
                  <TouchableOpacity onPress={() => setShowExpiryPicker(true)} style={styles.datePickerBtn}>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.primary }}>
                      {editForm.expiryDate ? formatDate(new Date(editForm.expiryDate), calendarType, language) : 'Set Expiry Date'}
                    </AppText>
                  </TouchableOpacity>
                ) : (
                  <AppText variant="body-sm" weight="semibold" style={{ color: colors.text }}>
                    {editForm.expiryDate ? formatDate(new Date(editForm.expiryDate), calendarType, language) : 'No Expiry Set'}
                  </AppText>
                )}
              </View>

              {daysUntilExpiry !== null && (
                <>
                  <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.detailRow}>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>Days Remaining</AppText>
                    <View style={[styles.expiryBadge, { backgroundColor: daysUntilExpiry <= 30 ? colors.error + '18' : colors.success + '18' }]}>
                      <AppText variant="caption" weight="bold" style={{ color: daysUntilExpiry <= 30 ? colors.error : colors.success }}>
                        {daysUntilExpiry <= 0 ? `Expired (${Math.abs(daysUntilExpiry)} days ago)` : `${daysUntilExpiry} days left`}
                      </AppText>
                    </View>
                  </View>
                </>
              )}

              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

              <View style={styles.detailRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Award size={16} color={colors.textSecondary} />
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>Quality Grade</AppText>
                </View>
                <AppText variant="body-sm" weight="semibold" style={{ color: colors.text }}>
                  {editForm.qualityGrade ? t(`form.${editForm.qualityGrade}`) || editForm.qualityGrade : 'Grade 1'}
                </AppText>
              </View>

              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

              <View style={styles.detailRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} color={colors.textSecondary} />
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>Notes</AppText>
                </View>
                {isEditing ? (
                  <TextInput
                    style={[styles.inputNotes, { color: colors.text, borderColor: colors.border }]}
                    value={editForm.notes || ''}
                    onChangeText={(v) => setEditForm((prev: any) => ({ ...prev, notes: v }))}
                    multiline
                    placeholder="Add notes..."
                    placeholderTextColor={colors.textSecondary}
                  />
                ) : (
                  <AppText variant="body-sm" weight="medium" style={{ color: colors.text, maxWidth: 180 }} numberOfLines={2}>
                    {editForm.notes || 'None'}
                  </AppText>
                )}
              </View>
            </View>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Custom Expiry Date Picker */}
        {showExpiryPicker && (
          <CustomDatePicker
            visible={showExpiryPicker}
            initialDate={editForm.expiryDate || undefined}
            onClose={() => setShowExpiryPicker(false)}
            onSelectDate={(isoDate) => {
              setEditForm((prev: any) => ({ ...prev, expiryDate: isoDate }));
              setShowExpiryPicker(false);
            }}
          />
        )}

        {/* Additional Barcodes Modal */}
        {showBarcodes && (
          <ManageBarcodesModal
            visible={showBarcodes}
            item={item}
            onClose={() => setShowBarcodes(false)}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any, G: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    navBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: { padding: 16, gap: 16 },
    heroCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 16,
    },
    imageHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    coverBox: {
      width: 72,
      height: 72,
      borderRadius: 18,
      borderWidth: 1,
      overflow: 'hidden',
      alignItems: 'center',
      justify: 'center',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
    inputTitle: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    inputSub: {
      fontSize: 13,
      fontFamily: Fonts.medium,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    section: { gap: 8 },
    sectionHeading: { fontSize: 11, letterSpacing: 1.2 },
    metricsGrid: { flexDirection: 'row', gap: 10 },
    metricCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14 },
    inputMetric: {
      fontSize: 16,
      fontFamily: Fonts.bold,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    detailBlock: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
    detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowDivider: { height: 1, width: '100%' },
    inputRow: {
      minWidth: 100,
      textAlign: 'right',
      fontSize: 14,
      fontFamily: Fonts.medium,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    inputNotes: {
      flex: 1,
      height: 48,
      fontSize: 13,
      fontFamily: Fonts.medium,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    manageBarcodesBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 8,
    },
    callSupplierCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    datePickerBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    expiryBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
  });

export default ItemDetailsScreen;
