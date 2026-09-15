import { AppNumber, AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { searchInventory } from '@/database/db';
import { usePermissions } from '@/hooks/usePermissions';
import { Check, Package, ScanLine, Search, ShoppingCart, Star, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { getSalesGlass } from './glass-sales';

interface NewSaleScreenProps {
  quickProducts: any[];
  cartCount: number;
  cartTotal: number;
  onAddProduct: (item: any) => void;
  onOpenScanner: () => void;
  onPay: () => void;
  onClose: () => void;
}

const NewSaleScreen: React.FC<NewSaleScreenProps> = ({
  quickProducts,
  cartCount,
  cartTotal,
  onAddProduct,
  onOpenScanner,
  onPay,
  onClose,
}) => {
  const { colors, t } = useSettings();
  const SALES_GLASS = getSalesGlass(colors);
  const { canSell } = usePermissions();

  const [query, setQuery] = useState('');
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const addedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    try {
      return searchInventory(q);
    } catch (e) {
      console.error('Search error:', e);
      return [];
    }
  }, [query]);

  const flashAdded = useCallback((item: any) => {
    setLastAdded(item.id);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setLastAdded(null), 1200);
  }, []);

  React.useEffect(() => {
    return () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    };
  }, []);

  const addAndFlash = useCallback((item: any) => {
    if (!canSell) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flashAdded(item);
    onAddProduct(item);
  }, [canSell, flashAdded, onAddProduct]);

  return (
    <View style={[styles.container, { backgroundColor: SALES_GLASS.bg }]}>
      <View style={styles.header}>
        <View>
          <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: SALES_GLASS.fgSecondary, letterSpacing: 1.5 }} numberOfLines={1}>
            {t('screen.new_sale') || 'New Sale'}
          </AppText>
          <AppText variant="heading" weight="bold" style={{ color: SALES_GLASS.fg }} numberOfLines={1}>
            {t('sale.pos_home_title') || 'Add products'}
          </AppText>
        </View>
        <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: SALES_GLASS.border }]} activeOpacity={0.7}>
          <X size={20} color={SALES_GLASS.fg} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
          <Search size={18} color={SALES_GLASS.fgSecondary} />
          <TextInput
            style={[styles.searchInput, { color: SALES_GLASS.fg }]}
            placeholder={t('sale.search_placeholder') || 'Search product, SKU, barcode, category...'}
            placeholderTextColor={SALES_GLASS.fgSecondary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <X size={16} color={SALES_GLASS.fgSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Scan CTA */}
        <TouchableOpacity
          style={[styles.scanCta, { backgroundColor: colors.primary }]}
          onPress={onOpenScanner}
          activeOpacity={0.9}
        >
          <View style={[styles.scanIcon, { backgroundColor: '#ffffff22' }]}>
            <ScanLine size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
              {t('sale.scan_barcode') || 'SCAN BARCODE'}
            </AppText>
            <AppText variant="body-sm" weight="medium" style={{ color: 'rgba(255,255,255,0.8)' }} numberOfLines={1}>
              {t('sale.scan_barcode_sub') || 'Camera scans & adds to cart instantly'}
            </AppText>
          </View>
          <Check size={20} color="#fff" />
        </TouchableOpacity>

        {query.trim().length > 0 ? (
          <View style={styles.section}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>
              {t('sale.search_results') || 'Results'}
            </AppText>
            {results.length === 0 && (
              <View style={styles.emptyBox}>
                <Package size={34} color={SALES_GLASS.border} />
                <AppText variant="body-sm" weight="medium" align="center" style={{ color: SALES_GLASS.fgSecondary, marginTop: 8 }} numberOfLines={2}>
                  {t('inv.no_items_found') || 'No products found'}
                </AppText>
              </View>
            )}
            {results.map((item: any) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.resultRow, { backgroundColor: lastAdded === item.id ? colors.success + '12' : SALES_GLASS.bgCard, borderColor: lastAdded === item.id ? colors.success + '40' : SALES_GLASS.border }]}
                onPress={() => addAndFlash(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.resultIcon, { backgroundColor: colors.primary + '15' }]}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                  ) : (
                    <Package size={18} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="bold" style={{ color: SALES_GLASS.fg }} numberOfLines={1}>{item.name}</AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <AppNumber value={item.baseSellingPrice} prefix={t('common.etb') + ' '} size="caption" />
                    <AppText variant="caption" weight="medium" style={{ color: SALES_GLASS.fgSecondary }} numberOfLines={1}>
                      {'  •  '}{t('inventory.stock') || 'Stock'}: <AppNumber value={item.totalBaseQuantity} fallback="0" size="caption" />
                    </AppText>
                  </View>
                </View>
                {lastAdded === item.id && <Check size={18} color={colors.success} />}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.quickHeader}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>
                {t('sale.quick_products') || 'Quick Products'}
              </AppText>
              {quickProducts.length > 0 && (
                <Star size={13} color={SALES_GLASS.fgSecondary} />
              )}
            </View>
            {quickProducts.length === 0 ? (
              <View style={styles.emptyBox}>
                <Star size={30} color={SALES_GLASS.border} />
                <AppText variant="body-sm" weight="medium" align="center" style={{ color: SALES_GLASS.fgSecondary, marginTop: 8 }} numberOfLines={2}>
                  {t('sale.no_quick_hint') || 'Tap the star in Inventory → Barcodes to pin frequent items here for one-tap selling.'}
                </AppText>
              </View>
            ) : (
              <View style={styles.quickGrid}>
                {quickProducts.map((item: any) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.quickCard, { backgroundColor: lastAdded === item.id ? colors.success + '12' : SALES_GLASS.bgCard, borderColor: lastAdded === item.id ? colors.success + '40' : SALES_GLASS.border }]}
                    onPress={() => addAndFlash(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.quickIcon, { backgroundColor: colors.primary + '15' }]}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                      ) : (
                        <Package size={18} color={colors.primary} />
                      )}
                    </View>
                    <AppText variant="body" weight="bold" style={[styles.quickName, { color: SALES_GLASS.fg }]} numberOfLines={1}>
                      {item.name}
                    </AppText>
                    <AppNumber value={item.baseSellingPrice} prefix={t('common.etb') + ' '} size="caption" style={{ color: SALES_GLASS.fgSecondary }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Cart summary + PAY */}
      {cartCount > 0 && (
        <View style={[styles.payBar, { borderColor: SALES_GLASS.border, backgroundColor: SALES_GLASS.bgCard }]}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" weight="medium" style={{ color: SALES_GLASS.fgSecondary }} numberOfLines={1}>
              {cartCount} {cartCount === 1 ? (t('sale.item') || 'item') : (t('sale.items') || 'items')}
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppText variant="caption" weight="bold" transform="uppercase" style={{ color: SALES_GLASS.fgSecondary }} numberOfLines={1}>
                {t('common.total') || 'Total'}
              </AppText>
              <AppNumber value={cartTotal} fallback="0" size="title" weight="bold" style={{ color: SALES_GLASS.fg }} />
            </View>
          </View>
          <TouchableOpacity
            style={{ height: 52, paddingHorizontal: 24, borderRadius: 16, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onPress={onPay}
            activeOpacity={0.85}
          >
            <ShoppingCart size={18} color="#fff" />
            <AppText variant="body" weight="bold" shrink={false} style={{ color: '#fff' }} numberOfLines={1}>
              {t('sale.pay') || 'PAY'}
            </AppText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.medium,
  },
  scanCta: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  scanIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    letterSpacing: 1,
    fontFamily: Fonts.semibold,
    marginLeft: 2,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickName: {
    fontFamily: Fonts.bold,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    padding: 24,
    alignItems: 'center',
  },
  payBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
});

export default NewSaleScreen;