import BusinessSuccessModal, { BusinessSuccessDetails } from '@/components/BusinessSuccessModal';
import PremiumActionModal from '@/components/PremiumActionModal';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import { deleteAdjustment, getFilteredAdjustments, updateAdjustment } from '@/database/db';
import { formatTime } from '@/utils/date-utils';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
    AlertTriangle,
    AlignLeft,
    DollarSign,
    Edit2,
    Hash,
    Package,
    Search,
    Trash2,
    TrendingDown,
    TrendingUp,
    X
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
// ─── Types ───────────────────────────────────────────────────────────────────

interface AdjustmentDetailsProps {
  adjustment: any;
  onClose: () => void;
  onRefresh: () => void;
}

// ─── View-All List Screen ────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Price Up', value: 'price_up', color: '#34C759', icon: TrendingUp },
  { label: 'Price Down', value: 'price_down', color: '#FF3B30', icon: TrendingDown },
  { label: 'Damaged', value: 'damaged', color: '#FF9500', icon: AlertTriangle },
] as const;

const PERIOD_FILTERS = [
  { label: 'All Time', value: undefined },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' },
] as const;

const AdjustmentListItem = ({ item, onPress }: { item: any; onPress: () => void }) => {
  const { colors, timeSystem, language, t } = useSettings();
  if (!item) return null;

  const type = item.type || 'unknown';
  const getConfig = () => {
    switch (type) {
      case 'price_up':   return { icon: <TrendingUp size={18} color="#34C759" />, bg: '#34C75915', label: t('adjustment.price_increase'), amountColor: '#34C759' };
      case 'price_down': return { icon: <TrendingDown size={18} color="#FF3B30" />, bg: '#FF3B3015', label: t('adjustment.price_decrease'), amountColor: '#FF3B30' };
      case 'damaged':    return { icon: <AlertTriangle size={18} color="#FF9500" />, bg: '#FF950015', label: t('adjustment.damaged'), amountColor: '#FF3B30' };
      default:           return { icon: <TrendingDown size={18} color={colors.textSecondary} />, bg: colors.border, label: t('adj.manual'), amountColor: colors.text };
    }
  };

  const cfg = getConfig();
  const dateStr = item.createdAt ? item.createdAt.split(' ')[0] : '';
  // Use the user's selected time system when rendering the
  // adjustment timestamp. `item.createdAt` is a SQLite timestamp
  // (UTC), so formatTime handles the local-time shift internally.
  const timeStr = item.createdAt ? formatTime(item.createdAt, timeSystem, language) : '';

  return (
    <TouchableOpacity
      style={[listStyles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[listStyles.iconCircle, { backgroundColor: cfg.bg }]}>{cfg.icon}</View>
      <View style={listStyles.main}>
        <AppText variant="body-lg" weight="bold" style={[listStyles.name, { color: colors.text }]} numberOfLines={1}>
          {item.itemName || t('common.unknown_item')}
        </AppText>
        <AppText variant="micro" weight="medium" style={[listStyles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
          {cfg.label} • {dateStr} {timeStr}
        </AppText>
      </View>
      <View style={listStyles.end}>
        {type === 'damaged' ? (
          <AppText variant="body" weight="bold" shrink={false} style={[listStyles.amount, { color: cfg.amountColor }]} numberOfLines={1}>-{item.quantity ?? 0}</AppText>
        ) : (
          <AppText variant="body" weight="bold" shrink={false} style={[listStyles.amount, { color: cfg.amountColor }]} numberOfLines={1}>{(item.newValue ?? 0).toLocaleString()} {t('common.etb')}</AppText>
        )}
        <AppText variant="micro" weight="medium" style={[listStyles.reason, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.reason || t('adj.manual_correction')}
        </AppText>
      </View>
    </TouchableOpacity>
  );
};

const AdjustmentAllScreen = ({ onClose, onSelectItem }: { onClose: () => void; onSelectItem: (item: any) => void }) => {
  const { colors, t, theme } = useSettings();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [periodFilter, setPeriodFilter] = useState<string | undefined>(undefined);
  const [data, setData] = useState<any[]>([]);

  const loadData = useCallback(() => {
    const results = getFilteredAdjustments({ type: typeFilter, period: periodFilter, search });
    setData(results as any[]);
  }, [typeFilter, periodFilter, search]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  React.useEffect(() => { loadData(); }, [typeFilter, periodFilter, search]);

  return (
    <View style={[listStyles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={listStyles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[listStyles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>CALIBRATION VAULT</AppText>
          <AppText variant="display" weight="bold" style={[listStyles.headerTitle, { color: colors.text }]} numberOfLines={2}>All Adjustments</AppText>
        </View>
        <TouchableOpacity onPress={onClose} style={[listStyles.closeBtn, { borderColor: colors.border }]}>
          <X size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[listStyles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Search size={16} color={colors.textSecondary} />
        <TextInput
          style={[listStyles.searchInput, { color: colors.text }]}
          placeholder={t('adj.search_item_reason')}
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Type Filter Chips */}
      <View style={listStyles.chipRowWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={listStyles.chipRow}>
          {TYPE_FILTERS.map((f) => {
            const active = typeFilter === f.value;
            const color = 'color' in f ? f.color : colors.text;
            const iconColor = active ? color : colors.textSecondary;
            return (
              <TouchableOpacity
                key={f.label}
                style={[listStyles.chip, { borderColor: active ? color : colors.border, backgroundColor: active ? color + '20' : colors.card }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTypeFilter(f.value); }}
              >
                <View style={listStyles.chipIconSlot}>
                  {'icon' in f && <f.icon size={13} color={iconColor} />}
                </View>
                <AppText variant="caption" weight="bold" shrink={false} style={[listStyles.chipText, { color: active ? color : colors.textSecondary }]} numberOfLines={1}>{f.label}</AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Period Filter Chips */}
      <View style={listStyles.chipRowWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={listStyles.chipRow}>
          {PERIOD_FILTERS.map((f) => {
            const active = periodFilter === f.value;
            return (
              <TouchableOpacity
                key={f.label}
                style={[listStyles.chip, { borderColor: active ? colors.text : colors.border, backgroundColor: active ? colors.text : colors.card }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPeriodFilter(f.value); }}
              >
                <AppText variant="caption" weight="bold" shrink={false} style={[listStyles.chipText, { color: active ? colors.background : colors.textSecondary }]} numberOfLines={1}>{f.label}</AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Count */}
      <AppText variant="micro" weight="bold" style={[listStyles.countText, { color: colors.textSecondary }]} numberOfLines={1}>
        {data.length} record{data.length !== 1 ? 's' : ''}
      </AppText>

      {/* List */}
      <FlatList
        data={data}
        keyExtractor={(item, i) => item?.id?.toString() ?? i.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 30).duration(300)}>
            <AdjustmentListItem item={item} onPress={() => onSelectItem(item)} />
          </Animated.View>
        )}
        ListEmptyComponent={
          <View style={listStyles.empty}>
            <AlertTriangle size={48} color={colors.border} />
            <AppText variant="body-lg" weight="bold" align="center" style={[listStyles.emptyText, { color: colors.textSecondary }]} numberOfLines={2}>No adjustments found</AppText>
          </View>
        }
      />
    </View>
  );
};

// ─── Detail Screen ────────────────────────────────────────────────────────────

const AdjustmentDetailsScreen: React.FC<AdjustmentDetailsProps> = ({ adjustment, onClose, onRefresh }) => {
  const { colors, t } = useSettings();
  const dialog = useDialog();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [successDetails, setSuccessDetails] = useState<BusinessSuccessDetails | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Editable fields
  const [quantity, setQuantity] = useState(adjustment?.quantity?.toString() || '');
  const [newValue, setNewValue] = useState(adjustment?.newValue?.toString() || '');
  const [reason, setReason] = useState(adjustment?.reason || '');

  const isDamaged = adjustment?.type === 'damaged';
  const isUp = adjustment?.type === 'price_up';

  const getStatusConfig = () => {
    if (isDamaged) return { icon: AlertTriangle, color: '#FF9500', bg: '#FF950015', label: t('adjustment.damaged') };
    if (isUp) return { icon: TrendingUp, color: '#34C759', bg: '#34C75915', label: t('adjustment.price_increase') };
    return { icon: TrendingDown, color: '#FF3B30', bg: '#FF3B3015', label: t('adjustment.price_decrease') };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // ── viewAll mode: show the full list ──────────────────────────────────────
  if (!adjustment) {
    return (
      <>
        <AdjustmentAllScreen
          onClose={onClose}
          onSelectItem={(item) => setSelectedItem(item)}
        />
        {/* Drill-in detail modal */}
        <Modal visible={!!selectedItem} transparent animationType="slide" onRequestClose={() => setSelectedItem(null)}>
          <View style={detailStyles.modalOverlay}>
            <TouchableOpacity style={detailStyles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedItem(null)} />
            <Animated.View entering={FadeInUp} style={[detailStyles.sheet, { backgroundColor: colors.background }]}>
              <View style={detailStyles.handleRow}>
                <View style={[detailStyles.handle, { backgroundColor: colors.border }]} />
              </View>
              {selectedItem && (
                <AdjustmentDetailsScreen
                  adjustment={selectedItem}
                  onClose={() => { setSelectedItem(null); onRefresh(); }}
                  onRefresh={() => { setSelectedItem(null); onRefresh(); }}
                />
              )}
            </Animated.View>
          </View>
        </Modal>
      </>
    );
  }

  // ── Single detail view ────────────────────────────────────────────────────

  const handleUpdate = async () => {
    if (isDamaged) {
      const qty = Number(quantity);
      if (!quantity || isNaN(qty) || qty <= 0) { await dialog.alert({ title: t('common.error'), message: t('adj.valid_quantity'), iconType: 'danger' }); return; }
      if (qty === adjustment.quantity) { await dialog.alert({ title: t('common.error'), message: t('adj.no_change'), iconType: 'danger' }); return; }
    } else {
      if (!newValue) { await dialog.alert({ title: t('common.error'), message: t('adj.valid_price'), iconType: 'danger' }); return; }
      const val = Number(newValue);
      if (isNaN(val) || val <= 0) { await dialog.alert({ title: t('common.error'), message: t('adj.valid_price'), iconType: 'danger' }); return; }
      if (val === adjustment.oldValue) { await dialog.alert({ title: t('common.error'), message: t('adj.no_change'), iconType: 'danger' }); return; }
    }
    if (!reason?.trim()) { await dialog.alert({ title: t('common.error'), message: t('adj.reason_required'), iconType: 'danger' }); return; }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updates: any = {};
    if (isDamaged && quantity) updates.quantity = Number(quantity);
    if (!isDamaged && newValue) updates.newValue = Number(newValue);
    updates.reason = reason;

    updateAdjustment(adjustment.id, updates);
    setIsEditing(false);
    onRefresh();

    setSuccessDetails({
      title: t('adj.edited_success') || 'Adjustment Updated',
      subtitle: t('adj.edited_sub') || 'Calibration record modified successfully',
      mainLabel: isDamaged ? t('adj.loss_qty') : t('adj.new_price'),
      mainValue: isDamaged ? `-${quantity} Units` : `${newValue} ${t('common.etb')}`,
      secondaryLabel: t('common.edited') || 'Edited',
      secondaryValue: '',
      iconType: isDamaged ? 'damaged' : (isUp ? 'price_up' : 'price_down'),
      itemName: adjustment.itemName,
    });
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deleteAdjustment(adjustment.id);
    setShowDeleteConfirm(false);
    onRefresh();

    setSuccessDetails({
      title: t('adj.deleted_success') || 'Record Deleted',
      subtitle: t('adj.deleted_sub') || 'Calibration record removed securely',
      mainLabel: '',
      mainValue: t('common.deleted') || 'Deleted',
      iconType: 'damaged',
      itemName: adjustment.itemName,
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={detailStyles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={detailStyles.scrollContent}>
        {/* Header Block */}
        <Animated.View entering={FadeInDown.duration(400)} style={[detailStyles.headerBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={detailStyles.headerTop}>
            <View style={[detailStyles.typeBadge, { backgroundColor: config.bg }]}>
              <Icon size={14} color={config.color} style={{ marginRight: 6 }} />
              <AppText variant="body-sm" weight="bold" shrink={false} style={[detailStyles.typeText, { color: config.color }]} numberOfLines={1}>{config.label}</AppText>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setIsEditing(!isEditing); }} style={[detailStyles.actionBtn, { backgroundColor: colors.border }]}>
                <Edit2 size={16} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={[detailStyles.actionBtn, { backgroundColor: '#FF3B3015' }]}>
                <Trash2 size={16} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={detailStyles.mainInfo}>
            <View style={[detailStyles.iconBox, { backgroundColor: colors.border }]}>
              <Package size={28} color={colors.text} />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <AppText variant="heading" weight="bold" style={[detailStyles.itemName, { color: colors.text }]} numberOfLines={2}>{adjustment.itemName}</AppText>
              <AppText variant="body-sm" weight="medium" style={[detailStyles.itemId, { color: colors.textSecondary }]} numberOfLines={1}>
                {t('adj.item_id') || 'Item ID'}: #{adjustment.itemId}
              </AppText>
            </View>
          </View>
        </Animated.View>

        {/* Mutable Fields */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={detailStyles.sectionBlock}>
          <AppText variant="caption" weight="bold" transform="uppercase" style={[detailStyles.sectionTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.details') || 'Adjustment Details'}</AppText>

          {isDamaged ? (
            <View style={[detailStyles.inputRow, { backgroundColor: colors.card, borderColor: isEditing ? colors.primary : colors.border }]}>
              <View style={[detailStyles.inputIcon, { backgroundColor: colors.border }]}><Hash size={18} color={colors.textSecondary} /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={[detailStyles.inputLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('form.quantity')}</AppText>
                {isEditing ? (
                  <TextInput style={[detailStyles.inputField, { color: colors.text }]} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
                ) : (
                  <AppText variant="subtitle" weight="bold" style={[detailStyles.valText, { color: colors.text }]} numberOfLines={1}>{quantity} {adjustment.unitType}</AppText>
                )}
              </View>
            </View>
          ) : (
            <>
              <View style={[detailStyles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[detailStyles.inputIcon, { backgroundColor: colors.border }]}><DollarSign size={18} color={colors.textSecondary} /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={[detailStyles.inputLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.previous_price') || 'Previous Price'}</AppText>
                  <AppText variant="subtitle" weight="bold" style={[detailStyles.valText, { color: colors.textSecondary }]} numberOfLines={1}>{adjustment.oldValue} {t('common.etb')}</AppText>
                </View>
              </View>
              <View style={[detailStyles.inputRow, { backgroundColor: colors.card, borderColor: isEditing ? colors.primary : colors.border }]}>
                <View style={[detailStyles.inputIcon, { backgroundColor: colors.border }]}><TrendingUp size={18} color={colors.textSecondary} /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={[detailStyles.inputLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.new_price') || 'New Price'}</AppText>
                  {isEditing ? (
                    <TextInput style={[detailStyles.inputField, { color: colors.text }]} value={newValue} onChangeText={setNewValue} keyboardType="numeric" />
                  ) : (
                    <AppText variant="subtitle" weight="bold" style={[detailStyles.valText, { color: colors.text }]} numberOfLines={1}>{newValue} {t('common.etb')}</AppText>
                  )}
                </View>
              </View>
            </>
          )}

          <View style={[detailStyles.inputRow, { backgroundColor: colors.card, borderColor: isEditing ? colors.primary : colors.border }]}>
            <View style={[detailStyles.inputIcon, { backgroundColor: colors.border }]}><AlignLeft size={18} color={colors.textSecondary} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[detailStyles.inputLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.reason')}</AppText>
              {isEditing ? (
                <TextInput style={[detailStyles.inputField, { color: colors.text }]} value={reason} onChangeText={setReason} placeholder={t('expense.desc_placeholder')} placeholderTextColor={colors.textSecondary} />
              ) : (
                <AppText variant="subtitle" weight="bold" style={[detailStyles.valText, { color: colors.text }]} numberOfLines={2}>{reason || t('adj.manual_correction')}</AppText>
              )}
            </View>
          </View>
        </Animated.View>

        {isEditing && (
          <Animated.View entering={FadeInDown} style={{ paddingHorizontal: 25, marginTop: 10 }}>
            <TouchableOpacity style={[detailStyles.saveBtn, { backgroundColor: colors.text }]} onPress={handleUpdate}>
              <AppText variant="subtitle" weight="bold" style={[detailStyles.saveBtnText, { color: colors.background }]} numberOfLines={1}>{t('adj.save_changes') || 'Save Changes'}</AppText>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <PremiumActionModal
          title={t('adj.delete_confirm') || 'Delete Calibration?'}
          subtitle={t('adj.delete_desc') || 'This action removes the record. Damaged quantities will be refunded to inventory. It cannot be undone.'}
          actionText={t('common.delete') || 'Delete'}
          cancelText={t('common.cancel')}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          iconType="danger"
        />
      </Modal>

      {successDetails && (
        <BusinessSuccessModal
          details={successDetails}
          onClose={() => { setSuccessDetails(null); onClose(); }}
        />
      )}
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const listStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 10, paddingBottom: 20 },
  headerSub: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
  headerTitle: { fontSize: 26, fontFamily: Fonts.bold },
  closeBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 25, height: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, gap: 10, marginBottom: 14 },
  searchInput: { flex: 1, fontFamily: Fonts.medium, fontSize: 14 },
  chipRow: { paddingHorizontal: 25, gap: 8, alignItems: 'center' },
  chipRowWrapper: {
    height: 54,
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    gap: 5,
  },
  chipIconSlot: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 12, fontFamily: Fonts.bold, lineHeight: 14 },
  countText: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 25, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 25, borderBottomWidth: 1 },
  iconCircle: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 13 },
  main: { flex: 1 },
  name: { fontSize: 15, fontFamily: Fonts.bold, marginBottom: 2 },
  sub: { fontSize: 11, fontFamily: Fonts.medium },
  end: { alignItems: 'flex-end', maxWidth: 110 },
  amount: { fontSize: 14, fontFamily: Fonts.bold, marginBottom: 2 },
  reason: { fontSize: 11, fontFamily: Fonts.medium },
  empty: { alignItems: 'center', paddingTop: 80, gap: 14 },
  emptyText: { fontSize: 15, fontFamily: Fonts.bold },
});

const detailStyles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  headerBlock: { margin: 25, marginTop: 10, borderRadius: 24, padding: 20, borderWidth: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  typeText: { fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  actionBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  mainInfo: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 20, fontFamily: Fonts.bold, marginBottom: 4 },
  itemId: { fontSize: 13, fontFamily: Fonts.medium },
  sectionBlock: { paddingHorizontal: 25, gap: 12 },
  sectionTitle: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', marginBottom: 5, marginLeft: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, borderWidth: 1 },
  inputIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  inputLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', marginBottom: 2 },
  valText: { fontSize: 16, fontFamily: Fonts.bold },
  inputField: { fontSize: 16, fontFamily: Fonts.bold, padding: 0, margin: 0 },
  saveBtn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontFamily: Fonts.bold },
  // drill-in modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { height: '85%', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  handleRow: { alignItems: 'center', paddingTop: 14, paddingBottom: 6 },
  handle: { width: 40, height: 4, borderRadius: 2 },
});

export default AdjustmentDetailsScreen;
