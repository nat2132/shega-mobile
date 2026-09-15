import { AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useDialog } from '@/context/DialogContext';
import { useSettings } from '@/context/SettingsContext';
import {
  addItemBarcode,
  addQuickProduct,
  getItemBarcodes,
  isQuickProduct,
  removeItemBarcode,
  removeQuickProduct,
  setPrimaryBarcode,
  toggleItemActive,
  updateItem,
} from '@/database/db';
import { playBad, playNice } from '@/services/soundService';
import { getPeripheralManager } from '@/services/peripherals/peripheralManager';
import { barcodePng } from '@shega/shared';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Barcode as BarcodeIcon, Plus, Star, Trash2, X, Check, Power, Printer, Download } from 'lucide-react-native';
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
import { getInventoryGlass } from '@/screens/inventory/glass-inventory';

interface ManageBarcodesModalProps {
  visible: boolean;
  item: any;
  onClose: () => void;
  onChanged?: () => void;
}

const ManageBarcodesModal: React.FC<ManageBarcodesModalProps> = ({ visible, item, onClose, onChanged }) => {
  const { colors, t } = useSettings();
  const G = useMemo(() => getInventoryGlass(colors), [colors]);
  const dialog = useDialog();

  const [barcodes, setBarcodes] = useState<any[]>([]);
  const [newBarcode, setNewBarcode] = useState('');
  const [editingPrimary, setEditingPrimary] = useState(false);
  const [primaryCode, setPrimaryCode] = useState('');
  const [active, setActive] = useState(true);
  const [quick, setQuick] = useState(false);

  const reload = useCallback(() => {
    if (!item?.id) return;
    setBarcodes(getItemBarcodes(item.id));
    setActive(item.isActive !== 0);
    setQuick(isQuickProduct(item.id));
    setPrimaryCode(item.barcode || item.sku || '');
  }, [item]);

  useEffect(() => {
    if (visible) {
      setNewBarcode('');
      setEditingPrimary(false);
      reload();
    }
  }, [visible, reload]);

  const handleAdd = useCallback(() => {
    const code = newBarcode.trim();
    if (!code || code.length < 4) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      return;
    }
    const added = addItemBarcode(item.id, code, barcodes.length === 0);
    if (added) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playNice();
      setNewBarcode('');
      reload();
      onChanged?.();
    }
  }, [newBarcode, item.id, barcodes.length, reload, onChanged]);

  const handleRemove = useCallback(
    async (bc: any) => {
      const ok = await dialog.confirm({
        title: t('inv.remove_barcode_title') || 'Remove Barcode',
        message: t('inv.remove_barcode_msg') || `Remove barcode #${bc.barcode} from this product?`,
        confirmText: t('common.remove') || 'Remove',
        cancelText: t('common.cancel') || 'Cancel',
        iconType: 'danger',
        destructive: true,
      });
      if (!ok) return;
      if (removeItemBarcode(bc.id)) {
        reload();
        onChanged?.();
      }
    },
    [dialog, t, reload, onChanged],
  );

  const handleSetPrimary = useCallback(
    (bc: any) => {
      if (setPrimaryBarcode(bc.id, item.id)) {
        setPrimaryCode(bc.barcode);
        updateItem(item.id, { barcode: bc.barcode });
        reload();
        onChanged?.();
      }
    },
    [item.id, reload, onChanged],
  );

  const handleSavePrimary = useCallback(() => {
    const code = primaryCode.trim();
    if (!code || code.length < 4) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      return;
    }
    updateItem(item.id, { barcode: code });
    // Ensure it's also registered as an alternative barcode so lookups stay consistent.
    const exists = barcodes.some((b) => b.barcode.toLowerCase() === code.toLowerCase());
    if (!exists) addItemBarcode(item.id, code, true);
    setEditingPrimary(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playNice();
    reload();
    onChanged?.();
  }, [primaryCode, item.id, barcodes, reload, onChanged]);

  const handleToggleActive = useCallback(() => {
    const next = !active;
    toggleItemActive(item.id, next);
    setActive(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (next) playNice();
    onChanged?.();
  }, [active, item.id, onChanged]);

  const handlePrintLabel = useCallback(
    async (code: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const res = await getPeripheralManager().printLabel({
        name: item?.name || 'Product',
        barcode: code,
        sku: item?.sku || undefined,
        price: Number(item?.baseSellingPrice ?? item?.sellingPrice ?? 0),
        copies: 1,
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        dialog.alert({
          title: res.errorCode === 'needs_dev_build' ? 'Development build required' : 'Print failed',
          message:
            res.errorCode === 'needs_dev_build'
              ? 'Printing requires the Shega development build. Preview:\n\n' + (res.preview || '')
              : res.errorCode === 'printer_missing'
                ? 'No printer configured. Add one in Settings → Devices.'
                : `Could not print the label (${res.errorCode || 'error'}).`,
        });
      }
    },
    [item, dialog],
  );

  const handleDownloadBarcode = useCallback(
    async (code: string) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const png = barcodePng(code);
        if (!png) {
          dialog.alert({ title: 'Cannot encode', message: 'This value cannot be rendered as a barcode image.' });
          return;
        }
        const b64 = pngBytesToBase64(png);
        const fileUri = `${FileSystem.cacheDirectory}barcode-${code.replace(/[^0-9A-Za-z-]/g, '_')}.png`;
        await FileSystem.writeAsStringAsync(fileUri, b64, { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'Save Barcode' });
        } else {
          dialog.alert({ title: 'Saved', message: fileUri });
        }
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        dialog.alert({ title: 'Download failed', message: 'Could not export the barcode image.' });
      }
    },
    [dialog],
  );

  const handleToggleQuick = useCallback(() => {
    const next = !quick;
    if (next) addQuickProduct(item.id);
    else removeQuickProduct(item.id);
    setQuick(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChanged?.();
  }, [quick, item.id, onChanged]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={FadeInDown.duration(280)} exiting={FadeOut.duration(150)} style={[styles.sheet, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: colors.primary + '18' }]}>
              <BarcodeIcon size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                {t('inv.co_barcode') || 'Barcodes & Status'}
              </AppText>
              <AppText variant="caption" style={{ color: G.fgSecondary }} numberOfLines={1}>
                {item?.name || ''}
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={G.fgSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Status toggles */}
            <View style={[styles.toggleRow, { borderColor: G.border, backgroundColor: G.bg }]}>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                  {t('inv.active_status') || 'Active Product'}
                </AppText>
                <AppText variant="caption" style={{ color: G.fgSecondary }} numberOfLines={2}>
                  {active
                    ? (t('inv.active_status_on') || 'Visible in POS & search')
                    : (t('inv.active_status_off') || 'Hidden from POS & search')}
                </AppText>
              </View>
              <TouchableOpacity
                onPress={handleToggleActive}
                style={[
                  styles.pill,
                  { backgroundColor: active ? '#22C55E' + '22' : G.border },
                ]}
                activeOpacity={0.8}
              >
                <Power size={14} color={active ? '#16A34A' : G.fgSecondary} />
                <AppText variant="caption" weight="bold" style={{ color: active ? '#16A34A' : G.fgSecondary }} numberOfLines={1}>
                  {active ? (t('common.on') || 'ON') : (t('common.off') || 'OFF')}
                </AppText>
              </TouchableOpacity>
            </View>

            <View style={[styles.toggleRow, { borderColor: G.border, backgroundColor: G.bg }]}>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                  {t('sale.quick_products') || 'Quick Product'}
                </AppText>
                <AppText variant="caption" style={{ color: G.fgSecondary }} numberOfLines={2}>
                  {quick
                    ? (t('inv.quick_on') || 'Shown in POS quick-add bar')
                    : (t('inv.quick_off') || 'Tap to pin to POS quick-add bar')}
                </AppText>
              </View>
              <TouchableOpacity
                onPress={handleToggleQuick}
                style={[styles.pill, { backgroundColor: quick ? '#F59E0B' + '22' : G.border }]}
                activeOpacity={0.8}
              >
                <Star size={14} color={quick ? '#D97706' : G.fgSecondary} fill={quick ? '#D97706' : 'transparent'} />
                <AppText variant="caption" weight="bold" style={{ color: quick ? '#D97706' : G.fgSecondary }} numberOfLines={1}>
                  {quick ? (t('common.on') || 'ON') : (t('common.off') || 'OFF')}
                </AppText>
              </TouchableOpacity>
            </View>

            {/* Primary barcode */}
            <View style={styles.section}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionLabel, { color: G.fgSecondary }]} numberOfLines={1}>
                {t('inv.primary_barcode') || 'Primary Barcode / SKU'}
              </AppText>
              {editingPrimary ? (
                <>
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, { color: G.fg, backgroundColor: G.bg, borderColor: G.border }]}
                      placeholder="Enter barcode or SKU"
                      placeholderTextColor={G.fgSecondary}
                      value={primaryCode}
                      onChangeText={setPrimaryCode}
                      autoCapitalize="none"
                      maxLength={64}
                    />
                  </View>
                  <View style={styles.rowActions}>
                    <TouchableOpacity style={[styles.smallBtn, { borderColor: G.border }]} onPress={() => setEditingPrimary(false)} activeOpacity={0.8}>
                      <AppText variant="caption" weight="bold" style={{ color: G.fgSecondary }} numberOfLines={1}>{t('common.cancel') || 'Cancel'}</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.primary }]} onPress={handleSavePrimary} activeOpacity={0.8}>
                      <Check size={14} color="#fff" style={{ marginRight: 4 }} />
                      <AppText variant="caption" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>{t('common.save') || 'Save'}</AppText>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.codeChip, { borderColor: G.border, backgroundColor: G.bg }]}
                  onPress={() => setEditingPrimary(true)}
                  activeOpacity={0.7}
                >
                  <BarcodeIcon size={16} color={G.fgSecondary} />
                  <AppText variant="body" weight="bold" style={[styles.codeText, { color: G.fg }]} numberOfLines={1}>
                    {primaryCode || (t('inv.no_barcode') || 'No barcode set — tap to add')}
                  </AppText>
                  <EditPen />
                </TouchableOpacity>
              )}
              {!!primaryCode && !editingPrimary && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity style={[styles.smallBtn, { flex: 1, borderColor: G.border }]} onPress={() => handlePrintLabel(primaryCode)} activeOpacity={0.8}>
                    <Printer size={14} color={colors.primary} style={{ marginRight: 6 }} />
                    <AppText variant="caption" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('inv.print_label') || 'Print Label'}</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smallBtn, { flex: 1, borderColor: G.border }]} onPress={() => handleDownloadBarcode(primaryCode)} activeOpacity={0.8}>
                    <Download size={14} color={G.fgSecondary} style={{ marginRight: 6 }} />
                    <AppText variant="caption" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('inv.download_barcode') || 'Download'}</AppText>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Alternative barcodes */}
            <View style={styles.section}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionLabel, { color: G.fgSecondary }]} numberOfLines={1}>
                {t('inv.alt_barcodes') || `Alternative Barcodes (${barcodes.length})`}
              </AppText>

              {barcodes.length === 0 && (
                <AppText variant="caption" style={{ color: G.fgSecondary, marginLeft: 2 }} numberOfLines={2}>
                  {t('inv.no_alt_barcodes') || 'No alternative barcodes yet. Add one so the same product can be scanned under multiple codes.'}
                </AppText>
              )}

              {barcodes.map((bc) => (
                <View key={bc.id} style={[styles.altRow, { borderColor: G.border, backgroundColor: G.bg }]}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <BarcodeIcon size={14} color={G.fgSecondary} style={{ marginRight: 8 }} />
                    <AppText variant="body" weight="medium" style={[styles.codeText, { color: G.fg }]} numberOfLines={1}>
                      {bc.barcode}
                    </AppText>
                    {bc.isPrimary === 1 && (
                      <AppText variant="micro" weight="bold" style={[styles.primaryBadge, { backgroundColor: colors.primary + '18', color: colors.primary }]} numberOfLines={1}>
                        {t('inv.primary') || 'PRIMARY'}
                      </AppText>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handlePrintLabel(bc.barcode)} activeOpacity={0.7}>
                      <Printer size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleDownloadBarcode(bc.barcode)} activeOpacity={0.7}>
                      <Download size={16} color={G.fgSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleSetPrimary(bc)} activeOpacity={0.7}>
                      <Check size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleRemove(bc)} activeOpacity={0.7}>
                      <Trash2 size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={[styles.addRow, { borderColor: G.border, backgroundColor: G.bg }]}>
                <TextInput
                  style={[styles.input, styles.addInput, { color: G.fg, backgroundColor: 'transparent' }]}
                  placeholder={t('inv.add_alt_barcode') || 'Scan or type another barcode...'}
                  placeholderTextColor={G.fgSecondary}
                  value={newBarcode}
                  onChangeText={setNewBarcode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={64}
                  onSubmitEditing={handleAdd}
                />
                <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={handleAdd} activeOpacity={0.85}>
                  <Plus size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const EditPen = () => {
  const { colors } = useSettings();
  const G = getInventoryGlass(colors);
  return (
    <View style={[styles.editPen, { borderColor: G.border }]}>
      <AppText variant="micro" weight="bold" style={{ color: G.fgSecondary }} numberOfLines={1}>
        EDIT
      </AppText>
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
    paddingBottom: 28,
    maxHeight: '88%',
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
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    letterSpacing: 1,
    fontFamily: Fonts.semibold,
    marginLeft: 2,
  },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Fonts.medium,
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  codeText: {
    flex: 1,
    fontFamily: Fonts.semibold,
    letterSpacing: 0.4,
  },
  editPen: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  primaryBadge: {
    fontSize: 10,
    borderRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 10,
    paddingRight: 6,
    minHeight: 52,
    gap: 8,
  },
  addInput: {
    flex: 1,
    minHeight: 48,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    gap: 8,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 10,
  },
  smallBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ManageBarcodesModal;
// Convert raw PNG bytes to base64 without Node's Buffer (RN-safe).
function pngBytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : chars[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : chars[b2 & 63];
  }
  return out;
}
