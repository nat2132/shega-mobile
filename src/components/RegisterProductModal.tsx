import { AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useDialog } from '@/context/DialogContext';
import { useSettings } from '@/context/SettingsContext';
import { getUserCategories, insertCategory, insertItem, logStockMovement } from '@/database/db';
import { playBad, playNice } from '@/services/soundService';
import * as Haptics from 'expo-haptics';
import { Barcode as BarcodeIcon, Check, Package, X } from 'lucide-react-native';
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

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [categories, setCategories] = useState<CategoryPick[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setPrice('');
      setStockQty('0');
      setCategoryId(null);
      setShowCategoryPicker(false);
      setNewCategory('');
      try {
        const cats = getUserCategories();
        setCategories((cats as any) || []);
      } catch {}
    }
  }, [visible]);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const handleSave = useCallback(async () => {
    const cleanName = name.trim();
    const cleanPrice = parseFloat(price);
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

    setSaving(true);
    try {
      let finalCategoryId = categoryId ?? 0;
      if (showCategoryPicker && newCategory.trim()) {
        const newId = await insertCategory(newCategory.trim(), '📦', true);
        if (newId) finalCategoryId = Number(newId);
      }

      const itemId = await insertItem({
        name: cleanName,
        categoryId: finalCategoryId,
        companyName: '',
        purchaseUnit: 'pcs',
        baseUnit: 'pcs',
        unitsPerPack: 0,
        totalPackQuantity: 0,
        totalBaseQuantity: qty,
        packPurchasePrice: 0,
        basePurchasePrice: 0,
        baseSellingPrice: cleanPrice,
        packSellingPrice: cleanPrice,
        allowSellByBaseUnit: true,
        allowSellByPackUnit: false,
        barcode: barcode || null,
        sku: barcode || null,
        isCredit: false,
        warehouseId: null,
        supplierId: null,
      });

      if (!itemId) throw new Error('insertItem failed');

      if (qty > 0) {
        logStockMovement(itemId, qty, 'pcs', 'Initial stock (scan registration)');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playNice();
      onSaved?.({
        id: itemId,
        name: cleanName,
        categoryId: finalCategoryId,
        barcode: barcode || null,
        sku: barcode || null,
        baseSellingPrice: cleanPrice,
        packSellingPrice: cleanPrice,
        totalBaseQuantity: qty,
        totalPackQuantity: 0,
        baseUnit: 'pcs',
        purchaseUnit: 'pcs',
        allowSellByBaseUnit: 1,
        allowSellByPackUnit: 0,
      });
      onClose();
    } catch (e) {
      console.error('Register product error:', e);
      await dialog.alert({ title: t('common.error'), message: t('inventory.failed_to_save'), iconType: 'danger' });
    } finally {
      setSaving(false);
    }
  }, [name, price, stockQty, categoryId, showCategoryPicker, newCategory, barcode, dialog, t, onSaved, onClose]);

  const toggleCategory = useCallback((id: number | null) => {
    setCategoryId(id);
    setShowCategoryPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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
                {t('sale.register_product') || 'Register New Product'}
              </AppText>
              <AppText variant="caption" style={{ color: SALES_GLASS.fgSecondary }} numberOfLines={1}>
                {t('sale.barcode_unknown') || 'Barcode not found in inventory'}
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={SALES_GLASS.fgSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.barcodeBox, { borderColor: SALES_GLASS.border, backgroundColor: SALES_GLASS.bg }]}>
              <BarcodeIcon size={16} color={SALES_GLASS.fgSecondary} />
              <AppText variant="body" weight="bold" style={[styles.barcodeText, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                {barcode}
              </AppText>
            </View>

            <Field label={t('form.name') || 'Product Name'} required>
              <TextInput
                style={[styles.input, { color: SALES_GLASS.fg, backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border }]}
                placeholder={t('form.name_placeholder') || 'e.g. Bati Wing Coffee'}
                placeholderTextColor={SALES_GLASS.fgSecondary}
                value={name}
                onChangeText={setName}
                maxLength={80}
              />
            </Field>

            <Field label={t('form.category') || 'Category'}>
              <TouchableOpacity
                style={[styles.input, styles.selectable, { backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border }]}
                onPress={() => { setCategoryId(null); setShowCategoryPicker((p) => !p); }}
                activeOpacity={0.7}
              >
                <AppText variant="body" weight="medium" style={{ color: selectedCategory || showCategoryPicker ? SALES_GLASS.fg : SALES_GLASS.fgSecondary }} numberOfLines={1}>
                  {showCategoryPicker ? (t('form.new_category') || 'Create new category...') : (selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : (t('form.select_category') || 'Select category (optional)'))}
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

            <Field label={t('form.selling_price') || 'Selling Price (ETB)'} required>
              <TextInput
                style={[styles.input, { color: SALES_GLASS.fg, backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border }]}
                placeholder="0.00"
                placeholderTextColor={SALES_GLASS.fgSecondary}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
            </Field>

            <Field label={t('form.initial_stock') || 'Initial Stock (pcs)'}>
              <TextInput
                style={[styles.input, { color: SALES_GLASS.fg, backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border }]}
                placeholder="0"
                placeholderTextColor={SALES_GLASS.fgSecondary}
                value={stockQty}
                onChangeText={setStockQty}
                keyboardType="number-pad"
              />
            </Field>
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
                    {t('common.save') || 'Save'}
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
    maxHeight: '88%',
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
  barcodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  barcodeText: {
    fontFamily: Fonts.semibold,
    letterSpacing: 0.5,
    flex: 1,
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