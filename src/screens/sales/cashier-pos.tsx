import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import {
  Barcode as BarcodeIcon,
  ChevronRight,
  Package,
  Search,
  ShoppingCart,
  Trash2,
  X,
  Zap,
} from 'lucide-react-native';

import { AppNumber, AppText } from '@/components/ui';
import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import ScanPanel from './scan-panel';
import { usePeripheralScan } from '@/hooks/usePeripherals';
import GlobalCheckout from './sale-form';
import { recordSaleBatch } from '@/services/saleService';
import { useDialog } from '@/context/DialogContext';
import { useToast } from '@/context/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getItems,
  getQuickProducts,
  getRecentSales,
} from '@/database/db';

/**
 * Cashier POS — a focused, minimal selling surface for the cashier role.
 *
 * Everything on this screen exists to complete a sale fast: search, scan,
 * quick products, cart, checkout, and today's receipts. No management
 * features. Reaches for the shared permission catalog so a custom role with
 * sales permissions can use it too, but nothing else.
 */

interface Props {
  onClose?: () => void;
}

type FlowStep = 'home' | 'scan' | 'checkout';

const CashierPOS: React.FC<Props> = ({ onClose }) => {
  const { colors, t } = useSettings();
  const dialog = useDialog();
  const toast = useToast();
  const perms = usePermissions();

  const G = {
    bg: colors.background,
    fg: colors.text,
    muted: colors.textSecondary,
    card: colors.card,
    border: colors.border,
    accent: colors.primary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  };

  const [step, setStep] = useState<FlowStep>('home');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [quickProducts, setQuickProducts] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [registerBarcode, setRegisterBarcode] = useState<string | null>(null);

  const loadProducts = useCallback(() => {
    try {
      setQuickProducts(getQuickProducts());
    } catch {
      setQuickProducts([]);
    }
  }, []);

  const loadRecent = useCallback(() => {
    try {
      const rows = getRecentSales(8) as any[];
      const today = new Date().toISOString().split('T')[0];
      setRecent(rows.filter((r) => String(r.createdAt || '').startsWith(today)));
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadRecent();
  }, [loadProducts, loadRecent]);

  // Hardware scanners (USB/Bluetooth HID) feed the cart directly.
  usePeripheralScan({
    onProduct: (item: unknown) => addToCart(item as any),
  });

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    try {
      return (getItems(true) as any[])
        .filter(
          (i) =>
            i.name?.toLowerCase().includes(q) ||
            i.sku?.toLowerCase().includes(q) ||
            i.barcode?.toLowerCase().includes(q) ||
            i.categoryName?.toLowerCase().includes(q),
        )
        .slice(0, 12);
    } catch {
      return [];
    }
  }, [search]);

  const addToCart = useCallback((item: any) => {
    if (!item?.id) return;
    if ((item.totalBaseQuantity ?? 0) <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        if ((existing.quantity ?? 0) + 1 > (item.totalBaseQuantity ?? 0)) return prev;
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: (c.quantity || 0) + 1 } : c,
        );
      }
      return [...prev, { ...item, id: item.id, quantity: 1, unitType: 'base' }];
    });
  }, []);

  const removeFromCart = useCallback((id: any) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (sum, c) => sum + (parseFloat(c.baseSellingPrice) || 0) * (c.quantity || 0),
        0,
      ),
    [cart],
  );
  const cartCount = cart.reduce((n, c) => n + (c.quantity || 0), 0);

  const handleScanFound = useCallback(
    (item: any) => {
      if (item) addToCart(item);
    },
    [addToCart],
  );

  const todayRevenue = useMemo(
    () => recent.reduce((s, r) => s + (r.totalPrice || 0), 0),
    [recent],
  );

  const canSell = perms.canSell;

  // ─── Scan step ───
  if (step === 'scan') {
    return (
      <ScanPanel
        quickProducts={quickProducts}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onAddProduct={(p: any) => {
          addToCart(p);
          setStep('home');
        }}
        onOpenSearch={() => setStep('home')}
        onViewCart={() => {
          setStep('home');
          setShowCart(true);
        }}
        onRegisterProduct={(code: string) => {
          setStep('home');
          setRegisterBarcode(code);
        }}
        onClose={() => setStep('home')}
      />
    );
  }

  // ─── Checkout step ───
  if (step === 'checkout') {
    return (
      <GlobalCheckout
        cart={cart}
        onAddItem={(item: any) => addToCart(item)}
        onUpdateItem={(id: any, updates: any) =>
          setCart((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
        }
        onRemoveItem={(id: any) => removeFromCart(id)}
        onBack={() => setStep('home')}
        onFinish={async (_saleMetadata: any) => {
          try {
            await recordSaleBatch(cart, _saleMetadata);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCart([]);
            setStep('home');
            loadRecent();
            loadProducts();
          } catch (e) {
            dialog.alert({
              title: t('common.error'),
              message: t('sale.save_error'),
              iconType: 'warning',
            });
          }
        }}
      />
    );
  }

  // ─── Home ───
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="title" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
            {t('screen.new_sale')}
          </AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
            {t('sale.pos_home_title')}
          </AppText>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={[styles.iconBtn, { backgroundColor: G.card }]}>
            <X size={20} color={G.fg} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              loadProducts();
              loadRecent();
              setRefreshing(false);
            }}
          />
        }
      >
        {/* Search row */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: G.card, borderColor: G.border }]}>
            <Search size={18} color={G.muted} />
            <TextInput
              style={[styles.searchInput, { color: G.fg }]}
              placeholder={t('sale.search_placeholder')}
              placeholderTextColor={G.muted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color={G.muted} />
              </TouchableOpacity>
            )}
          </View>
          {canSell && (
            <TouchableOpacity
              style={[styles.scanBtn, { backgroundColor: G.accent }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setStep('scan');
              }}
            >
              <BarcodeIcon size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Search results */}
        {search.trim().length > 0 && (
          <View style={styles.resultsBlock}>
            {results.length === 0 ? (
              <AppText variant="body-sm" weight="medium" style={{ color: G.muted, padding: Spacing.md }}>
                {t('sale.no_results')}
              </AppText>
            ) : (
              results.map((item) => {
                const out = (item.totalBaseQuantity ?? 0) <= 0;
                return (
                  <TouchableOpacity
                    key={String(item.id)}
                    disabled={out}
                    onPress={() => addToCart(item)}
                    style={[styles.resultRow, { backgroundColor: G.card, borderColor: G.border, opacity: out ? 0.5 : 1 }]}
                  >
                    <View style={[styles.resultIcon, { backgroundColor: G.accent + '14' }]}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                      ) : (
                        <Package size={18} color={G.accent} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="body" weight="semibold" style={{ color: G.fg }} numberOfLines={1}>
                        {item.name}
                      </AppText>
                      <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                        {out ? t('inventory.out_of_stock') : `${item.totalBaseQuantity ?? 0} ${item.baseUnit || ''} ${t('sale.stock_hint')}`}
                      </AppText>
                    </View>
                    <AppNumber
                      value={parseFloat(item.baseSellingPrice) || 0}
                      size="body"
                      weight="bold"
                      suffix={` ${t('common.etb')}`}
                      color={G.fg}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Quick products */}
        {quickProducts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Zap size={15} color={G.accent} />
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1.2 }}>
                {t('sale.quick_products')}
              </AppText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {quickProducts.map((item) => {
                const out = (item.totalBaseQuantity ?? 0) <= 0;
                return (
                  <TouchableOpacity
                    key={`q-${item.id}`}
                    disabled={out}
                    onPress={() => addToCart(item)}
                    style={[styles.quickCard, { backgroundColor: G.card, borderColor: G.border, opacity: out ? 0.5 : 1 }]}
                  >
                    <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={2}>
                      {item.name}
                    </AppText>
                    <AppNumber
                      value={parseFloat(item.baseSellingPrice) || 0}
                      size="caption"
                      weight="bold"
                      suffix={` ${t('common.etb')}`}
                      color={G.accent}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Today's sales */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <ShoppingCart size={15} color={G.accent} />
            <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1.2 }}>
              {t('sales.recent_sales')}
            </AppText>
            <View style={{ flex: 1 }} />
            <AppNumber
              value={todayRevenue}
              size="caption"
              weight="bold"
              suffix={` ${t('common.etb')}`}
              color={G.success}
            />
          </View>
          {recent.length === 0 ? (
            <AppText variant="body-sm" weight="medium" style={{ color: G.muted, paddingVertical: 8 }}>
              {t('sales.no_sales')}
            </AppText>
          ) : (
            recent.slice(0, 5).map((s) => (
              <View key={`r-${s.id}`} style={[styles.recentRow, { backgroundColor: G.card, borderColor: G.border }]}>
                <View style={[styles.resultIcon, { backgroundColor: G.success + '14' }]}>
                  {s.image ? (
                    <Image source={{ uri: s.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                  ) : (
                    <Package size={16} color={G.success} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="body-sm" weight="semibold" style={{ color: G.fg }} numberOfLines={1}>
                    {s.itemName || t('common.unknown_item')}
                  </AppText>
                  <AppText variant="micro" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                    {(s.createdAt || '').split('T')[1]?.slice(0, 5) || ''} · {s.paymentStatus || ''}
                  </AppText>
                </View>
                <AppNumber
                  value={s.totalPrice || 0}
                  size="caption"
                  weight="bold"
                  suffix={` ${t('common.etb')}`}
                  color={G.success}
                />
              </View>
            ))
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Cart dock */}
      {cartCount > 0 && canSell && (
        <Animated.View entering={FadeInDown.springify()} exiting={FadeOut} style={styles.cartDock}>
          <TouchableOpacity
            style={[styles.cartBar, { backgroundColor: G.fg }]}
            onPress={() => setShowCart(true)}
            activeOpacity={0.9}
          >
            <View style={styles.cartBadge}>
              <AppText variant="caption" weight="bold" style={{ color: G.bg }}>
                {cartCount}
              </AppText>
            </View>
            <AppText variant="body" weight="bold" style={{ color: G.bg, flex: 1 }} numberOfLines={1}>
              {t('sale.view_cart')}
            </AppText>
            <AppNumber
              value={cartTotal}
              size="body"
              weight="bold"
              suffix={` ${t('common.etb')}`}
              color={G.bg}
            />
            <ChevronRight size={18} color={G.bg} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Cart sheet */}
      <Modal visible={showCart} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheet, { backgroundColor: G.bg }]}>
            <View style={[styles.sheetHandle, { backgroundColor: G.border }]} />
            <View style={styles.sheetHeader}>
              <AppText variant="title" weight="bold" style={{ color: G.fg }}>
                {t('sale.cart_title')}
              </AppText>
              <TouchableOpacity onPress={() => setShowCart(false)} style={[styles.iconBtn, { backgroundColor: G.card }]}>
                <X size={18} color={G.fg} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
              {cart.length === 0 ? (
                <AppText variant="body" weight="medium" style={{ color: G.muted, textAlign: 'center', paddingVertical: 30 }}>
                  {t('sale.empty_cart_hint')}
                </AppText>
              ) : (
                cart.map((c) => (
                  <View key={`c-${c.id}`} style={[styles.cartRow, { backgroundColor: G.card, borderColor: G.border }]}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="body" weight="semibold" style={{ color: G.fg }} numberOfLines={1}>
                        {c.name}
                      </AppText>
                      <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                        {c.quantity} × {parseFloat(c.baseSellingPrice) || 0} {t('common.etb')}
                      </AppText>
                    </View>
                    <View style={styles.qtyRow}>
                      <TouchableOpacity
                        style={[styles.qtyBtn, { backgroundColor: G.border + '40' }]}
                        onPress={() =>
                          setCart((prev) =>
                            prev
                              .map((x) =>
                                x.id === c.id ? { ...x, quantity: (x.quantity || 0) - 1 } : x,
                              )
                              .filter((x) => (x.quantity || 0) > 0),
                          )
                        }
                      >
                        <AppText variant="body" weight="bold" style={{ color: G.fg }}>−</AppText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.qtyBtn, { backgroundColor: G.accent + '20' }]}
                        onPress={() => addToCart(c)}
                      >
                        <AppText variant="body" weight="bold" style={{ color: G.accent }}>+</AppText>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => removeFromCart(c.id)} style={styles.trashBtn}>
                      <Trash2 size={16} color={G.error} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            {cart.length > 0 && (
              <TouchableOpacity
                style={[styles.checkoutBtn, { backgroundColor: G.accent }]}
                onPress={() => {
                  setShowCart(false);
                  setStep('checkout');
                }}
              >
                <AppText variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
                  {t('sale.pay')} · {cartTotal.toFixed(2)} {t('common.etb')}
                </AppText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: { flex: 1, fontFamily: Fonts.medium, fontSize: 14, paddingVertical: 0 },
  scanBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsBlock: { marginTop: 10, gap: 6 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: 10,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  quickCard: {
    width: 128,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: 12,
    gap: 6,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: 10,
    marginBottom: 6,
  },
  cartDock: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 110,
  },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 56,
  },
  cartBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: 10,
  },
  qtyRow: { flexDirection: 'row', gap: 6 },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashBtn: { paddingHorizontal: 6 },
  checkoutBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
});

export default CashierPOS;
