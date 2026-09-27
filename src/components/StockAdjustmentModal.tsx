import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { X, Check, Package, AlertTriangle, ChevronDown, Wrench, ShieldAlert } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { getItems, insertAdjustment, ItemData, getCurrentUserIdSafe } from '@/database/db';
import { notifyLocalDataChanged } from '@/services/syncService';
import { parseProductImages } from '@/utils/productImages';

interface StockAdjustmentModalProps {
  visible: boolean;
  preSelectedItem?: ItemData | null;
  onClose: () => void;
  onSuccess?: () => void;
}

type ReasonType = 'damaged' | 'expired' | 'lost' | 'discrepancy' | 'found' | 'other';

const REASON_OPTIONS: { id: ReasonType; label: string; isDeduction: boolean; icon: string }[] = [
  { id: 'damaged', label: 'Damaged', isDeduction: true, icon: '💥' },
  { id: 'expired', label: 'Expired', isDeduction: true, icon: '⏰' },
  { id: 'lost', label: 'Lost / Stolen', isDeduction: true, icon: '🔍' },
  { id: 'discrepancy', label: 'Count Discrepancy', isDeduction: true, icon: '📉' },
  { id: 'found', label: 'Found / Addition', isDeduction: false, icon: '📈' },
  { id: 'other', label: 'Other', isDeduction: true, icon: '📝' },
];

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  visible,
  preSelectedItem,
  onClose,
  onSuccess,
}) => {
  const { colors, t } = useSettings();

  const [items, setItems] = useState<ItemData[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(preSelectedItem || null);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [reasonType, setReasonType] = useState<ReasonType>('damaged');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      try {
        const loaded = (getItems() as ItemData[]) || [];
        setItems(loaded);
        if (preSelectedItem) {
          const fresh = loaded.find((i) => i.id === preSelectedItem.id);
          setSelectedItem(fresh || preSelectedItem);
        } else if (loaded.length > 0 && !selectedItem) {
          setSelectedItem(loaded[0]);
        }
      } catch {
        setItems([]);
      }
      setQuantity('');
      setNote('');
      setReasonType('damaged');
      setError('');
      setShowPicker(false);
    }
  }, [visible, preSelectedItem]);

  const activeReason = useMemo(() => REASON_OPTIONS.find((r) => r.id === reasonType)!, [reasonType]);

  const currentStock = selectedItem?.totalBaseQuantity ?? 0;
  const adjQty = Math.max(0, parseFloat(quantity) || 0);

  const newStock = useMemo(() => {
    if (!selectedItem) return 0;
    if (activeReason.isDeduction) {
      return Math.max(0, currentStock - adjQty);
    }
    return currentStock + adjQty;
  }, [currentStock, adjQty, activeReason, selectedItem]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items.slice(0, 30);
    const q = searchQuery.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.categoryName?.toLowerCase().includes(q)).slice(0, 30);
  }, [items, searchQuery]);

  const handleConfirm = () => {
    setError('');
    if (!selectedItem) {
      setError('Please select a product');
      return;
    }
    if (isNaN(adjQty) || adjQty <= 0) {
      setError('Please enter a valid quantity greater than 0');
      return;
    }
    if (activeReason.isDeduction && adjQty > currentStock) {
      setError(`Cannot adjust ${adjQty} ${selectedItem.baseUnit || 'pcs'}. Available stock is only ${currentStock}.`);
      return;
    }

    setSubmitting(true);
    try {
      const fullReason = note.trim()
        ? `${activeReason.label}: ${note.trim()}`
        : activeReason.label;

      const res = insertAdjustment({
        itemId: selectedItem.id,
        type: reasonType,
        oldValue: currentStock,
        newValue: newStock,
        quantity: adjQty,
        unitType: 'base',
        reason: fullReason,
        userId: getCurrentUserIdSafe(),
        date: new Date().toISOString().split('T')[0],
      });

      if (res) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        try { notifyLocalDataChanged(); } catch {}
        onSuccess?.();
        onClose();
      } else {
        setError('Failed to record stock adjustment');
      }
    } catch (e: any) {
      setError(e?.message || 'Stock adjustment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const coverImg = selectedItem ? parseProductImages(selectedItem.image).primary : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.iconBox, { backgroundColor: colors.primary + '18' }]}>
                <Wrench size={20} color={colors.primary} />
              </View>
              <View>
                <AppText variant="title" weight="bold" style={{ color: colors.text }}>
                  Stock Adjustment
                </AppText>
                <AppText variant="caption" style={{ color: colors.textSecondary }}>
                  Record damaged, lost, or count corrections
                </AppText>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {/* Product Picker Button */}
            <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: colors.textSecondary }}>
              Select Product
            </AppText>

            <TouchableOpacity
              style={[styles.productSelectBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowPicker(!showPicker)}
              activeOpacity={0.8}
            >
              {coverImg ? (
                <Image source={{ uri: coverImg }} style={styles.productThumb} contentFit="cover" />
              ) : (
                <View style={[styles.productThumb, { backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' }]}>
                  <Package size={20} color={colors.textSecondary} />
                </View>
              )}

              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="body" weight="bold" style={{ color: colors.text }} numberOfLines={1}>
                  {selectedItem?.name || 'Select a product...'}
                </AppText>
                <AppText variant="caption" style={{ color: colors.textSecondary }}>
                  Current Stock: {currentStock} {selectedItem?.baseUnit || 'pcs'}
                </AppText>
              </View>

              <ChevronDown size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Product Picker Dropdown */}
            {showPicker && (
              <View style={[styles.pickerDropdown, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.searchInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Search product..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                  {filteredItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                      onPress={() => {
                        setSelectedItem(item);
                        setShowPicker(false);
                        Haptics.selectionAsync();
                      }}
                    >
                      <AppText variant="body-sm" weight="bold" style={{ color: colors.text, flex: 1 }}>
                        {item.name}
                      </AppText>
                      <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
                        {item.totalBaseQuantity} {item.baseUnit || 'pcs'}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Adjustment Reason Selection */}
            <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: colors.textSecondary, marginTop: 14 }}>
              Adjustment Reason
            </AppText>

            <View style={styles.reasonGrid}>
              {REASON_OPTIONS.map((opt) => {
                const isSelected = reasonType === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => {
                      setReasonType(opt.id);
                      Haptics.selectionAsync();
                    }}
                    style={[
                      styles.reasonChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.background,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <AppText variant="caption" weight="bold" style={{ color: isSelected ? '#FFFFFF' : colors.text }}>
                      {opt.icon} {opt.label}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quantity Input */}
            <View style={{ marginTop: 14 }}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: colors.textSecondary, marginBottom: 6 }}>
                Quantity Adjusted ({selectedItem?.baseUnit || 'pcs'}) *
              </AppText>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="e.g. 5"
                placeholderTextColor={colors.textSecondary}
                value={quantity}
                onChangeText={(v) => {
                  setQuantity(v.replace(/[^0-9.]/g, ''));
                  setError('');
                }}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Optional Note */}
            <View style={{ marginTop: 14 }}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: colors.textSecondary, marginBottom: 6 }}>
                Note / Description (Optional)
              </AppText>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, height: 60 }]}
                placeholder="e.g. 5 bottles damaged during delivery"
                placeholderTextColor={colors.textSecondary}
                value={note}
                onChangeText={setNote}
                multiline
              />
            </View>

            {/* Stock Calculation Preview Box */}
            {selectedItem && adjQty > 0 && (
              <View style={[styles.previewBox, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
                <View style={styles.previewLine}>
                  <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>Current Stock:</AppText>
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>{currentStock} {selectedItem.baseUnit || 'pcs'}</AppText>
                </View>

                <View style={styles.previewLine}>
                  <AppText variant="caption" weight="medium" style={{ color: activeReason.isDeduction ? colors.error : colors.success }}>
                    Adjustment ({activeReason.label}):
                  </AppText>
                  <AppText variant="body-sm" weight="bold" style={{ color: activeReason.isDeduction ? colors.error : colors.success }}>
                    {activeReason.isDeduction ? `-` : `+`}{adjQty} {selectedItem.baseUnit || 'pcs'}
                  </AppText>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.previewLine}>
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>New Available Stock:</AppText>
                  <AppText variant="title" weight="extrabold" style={{ color: colors.primary }}>
                    {newStock} {selectedItem.baseUnit || 'pcs'}
                  </AppText>
                </View>
              </View>
            )}

            {/* Error Message Display */}
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.error + '18', borderColor: colors.error + '40' }]}>
                <ShieldAlert size={16} color={colors.error} />
                <AppText variant="caption" weight="bold" style={{ color: colors.error, flex: 1 }}>
                  {error}
                </AppText>
              </View>
            ) : null}

            {/* Confirm Button */}
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.primary, opacity: submitting || !selectedItem || !adjQty ? 0.5 : 1 }]}
              disabled={submitting || !selectedItem || !adjQty}
              onPress={handleConfirm}
            >
              <Check size={18} color="#FFFFFF" />
              <AppText variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
                {submitting ? 'Saving Adjustment…' : 'Confirm Stock Adjustment'}
              </AppText>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  card: { height: '85%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { padding: 6 },
  body: { padding: 20, gap: 4 },
  productSelectBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, marginTop: 6 },
  productThumb: { width: 42, height: 42, borderRadius: 10 },
  pickerDropdown: { borderRadius: 16, borderWidth: 1, marginTop: 6, padding: 10 },
  searchInput: { height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 13, marginBottom: 8 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  reasonChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  input: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  previewBox: { borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 16, gap: 6 },
  previewLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, width: '100%', marginVertical: 4 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 14 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 20 },
});
