import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '@/context/SettingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useDialog } from '@/context/DialogContext';
import { useToast } from '@/context/ToastContext';
import { useDataChangedRefresh } from '@/hooks/useDataChangedRefresh';
import { getSuppliersGlass } from './glass-suppliers';
import { Fonts } from '@/constants/theme';
import {
  getSupplierById,
  getSupplierPurchases,
  getSupplierProducts,
  getSupplierPayments,
  getSupplierOrders,
  getItems,
  insertSupplierPayment,
  insertSupplierOrder,
  deleteSupplierOrder,
  SupplierOrderRow,
  SupplierOrderItem,
} from '@/database/db';
import { generateSupplierOrderPDF } from '@/utils/pdf-utils';
import { AppText, AppCard, AppNumber } from '@/components/ui';
import { formatDate, parseLocalDate } from '@/utils/date-utils';
import SupplierForm from './supplier-form';
import * as Haptics from 'expo-haptics';
import { playNice, playBad } from '@/services/soundService';
import {
  ArrowLeft,
  Bookmark,
  ClipboardList,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  Minus,
  Package,
  Pencil,
  PhoneCall,
  Plus,
  ShoppingCart,
  Trash2,
  Truck,
  Wallet,
  X,
} from 'lucide-react-native';

type TabKey = 'overview' | 'purchases' | 'products' | 'payments' | 'orders';

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function fmtDate(str: string | null | undefined, calendarType: 'ethiopian' | 'gregorian', language: string) {
  if (!str) return '—';
  const d = parseLocalDate(str);
  if (!d) return str;
  return formatDate(d, calendarType, language);
}

export default function SupplierDetails({
  supplierId,
  onClose,
}: {
  supplierId: number;
  onClose: () => void;
}) {
  const { colors, t, calendarType, language, userProfile } = useSettings();
  const { isReadOnly } = useSubscription();
  const G = getSuppliersGlass(colors);
  const dialog = useDialog();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const compactStats = width < 370;

  const [supplier, setSupplier] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [orders, setOrders] = useState<SupplierOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('overview');
  const [showForm, setShowForm] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNote, setPayNote] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  // Product order editor state
  const [showOrderEditor, setShowOrderEditor] = useState(false);
  const [draftItems, setDraftItems] = useState<SupplierOrderItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [exportingOrder, setExportingOrder] = useState(false);

  // Add-item picker state
  const [inventory, setInventory] = useState<any[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState('pcs');

  const load = useCallback(() => {
    const s = getSupplierById(supplierId);
    setSupplier(s);
    setPurchases(getSupplierPurchases(supplierId));
    setProducts(getSupplierProducts(supplierId));
    setPayments(getSupplierPayments(supplierId));
    setOrders(getSupplierOrders(supplierId));
    setInventory(getItems());
    setLoading(false);
  }, [supplierId]);

  useEffect(() => { load(); }, [load]);
  useDataChangedRefresh(load);

  const handleSavePayment = async () => {
    if (isReadOnly) {
      await dialog.alert({ title: t('common.read_only_mode'), message: t('common.read_only_mode'), iconType: 'warning' });
      return;
    }
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      playBad();
      await dialog.alert({ title: t('common.error'), message: t('suppliers.payment_invalid'), iconType: 'danger' });
      return;
    }
    setSavingPay(true);
    try {
      await insertSupplierPayment({
        supplierId,
        amount,
        method: payMethod,
        note: payNote.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playNice();
      setShowPayment(false);
      setPayAmount('');
      setPayNote('');
      load();
    } catch {
      playBad();
      await dialog.alert({ title: t('common.error'), message: t('suppliers.payment_save_error'), iconType: 'danger' });
    } finally {
      setSavingPay(false);
    }
  };

  // ─── Product orders ─────────────────────────────────────────────────────

  const openNewOrder = () => {
    if (products.length === 0) return;
    const draft: SupplierOrderItem[] = products.map((p) => ({
      itemId: p.id,
      name: p.name,
      unit: p.baseUnit || 'pcs',
      currentStock: p.currentStock || 0,
      quantity: 1,
      price: p.lastPurchasePrice || 0,
    }));
    setDraftItems(draft);
    setOrderNotes('');
    setShowOrderEditor(true);
  };

  const updateDraftItem = (index: number, patch: Partial<SupplierOrderItem>) => {
    setDraftItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeDraftItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Inventory items that aren't already in the draft, optionally filtered by search.
  const addableItems = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    const draftIds = new Set(draftItems.map((d) => d.itemId).filter((id): id is number => !!id));
    return inventory.filter((it) => {
      if (draftIds.has(it.id)) return false;
      if (!q) return true;
      return (it.name || '').toLowerCase().includes(q) || (it.companyName || '').toLowerCase().includes(q);
    });
  }, [inventory, addSearch, draftItems]);

  const openAddItem = () => {
    setAddSearch('');
    setCustomName('');
    setCustomUnit('pcs');
    setShowAddItem(true);
  };

  const addInventoryItem = (item: any) => {
    Haptics.selectionAsync();
    setDraftItems((prev) => [
      ...prev,
      {
        itemId: item.id,
        name: item.name,
        unit: item.baseUnit || 'pcs',
        currentStock: item.totalBaseQuantity || 0,
        quantity: 1,
        price: item.basePurchasePrice || 0,
      },
    ]);
    setAddSearch('');
    setShowAddItem(false);
  };

  const addCustomItem = async () => {
    const name = customName.trim();
    if (!name) {
      playBad();
      await dialog.alert({ title: t('common.error'), message: t('suppliers.item_name_required'), iconType: 'danger' });
      return;
    }
    Haptics.selectionAsync();
    setDraftItems((prev) => [
      ...prev,
      {
        itemId: null,
        name,
        unit: customUnit.trim() || 'pcs',
        currentStock: 0,
        quantity: 1,
        price: 0,
      },
    ]);
    setCustomName('');
    setCustomUnit('pcs');
    setShowAddItem(false);
  };

  const draftTotal = draftItems.reduce((sum, it) => sum + (it.quantity || 0) * (it.price || 0), 0);

  const saveOrder = async () => {
    if (isReadOnly) {
      await dialog.alert({ title: t('common.read_only_mode'), message: t('common.read_only_mode'), iconType: 'warning' });
      return;
    }
    const valid = draftItems.filter((it) => (it.quantity || 0) > 0);
    if (valid.length === 0) {
      playBad();
      await dialog.alert({ title: t('common.error'), message: t('suppliers.order_empty'), iconType: 'danger' });
      return;
    }
    setSavingOrder(true);
    try {
      const res = insertSupplierOrder({ supplierId, items: valid, notes: orderNotes });
      if (!res) throw new Error('Insert failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playNice();
      setShowOrderEditor(false);
      load();
      showToast({ title: t('suppliers.order_saved'), message: t('suppliers.order_saved_desc'), type: 'success' });
    } catch {
      playBad();
      await dialog.alert({ title: t('common.error'), message: t('suppliers.order_save_error'), iconType: 'danger' });
    } finally {
      setSavingOrder(false);
    }
  };

  const exportOrderPdf = async (
    items: SupplierOrderItem[],
    opts: { orderNumber?: string; notes?: string | null; createdAt?: string | null; total?: number } = {},
  ) => {
    if (exportingOrder || items.length === 0) return;

    const buildOrder = () => ({
      orderNumber: opts.orderNumber,
      supplier: {
        fullName: supplier?.fullName,
        companyName: supplier?.companyName,
        phone: supplier?.phone,
        address: supplier?.address,
      },
      items,
      totalAmount: opts.total ?? items.reduce((s, it) => s + (it.quantity || 0) * (it.price || 0), 0),
      notes: opts.notes,
      createdAt: opts.createdAt,
    });

    const runExport = async (action: 'share' | 'save') => {
      setExportingOrder(true);
      try {
        const ok = await generateSupplierOrderPDF(
          buildOrder(),
          { businessName: userProfile.businessName, storeName: '' },
          language,
          action,
          calendarType === 'ethiopian' ? 'ethiopian' : 'device',
        );
        if (ok) {
          playNice();
          showToast({ title: t('suppliers.exported'), message: t('suppliers.exported_desc'), type: 'success' });
        } else {
          showToast(t('suppliers.export_failed'), 'error');
        }
      } catch {
        showToast(t('suppliers.export_failed'), 'error');
      } finally {
        setExportingOrder(false);
      }
    };

    await dialog.choose({
      title: t('suppliers.export_pdf'),
      message: '',
      cancelText: t('common.cancel'),
      choices: [
        { label: t('common.share_pdf'), onPress: () => runExport('share') },
        { label: t('common.save_device'), onPress: () => runExport('save') },
      ],
    });
  };

  const handleDeleteOrder = async (order: SupplierOrderRow) => {
    if (isReadOnly) {
      await dialog.alert({ title: t('common.read_only_mode'), message: t('common.read_only_mode'), iconType: 'warning' });
      return;
    }
    const ok = await dialog.confirm({
      title: t('suppliers.order_delete_confirm'),
      message: order.orderNumber,
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      iconType: 'danger',
      destructive: true,
    });
    if (!ok) return;
    deleteSupplierOrder(order.id);
    load();
    playNice();
    showToast({ title: t('suppliers.order_deleted'), message: t('suppliers.order_deleted_desc'), type: 'success' });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
        <ActivityIndicator color={G.fg} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!supplier) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
        <TouchableOpacity onPress={onClose} style={[styles.headerBtn, { borderColor: G.border }]}>
          <ArrowLeft size={22} color={G.fg} />
        </TouchableOpacity>
        <AppText variant="title" weight="bold" align="center" style={{ color: G.muted, marginTop: 60 }} numberOfLines={2}>
          {t('suppliers.not_found')}
        </AppText>
      </SafeAreaView>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: t('suppliers.tab_overview') },
    { key: 'purchases', label: t('suppliers.tab_purchases') },
    { key: 'products', label: t('suppliers.tab_products') },
    { key: 'payments', label: t('suppliers.tab_payments') },
    { key: 'orders', label: t('suppliers.tab_orders') },
  ];

  const stats = [
    { label: t('suppliers.stat_purchases'), value: supplier.totalPurchases },
    { label: t('suppliers.stat_paid'), value: supplier.purchasePaid + supplier.paymentsSum },
    { label: t('suppliers.stat_outstanding'), value: supplier.outstanding, forceNeutral: true, negative: supplier.outstanding > 0 },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: -80, right: -60, width: 220, height: 220, borderRadius: 110 }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={[styles.headerBtn, { borderColor: G.border }]}>
          <ArrowLeft size={22} color={G.fg} />
        </TouchableOpacity>
        <AppText variant="title" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={1}>
          {t('suppliers.details_title')}
        </AppText>
        <TouchableOpacity onPress={() => setShowForm(true)} style={[styles.headerBtn, { borderColor: G.border }]}>
          <Pencil size={20} color={G.fg} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Identity card */}
        <AppCard padding={16} gap={10} radius={16} background={G.bgCard} bordered style={{ borderColor: G.border, alignItems: 'center' }}>
          <View style={[styles.avatar, { backgroundColor: colors.success + '22' }]}>
            <AppText variant="heading" weight="extrabold" shrink={false} style={{ color: colors.success }}>
              {getInitials(supplier.fullName)}
            </AppText>
          </View>
          <View style={{ alignItems: 'center', gap: 4, alignSelf: 'stretch' }}>
            <AppText variant="heading-lg" weight="bold" align="center" style={[styles.name, { color: G.fg }]} numberOfLines={2}>
              {supplier.fullName}
            </AppText>
            {supplier.companyName ? (
              <AppText variant="body" weight="medium" align="center" style={{ color: G.fgSecondary }} numberOfLines={2}>
                {supplier.companyName}
              </AppText>
            ) : null}
            <View style={styles.chipRow}>
              {supplier.isActive ? (
                <View style={[styles.tag, { backgroundColor: colors.success + '18' }]}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: colors.success }} numberOfLines={1}>
                    {t('suppliers.status_active')}
                  </AppText>
                </View>
              ) : (
                <View style={[styles.tag, { backgroundColor: colors.warning + '18' }]}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: colors.warning }} numberOfLines={1}>
                    {t('suppliers.status_inactive')}
                  </AppText>
                </View>
              )}
              {supplier.paymentType ? (
                <View style={[styles.tag, { backgroundColor: G.accentGlass }]}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.fgSecondary }} numberOfLines={1}>
                    {t('suppliers.payment_' + supplier.paymentType)}
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.actionRow}>
            {supplier.phone ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${supplier.phone}`)}
                style={[styles.actionBtn, { backgroundColor: G.accentGlassStrong }]}
                activeOpacity={0.75}
              >
                <PhoneCall size={16} color={G.fg} />
                <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: G.fg }} numberOfLines={1}>{t('dash.call')}</AppText>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => setShowPayment(true)}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.75}
            >
              <Wallet size={16} color={colors.background} />
              <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: colors.background }} numberOfLines={1}>{t('suppliers.record_payment')}</AppText>
            </TouchableOpacity>
          </View>
        </AppCard>

        {/* Stats — scale long values, stack on narrow screens */}
        <View style={[styles.statsRow, compactStats && styles.statsCol]}>
          {stats.map((s, idx) => (
            <View key={idx} style={[styles.statCard, compactStats && styles.statCardWide, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <AppNumber
                size="heading"
                weight="bold"
                value={s.value}
                showCurrency
                tabular={false}
                positive={s.forceNeutral ? false : undefined}
                negative={s.negative}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}
                style={[styles.statNumber, compactStats && styles.statNumberLeft]}
              />
              <AppText variant="caption" weight="medium" shrink={false} style={{ color: G.muted }} numberOfLines={1}>{s.label}</AppText>
            </View>
          ))}
        </View>

        {/* Tabs — horizontally scrollable so long labels stay visible */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {tabs.map((tb) => {
            const isActive = tab === tb.key;
            return (
              <TouchableOpacity
                key={tb.key}
                onPress={() => { Haptics.selectionAsync(); setTab(tb.key); }}
                style={[styles.tab, { backgroundColor: isActive ? G.fg : G.bgCard, borderColor: isActive ? G.fg : G.border }]}
                activeOpacity={0.75}
              >
                <AppText variant="caption" weight={isActive ? 'bold' : 'semibold'} shrink={false} style={{ color: isActive ? G.bg : G.muted }} numberOfLines={1}>
                  {tb.label}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {tab === 'overview' && (
          <View style={styles.section}>
            <InfoRow icon={<PhoneCall size={16} color={G.fgSecondary} />} label={t('suppliers.form_phone_label')} value={supplier.phone} />
            {supplier.alternatePhone ? <InfoRow icon={<PhoneCall size={16} color={G.fgSecondary} />} label={t('suppliers.form_alt_phone_label')} value={supplier.alternatePhone} /> : null}
            {supplier.email ? <InfoRow icon={<Mail size={16} color={G.fgSecondary} />} label={t('suppliers.form_email_label')} value={supplier.email} /> : null}
            {supplier.address ? <InfoRow icon={<MapPin size={16} color={G.fgSecondary} />} label={t('suppliers.form_address_label')} value={supplier.address} /> : null}
            {supplier.tin ? <InfoRow icon={<Bookmark size={16} color={G.fgSecondary} />} label={t('suppliers.form_tin_label')} value={supplier.tin} /> : null}
            {supplier.accountNumber ? <InfoRow icon={<CreditCard size={16} color={G.fgSecondary} />} label={t('suppliers.form_account_label')} value={supplier.accountNumber} /> : null}
            {supplier.supplierCategory ? <InfoRow icon={<Truck size={16} color={G.fgSecondary} />} label={t('suppliers.form_category_label')} value={supplier.supplierCategory} /> : null}
            {supplier.lastPurchaseDate ? (
              <InfoRow icon={<ShoppingCart size={16} color={G.fgSecondary} />} label={t('suppliers.last_purchase')} value={fmtDate(supplier.lastPurchaseDate, calendarType, language)} />
            ) : null}
            {supplier.notes ? <InfoRow icon={<Package size={16} color={G.fgSecondary} />} label={t('common.notes')} value={supplier.notes} /> : null}
            {!supplier.phone && !supplier.email && !supplier.address && !supplier.tin && !supplier.accountNumber && !supplier.notes ? (
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, paddingVertical: 20 }} numberOfLines={2}>
                {t('suppliers.no_details')}
              </AppText>
            ) : null}
          </View>
        )}

        {tab === 'purchases' && (
          <View style={styles.section}>
            {purchases.length === 0 ? (
              <EmptyBlock label={t('suppliers.no_purchases')} icon={<ShoppingCart size={28} color={G.muted} />} />
            ) : (
              purchases.map((p) => (
                <AppCard key={p.id} padding={13} gap={6} radius={14} background={G.bgCard} bordered style={{ borderColor: G.border, marginBottom: 8 }}>
                  <View style={styles.rowBetween}>
                    <AppText variant="body-sm" weight="bold" style={[styles.flexText, { color: G.fg }]} numberOfLines={2}>{p.itemName}</AppText>
                    <View style={styles.metaNumWrap}>
                      <AppNumber size="body-sm" weight="bold" value={p.totalAmount} showCurrency tabular={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.metaNumText} />
                    </View>
                  </View>
                  <View style={styles.productMeta}>
                    <AppText variant="caption" weight="semibold" style={[styles.productMetaLabel, { color: G.fgSecondary }]} numberOfLines={1}>{p.orderNumber}</AppText>
                    <AppText variant="caption" weight="medium" style={[styles.productMetaSep, { color: G.muted }]} numberOfLines={1}>·</AppText>
                    <AppText variant="caption" weight="medium" style={[styles.productMetaLabel, { color: G.muted }]} numberOfLines={1}>{t('suppliers.qty', { qty: String(p.quantity), unit: p.unit })}</AppText>
                    <AppText variant="caption" weight="medium" style={[styles.productMetaSep, { color: G.muted }]} numberOfLines={1}>·</AppText>
                    <AppText variant="caption" weight="medium" style={[styles.productMetaDate, { color: G.muted }]} numberOfLines={2}>{fmtDate(p.createdAt, calendarType, language)}</AppText>
                  </View>
                  <View style={styles.rowBetween}>
                    <View style={[styles.tag, {
                      backgroundColor: (p.paymentStatus === 'Paid' ? colors.success : p.paymentStatus === 'Partial' ? colors.warning : colors.error) + '18',
                    }]}>
                      <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: p.paymentStatus === 'Paid' ? colors.success : p.paymentStatus === 'Partial' ? colors.warning : colors.error }} numberOfLines={1}>
                        {t('suppliers.pay_status_' + (p.paymentStatus || 'Paid'))}
                      </AppText>
                    </View>
                    {p.outstandingAmount > 0 ? (
                      <View style={styles.dueWrap}>
                        <AppText variant="caption" weight="semibold" style={[styles.productMetaLabel, { color: colors.error }]} numberOfLines={1}>{t('suppliers.due')}:</AppText>
                        <View style={styles.metaNumWrap}>
                          <AppNumber size="caption" weight="semibold" value={p.outstandingAmount} tabular={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.metaNumText} />
                        </View>
                      </View>
                    ) : null}
                  </View>
                </AppCard>
              ))
            )}
          </View>
        )}

        {tab === 'products' && (
          <View style={styles.section}>
            {products.length === 0 ? (
              <EmptyBlock label={t('suppliers.no_products')} icon={<Package size={28} color={G.muted} />} />
            ) : (
              products.map((pr) => (
                <AppCard key={pr.id} padding={13} gap={8} radius={14} background={G.bgCard} bordered style={{ borderColor: G.border, marginBottom: 8, overflow: 'hidden' }}>
                  <AppText variant="body" weight="bold" style={[styles.flexText, { color: G.fg }]} numberOfLines={2}>{pr.name}</AppText>
                  <View style={styles.productMeta}>
                    <View style={styles.metaNumWrap}>
                      <AppNumber size="body-sm" weight="bold" value={pr.currentStock} suffix={' ' + (pr.baseUnit || 'pcs')} tabular={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={styles.metaNumText} />
                    </View>
                    <AppText variant="caption" weight="medium" style={[styles.productMetaSep, { color: G.muted }]} numberOfLines={1}>·</AppText>
                    <AppText variant="caption" weight="medium" style={[styles.productMetaLabel, { color: G.muted }]} numberOfLines={1}>{t('suppliers.last_price')}</AppText>
                    <View style={styles.metaNumWrap}>
                      <AppNumber size="caption" weight="semibold" value={pr.lastPurchasePrice} tabular={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.metaNumText} />
                    </View>
                    <AppText variant="caption" weight="medium" style={[styles.productMetaSep, { color: G.muted }]} numberOfLines={1}>·</AppText>
                    <AppText variant="caption" weight="medium" style={[styles.productMetaLabel, { color: G.muted }]} numberOfLines={1}>{t('suppliers.last_restock')}</AppText>
                    <AppText variant="caption" weight="semibold" style={[styles.productMetaDate, { color: G.fgSecondary }]} numberOfLines={2}>{fmtDate(pr.lastPurchaseDate, calendarType, language)}</AppText>
                  </View>
                </AppCard>
              ))
            )}
          </View>
        )}

        {tab === 'payments' && (
          <View style={styles.section}>
            <TouchableOpacity
              onPress={() => setShowPayment(true)}
              style={[styles.recordPayBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Plus size={18} color={colors.background} />
              <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: colors.background }} numberOfLines={1}>{t('suppliers.record_payment')}</AppText>
            </TouchableOpacity>
            {payments.length === 0 ? (
              <EmptyBlock label={t('suppliers.no_payments')} icon={<Wallet size={28} color={G.muted} />} />
            ) : (
              payments.map((pm) => (
                <AppCard key={pm.id} padding={13} gap={6} radius={14} background={G.bgCard} bordered style={{ borderColor: G.border, marginBottom: 8 }}>
                  <View style={styles.rowBetween}>
                    <View style={styles.metaNumWrap}>
                      <AppNumber size="body" weight="bold" value={pm.amount} showCurrency tabular={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.metaNumText} />
                    </View>
                    <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                      {fmtDate(pm.paidAt || pm.createdAt, calendarType, language)}
                    </AppText>
                  </View>
                  <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={2}>
                    {pm.method ? t('suppliers.payment_' + pm.method) : ''} {pm.note ? `· ${pm.note}` : ''}
                  </AppText>
                </AppCard>
              ))
            )}
          </View>
        )}

        {tab === 'orders' && (
          <View style={styles.section}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openNewOrder(); }}
              disabled={products.length === 0}
              style={[styles.recordPayBtn, { backgroundColor: products.length === 0 ? G.muted : colors.primary }]}
              activeOpacity={0.8}
            >
              <ClipboardList size={18} color={colors.background} />
              <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: colors.background }} numberOfLines={1}>{t('suppliers.new_order')}</AppText>
            </TouchableOpacity>
            {orders.length === 0 ? (
              <View style={styles.emptyBlock}>
                <View style={[styles.emptyIconWrap, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                  <ClipboardList size={28} color={G.muted} />
                </View>
                <AppText variant="body" weight="medium" align="center" style={{ color: G.muted }} numberOfLines={2}>
                  {t('suppliers.no_orders')}
                </AppText>
                {products.length === 0 ? (
                  <AppText variant="caption" weight="medium" align="center" style={{ color: G.muted }} numberOfLines={2}>
                    {t('suppliers.no_products')}
                  </AppText>
                ) : (
                  <AppText variant="caption" weight="medium" align="center" style={{ color: G.muted }} numberOfLines={3}>
                    {t('suppliers.no_orders_desc')}
                  </AppText>
                )}
              </View>
            ) : (
              orders.map((o) => (
                <AppCard key={o.id} padding={13} gap={8} radius={14} background={G.bgCard} bordered style={{ borderColor: G.border, marginBottom: 8 }}>
                  <View style={styles.rowBetween}>
                    <View style={styles.flexText}>
                      <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{o.orderNumber}</AppText>
                      <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                        {fmtDate(o.createdAt, calendarType, language)} · {o.items.length === 1 ? t('suppliers.order_items_one', { count: String(o.items.length) }) : t('suppliers.order_items', { count: String(o.items.length) })}
                      </AppText>
                    </View>
                    <View style={styles.metaNumWrap}>
                      <AppNumber size="body" weight="bold" value={o.totalAmount} showCurrency tabular={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.metaNumText} />
                    </View>
                  </View>
                  {o.notes ? (
                    <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={2}>{o.notes}</AppText>
                  ) : null}
                  <View style={[styles.orderActions, { borderTopColor: G.border }]}>
                    <TouchableOpacity
                      onPress={() => exportOrderPdf(o.items, { orderNumber: o.orderNumber, notes: o.notes, createdAt: o.createdAt, total: o.totalAmount })}
                      disabled={exportingOrder}
                      style={[styles.orderActionBtn, { backgroundColor: G.accentGlass }]}
                      activeOpacity={0.75}
                    >
                      <FileText size={15} color={G.fg} />
                      <AppText variant="caption" weight="bold" shrink={false} style={{ color: G.fg }} numberOfLines={1}>
                        {exportingOrder ? t('suppliers.exporting') : t('suppliers.export_pdf')}
                      </AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteOrder(o)}
                      style={[styles.orderActionBtn, { backgroundColor: colors.error + '18' }]}
                      activeOpacity={0.75}
                    >
                      <Trash2 size={15} color={colors.error} />
                      <AppText variant="caption" weight="bold" shrink={false} style={{ color: colors.error }} numberOfLines={1}>{t('common.delete')}</AppText>
                    </TouchableOpacity>
                  </View>
                </AppCard>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Edit form */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SupplierForm
          supplier={supplier}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      </Modal>

      {/* Record payment */}
      <Modal visible={showPayment} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.payOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowPayment(false)} />
            <View style={[styles.paySheet, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <AppText variant="title" weight="bold" style={[styles.payTitle, { color: G.fg }]} numberOfLines={1}>
                {t('suppliers.record_payment')}
              </AppText>
              <TextInput
                style={[styles.payInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
                value={payAmount}
                onChangeText={setPayAmount}
                placeholder={t('suppliers.payment_amount_ph')}
                placeholderTextColor={G.muted}
                keyboardType="decimal-pad"
              />
              <View style={styles.chipRow}>
                {['cash', 'credit', 'mobile', 'bank'].map((m) => {
                  const isSel = payMethod === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => { Haptics.selectionAsync(); setPayMethod(m); }}
                      style={[styles.chip, { backgroundColor: isSel ? colors.primary : G.bg, borderColor: isSel ? colors.primary : G.border }]}
                      activeOpacity={0.75}
                    >
                      <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: isSel ? colors.background : G.muted }} numberOfLines={1}>
                        {t('suppliers.payment_' + m)}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={[styles.payInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
                value={payNote}
                onChangeText={setPayNote}
                placeholder={t('suppliers.payment_note_ph')}
                placeholderTextColor={G.muted}
              />
              <TouchableOpacity
                onPress={handleSavePayment}
                disabled={savingPay}
                style={[styles.paySaveBtn, { backgroundColor: savingPay ? G.muted : colors.primary }]}
                activeOpacity={0.8}
              >
                <AppText variant="label" weight="bold" style={{ color: colors.background }} numberOfLines={1}>
                  {savingPay ? t('common.loading') : t('common.save')}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Product order editor */}
      <Modal visible={showOrderEditor} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.editorContainer, { backgroundColor: G.bg }]}>
          <View style={styles.editorHeader}>
            <TouchableOpacity onPress={() => setShowOrderEditor(false)} style={[styles.headerBtn, { borderColor: G.border }]}>
              <X size={20} color={G.fg} />
            </TouchableOpacity>
            <AppText variant="title" weight="bold" style={[styles.editorTitle, { color: G.fg }]} numberOfLines={1}>
              {t('suppliers.order_draft_title')}
            </AppText>
            <View style={{ width: 42 }} />
          </View>
          <ScrollView contentContainerStyle={styles.editorContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <AppText variant="caption" weight="medium" style={{ color: G.muted, marginBottom: 12 }} numberOfLines={3}>
              {t('suppliers.order_auto_desc', { count: String(draftItems.length) })}
            </AppText>

            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); openAddItem(); }}
              style={[styles.addItemBtn, { borderColor: G.border, backgroundColor: G.bgCard }]}
              activeOpacity={0.8}
            >
              <Plus size={16} color={G.fg} />
              <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: G.fg }} numberOfLines={1}>{t('suppliers.add_item')}</AppText>
            </TouchableOpacity>

            {draftItems.map((it, idx) => (
              <AppCard key={it.itemId ?? idx} padding={12} gap={8} radius={14} background={G.bgCard} bordered style={{ borderColor: G.border, marginBottom: 8 }}>
                <View style={styles.rowBetween}>
                  <AppText variant="body-sm" weight="bold" style={[styles.draftItemName, { color: G.fg }]} numberOfLines={2}>{it.name}</AppText>
                  <TouchableOpacity onPress={() => removeDraftItem(idx)} hitSlop={8} style={styles.removeBtn}>
                    <X size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
                <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                  {t('suppliers.current_stock')}: {(it.currentStock || 0).toLocaleString()} {it.unit || 'pcs'}
                </AppText>
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); updateDraftItem(idx, { quantity: Math.max(0, (it.quantity || 0) - 1) }); }}
                    style={[styles.qtyBtn, { backgroundColor: G.accentGlass }]}
                    activeOpacity={0.7}
                  >
                    <Minus size={16} color={G.fg} />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.qtyInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
                    value={String(it.quantity || 0)}
                    onChangeText={(v) => updateDraftItem(idx, { quantity: Math.max(0, parseInt(v.replace(/[^0-9]/g, ''), 10) || 0) })}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={G.muted}
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); updateDraftItem(idx, { quantity: (it.quantity || 0) + 1 }); }}
                    style={[styles.qtyBtn, { backgroundColor: G.accentGlass }]}
                    activeOpacity={0.7}
                  >
                    <Plus size={16} color={G.fg} />
                  </TouchableOpacity>
                  <View style={styles.priceWrap}>
                    <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted }} numberOfLines={1}>
                      {t('suppliers.order_unit_price')}
                    </AppText>
                    <TextInput
                      style={[styles.priceInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
                      value={it.price ? String(it.price) : ''}
                      onChangeText={(v) => updateDraftItem(idx, { price: parseFloat(v.replace(/[^0-9.]/g, '')) || 0 })}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={G.muted}
                      selectTextOnFocus
                    />
                  </View>
                </View>
                <View style={[styles.rowBetween, { marginTop: 2 }]}>
                  <AppText variant="caption" weight="semibold" style={{ color: G.fgSecondary }} numberOfLines={1}>{t('suppliers.order_line_total')}</AppText>
                  <View style={styles.metaNumWrap}>
                    <AppNumber size="body-sm" weight="bold" value={(it.quantity || 0) * (it.price || 0)} showCurrency tabular={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.metaNumText} />
                  </View>
                </View>
              </AppCard>
            ))}

            {draftItems.length === 0 ? (
              <View style={styles.emptyBlock}>
                <View style={[styles.emptyIconWrap, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                  <Package size={28} color={G.muted} />
                </View>
                <AppText variant="body" weight="medium" align="center" style={{ color: G.muted }} numberOfLines={2}>
                  {t('suppliers.order_empty')}
                </AppText>
              </View>
            ) : null}

            <TextInput
              style={[styles.payInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
              value={orderNotes}
              onChangeText={setOrderNotes}
              placeholder={t('suppliers.order_notes_ph')}
              placeholderTextColor={G.muted}
              multiline
            />

            <View style={styles.editorTotalRow}>
              <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('suppliers.order_total')}</AppText>
              <View style={styles.metaNumWrap}>
                <AppNumber size="title" weight="extrabold" value={draftTotal} showCurrency tabular={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.metaNumText} />
              </View>
            </View>

            <View style={styles.editorActions}>
              <TouchableOpacity
                onPress={() => exportOrderPdf(draftItems, { notes: orderNotes })}
                disabled={exportingOrder || draftItems.length === 0}
                style={[styles.editorExportBtn, { backgroundColor: G.accentGlassStrong, borderColor: G.border }]}
                activeOpacity={0.8}
              >
                <FileText size={17} color={G.fg} />
                <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: G.fg }} numberOfLines={1}>
                  {exportingOrder ? t('suppliers.exporting') : t('suppliers.export_pdf')}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveOrder}
                disabled={savingOrder || draftItems.length === 0}
                style={[styles.editorSaveBtn, { backgroundColor: savingOrder || draftItems.length === 0 ? G.muted : colors.primary }]}
                activeOpacity={0.8}
              >
                <AppText variant="label" weight="bold" style={{ color: colors.background }} numberOfLines={1}>
                  {savingOrder ? t('common.loading') : t('suppliers.order_save')}
                </AppText>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add item to order (inventory picker + custom item) */}
      <Modal visible={showAddItem} transparent animationType="fade">
        <View style={styles.payOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowAddItem(false)} />
          <View style={[styles.addItemSheet, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.rowBetween}>
              <AppText variant="title" weight="bold" style={[styles.payTitle, { color: G.fg }]} numberOfLines={1}>
                {t('suppliers.add_item_title')}
              </AppText>
              <TouchableOpacity onPress={() => setShowAddItem(false)} hitSlop={8} style={styles.addItemCloseBtn}>
                <X size={18} color={G.fgSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.payInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
              value={addSearch}
              onChangeText={setAddSearch}
              placeholder={t('suppliers.search_items_ph')}
              placeholderTextColor={G.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <ScrollView style={styles.addItemList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {addableItems.length === 0 ? (
                <AppText variant="body-sm" weight="medium" align="center" style={{ color: G.muted, paddingVertical: 16 }} numberOfLines={2}>
                  {t('suppliers.no_items_found')}
                </AppText>
              ) : (
                addableItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => addInventoryItem(item)}
                    style={[styles.addItemRow, { borderBottomColor: G.border }]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.flexText}>
                      <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={2}>{item.name}</AppText>
                      {item.companyName ? (
                        <AppText variant="micro" weight="medium" style={{ color: G.muted }} numberOfLines={1}>{item.companyName}</AppText>
                      ) : null}
                    </View>
                    <AppText variant="caption" weight="medium" shrink={false} style={{ color: G.muted }} numberOfLines={1}>
                      {(item.totalBaseQuantity || 0).toLocaleString()} {item.baseUnit || 'pcs'}
                    </AppText>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={[styles.addItemDivider, { backgroundColor: G.border }]} />

            <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted }} numberOfLines={1}>
              {t('suppliers.custom_item')}
            </AppText>
            <View style={styles.qtyRow}>
              <TextInput
                style={[styles.addItemNameInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
                value={customName}
                onChangeText={setCustomName}
                placeholder={t('suppliers.custom_item_name_ph')}
                placeholderTextColor={G.muted}
              />
              <TextInput
                style={[styles.addItemUnitInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
                value={customUnit}
                onChangeText={setCustomUnit}
                placeholder={t('suppliers.custom_item_unit_ph')}
                placeholderTextColor={G.muted}
              />
            </View>
            <TouchableOpacity
              onPress={addCustomItem}
              style={[styles.paySaveBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <AppText variant="label" weight="bold" style={{ color: colors.background }} numberOfLines={1}>
                {t('suppliers.add_custom')}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  const { colors } = useSettings();
  const G = getSuppliersGlass(colors);
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: G.accentGlass }]}>{icon}</View>
      <View style={styles.flexText}>
        <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted }} numberOfLines={1}>{label}</AppText>
        <AppText variant="body" weight="medium" style={{ color: G.fg }} numberOfLines={2}>{value}</AppText>
      </View>
    </View>
  );
}

function EmptyBlock({ label, icon }: { label: string; icon: React.ReactNode }) {
  const { colors } = useSettings();
  const G = getSuppliersGlass(colors);
  return (
    <View style={styles.emptyBlock}>
      <View style={[styles.emptyIconWrap, { backgroundColor: G.bgCard, borderColor: G.border }]}>{icon}</View>
      <AppText variant="body" weight="medium" align="center" style={{ color: G.muted }} numberOfLines={2}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  glowWash: { position: 'absolute' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 10,
    gap: 14,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.extrabold,
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },

  avatar: {
    width: 68,
    height: 68,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontFamily: Fonts.extrabold,
    overflow: 'hidden',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
    width: '100%',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 12,
    flex: 1,
    minWidth: 0,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statsCol: {
    flexDirection: 'column',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 3,
    minWidth: 0,
  },
  statCardWide: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statNumber: {
    width: '100%',
    textAlign: 'center',
  },
  statNumberLeft: {
    width: '65%',
    textAlign: 'right',
  },

  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
    marginBottom: 4,
  },
  tab: {
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  section: {
    marginTop: 14,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowBetweenTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  // Wrapping meta row (e.g. "Last price · Last restock" captions). Each piece
  // can shrink/wrap independently so long values never push outside the card.
  productMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 5,
    rowGap: 4,
  },
  productMetaLabel: {
    flexShrink: 0,
    overflow: 'hidden',
  },
  productMetaSep: {
    flexShrink: 0,
    overflow: 'hidden',
  },
  productMetaDate: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    overflow: 'hidden',
  },
  // Bounded wrapper so adjustsFontSizeToFit actually has a width to fit into.
  metaNumWrap: {
    maxWidth: '48%',
    minWidth: 0,
    flexShrink: 1,
    overflow: 'hidden',
  },
  metaNumText: {
    width: '100%',
  },
  dueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },

  recordPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 13,
    marginBottom: 12,
  },

  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  orderActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  orderActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
  },

  editorContainer: {
    flex: 1,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 10,
    gap: 14,
  },
  editorTitle: {
    fontFamily: Fonts.extrabold,
    flex: 1,
    textAlign: 'center',
  },
  editorContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  draftItemName: {
    flex: 1,
    minWidth: 0,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyInput: {
    width: 52,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: 'center',
    fontFamily: Fonts.bold,
    fontSize: 15,
  },
  priceWrap: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  priceInput: {
    minWidth: 90,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontFamily: Fonts.bold,
    fontSize: 14,
    textAlign: 'right',
  },
  editorTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
  },
  editorActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  editorExportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 50,
    borderRadius: 13,
    borderWidth: 1,
  },
  editorSaveBtn: {
    flex: 1.2,
    height: 50,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 12,
  },
  addItemSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 40 : 26,
    gap: 12,
    maxHeight: '85%',
  },
  addItemCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemList: {
    maxHeight: 240,
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  addItemDivider: {
    height: 1,
    marginVertical: 2,
  },
  addItemNameInput: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  addItemUnitInput: {
    width: 64,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontFamily: Fonts.medium,
    fontSize: 14,
    textAlign: 'center',
  },

  payOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  paySheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 40 : 26,
    gap: 12,
  },
  payTitle: {
    fontFamily: Fonts.extrabold,
  },
  payInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 50,
    fontFamily: Fonts.medium,
    fontSize: 15,
  },
  paySaveBtn: {
    height: 50,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
