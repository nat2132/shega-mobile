import BusinessSuccessModal, { BusinessSuccessDetails } from '@/components/BusinessSuccessModal';
import PremiumActionModal from '@/components/PremiumActionModal';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import { deleteAdjustment, getFilteredAdjustments, updateAdjustment } from '@/database/db';
import { formatDate, formatTime } from '@/utils/date-utils';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { playNice} from '@/services/soundService';
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
import { AppNumber, AppText } from '@/components/ui';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { getAdjustmentGlass } from './glass-adjustment';
import { useTutorial, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { adjustmentHistoryTutorial } from '@/tutorials/definitions';
// →→→ Types →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

interface AdjustmentDetailsProps {
  adjustment: any;
  onClose: () => void;
  onRefresh: () => void;
}

// →→→ View-All List Screen →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

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
  const { colors, calendarType, timeSystem, language, t } = useSettings();
  const G = getAdjustmentGlass(colors);
  if (!item) return null;

  const type = item.type || 'unknown';
  const getConfig = () => {
    switch (type) {
      case 'price_up':   return { icon: <TrendingUp size={18} color={colors.success} />, bg: colors.success + '15', label: t('adjustment.price_increase'), amountColor: colors.success };
      case 'price_down': return { icon: <TrendingDown size={18} color={colors.error} />, bg: colors.error + '15', label: t('adjustment.price_decrease'), amountColor: colors.error };
      case 'damaged':    return { icon: <AlertTriangle size={18} color={colors.warning} />, bg: colors.warning + '15', label: t('adjustment.damaged'), amountColor: colors.error };
      default:           return { icon: <TrendingDown size={18} color={G.fgSecondary} />, bg: G.bgCard, label: t('adj.manual'), amountColor: G.fg };
    }
  };

  const cfg = getConfig();
  const dateStr = item.createdAt ? formatDate(new Date(item.createdAt), calendarType, language) : '';
  const timeStr = item.createdAt ? formatTime(item.createdAt, timeSystem, language) : '';

  return (
    <TouchableOpacity
      style={[listStyles.row, { borderBottomColor: G.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[listStyles.iconCircle, { backgroundColor: cfg.bg }]}>{cfg.icon}</View>
      <View style={listStyles.main}>
        <AppText variant="body-lg" weight="bold" style={[listStyles.name, { color: G.fg }]} numberOfLines={1}>
          {item.itemName || t('common.unknown_item')}
        </AppText>
        <AppText variant="micro" weight="medium" style={[listStyles.sub, { color: G.fgSecondary }]} numberOfLines={1}>
          {cfg.label} • {dateStr} {timeStr}
        </AppText>
      </View>
      <View style={listStyles.end}>
        {type === 'damaged' ? (
          <AppNumber value={-(item.quantity ?? 0)} size="body" color={cfg.amountColor} />
        ) : (
          <AppNumber value={item.newValue ?? 0} size="body" showCurrency color={cfg.amountColor} />
        )}
        <AppText variant="micro" weight="medium" style={[listStyles.reason, { color: G.fgSecondary }]} numberOfLines={1}>
          {item.reason || t('adj.manual_correction')}
        </AppText>
      </View>
    </TouchableOpacity>
  );
};

const AdjustmentAllScreen = ({ onClose, onSelectItem }: { onClose: () => void; onSelectItem: (item: any) => void }) => {
  const { colors, t } = useSettings();
  const G = getAdjustmentGlass(colors);
  const tutorial = useTutorial({ tutorial: adjustmentHistoryTutorial });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [periodFilter, setPeriodFilter] = useState<string | undefined>(undefined);
  const [data, setData] = useState<any[]>([]);

  const loadData = useCallback(() => {
    const results = getFilteredAdjustments({ type: typeFilter, period: periodFilter, search });
    setData(results as any[]);
  }, [typeFilter, periodFilter, search]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  React.useEffect(() => { loadData(); }, [loadData]);

  return (
    <View style={[listStyles.container, { backgroundColor: G.bg }]}>
      <View style={{ position: 'absolute', top: -70, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: G.mutedLight, opacity: 0.4, pointerEvents: 'none' }} />
      <View style={{ position: 'absolute', top: 200, left: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: G.mutedLight, opacity: 0.25, pointerEvents: 'none' }} />
      {/* Header */}
      <TutorialTarget id="ah-header">
      <View style={listStyles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[listStyles.headerSub, { color: G.fgSecondary }]} numberOfLines={1}>CALIBRATION VAULT</AppText>
          <AppText variant="display" weight="bold" style={[listStyles.headerTitle, { color: G.fg }]} numberOfLines={2}>All Adjustments</AppText>
        </View>
        <TouchableOpacity onPress={onClose} style={[listStyles.closeBtn, { borderColor: G.border }]}>
          <X size={20} color={G.fg} />
        </TouchableOpacity>
        <TutorialButton tutorialId="adjustment-history" screenName={t('screen.adjustment_history')} />
      </View>
      </TutorialTarget>

      {/* Search */}
      <TutorialTarget id="ah-filter">
      <View style={[listStyles.searchBox, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <Search size={16} color={G.fgSecondary} />
        <TextInput
          style={[listStyles.searchInput, { color: G.fg }]}
          placeholder={t('adj.search_item_reason')}
          placeholderTextColor={G.fgSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={16} color={G.fgSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Type Filter Chips */}
      <View style={listStyles.chipRowWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={listStyles.chipRow}>
          {TYPE_FILTERS.map((f) => {
            const active = typeFilter === f.value;
            const color = 'color' in f ? f.color : G.fg;
            const iconColor = active ? color : G.fgSecondary;
            return (
              <TouchableOpacity
                key={f.label}
                style={[listStyles.chip, { borderColor: active ? color : G.border, backgroundColor: active ? color + '20' : G.bgCard }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTypeFilter(f.value); }}
              >
                <View style={listStyles.chipIconSlot}>
                  {'icon' in f && <f.icon size={13} color={iconColor} />}
                </View>
                <AppText variant="caption" weight="bold" shrink={false} style={[listStyles.chipText, { color: active ? color : G.fgSecondary }]} numberOfLines={1}>{f.label}</AppText>
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
                style={[listStyles.chip, { borderColor: active ? G.fg : G.border, backgroundColor: active ? G.fg : G.bgCard }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPeriodFilter(f.value); }}
              >
                <AppText variant="caption" weight="bold" shrink={false} style={[listStyles.chipText, { color: active ? G.bg : G.fgSecondary }]} numberOfLines={1}>{f.label}</AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Count */}
      <AppText variant="micro" weight="bold" style={[listStyles.countText, { color: G.fgSecondary }]} numberOfLines={1}>
        {data.length} record{data.length !== 1 ? 's' : ''}
      </AppText>
      </TutorialTarget>

      {/* List */}
      <TutorialTarget id="ah-list">
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
            <AlertTriangle size={48} color={G.border} />
            <AppText variant="body-lg" weight="bold" align="center" style={[listStyles.emptyText, { color: G.fgSecondary }]} numberOfLines={2}>{t('adjustment.no_records_found')}</AppText>
          </View>
        }
      />
      </TutorialTarget>
    </View>
  );
};

// →→→ Detail Screen →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const AdjustmentDetailsScreen: React.FC<AdjustmentDetailsProps> = ({ adjustment, onClose, onRefresh }) => {
  const { colors, t } = useSettings();
  const G = getAdjustmentGlass(colors);
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
    if (isDamaged) return { icon: AlertTriangle, color: colors.warning, bg: colors.warning + '15', label: t('adjustment.damaged') };
    if (isUp) return { icon: TrendingUp, color: colors.success, bg: colors.success + '15', label: t('adjustment.price_increase') };
    return { icon: TrendingDown, color: colors.error, bg: colors.error + '15', label: t('adjustment.price_decrease') };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // →→ viewAll mode: show the full list →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
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
            <Animated.View entering={FadeInUp} style={[detailStyles.sheet, { backgroundColor: G.bg }]}>
              <View style={detailStyles.handleRow}>
                <View style={[detailStyles.handle, { backgroundColor: G.bgCard }]} />
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

  // →→ Single detail view →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

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
    playNice();
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
      <View style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: G.mutedLight, opacity: 0.4, pointerEvents: 'none' }} />
      <View style={{ position: 'absolute', top: 150, left: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: G.mutedLight, opacity: 0.25, pointerEvents: 'none' }} />
      <View style={{ position: 'absolute', bottom: 100, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: G.mutedLight, opacity: 0.2, pointerEvents: 'none' }} />
      <TutorialScrollView showsVerticalScrollIndicator={false} contentContainerStyle={detailStyles.scrollContent}>
        {/* Header Block */}
        <Animated.View entering={FadeInDown.duration(400)} style={[detailStyles.headerBlock, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <View style={detailStyles.headerTop}>
            <View style={[detailStyles.typeBadge, { backgroundColor: config.bg }]}>
              <Icon size={14} color={config.color} style={{ marginRight: 6 }} />
              <AppText variant="body-sm" weight="bold" shrink={false} style={[detailStyles.typeText, { color: config.color }]} numberOfLines={1}>{config.label}</AppText>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setIsEditing(!isEditing); }} style={[detailStyles.actionBtn, { backgroundColor: G.bgCard }]}>
                <Edit2 size={16} color={G.fg} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={[detailStyles.actionBtn, { backgroundColor: colors.error + '15' }]}>
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={detailStyles.mainInfo}>
            <View style={[detailStyles.iconBox, { backgroundColor: G.bgCard }]}>
              <Package size={28} color={G.fg} />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <AppText variant="heading" weight="bold" style={[detailStyles.itemName, { color: G.fg }]} numberOfLines={2}>{adjustment.itemName}</AppText>
              <AppText variant="body-sm" weight="medium" style={[detailStyles.itemId, { color: G.fgSecondary }]} numberOfLines={1}>
                {t('adj.item_id') || 'Item ID'}: #{adjustment.itemId}
              </AppText>
            </View>
          </View>
        </Animated.View>

        {/* Mutable Fields */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={detailStyles.sectionBlock}>
          <AppText variant="caption" weight="bold" transform="uppercase" style={[detailStyles.sectionTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.details') || 'Adjustment Details'}</AppText>

          {isDamaged ? (
            <View style={[detailStyles.inputRow, { backgroundColor: G.bgCard, borderColor: isEditing ? colors.primary : G.border }]}>
              <View style={[detailStyles.inputIcon, { backgroundColor: G.bgCard }]}><Hash size={18} color={G.fgSecondary} /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={[detailStyles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.quantity')}</AppText>
                {isEditing ? (
                  <TextInput style={[detailStyles.inputField, { color: G.fg }]} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
                ) : (
                  <AppText variant="subtitle" weight="bold" style={[detailStyles.valText, { color: G.fg }]} numberOfLines={1}>{quantity} {adjustment.unitType}</AppText>
                )}
              </View>
            </View>
          ) : (
            <>
              <View style={[detailStyles.inputRow, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <View style={[detailStyles.inputIcon, { backgroundColor: G.bgCard }]}><DollarSign size={18} color={G.fgSecondary} /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={[detailStyles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.previous_price') || 'Previous Price'}</AppText>
                  <AppNumber value={adjustment.oldValue} size="display" showCurrency color={G.fgSecondary} />
                </View>
              </View>
              <View style={[detailStyles.inputRow, { backgroundColor: G.bgCard, borderColor: isEditing ? colors.primary : G.border }]}>
                <View style={[detailStyles.inputIcon, { backgroundColor: G.bgCard }]}><TrendingUp size={18} color={G.fgSecondary} /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={[detailStyles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.new_price') || 'New Price'}</AppText>
                  {isEditing ? (
                    <TextInput style={[detailStyles.inputField, { color: G.fg }]} value={newValue} onChangeText={setNewValue} keyboardType="numeric" />
                  ) : (
                    <AppNumber value={Number(newValue)} size="display" showCurrency />
                  )}
                </View>
              </View>
            </>
          )}

          <View style={[detailStyles.inputRow, { backgroundColor: G.bgCard, borderColor: isEditing ? colors.primary : G.border }]}>
            <View style={[detailStyles.inputIcon, { backgroundColor: G.bgCard }]}><AlignLeft size={18} color={G.fgSecondary} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[detailStyles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.reason')}</AppText>
              {isEditing ? (
                <TextInput style={[detailStyles.inputField, { color: G.fg }]} value={reason} onChangeText={setReason} placeholder={t('expense.desc_placeholder')} placeholderTextColor={G.fgSecondary} />
              ) : (
                <AppText variant="subtitle" weight="bold" style={[detailStyles.valText, { color: G.fg }]} numberOfLines={2}>{reason || t('adj.manual_correction')}</AppText>
              )}
            </View>
          </View>
        </Animated.View>

        {isEditing && (
          <Animated.View entering={FadeInDown} style={{ paddingHorizontal: 25, marginTop: 10 }}>
            <TouchableOpacity style={[detailStyles.saveBtn, { backgroundColor: G.fg }]} onPress={handleUpdate}>
              <AppText variant="subtitle" weight="bold" style={[detailStyles.saveBtnText, { color: G.bg }]} numberOfLines={1}>{t('adj.save_changes') || 'Save Changes'}</AppText>
            </TouchableOpacity>
          </Animated.View>
        )}
      </TutorialScrollView>

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

// →→→ Styles →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const listStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 10, paddingBottom: 20 },
  headerSub: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
  headerTitle: { fontSize: 26, fontFamily: Fonts.bold },
  closeBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 25, height: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, gap: 10, marginBottom: 14, overflow: 'hidden' },
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
  headerBlock: { margin: 25, marginTop: 10, borderRadius: 24, padding: 20, borderWidth: 1, overflow: 'hidden' },
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
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  inputIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  inputLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', marginBottom: 2 },
  valText: { fontSize: 16, fontFamily: Fonts.bold },
  inputField: { fontSize: 16, fontFamily: Fonts.bold, padding: 0, margin: 0 },
  saveBtn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontFamily: Fonts.bold },
  // drill-in modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  handleRow: { alignItems: 'center', paddingTop: 14, paddingBottom: 6 },
  handle: { width: 40, height: 4, borderRadius: 2 },
});

export default AdjustmentDetailsScreen;