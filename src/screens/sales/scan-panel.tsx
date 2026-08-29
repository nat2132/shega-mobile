import BarcodeScannerView, { BarcodeScanResult } from '@/components/BarcodeScanner';
import { AppNumber, AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useBarcodeScanner, ScannedProduct } from '@/hooks/useBarcodeScanner';
import { Check, Package, Search, ShoppingCart, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, Layout } from 'react-native-reanimated';
import { getSalesGlass } from './glass-sales';

interface ScanPanelProps {
  quickProducts: any[];
  cartCount: number;
  cartTotal: number;
  onAddProduct: (item: any) => void;
  onOpenSearch: () => void;
  onViewCart: () => void;
  onRegisterProduct: (barcode: string) => void;
  onClose: () => void;
}

const ScanPanel: React.FC<ScanPanelProps> = ({
  quickProducts,
  cartCount,
  cartTotal,
  onAddProduct,
  onOpenSearch,
  onViewCart,
  onRegisterProduct,
  onClose,
}) => {
  const { colors, t } = useSettings();
  const SALES_GLASS = getSalesGlass(colors);

  const [miss, setMiss] = useState<{ barcode: string; at: number } | null>(null);
  const [lastAdded, setLastAdded] = useState<ScannedProduct | null>(null);
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scanner = useBarcodeScanner({
    cooldownMs: 0,
    duplicateWindowMs: 0,
    maxDuplicateScans: 9999,
    enableSound: true,
    enableHaptics: true,
  });

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    };
  }, []);

  const flashAdded = useCallback((product: ScannedProduct) => {
    setLastAdded(product);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    addedTimerRef.current = setTimeout(() => setLastAdded(null), 1400);
  }, []);

  const handleScan = useCallback(
    async (result: BarcodeScanResult) => {
      const product = await scanner.scanBarcode(result.barcode, result.type);
      if (product) {
        setMiss(null);
        flashAdded(product);
        onAddProduct(product);
      } else {
        setMiss({ barcode: result.barcode, at: Date.now() });
      }
    },
    [scanner, flashAdded, onAddProduct],
  );

  const handleQuickProduct = useCallback(
    (item: any) => {
      flashAdded(item);
      onAddProduct(item);
    },
    [flashAdded, onAddProduct],
  );

  return (
    <View style={[styles.container, { backgroundColor: 'black' }]}>
      {/* Camera scanner (silent; feedback is driven by useBarcodeScanner) */}
      <View style={StyleSheet.absoluteFill}>
        <BarcodeScannerView
          onScan={handleScan}
          onClose={onClose}
          onManualEntry={() => onOpenSearch()}
          silent
        />
      </View>

      {/* Custom header overlay */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onClose} activeOpacity={0.7}>
          <X size={22} color="#fff" />
        </TouchableOpacity>
        <AppText variant="caption" weight="bold" transform="uppercase" style={styles.headerTitle} numberOfLines={1}>
          {t('barcode.scanning') || 'SCAN BARCODE'}
        </AppText>
        <TouchableOpacity style={styles.headerBtn} onPress={onOpenSearch} activeOpacity={0.7}>
          <Search size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Added feedback toast */}
      {lastAdded && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.addedToast} pointerEvents="none">
          <View style={[styles.addedIcon, { backgroundColor: '#22C55E' }]}>
            <Check size={14} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
              {lastAdded.name}
            </AppText>
            <AppText variant="micro" weight="medium" style={{ color: 'rgba(255,255,255,0.7)' }} numberOfLines={1}>
              {t('sale.added_to_cart') || 'Added to cart'}
            </AppText>
          </View>
        </Animated.View>
      )}

      {/* Not-found banner */}
      {miss && (
        <Animated.View entering={FadeInDown.duration(300)} layout={Layout} style={styles.missCard}>
          <AppText variant="body" weight="bold" style={[styles.missBarcode, { color: SALES_GLASS.fg }]} numberOfLines={1}>
            {t('sale.barcode_not_found') || 'Barcode not found'}
          </AppText>
          <AppText variant="caption" style={{ color: SALES_GLASS.fgSecondary }} numberOfLines={1}>
            #{miss.barcode}
          </AppText>
          <View style={styles.missActions}>
            <TouchableOpacity
              style={[styles.missBtn, { backgroundColor: colors.primary }]}
              onPress={() => onRegisterProduct(miss.barcode)}
              activeOpacity={0.8}
            >
              <AppText variant="body-sm" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
                {t('sale.register_product') || 'Register Product'}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.missBtn, { backgroundColor: SALES_GLASS.bgCard, borderWidth: 1, borderColor: SALES_GLASS.border }]}
              onPress={onOpenSearch}
              activeOpacity={0.8}
            >
              <AppText variant="body-sm" weight="bold" style={{ color: SALES_GLASS.fg }} numberOfLines={1}>
                {t('common.search') || 'Search'}
              </AppText>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Quick products + cart summary */}
      <View style={styles.bottomArea} pointerEvents="box-none">
        {quickProducts.length > 0 && (
          <View style={styles.quickWrap}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.quickLabel, { color: 'rgba(255,255,255,0.6)' }]} numberOfLines={1}>
              {t('sale.quick_products') || 'Quick Products'}
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickList}>
              {quickProducts.map((item: any) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.quickChip, { backgroundColor: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.15)' }]}
                  onPress={() => handleQuickProduct(item)}
                  activeOpacity={0.8}
                >
                  <Package size={14} color="#fff" style={{ marginRight: 6 }} />
                  <View style={{ flexShrink: 1 }}>
                    <AppText variant="micro" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
                      {item.name}
                    </AppText>
                    <AppNumber value={item.baseSellingPrice} fallback="0" size="micro" style={{ color: '#fff', opacity: 0.8 }} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {cartCount > 0 && (
          <TouchableOpacity style={styles.cartBar} onPress={onViewCart} activeOpacity={0.9}>
            <View style={styles.cartLeft}>
              <View style={styles.cartIcon}>
                <ShoppingCart size={16} color="#fff" />
              </View>
              <AppText variant="body" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
                {cartCount} {cartCount === 1 ? (t('sale.item') || 'item') : (t('sale.items') || 'items')}
              </AppText>
            </View>
            <View style={styles.cartRight}>
              <AppNumber value={cartTotal} fallback="0" size="body" weight="bold" style={{ color: '#fff' }} />
              <View style={styles.cartCta}>
                <AppText variant="body-sm" weight="bold" style={{ color: colors.primary }}>
                  {t('sale.view_cart') || 'View Cart'}
                </AppText>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 30,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    letterSpacing: 1.5,
    fontFamily: Fonts.bold,
  },
  addedToast: {
    position: 'absolute',
    top: 64,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 40,
  },
  addedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  missCard: {
    position: 'absolute',
    top: 64,
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(20,20,20,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 40,
  },
  missBarcode: {
    fontFamily: Fonts.bold,
  },
  missActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  missBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    zIndex: 30,
  },
  quickWrap: {
    gap: 6,
  },
  quickLabel: {
    letterSpacing: 1.2,
    fontFamily: Fonts.semibold,
    marginLeft: 4,
  },
  quickList: {
    gap: 8,
    paddingBottom: 2,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 180,
  },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cartRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartCta: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 12,
  },
});

export default ScanPanel;