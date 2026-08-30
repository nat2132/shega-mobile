import BarcodeScannerView, { BarcodeScanResult } from '@/components/BarcodeScanner';
import { AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { getItemByBarcode } from '@/database/db';
import { usePermissions } from '@/hooks/usePermissions';
import { Barcode as BarcodeIcon, Package, Plus, RefreshCw, Search, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { getSalesGlass } from '@/screens/sales/glass-sales';

interface InventoryScannerSheetProps {
  visible: boolean;
  onClose: () => void;
  onFound: (item: any, barcode: string) => void;
  onSearchExisting: () => void;
  onRegister: (barcode: string) => void;
}

const InventoryScannerSheet: React.FC<InventoryScannerSheetProps> = ({
  visible,
  onClose,
  onFound,
  onSearchExisting,
  onRegister,
}) => {
  const { colors, t } = useSettings();
  const SALES_GLASS = getSalesGlass(colors);
  const { canAdjustStock, canManageCatalog } = usePermissions();

  const [miss, setMiss] = useState<string | null>(null);

  const handleBarcode = useCallback(async (result: BarcodeScanResult) => {
    const product = await getItemByBarcode(result.barcode, true);
    if (product) {
      setMiss(null);
      onFound(product, result.barcode);
    } else {
      setMiss(result.barcode);
    }
  }, [onFound]);

  const reset = useCallback(() => {
    setMiss(null);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            reset();
            onClose();
          }}
        />
        <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOut.duration(150)} style={[styles.sheet, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: colors.primary + '18' }]}>
              <BarcodeIcon size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading" weight="bold" style={{ color: SALES_GLASS.fg }} numberOfLines={1}>
                {t('inventory.scan_barcode') || 'Scan Barcode'}
              </AppText>
              <AppText variant="caption" style={{ color: SALES_GLASS.fgSecondary }} numberOfLines={2}>
                {t('inventory.scan_barcode_hint') || 'Point the camera at the products barcode.'}
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={SALES_GLASS.fgSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.cameraBox}>
            <BarcodeScannerView onScan={handleBarcode} onClose={onClose} onManualEntry={onSearchExisting} silent showTopBar={false} />
            <View pointerEvents="none" style={styles.scanFrame}>
              <View style={[styles.scanFrameInner, { borderColor: 'rgba(255,255,255,0.7)' }]} />
            </View>
          </View>

          <View style={styles.body}>
            {miss ? (
              <Animated.View entering={FadeInDown} key={miss} style={[styles.missCard, { borderColor: colors.error + '30', backgroundColor: colors.error + '08' }]}>
                <AppText variant="body" weight="bold" style={{ color: SALES_GLASS.fg }} numberOfLines={1}>
                  {t('sale.barcode_not_found') || 'Barcode not found'}
                </AppText>
                <AppText variant="caption" weight="medium" style={[styles.mono, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>
                  #{miss}
                </AppText>
                <View style={styles.missActions}>
                  {canManageCatalog && (
                    <TouchableOpacity
                      style={[styles.missBtn, { backgroundColor: colors.primary }]}
                      onPress={() => onRegister(miss)}
                      activeOpacity={0.85}
                    >
                      <Plus size={16} color="#fff" style={{ marginRight: 6 }} />
                      <AppText variant="body-sm" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
                        {t('sale.register_product') || 'Register Product'}
                      </AppText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.missBtn, { backgroundColor: SALES_GLASS.bg, borderWidth: 1, borderColor: SALES_GLASS.border }]}
                    onPress={onSearchExisting}
                    activeOpacity={0.85}
                  >
                    <Search size={16} color={SALES_GLASS.fg} style={{ marginRight: 6 }} />
                    <AppText variant="body-sm" weight="bold" style={{ color: SALES_GLASS.fg }} numberOfLines={1}>
                      {t('common.search') || 'Search existing'}
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.missBtn, styles.missBtnGhost]} onPress={() => setMiss(null)} activeOpacity={0.85}>
                    <RefreshCw size={16} color={SALES_GLASS.fgSecondary} style={{ marginRight: 6 }} />
                    <AppText variant="body-sm" weight="bold" style={{ color: SALES_GLASS.fgSecondary }} numberOfLines={1}>
                      {t('common.retry') || 'Keep scanning'}
                    </AppText>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ) : (
              <View style={[styles.hintCard, { borderColor: SALES_GLASS.border }]}>
                <Package size={30} color={SALES_GLASS.fgSecondary} />
                <AppText variant="body-sm" weight="medium" align="center" style={{ color: SALES_GLASS.fgSecondary, marginTop: 8, marginBottom: 2 }} numberOfLines={2}>
                  {t('inventory.scan_to_restock_hint') || 'Scan an existing barcode to add stock to that product. Unknown barcodes can be registered as new products.'}
                </AppText>
                {!canAdjustStock && (
                  <AppText variant="micro" weight="bold" align="center" style={{ color: colors.warning, marginTop: 4 }} numberOfLines={2}>
                    {t('inventory.no_stock_permission') || 'You can scan to view, but stock adjustments are restricted to your role.'}
                  </AppText>
                )}
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
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
  cameraBox: {
    height: 220,
    marginHorizontal: 20,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  scanFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrameInner: {
    width: 180,
    height: 90,
    borderRadius: 12,
    borderWidth: 2,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 10,
  },
  missCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  missActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  missBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  missBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  hintCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
  },
  mono: {
    fontFamily: Fonts.semibold,
    letterSpacing: 0.5,
  },
});

export default InventoryScannerSheet;