import { Fonts , BorderRadius, Spacing } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import { getOnCreditItems, ItemData, settleItemCredit } from '@/database/db';
import * as Haptics from 'expo-haptics';
import {
    AlertTriangle,
    BarChart3,
    Building2,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    CreditCard,
    MapPin,
    Phone,
    ShieldAlert,
    ShieldCheck,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { AppNumber, AppText, AppListItem, AppRow, AppCard} from '@/components/ui';

import Animated, { FadeInDown } from 'react-native-reanimated';
import { getDashGlass } from './glass-dashboard';
// →→→ Settlement Modal →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

interface SettlementModalProps {
  visible: boolean;
  item: ItemData | null;
  onClose: () => void;
  onSettled: () => void;
}

const SettlementModal: React.FC<SettlementModalProps> = ({ visible, item, onClose, onSettled }) => {
  const { colors, t } = useSettings();
  const G = getDashGlass(colors);
  const modalStyles = useMemo(() => createModalStyles(G), [G]);
  const dialog = useDialog();
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState('');

  if (!item) return null;

  const totalCredit = item.packPurchasePrice || item.basePurchasePrice || 0;

  const handleConfirm = async () => {
    if (paymentType === 'full') {
      const ok = await dialog.confirm({
        title: t('dash.mark_as_paid'),
        message: t('dash.settle_confirm'),
        confirmText: t('common.confirm'),
        cancelText: t('common.cancel'),
        iconType: 'info',
      });
      if (ok) {
        const success = settleItemCredit(item.id);
        if (success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setPartialAmount('');
          onSettled();
        }
      }
    } else {
      const amount = parseFloat(partialAmount);
      if (isNaN(amount) || amount <= 0) {
        await dialog.alert({ title: t('common.error'), message: t('dash.invalid_amount'), iconType: 'danger' });
        return;
      }
      if (amount > totalCredit) {
        await dialog.alert({ title: t('common.error'), message: t('dash.amount_exceeds'), iconType: 'danger' });
        return;
      }
      const ok = await dialog.confirm({
        title: t('dash.mark_as_paid'),
        message: `Confirm partial payment of ${amount.toLocaleString()} ${t('common.etb')}?`,
        confirmText: t('common.confirm'),
        cancelText: t('common.cancel'),
        iconType: 'info',
      });
      if (ok) {
        // For partial, only fully settle if amount covers the total
        if (amount >= totalCredit) {
          settleItemCredit(item.id);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPartialAmount('');
        onSettled();
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <TouchableOpacity style={modalStyles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[modalStyles.sheet, { backgroundColor: G.bg, overflow: 'hidden' }]}>
          <View style={{ position: 'absolute', top: -40, left: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: G.mutedLight, opacity: 0.2 }} />
          {/* Handle */}
          <View style={modalStyles.handleRow}>
            <View style={[modalStyles.handle, { backgroundColor: G.border }]} />
          </View>

          <AppText variant="title" weight="bold" style={[modalStyles.title, { color: G.fg }]} numberOfLines={2}>{t('dash.settle_credit')}</AppText>
          <AppText variant="body-sm" weight="medium" style={[modalStyles.itemName, { color: G.fgSecondary }]} numberOfLines={1}>{item.name}</AppText>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
            {/* Full Payment Option */}
            <TouchableOpacity
              style={[modalStyles.option, { borderColor: paymentType === 'full' ? G.fg : G.border, backgroundColor: G.bgCard }]}
              onPress={() => setPaymentType('full')}
            >
              <View style={[modalStyles.radio, { borderColor: paymentType === 'full' ? G.fg : G.border, backgroundColor: paymentType === 'full' ? G.fg : 'transparent' }]} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={[modalStyles.optionLabel, { color: G.fg }]} numberOfLines={1}>{t('dash.paid_full')}</AppText>
                <AppText variant="caption" weight="medium" style={[modalStyles.optionSub, { color: G.fgSecondary }]} numberOfLines={2}>{t('dash.settle_entire')}</AppText>
              </View>
              <AppNumber value={totalCredit} size="body" showCurrency color={G.fg} numberOfLines={1} />
            </TouchableOpacity>

            {/* Partial Payment Option */}
            <TouchableOpacity
              style={[modalStyles.option, { borderColor: paymentType === 'partial' ? G.fg : G.border, backgroundColor: G.bgCard }]}
              onPress={() => setPaymentType('partial')}
            >
              <View style={[modalStyles.radio, { borderColor: paymentType === 'partial' ? G.fg : G.border, backgroundColor: paymentType === 'partial' ? G.fg : 'transparent' }]} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={[modalStyles.optionLabel, { color: G.fg }]} numberOfLines={1}>{t('dash.partial_payment')}</AppText>
                <AppText variant="caption" weight="medium" style={[modalStyles.optionSub, { color: G.fgSecondary }]} numberOfLines={2}>{t('dash.record_fractional')}</AppText>
              </View>
            </TouchableOpacity>

            {/* Partial Amount Input */}
            {paymentType === 'partial' && (
              <View style={[modalStyles.inputContainer, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <TextInput
                  style={[modalStyles.input, { color: G.fg }]}
                  placeholder="0.00"
                  placeholderTextColor={G.fgSecondary}
                  keyboardType="numeric"
                  value={partialAmount}
                  onChangeText={setPartialAmount}
                />
                <AppText variant="body" weight="bold" shrink={false} style={[modalStyles.inputUnit, { color: G.fgSecondary }]} numberOfLines={1}>{t('common.etb')}</AppText>
              </View>
            )}

            {/* Confirm Button */}
            <TouchableOpacity
              style={[modalStyles.confirmBtn, { backgroundColor: G.fg }]}
              onPress={handleConfirm}
            >
              <AppText variant="body" weight="bold" shrink={false} style={[modalStyles.confirmBtnText, { color: G.bg }]} numberOfLines={1}>{t('dash.confirm_payment')}</AppText>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// →→→ Detail View →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const CreditItemDetail = ({
  item,
  onBack,
  onSettled,
}: {
  item: ItemData;
  onBack: () => void;
  onSettled: () => void;
}) => {
  const { colors, t } = useSettings();
  const G = getDashGlass(colors);
  const detailStyles = useMemo(() => createDetailStyles(G), [G]);
  const [showSettlement, setShowSettlement] = useState(false);

  return (
    <View style={[detailStyles.container, { backgroundColor: G.bg }]}>
      <View style={{ position: 'absolute', top: -60, left: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: G.mutedLight, opacity: 0.25 }} />
      <View style={{ position: 'absolute', bottom: -60, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: G.mutedLight, opacity: 0.15 }} />
      {/* Header */}
      <View style={detailStyles.header}>
        <TouchableOpacity onPress={onBack} style={[detailStyles.backBtn, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <ChevronLeft size={22} color={G.fg} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[detailStyles.headerSub, { color: G.fgSecondary }]} numberOfLines={1}>
            {t('dash.sourcing')}
          </AppText>
          <AppText variant="title" weight="bold" style={[detailStyles.headerTitle, { color: G.fg }]} numberOfLines={2}>
            {t('dash.asset_origin')}
          </AppText>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={detailStyles.scroll}>
        <Animated.View entering={FadeInDown.duration(500)}>
          {/* Blueprint Card */}
          <View style={[detailStyles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            {/* Card Header */}
            <View style={detailStyles.cardHeader}>
              <View style={[detailStyles.iconBox, { backgroundColor: G.fg + '08' }]}>
                <Building2 size={28} color={G.fg} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <AppText variant="title" weight="bold" style={[detailStyles.itemName, { color: G.fg }]} numberOfLines={2}>
                  {item.name}
                </AppText>
                <AppText variant="body-sm" weight="medium" style={[detailStyles.itemSub, { color: G.fgSecondary }]} numberOfLines={1}>
                  {item.companyName || t('dash.unregistered_source')}
                </AppText>
              </View>
              <View style={[detailStyles.statusBadge, { backgroundColor: colors.primary + '15' }]}>
                <ShieldAlert size={13} color={colors.primary} />
                <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[detailStyles.statusText, { color: colors.primary }]} numberOfLines={1}>
                  {t('dash.on_credit')}
                </AppText>
              </View>
            </View>

            <View style={[detailStyles.divider, { backgroundColor: G.border }]} />

            {/* Purchase Details */}
            <AppText variant="micro" weight="bold" transform="uppercase" style={[detailStyles.sectionLabel, { color: G.fgSecondary }]} numberOfLines={1}>
              {t('dash.purchase_arch')}
            </AppText>

            <AppRow
              label={t('dash.purchase_unit')}
              value={item.purchaseUnit || '—'}
              valueVariant="body"
              valueWeight="bold"
              labelMaxLines={2}
              style={{ marginBottom: Spacing.sm }}
            >
              <MapPin size={14} color={G.fgSecondary} />
            </AppRow>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <BarChart3 size={14} color={G.fgSecondary} />
                <AppText variant="body" numberOfLines={2} style={{ color: G.fgSecondary }}>{t('dash.pack_purchase_price')}</AppText>
              </View>
              <AppNumber value={item.packPurchasePrice || 0} size="body" showCurrency numberOfLines={1} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Clock size={14} color={G.fgSecondary} />
                <AppText variant="body" numberOfLines={2} style={{ color: G.fgSecondary }}>{t('dash.base_purchase_price')}</AppText>
              </View>
              <AppNumber value={item.basePurchasePrice || 0} size="body" showCurrency numberOfLines={1} />
            </View>

            <View style={[detailStyles.divider, { backgroundColor: G.border }]} />

            {/* Settle Button */}
            <TouchableOpacity
              style={[detailStyles.settleBtn, { backgroundColor: colors.success }]}
              onPress={() => setShowSettlement(true)}
              activeOpacity={0.8}
            >
              <ShieldCheck size={20} color={G.fg} />
              <AppText variant="body" weight="bold" shrink={false} style={detailStyles.settleBtnText} numberOfLines={1}>{t('dash.mark_as_paid')}</AppText>
            </TouchableOpacity>

            {/* Supplier Contact Footer */}
            <View style={detailStyles.cardFooter}>
              <View>
                <AppText variant="caption" weight="medium" style={[detailStyles.footerLabel, { color: G.fgSecondary }]} numberOfLines={1}>
                  {t('dash.supplier_interface')}
                </AppText>
                <AppText variant="title-sm" weight="bold" style={[detailStyles.footerValue, { color: G.fg }]} numberOfLines={1}>
                  {item.supplierPhone || 'N/A'}
                </AppText>
              </View>
              {item.supplierPhone ? (
                <TouchableOpacity style={[detailStyles.callBtn, { backgroundColor: G.fg }]}>
                  <Phone size={18} color={G.bg} />
                  <AppText variant="body-sm" weight="bold" shrink={false} style={[detailStyles.callBtnText, { color: G.bg }]} numberOfLines={1}>
                    {t('dash.call')}
                  </AppText>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <SettlementModal
        visible={showSettlement}
        item={item}
        onClose={() => setShowSettlement(false)}
        onSettled={() => {
          setShowSettlement(false);
          onSettled();
          onBack();
        }}
      />
    </View>
  );
};

// →→→ Main List Screen →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const NefasSilkScreen = ({ initialItemId }: { initialItemId?: number } = {}) => {
  const { colors, t } = useSettings();
  const G = getDashGlass(colors);
  const listStyles = useMemo(() => createListStyles(G), [G]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);

  const loadData = useCallback(() => {
    const data = getOnCreditItems() as ItemData[];
    setItems(data);
    if (initialItemId) {
      const match = data.find((it) => it.id === initialItemId);
      if (match) setSelectedItem(match);
    }
  }, [initialItemId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Drill into detail
  if (selectedItem) {
    return (
      <CreditItemDetail
        item={selectedItem}
        onBack={() => setSelectedItem(null)}
        onSettled={loadData}
      />
    );
  }

  return (
    <View style={[listStyles.container, { backgroundColor: G.bg }]}>
      <View style={{ position: 'absolute', top: -80, left: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: G.mutedLight, opacity: 0.3 }} />
      <View style={{ position: 'absolute', bottom: -50, right: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: G.mutedLight, opacity: 0.2 }} />
      <ScrollView
        contentContainerStyle={listStyles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={listStyles.headerNode}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[listStyles.headerSub, { color: G.fgSecondary }]} numberOfLines={1}>
            {t('dash.supply_intel')}
          </AppText>
          <AppText variant="display" weight="bold" style={[listStyles.headerTitle, { color: G.fg }]} numberOfLines={2}>
            {t('dash.credit_inventory')}
          </AppText>
        </View>

        {/* Item Cards */}
        {items.map((item, idx) => {
          const isOverdue = item.createdAt
            ? new Date() > new Date(new Date(item.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000)
            : false;

          return (
            <Animated.View key={item.id} entering={FadeInDown.delay(idx * 50).duration(500)}>
              <AppCard
                padding={Spacing.md}
                gap={Spacing.sm}
                background={G.bgCard}
                bordered
                style={{
                  borderColor: isOverdue ? colors.error + '40' : G.border,
                  borderLeftColor: isOverdue ? colors.error : G.border,
                  borderLeftWidth: isOverdue ? 3 : 1,
                  borderRadius: BorderRadius.lg,
                  marginBottom: Spacing.md,
                  overflow: 'hidden',
                }}
              >
                <AppListItem
                  left={
                    <View style={[listStyles.iconBox, { backgroundColor: G.fg + '06' }]}>
                      <Building2 size={22} color={G.fg} />
                    </View>
                  }
                  title={item.name}
                  subtitle={item.companyName || t('dash.general_source')}
                  titleMaxLines={2}
                  subtitleMaxLines={1}
                  right={
                    <View style={listStyles.statArea}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <AppNumber value={item.totalBaseQuantity || 0} size="body" color={G.fg} numberOfLines={1} />
                        <AppText variant="caption" weight="medium" style={listStyles.unitSmall}> {item.baseUnit || 'pcs'}</AppText>
                      </View>
                      {isOverdue ? (
                        <View style={[listStyles.badge, { backgroundColor: colors.error + '15' }]}>
                          <AlertTriangle size={10} color={colors.error} />
                          <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[listStyles.badgeText, { color: colors.error }]} numberOfLines={1}>
                            {t('dash.overdue')}
                          </AppText>
                        </View>
                      ) : (
                        <View style={[listStyles.badge, { backgroundColor: colors.primary + '15' }]}>
                          <ShieldAlert size={10} color={colors.primary} />
                          <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[listStyles.badgeText, { color: colors.primary }]} numberOfLines={1}>
                            {t('dash.on_credit')}
                          </AppText>
                        </View>
                      )}
                    </View>
                  }
                  onPress={() => setSelectedItem(item)}
                  noBorder
                  padding={0}
                />

                {/* Credit Amount Footer */}
                <View style={[listStyles.cardFooter, { backgroundColor: G.fg + '03', borderTopColor: G.border }]}>
                  <View style={listStyles.creditFooterRow}>
                    <CreditCard size={13} color={G.fgSecondary} />
                    <AppText variant="caption" weight="medium" style={[listStyles.creditFooterLabel, { color: G.fgSecondary }]} numberOfLines={1}>
                      {t('dash.total_credit')}
                    </AppText>
                    <AppNumber value={(item.packPurchasePrice || 0) * (item.totalPackQuantity || 1) || (item.basePurchasePrice || 0) * (item.totalBaseQuantity || 1) || 0} size="body-sm" showCurrency color={colors.error} numberOfLines={1} />
                  </View>
                  <ChevronRight size={15} color={G.border} />
                </View>
              </AppCard>
            </Animated.View>
          );
        })}

        {/* Empty State */}
        {items.length === 0 && (
          <View style={listStyles.empty}>
            <View style={[listStyles.emptyIcon, { backgroundColor: colors.success + '15' }]}>
              <Check size={36} color={colors.success} />
            </View>
            <AppText variant="title" weight="bold" style={[listStyles.emptyTitle, { color: G.fg }]} numberOfLines={2}>
              {t('dash.zero_credit')}
            </AppText>
            <AppText variant="body" weight="medium" style={[listStyles.emptySub, { color: G.fgSecondary }]} numberOfLines={3}>
              {t('dash.all_assets_settled')}
            </AppText>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// →→→ Styles →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const createListStyles = (G: any) => StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 25, paddingTop: 20, paddingBottom: 40 },
  headerNode: { marginBottom: 25 },
  headerSub: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { fontSize: 26, fontFamily: Fonts.bold },
  card: { borderRadius: 22, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  creditFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  creditFooterLabel: { fontSize: 11, fontFamily: Fonts.medium },
  creditFooterAmount: { fontSize: 13, fontFamily: Fonts.bold },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  infoArea: { flex: 1, marginLeft: 14 },
  itemName: { fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 },
  itemSub: { fontSize: 12, fontFamily: Fonts.medium },
  statArea: { alignItems: 'flex-end' },
  qtyText: { fontSize: 15, fontFamily: Fonts.bold, marginBottom: 4 },
  unitSmall: { fontSize: 11, fontFamily: Fonts.medium, opacity: 0.6 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, gap: 4 },
  badgeText: { fontSize: 9, fontFamily: Fonts.bold },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  footerText: { fontSize: 11, fontFamily: Fonts.medium, fontStyle: 'italic', flex: 1, marginRight: 8 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 20, fontFamily: Fonts.bold, marginBottom: 8 },
  emptySub: { fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center', paddingHorizontal: 40 },
});

const createDetailStyles = (G: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 20, paddingBottom: 20 },
  backBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerSub: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
  headerTitle: { fontSize: 22, fontFamily: Fonts.bold },
  scroll: { paddingHorizontal: 25, paddingBottom: 40 },
  card: { borderRadius: 28, borderWidth: 1, padding: 22, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBox: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 19, fontFamily: Fonts.bold, marginBottom: 3 },
  itemSub: { fontSize: 13, fontFamily: Fonts.medium },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 5 },
  statusText: { fontSize: 10, fontFamily: Fonts.bold },
  divider: { height: 1, marginVertical: 18 },
  sectionLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontSize: 14, fontFamily: Fonts.medium },
  rowValue: { fontSize: 15, fontFamily: Fonts.bold },
  settleBtn: { flexDirection: 'row', height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 },
  settleBtnText: { fontSize: 15, fontFamily: Fonts.bold, color: G.fg },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: 4 },
  footerValue: { fontSize: 18, fontFamily: Fonts.bold },
  callBtn: { flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14, gap: 8, alignItems: 'center' },
  callBtnText: { fontSize: 14, fontFamily: Fonts.bold },
});

const createModalStyles = (G: any) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 25, paddingBottom: 40, maxHeight: '80%' },
  handleRow: { alignItems: 'center', paddingTop: 14, paddingBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  title: { fontSize: 22, fontFamily: Fonts.bold, marginBottom: 4 },
  itemName: { fontSize: 13, fontFamily: Fonts.medium, marginBottom: 20 },
  option: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  optionLabel: { fontSize: 15, fontFamily: Fonts.bold },
  optionSub: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 2 },
  optionPrice: { fontSize: 15, fontFamily: Fonts.bold },
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 16, fontFamily: Fonts.bold },
  inputUnit: { fontSize: 14, fontFamily: Fonts.semibold },
  confirmBtn: { height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { fontSize: 16, fontFamily: Fonts.bold },
});

export default NefasSilkScreen;