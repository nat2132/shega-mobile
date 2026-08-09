import { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  Modal 
} from 'react-native';
import { 
  Search, 
  ChevronDown, 
  ChevronRight,
  History,
  TrendingDown,
  Info,
  Zap,
  ShieldAlert,
  LayoutGrid
, Calendar } from 'lucide-react-native';
import Animated, {
  FadeInDown
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { playNice, playBad } from '@/services/soundService';
import { Fonts } from '@/constants/theme';
import { searchInventory, insertAdjustment } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useDialog } from '@/context/DialogContext';
import BusinessSuccessModal, { BusinessSuccessDetails } from '@/components/BusinessSuccessModal';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { formatDate } from '@/utils/date-utils';

import { AppNumber, AppText} from '@/components/ui';
import { getAdjustmentGlass } from './glass-adjustment';
import { useFormDrafts } from '@/hooks/useFormDrafts';
import { DraftSection } from '@/components/DraftSection';
import { Draft } from '@/services/draftService';
import { useTutorial, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { damagedItemTutorial } from '@/tutorials/definitions';
const DamagedItemForm = ({ onComplete }: { onComplete?: () => void }) => {
  const { colors, calendarType, language, t } = useSettings();
  const { isReadOnly } = useSubscription();
  const G = getAdjustmentGlass(colors);
  const dialog = useDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState('');
  const [unitType, setUnitType] = useState<'base' | 'pack'>('base');
  const [reason, setReason] = useState(t('adj.reason_broken'));
  const [showResults, setShowResults] = useState(false);
  const [successDetails, setSuccessDetails] = useState<BusinessSuccessDetails | null>(null);
  const [recordDate, setRecordDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const draftFormKey = 'damaged';
  const draftFormData = useFormDrafts({
    screen: 'adjustment-damaged',
    formKey: draftFormKey,
    getPayload: useCallback(() => ({
      searchQuery,
      selectedItem,
      quantity,
      unitType,
      reason,
      recordDate,
    }), [searchQuery, selectedItem, quantity, unitType, reason, recordDate]),
    getTitle: useCallback(() => (selectedItem?.name 
      ? `Damaged - ${selectedItem.name}` 
      : 'Damaged Draft'), [selectedItem]),
    getSubtitle: useCallback(() => {
      const q = parseFloat(quantity) || 0;
      return q > 0 ? `Qty: ${q} ${unitType === 'pack' ? 'pack(s)' : 'unit(s)'}` : 'No quantity set';
    }, [quantity, unitType]),
    enabled: !successDetails,
  });

  const tutorial = useTutorial({ tutorial: damagedItemTutorial });

  useEffect(() => {
    if (searchQuery.length > 1) {
      const results = searchInventory(searchQuery);
      setSearchResults(results);
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }, [searchQuery]);

  const handleSelectItem = (item: any) => {
    Haptics.selectionAsync();
    setSelectedItem(item);
    setSearchQuery(item.name);
    setShowResults(false);
  };

  const calculateLossValue = () => {
    if (!selectedItem || !quantity) return 0;
    const qty = parseFloat(quantity) || 0;
    const price = unitType === 'pack' ? (selectedItem.packPurchasePrice || selectedItem.basePurchasePrice * (selectedItem.unitsPerPack || 1)) : selectedItem.basePurchasePrice;
    return qty * price;
  };

  const handleConfirm = async () => {
    if (isReadOnly) {
      await dialog.alert({ title: t('common.read_only_mode'), message: t('common.read_only_mode'), iconType: 'warning' });
      return;
    }
    if (!selectedItem) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({
        title: t('common.error'),
        message: t('adj.select_asset'),
        iconType: 'danger',
      });
      return;
    }

    const qty = parseFloat(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({
        title: t('common.error'),
        message: t('adj.valid_quantity'),
        iconType: 'danger',
      });
      return;
    }

    if (qty > selectedItem.totalBaseQuantity) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({
        title: t('common.error'),
        message: 'Cannot exceed available stock',
        iconType: 'danger',
      });
      return;
    }

    if (!reason?.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({
        title: t('common.error'),
        message: t('adj.select_reason'),
        iconType: 'danger',
      });
      return;
    }

    const adjData = {
      itemId: selectedItem.id,
      type: 'damaged',
      oldValue: null,
      newValue: null,
      quantity: qty,
      unitType: unitType,
      reason: reason,
      date: new Date().toISOString().split('T')[0],
      createdAt: recordDate || undefined
    };

    const result = await insertAdjustment(adjData);
    if (result) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playNice();
      setSuccessDetails({
        title: t('adj.stock_integrity_updated'),
        subtitle: t('adj.loss_authorized'),
        mainLabel: t('adj.loss_qty'),
        mainValue: `${quantity} ${unitType === 'pack' ? (selectedItem?.purchaseUnit || t('adj.pack')) : (selectedItem?.baseUnit || t('adj.unit'))}`,
        secondaryLabel: t('adj.magnitude'),
        secondaryValue: `-${calculateLossValue().toLocaleString()} ${t('common.etb')}`,
        iconType: 'damaged',
        itemName: selectedItem.name
      });
      await draftFormData.clearCurrent();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      await dialog.alert({
        title: t('common.error'),
        message: t('adj.record_failed'),
        iconType: 'danger',
      });
    }
  };

  const lossValue = calculateLossValue();
  const warningColor = colors.warning;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: G.mutedLight, opacity: 0.4, pointerEvents: 'none' }} />
      <View style={{ position: 'absolute', top: 150, left: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: G.mutedLight, opacity: 0.25, pointerEvents: 'none' }} />
      <View style={{ position: 'absolute', bottom: 100, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: G.mutedLight, opacity: 0.2, pointerEvents: 'none' }} />
      <TutorialScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {draftFormData.showDrafts && (
          <DraftSection
            drafts={draftFormData.drafts}
            onRestore={async (draft) => {
              const d = draft.data;
              setSearchQuery(d.searchQuery || '');
              setQuantity(d.quantity || '');
              setUnitType(d.unitType || 'base');
              setReason(d.reason || '');
              setRecordDate(d.recordDate || '');
              if (d.selectedItem) {
                setSelectedItem(d.selectedItem);
                setSearchQuery(d.selectedItem.name || '');
              }
              await draftFormData.remove(draft.id);
            }}
            onDelete={async (id) => {
              await draftFormData.remove(id);
            }}
          />
        )}

        <TutorialTarget id="di-header">
          <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
              <View style={styles.headerRow}>
                 <View>
                  <AppText variant="body-sm" weight="bold" transform="uppercase" style={[styles.headerSub, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.integrity_audit')}</AppText>
                  <AppText variant="display-lg" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{t('adj.stock_integrity')}</AppText>
               </View>
                  <View style={[styles.modeBadge, { backgroundColor: warningColor + '15' }]}>
                     <AppText variant="micro" weight="bold" shrink={false} style={[styles.modeText, { color: warningColor }]} numberOfLines={1}>{t('common.damaged').toUpperCase()}</AppText>
                 </View>
              </View>
          </Animated.View>
        </TutorialTarget>

        {/* Integrity Impact Visualization */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.impactContainer}>
           <View style={[styles.impactCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
             <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.impactLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.valuation_impact')}</AppText>
             
             <View style={styles.impactRow}>
                <View style={{ flex: 1 }}>
                   <AppText variant="body-sm" weight="bold" transform="uppercase" style={[styles.impactKey, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.asset_drain')}</AppText>
                   <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                     <AppText variant="display-lg" weight="bold" style={{ color: G.fg }}>- </AppText>
                     <AppNumber value={parseFloat(quantity) || 0} size="display-lg" weight="bold" style={{ color: G.fg }} />
                     <AppText variant="body" weight="medium" style={styles.smallUnit}> {unitType === 'pack' ? (selectedItem?.purchaseUnit || t('adj.pack')) : (selectedItem?.baseUnit || t('adj.unit'))}</AppText>
                   </View>
                </View>
                <View style={[styles.impactIconBox, { backgroundColor: warningColor + '15' }]}>
                   <TrendingDown size={28} color={warningColor} />
                </View>
             </View>

             <View style={[styles.divider, { backgroundColor: G.border }]} />

             <View style={styles.impactRow}>
                <AppText variant="body-sm" weight="bold" transform="uppercase" style={[styles.impactKey, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.loss_magnitude')}</AppText>
                <AppNumber value={-lossValue} showCurrency size="heading-lg" weight="bold" showSign style={{ color: warningColor }} />
             </View>

             <View style={styles.logRow}>
               <History size={12} color={G.fgSecondary} />
               <AppText variant="micro" weight="bold" style={[styles.logText, { color: G.fgSecondary }]} numberOfLines={1}>
                  {t('adj.audit_id')}: <AppText variant="micro" weight="bold" style={styles.boldLog} numberOfLines={1}>LSS-{new Date().getTime().toString().slice(-6)}</AppText>
               </AppText>
             </View>
           </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.formSection}>
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
               <Search size={14} color={G.fgSecondary} />
               <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.target_asset')}</AppText>
            </View>
            <TutorialTarget id="di-search">
              <View style={[styles.inputWrapper, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <TextInput
                  style={[styles.input, { color: G.fg }]}
                  placeholder={t("adj.search_placeholder")}
                  placeholderTextColor={G.fgSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </TutorialTarget>
            {showResults && (
              <TutorialTarget id="di-item-select">
                <Animated.View entering={FadeInDown} style={[styles.resultsPanel, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                  {searchResults.map((item) => (
                    <TouchableOpacity key={item.id} style={[styles.resultItem, { borderBottomColor: G.border }]} onPress={() => handleSelectItem(item)}>
                      <View>
                         <AppText variant="body-lg" weight="bold" style={[styles.resultText, { color: G.fg }]} numberOfLines={1}>{item.name}</AppText>
                         <AppText variant="caption" weight="medium" style={[styles.resultSubtext, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.available')}: <AppNumber value={item.totalBaseQuantity} size="caption" weight="medium" style={{ color: G.fgSecondary }} /> {item.baseUnit}</AppText>
                      </View>
                      <ChevronRight size={16} color={G.fgSecondary} />
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              </TutorialTarget>
            )}
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1.2, marginRight: 15 }]}>
              <View style={styles.labelRow}>
                 <Zap size={14} color={G.fgSecondary} />
                 <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.loss_qty')}</AppText>
              </View>
              <TutorialTarget id="di-quantity">
                <View style={[styles.inputWrapper, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                  <TextInput
                    style={[styles.input, { color: G.fg, fontFamily: Fonts.bold, fontSize: 18 }]}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                    placeholder={t('inv.qty_ph')}
                    placeholderTextColor={G.fgSecondary}
                  />
                </View>
              </TutorialTarget>
            </View>
            
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <View style={styles.labelRow}>
                 <LayoutGrid size={14} color={G.fgSecondary} />
                 <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.scale')}</AppText>
              </View>
              <TutorialTarget id="di-unit-type">
                <View style={[styles.unitToggleRow, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                   <TouchableOpacity 
                     style={[styles.unitBtn, unitType === 'base' && [styles.activeUnit, { backgroundColor: G.fg }]]} 
                     onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUnitType('base'); }}
                   >
                     <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.unitBtnText, { color: G.fgSecondary }, unitType === 'base' && { color: G.bg }]} numberOfLines={1}>{t('adj.unit')}</AppText>
                   </TouchableOpacity>
                   <TouchableOpacity 
                     style={[styles.unitBtn, unitType === 'pack' && [styles.activeUnit, { backgroundColor: G.fg }]]} 
                     onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUnitType('pack'); }}
                   >
                     <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.unitBtnText, { color: G.fgSecondary }, unitType === 'pack' && { color: G.bg }]} numberOfLines={1}>{t('adj.pack')}</AppText>
                   </TouchableOpacity>
                </View>
              </TutorialTarget>
            </View>
          </View>

          <TutorialTarget id="di-reason">
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                 <Info size={14} color={G.fgSecondary} />
                 <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.loss_reason')}</AppText>
              </View>
              <TouchableOpacity style={[styles.dropdownWrapper, { backgroundColor: G.bgCard, borderColor: G.border }]} onPress={() => Haptics.selectionAsync()}>
                <AppText variant="subtitle" weight="bold" style={[styles.dropdownText, { color: G.fg }]} numberOfLines={1}>{reason}</AppText>
                <ChevronDown color={G.fgSecondary} size={20} />
              </TouchableOpacity>
              <View style={styles.reasonsRow}>
                {[t('adj.reason_broken'), t('adj.reason_expired'), t('adj.reason_defective'), t('adj.reason_water')].map(r => (
                  <TouchableOpacity 
                    key={r} 
                    style={[styles.reasonTag, { backgroundColor: G.bgCard, borderColor: reason === r ? warningColor : G.border }]} 
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReason(r); }}
                  >
                    <AppText variant="caption" weight="bold" shrink={false} style={[styles.reasonTagText, { color: reason === r ? warningColor : G.fgSecondary }]} numberOfLines={1}>{r}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TutorialTarget>
        </Animated.View>

        {/* Record Date */}
        <TutorialTarget id="di-date">
          <TouchableOpacity 
            style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderWidth: 1, borderColor: G.border, borderRadius: 20, padding: 16, marginBottom: 15 }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar size={18} color={warningColor} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <AppText variant="micro" weight="semibold" transform="uppercase" style={{ color: G.fgSecondary }} numberOfLines={1}>{t('common.record_date') || 'Record Date'}</AppText>
              <AppText variant="subtitle" weight="bold" style={{ color: recordDate ? G.fg : G.fgSecondary, marginTop: 2 }} numberOfLines={1}>
                {recordDate ? formatDate(new Date(recordDate), calendarType, language) : (t('common.today') || 'Today (Default)')}
              </AppText>
            </View>
          </TouchableOpacity>
        </TutorialTarget>

        <TutorialTarget id="di-commit-btn">
          <TouchableOpacity 
            style={[styles.confirmBtn, { backgroundColor: G.fg }]} 
            activeOpacity={0.8} 
            onPress={handleConfirm}
          >
            <ShieldAlert color={G.bg} size={20} />
            <AppText variant="subtitle" weight="bold" style={[styles.confirmText, { color: G.bg }]} numberOfLines={1}>{t('adj.authorize_loss')}</AppText>
          </TouchableOpacity>
        </TutorialTarget>
        <TutorialButton tutorialId="damaged-item" screenName={t('screen.damaged_item')} />
        
        <View style={{ height: 100 }} />

        <Modal visible={!!successDetails} transparent animationType="fade">
          <BusinessSuccessModal 
            details={successDetails!} 
            onClose={() => {
              setSuccessDetails(null);
              onComplete?.();
            }} 
          />
        </Modal>

        <CustomDatePicker
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onSelectDate={(date) => { setRecordDate(date); setShowDatePicker(false); }}
          initialDate={recordDate}
        />
      </TutorialScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  header: { marginTop: 10, marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerSub: { fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { fontSize: 32, fontFamily: Fonts.bold, letterSpacing: -1 },
  modeBadge: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  impactContainer: { marginBottom: 20 },
  impactCard: { borderRadius: 28, padding: 18, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 14, elevation: 3, overflow: 'hidden' },
  impactLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', marginBottom: 14, letterSpacing: 1.5 },
  impactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  impactKey: { fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase', marginBottom: 5 },
  impactValueMain: { fontSize: 32, fontFamily: Fonts.bold },
  smallUnit: { fontSize: 14, fontFamily: Fonts.medium },
  impactIconBox: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  divider: { height: 1, marginVertical: 14 },
  impactValueSecondary: { fontSize: 24, fontFamily: Fonts.bold },
  smallCurr: { fontSize: 12 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, justifyContent: 'center' },
  logText: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  boldLog: { },
  formSection: { gap: 14 },
  inputGroup: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5 },
  fieldLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  inputWrapper: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, justifyContent: 'center' },
  input: { fontSize: 15, fontFamily: Fonts.medium },
  row: { flexDirection: 'row', alignItems: 'center' },
  unitToggleRow: { flexDirection: 'row', height: 52, padding: 4, borderRadius: 16, borderWidth: 1 },
  unitBtn: { flex: 1, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  activeUnit: { elevation: 2 },
  unitBtnText: { fontFamily: Fonts.bold, fontSize: 13 },
  dropdownWrapper: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 16, fontFamily: Fonts.bold },
  reasonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  reasonTag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  reasonTagText: { fontSize: 12, fontFamily: Fonts.bold },
  resultsPanel: { borderRadius: 20, borderWidth: 1, marginTop: 5, zIndex: 100, maxHeight: 250 },
  resultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, minHeight: 60 },
  resultText: { fontSize: 15, fontFamily: Fonts.bold },
  resultSubtext: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 2 },
  confirmBtn: { height: 56, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16 },
  confirmText: { fontSize: 16, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  modeText: { fontSize: 11, fontFamily: Fonts.bold },
});

export default DamagedItemForm;