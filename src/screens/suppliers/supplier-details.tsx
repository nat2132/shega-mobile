import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import { getSuppliersGlass } from './glass-suppliers';
import { Fonts } from '@/constants/theme';
import {
  getSupplierById,
  getSupplierPurchases,
  getSupplierProducts,
  getSupplierPayments,
  insertSupplierPayment,
} from '@/database/db';
import { AppText, AppCard, AppNumber } from '@/components/ui';
import { formatDate, parseLocalDate } from '@/utils/date-utils';
import SupplierForm from './supplier-form';
import * as Haptics from 'expo-haptics';
import { playNice, playBad } from '@/services/soundService';
import {
  ArrowLeft,
  Bookmark,
  CreditCard,
  Mail,
  MapPin,
  Package,
  Pencil,
  PhoneCall,
  Plus,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-react-native';

type TabKey = 'overview' | 'purchases' | 'products' | 'payments';

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
  const { colors, t, calendarType, language } = useSettings();
  const G = getSuppliersGlass(colors);
  const dialog = useDialog();

  const [supplier, setSupplier] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('overview');
  const [showForm, setShowForm] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNote, setPayNote] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  const load = useCallback(() => {
    const s = getSupplierById(supplierId);
    setSupplier(s);
    setPurchases(getSupplierPurchases(supplierId));
    setProducts(getSupplierProducts(supplierId));
    setPayments(getSupplierPayments(supplierId));
    setLoading(false);
  }, [supplierId]);

  useEffect(() => { load(); }, [load]);

  const handleSavePayment = async () => {
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
          <View style={{ alignItems: 'center', gap: 4 }}>
            <AppText variant="heading-lg" weight="bold" align="center" style={[styles.name, { color: G.fg }]} numberOfLines={2}>
              {supplier.fullName}
            </AppText>
            {supplier.companyName ? (
              <AppText variant="body" weight="medium" align="center" style={{ color: G.fgSecondary }} numberOfLines={1}>
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

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppNumber size="heading" weight="bold" value={supplier.totalPurchases} showCurrency tabular={false} />
            <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>{t('suppliers.stat_purchases')}</AppText>
          </View>
          <View style={[styles.statCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppNumber size="heading" weight="bold" value={supplier.purchasePaid + supplier.paymentsSum} showCurrency tabular={false} />
            <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>{t('suppliers.stat_paid')}</AppText>
          </View>
          <View style={[styles.statCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppNumber
              size="heading"
              weight="bold"
              value={supplier.outstanding}
              showCurrency
              tabular={false}
              positive={supplier.outstanding > 0 ? false : undefined}
              negative={supplier.outstanding > 0}
            />
            <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>{t('suppliers.stat_outstanding')}</AppText>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
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
        </View>

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
                    <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{p.itemName}</AppText>
                    <AppNumber size="body-sm" weight="bold" value={p.totalAmount} showCurrency tabular={false} />
                  </View>
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                    {p.orderNumber} · {t('suppliers.qty', { qty: String(p.quantity), unit: p.unit })} · {fmtDate(p.createdAt, calendarType, language)}
                  </AppText>
                  <View style={styles.rowBetween}>
                    <View style={[styles.tag, {
                      backgroundColor: (p.paymentStatus === 'Paid' ? colors.success : p.paymentStatus === 'Partial' ? colors.warning : colors.error) + '18',
                    }]}>
                      <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: p.paymentStatus === 'Paid' ? colors.success : p.paymentStatus === 'Partial' ? colors.warning : colors.error }} numberOfLines={1}>
                        {t('suppliers.pay_status_' + (p.paymentStatus || 'Paid'))}
                      </AppText>
                    </View>
                    {p.outstandingAmount > 0 ? (
                      <AppText variant="caption" weight="semibold" style={{ color: colors.error }} numberOfLines={1}>
                        {t('suppliers.due')}: {p.outstandingAmount.toLocaleString()}
                      </AppText>
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
                <AppCard key={pr.id} padding={13} gap={6} radius={14} background={G.bgCard} bordered style={{ borderColor: G.border, marginBottom: 8 }}>
                  <View style={styles.rowBetween}>
                    <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{pr.name}</AppText>
                    <AppNumber size="body-sm" weight="bold" value={pr.currentStock} suffix={' ' + (pr.baseUnit || 'pcs')} tabular={false} />
                  </View>
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                    {t('suppliers.last_price')}: {pr.lastPurchasePrice.toLocaleString()} · {t('suppliers.last_restock')}: {fmtDate(pr.lastPurchaseDate, calendarType, language)}
                  </AppText>
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
                    <AppNumber size="body" weight="bold" value={pm.amount} showCurrency tabular={false} />
                    <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                      {fmtDate(pm.paidAt || pm.createdAt, calendarType, language)}
                    </AppText>
                  </View>
                  <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>
                    {pm.method ? t('suppliers.payment_' + pm.method) : ''} {pm.note ? `· ${pm.note}` : ''}
                  </AppText>
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
      <View style={{ flex: 1 }}>
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
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 12,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 3,
  },

  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
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
