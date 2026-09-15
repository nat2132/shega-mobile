import { AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useDialog } from '@/context/DialogContext';
import { useSettings } from '@/context/SettingsContext';
import { findItemsByNameInCategory, generateShegaCode, getUserCategories, insertCategory, insertItem, logStockMovement } from '@/database/db';
import { usePermissions } from '@/hooks/usePermissions';
import { playBad, playNice } from '@/services/soundService';
import { getActiveTaxType } from '@/services/taxService';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Barcode as BarcodeIcon, Camera, Check, Image as ImageIcon, Package, ShieldCheck, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { getSalesGlass } from '@/screens/sales/glass-sales';

const UNITS: { id: string; label: string }[] = [
  { id: 'pcs', label: 'PCS' },
  { id: 'kg', label: 'KG' },
  { id: 'l', label: 'L' },
  { id: 'box', label: 'BOX' },
  { id: 'pack', label: 'PACK' },
  { id: 'dozen', label: 'DOZEN' },
];

interface RegisterProductModalProps {
  visible: boolean;
  barcode: string;
  onClose: () => void;
  onSaved?: (item: any) => void;
}

interface CategoryPick {
  id: number | null;
  name: string;
  icon: string;
}

const RegisterProductModal: React.FC<RegisterProductModalProps> = ({
  visible,
  barcode,
  onClose,
  onSaved,
}) => {
  const { colors, t } = useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);
  const dialog = useDialog();
  const { canManageCatalog } = usePermissions();

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [price, setPrice] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [image, setImage] = useState<string | null>(null);
  const [hasBarcode, setHasBarcode] = useState<boolean>(true);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [useGeneratedAsBarcode, setUseGeneratedAsBarcode] = useState<boolean>(true);
  const [categories, setCategories] = useState<CategoryPick[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setUnit('pcs');
      setPurchasePrice('');
      setPrice('');
      setStockQty('0');
      setImage(null);
      setCategoryId(null);
      setShowCategoryPicker(false);
      setNewCategory('');
      const has = !!barcode;
      setHasBarcode(has);
      if (!has) {
        try {
          const code = generateShegaCode();
          setGeneratedCode(code);
        } catch {
          setGeneratedCode('');
        }
      } else {
        setGeneratedCode('');
      }
      setUseGeneratedAsBarcode(true);
      try {
        const cats = getUserCategories();
        setCategories((cats as any) || []);
      } catch {}
    }
  }, [visible, barcode]);

  // Cashiers cannot register products (permission-based inventory control).
  useEffect(() => {
    if (visible && !canManageCatalog) {
      dialog.alert({ title: t('common.read_only_mode'), message: t('inventory.no_catalog_permission') || 'You do not have permission to create products.', iconType: 'warning' });
      onClose();
    }
  }, [visible, canManageCatalog, dialog, t, onClose]);

  const takePhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        await dialog.alert({ title: t('permission.required'), message: t('permission.library_message'), iconType: 'warning' });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setImage(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
      }
    } catch (e) {
      console.error('Take product photo error:', e);
    }
  }, [dialog, t]);

  const pickFromLibrary = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        await dialog.alert({ title: t('permission.required'), message: t('permission.library_message'), iconType: 'warning' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setImage(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
      }
    } catch (e) {
      console.error('Pick product photo error:', e);
    }
  }, [dialog, t]);

  const toggleCategory = useCallback((id: number | null) => {
    setCategoryId(id);
    setShowCategoryPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSave = useCallback(async () => {
    const cleanName = name.trim();
    const cleanPrice = parseFloat(price);
    const cleanPurchasePrice = parseFloat(purchasePrice);
    const qty = Math.max(0, parseFloat(stockQty) || 0);

    if (!cleanName) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      return;
    }
    if (isNaN(cleanPrice) || cleanPrice <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      return;
    }
    if (!hasBarcode && !generatedCode) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      return;
    }

    setSaving(true);
    try {
      let finalCategoryId = categoryId ?? 0;
      if (showCategoryPicker && newCategory.trim()) {
        const newId = await insertCategory(newCategory.trim(), '📦', true);
        if (newId) finalCategoryId = Number(newId);
      }

      const dupes = findItemsByNameInCategory(cleanName, finalCategoryId);
      if (dupes.length > 0) {
        const proceed = await dialog.confirm({
          title: t('inventory.duplicate_item_title') || 'Duplicate item',
          message: t('inventory.duplicate_item_message', { name: cleanName }) || `An item named '${cleanName}' already exists in this category. Do you want to continue?`,
          confirmText: t('common.proceed') || 'Proceed',
          cancelText: t('common.cancel') || 'Cancel',
          iconType: 'warning',
        });
        if (!proceed) return;
      }

      const finalBarcode = hasBarcode ? (barcode || null) : useGeneratedAsBarcode ? generatedCode : null;
      const finalSku = barcode || generatedCode || null;

      const itemId = await insertItem({
        name: cleanName,
        categoryId: finalCategoryId,
        companyName: '',
        purchaseUnit: unit,
        baseUnit: unit,
        unitsPerPack: 1,
        totalPackQuantity: 0,
        totalBaseQuantity: qty,
        packPurchasePrice: 0,
        basePurchasePrice: isNaN(cleanPurchasePrice) || cleanPurchasePrice < 0 ? 0 : cleanPurchasePrice,
        baseSellingPrice: cleanPrice,
        packSellingPrice: cleanPrice,
        allowSellByBaseUnit: true,
        allowSellByPackUnit: false,
        barcode: finalBarcode,
        sku: finalSku,
        image: image || null,
        taxType: getActiveTaxType()?.name || 'VAT',
        isCredit: false,
        warehouseId: null,
        supplierId: null,
        isActive: true,
      });

      if (!itemId) throw new Error('insertItem failed');

      if (qty > 0) {
        logStockMovement(itemId, qty, unit, hasBarcode ? 'Initial stock (barcode registration)' : 'Initial stock (no barcode)');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playNice();
      onSaved?.({
        id: itemId,
        name: cleanName,
        categoryId: finalCategoryId,
        barcode: finalBarcode,
        sku: finalSku,
        image: image || null,
        taxType: getActiveTaxType()?.name || 'VAT',
        baseSellingPrice: cleanPrice,
        packSellingPrice: cleanPrice,
        basePurchasePrice: isNaN(cleanPurchasePrice) || cleanPurchasePrice < 0 ? 0 : cleanPurchasePrice,
        totalBaseQuantity: qty,
        totalPackQuantity: 0,
        baseUnit: unit,
        purchaseUnit: unit,
        unitsPerPack: 1,
        allowSellByBaseUnit: 1,
        allowSellByPackUnit: 0,
        isActive: 1,
      });
      onClose();
    } catch (e) {
      console.error('Register product error:', e);
      await dialog.alert({ title: t('common.error'), message: t('inventory.failed_to_save'), iconType: 'danger' });
    } finally {
      setSaving(false);
    }
  }, [name, unit, purchasePrice, price, stockQty, image, hasBarcode, generatedCode, useGeneratedAsBarcode, categoryId, showCategoryPicker, newCategory, barcode, dialog, t, onSaved, onClose]);

  const selectedCat = categories.find((c) => c.id === categoryId);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={FadeInDown.duration(280)} exiting={FadeOut.duration(150)} style={[styles.sheet, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: colors.primary + '18' }]}>
              <BarcodeIcon size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading" weight="bold" style={{ color: SALES_GLASS.fg }} numberOfLines={1}>
                {t('inventory.new_product') || 'New Product'}
              </AppText>
              <AppText variant="caption" style={{ color: SALES_GLASS.fgSecondary }} numberOfLines={1}>
                {hasBarcode ? (t('sale.barcode_unknown') || 'Barcode not found in inventory') : (t('inventory.no_barcode') || 'Product has no barcode')}
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={SALES_GLASS.fgSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {hasBarcode ? (
              <View style={[styles.infoBox, { borderColor: SALES_GLASS.border, backgroundColor: SALES_GLASS.bg }]}>
                <BarcodeIcon size={16} color={SALES_GLASS.fgSecondary} />
                <AppText variant="body" weight="bold" style={[styles.infoText, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                  {barcode}
                </AppText>
                <Check size={16} color={colors.success} />
              </View>
            ) : (
              <View style={[styles.infoBox, { borderColor: SALES_GLASS.border, backgroundColor: SALES_GLASS.bg }]}>
                <ShieldCheck size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="bold" style={{ color: SALES_GLASS.fg }} numberOfLines={1}>
                    {generatedCode}
                  </AppText>
                  <AppText variant="micro" weight="medium" style={{ color: SALES_GLASS.fgSecondary }} numberOfLines={2}>
                    {t('inventory.shega_barcode_hint') || 'Unique Shega code. Sold later via Search, or print a label to scan it.'}
                  </AppText>
                </View>
                <TouchableOpacity
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUseGeneratedAsBarcode(!useGeneratedAsBarcode); }}
                  style={[styles.switchBtn, { backgroundColor: useGeneratedAsBarcode ? colors.primary : SALES_GLASS.border }]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.switchThumb, { backgroundColor: SALES_GLASS.bg, alignSelf: 'flex-start', left: useGeneratedAsBarcode ? 24 : 2 }]} />
                </TouchableOpacity>
              </View>
            )}

            {/* Product photo */}
            <View style={styles.field}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>
                {t('inventory.product_photo') || 'Product Photo (optional)'}
              </AppText>
              <View style={[styles.photoRow, { borderColor: SALES_GLASS.border }]}>
                {image ? (
                  <View style={styles.photoPreviewWrap}>
                    <Image source={{ uri: image }} style={styles.photoPreview} contentFit="cover" transition={150} />
                    <TouchableOpacity style={[styles.photoRemove, { backgroundColor: 'rgba(0,0,0,0.6)' }]} onPress={() => setImage(null)} activeOpacity={0.8}>
                      <Trash2 size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.photoPlaceholder, { backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border }]}>
                    <ImageIcon size={22} color={SALES_GLASS.fgSecondary} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 8 }}>
                  <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.primary }]} onPress={takePhoto} activeOpacity={0.85}>
                    <Camera size={15} color="#fff" style={{ marginRight: 6 }} />
                    <AppText variant="body-sm" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
                      {image ? (t('inventory.retake') || 'Retake') : (t('inventory.take_photo') || 'Take Photo')}
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.photoBtn, { backgroundColor: SALES_GLASS.bg, borderWidth: 1, borderColor: SALES_GLASS.border }]} onPress={pickFromLibrary} activeOpacity={0.85}>
                    <ImageIcon size={15} color={SALES_GLASS.fg} style={{ marginRight: 6 }} />
                    <AppText variant="body-sm" weight="bold" style={{ color: SALES_GLASS.fg }} numberOfLines={1}>
                      {t('inventory.gallery') || 'Choose from Gallery'}
                    </AppText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Field label={t('form.official_name') || 'Product Name'} required>
              <TextInput
                style={[styles.input, { color: SALES_GLASS.fg, backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border }]}
                placeholder={t('form.name_placeholder') || 'e.g. Biscuit 50g'}
                placeholderTextColor={SALES_GLASS.fgSecondary}
                value={name}
                onChangeText={setName}
                maxLength={80}
              />
            </Field>

            <Field label={t('form.intel_category') || 'Category'}>
              <TouchableOpacity
                style={[styles.input, styles.selectable, { backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border }]}
                onPress={() => { setCategoryId(null); setShowCategoryPicker((p) => !p); }}
                activeOpacity={0.7}
              >
                <AppText variant="body" weight="medium" style={{ color: selectedCat || showCategoryPicker ? SALES_GLASS.fg : SALES_GLASS.fgSecondary }} numberOfLines={1}>
                  {showCategoryPicker ? (t('form.new_category') || 'Create new category...') : (selectedCat ? `${selectedCat.icon} ${selectedCat.name}` : (t('form.select_category') || 'Select category (optional)'))}
                </AppText>
              </TouchableOpacity>
            </Field>

            {showCategoryPicker && (
              <View style={[styles.catPicker, { borderColor: SALES_GLASS.border, backgroundColor: SALES_GLASS.bg }]}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 180 }}>
                  {categories.map((c) => (
                    <TouchableOpacity key={c.id} style={styles.catRow} onPress={() => toggleCategory(c.id)} activeOpacity={0.7}>
                      <AppText variant="body" weight="medium" style={{ color: SALES_GLASS.fg }} numberOfLines={1}>
                        {c.icon} {c.name}
                      </AppText>
                      {categoryId === c.id && <Check size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={[styles.newCatRow, { borderTopColor: SALES_GLASS.border }]}>
                  <TextInput
                    style={[styles.input, styles.newCatInput, { color: SALES_GLASS.fg, backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border }]}
                    placeholder={t('form.new_category') || 'New category name...'}
                    placeholderTextColor={SALES_GLASS.fgSecondary}
                    value={newCategory}
                    onChangeText={setNewCategory}
                    maxLength={40}
                  />
                </View>
              </View>
            )}

            <Field label={t('inventory.unit') || 'Unit'} required>
              <View style={styles.chipRow}>
                {UNITS.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => { Haptics.selectionAsync(); setUnit(u.id); }}
                    style={[styles.chip, { backgroundColor: unit === u.id ? colors.primary : SALES_GLASS.bg, borderColor: unit === u.id ? colors.primary : SALES_GLASS.border }]}
                    activeOpacity={0.8}
                  >
                    <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: unit === u.id ? '#fff' : SALES_GLASS.fgSecondary }} numberOfLines={1}>{u.label}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            <View style={styles.row}>
              <Field label={t('form.unit_cost') || 'Purchase Price (ETB)'}>
                <TextInput
                  style={[styles.input, { color: SALES_GLASS.fg, backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border }]}
                  placeholder="0.00"
                  placeholderTextColor={SALES_GLASS.fgSecondary}
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                  keyboardType="decimal-pad"
                />
              </Field>
              <Field label={t('form.unit_selling_price') || 'Selling Price (ETB)'} required>
                <TextInput
                  style={[styles.input, { color: SALES_GLASS.fg, backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border }]}
                  placeholder="0.00"
                  placeholderTextColor={SALES_GLASS.fgSecondary}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />
              </Field>
            </View>

            <View style={styles.row}>
              <Field label={t('form.initial_stock', { unit }) || `Initial Quantity (${unit})`}>
                <TextInput
                  style={[styles.input, { color: SALES_GLASS.fg, backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border }]}
                  placeholder="0"
                  placeholderTextColor={SALES_GLASS.fgSecondary}
                  value={stockQty}
                  onChangeText={setStockQty}
                  keyboardType="number-pad"
                />
              </Field>
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: SALES_GLASS.border }]}>
            <TouchableOpacity style={[styles.footerBtn, { borderColor: SALES_GLASS.border }]} onPress={onClose} activeOpacity={0.8}>
              <AppText variant="body" weight="bold" style={{ color: SALES_GLASS.fgSecondary }} numberOfLines={1}>
                {t('common.cancel') || 'Cancel'}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.footerBtn, styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
              {saving ? (
                <AppText variant="body" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
                  {t('common.saving') || 'Saving...'}
                </AppText>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Package size={16} color="#fff" style={{ marginRight: 6 }} />
                  <AppText variant="body" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
                    {t('common.save') || 'Save Product'}
                  </AppText>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => {
  const { colors } = useSettings();
  const SALES_GLASS = getSalesGlass(colors);
  return (
    <View style={styles.field}>
      <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>
        {label}{required ? ' *' : ''}
      </AppText>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  infoText: {
    fontFamily: Fonts.semibold,
    letterSpacing: 0.5,
    flex: 1,
  },
  switchBtn: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    letterSpacing: 1,
    fontFamily: Fonts.semibold,
    marginLeft: 2,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Fonts.medium,
  },
  selectable: {
    justifyContent: 'center',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  photoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPreviewWrap: {
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: 'hidden',
  },
  photoPreview: {
    width: 72,
    height: 72,
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  catPicker: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  newCatRow: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 4,
  },
  newCatInput: {
    height: 46,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  footerBtn: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    borderWidth: 0,
  },
});

export default RegisterProductModal;