import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  Modal 
} from 'react-native';
import { 
  Search, 
  ChevronDown, 
  ChevronRight,
  CheckCircle2, 
  AlertOctagon,
  ChevronLeft,
  History,
  TrendingDown,
  Info,
  Archive,
  Zap,
  ShieldAlert,
  LayoutGrid
} from 'lucide-react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Fonts } from '@/constants/theme';
import { searchInventory, insertAdjustment } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import BusinessSuccessModal, { BusinessSuccessDetails } from '@/components/BusinessSuccessModal';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { Calendar } from 'lucide-react-native';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
const DamagedItemForm = ({ onComplete }: { onComplete?: () => void }) => {
  const { colors, theme, t } = useSettings();
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
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({
        title: t('common.error'),
        message: t('adj.record_failed'),
        iconType: 'danger',
      });
    }
  };

  const lossValue = calculateLossValue();
  const warningColor = '#FF9500'; // Amber/Orange for Damage

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
            <View style={styles.headerRow}>
               <View>
                <AppText variant="body-sm" weight="bold" transform="uppercase" style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.integrity_audit')}</AppText>
                <AppText variant="display-lg" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('adj.stock_integrity')}</AppText>
             </View>
                <View style={[styles.modeBadge, { backgroundColor: warningColor + '15' }]}>
                   <AppText variant="micro" weight="bold" shrink={false} style={[styles.modeText, { color: warningColor }]} numberOfLines={1}>{t('common.damaged').toUpperCase()}</AppText>
               </View>
            </View>
        </Animated.View>

        {/* Integrity Impact Visualization */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.impactContainer}>
           <View style={[styles.impactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.impactLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.valuation_impact')}</AppText>
             
             <View style={styles.impactRow}>
                <View style={{ flex: 1 }}>
                   <AppText variant="body-sm" weight="bold" transform="uppercase" style={[styles.impactKey, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.asset_drain')}</AppText>
                   <AppText variant="display-lg" weight="bold" style={[styles.impactValueMain, { color: colors.text }]} numberOfLines={1}>
                     - {quantity || '0'} 
                     <AppText variant="body" weight="medium" style={styles.smallUnit}> {unitType === 'pack' ? (selectedItem?.purchaseUnit || t('adj.pack')) : (selectedItem?.baseUnit || t('adj.unit'))}</AppText>
                   </AppText>
                </View>
                <View style={[styles.impactIconBox, { backgroundColor: warningColor + '15' }]}>
                   <TrendingDown size={28} color={warningColor} />
                </View>
             </View>

             <View style={[styles.divider, { backgroundColor: colors.border }]} />

             <View style={styles.impactRow}>
                <AppText variant="body-sm" weight="bold" transform="uppercase" style={[styles.impactKey, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.loss_magnitude')}</AppText>
                <AppText variant="heading-lg" weight="bold" style={[styles.impactValueSecondary, { color: warningColor }]} numberOfLines={1}>
                  - {lossValue.toLocaleString()} <AppText variant="caption" weight="bold" style={styles.smallCurr}>{t('common.etb')}</AppText>
                </AppText>
             </View>

             <View style={styles.logRow}>
               <History size={12} color={colors.textSecondary} />
               <AppText variant="micro" weight="bold" style={[styles.logText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t('adj.audit_id')}: <AppText variant="micro" weight="bold" style={styles.boldLog} numberOfLines={1}>LSS-{new Date().getTime().toString().slice(-6)}</AppText>
               </AppText>
             </View>
           </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.formSection}>
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
               <Search size={14} color={colors.textSecondary} />
               <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.target_asset')}</AppText>
            </View>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t("adj.search_placeholder")}
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            {showResults && (
              <Animated.View entering={FadeInDown} style={[styles.resultsPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {searchResults.map((item) => (
                  <TouchableOpacity key={item.id} style={[styles.resultItem, { borderBottomColor: colors.border }]} onPress={() => handleSelectItem(item)}>
                    <View>
                       <AppText variant="body-lg" weight="bold" style={[styles.resultText, { color: colors.text }]} numberOfLines={1}>{item.name}</AppText>
                       <AppText variant="caption" weight="medium" style={[styles.resultSubtext, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.available')}: {item.totalBaseQuantity} {item.baseUnit}</AppText>
                    </View>
                    <ChevronRight size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </Animated.View>
            )}
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1.2, marginRight: 15 }]}>
              <View style={styles.labelRow}>
                 <Zap size={14} color={colors.textSecondary} />
                 <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.loss_qty')}</AppText>
              </View>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.text, fontFamily: Fonts.bold, fontSize: 18 }]}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder={t('inv.qty_ph')}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
            
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <View style={styles.labelRow}>
                 <LayoutGrid size={14} color={colors.textSecondary} />
                 <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.scale')}</AppText>
              </View>
              <View style={[styles.unitToggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                 <TouchableOpacity 
                   style={[styles.unitBtn, unitType === 'base' && [styles.activeUnit, { backgroundColor: colors.text }]]} 
                   onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUnitType('base'); }}
                 >
                   <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.unitBtnText, { color: colors.textSecondary }, unitType === 'base' && { color: colors.background }]} numberOfLines={1}>{t('adj.unit')}</AppText>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.unitBtn, unitType === 'pack' && [styles.activeUnit, { backgroundColor: colors.text }]]} 
                   onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUnitType('pack'); }}
                 >
                   <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.unitBtnText, { color: colors.textSecondary }, unitType === 'pack' && { color: colors.background }]} numberOfLines={1}>{t('adj.pack')}</AppText>
                 </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
               <Info size={14} color={colors.textSecondary} />
               <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.loss_reason')}</AppText>
            </View>
            <TouchableOpacity style={[styles.dropdownWrapper, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => Haptics.selectionAsync()}>
              <AppText variant="subtitle" weight="bold" style={[styles.dropdownText, { color: colors.text }]} numberOfLines={1}>{reason}</AppText>
              <ChevronDown color={colors.textSecondary} size={20} />
            </TouchableOpacity>
            <View style={styles.reasonsRow}>
              {[t('adj.reason_broken'), t('adj.reason_expired'), t('adj.reason_defective'), t('adj.reason_water')].map(r => (
                <TouchableOpacity 
                  key={r} 
                  style={[styles.reasonTag, { backgroundColor: colors.card, borderColor: reason === r ? warningColor : colors.border }]} 
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReason(r); }}
                >
                  <AppText variant="caption" weight="bold" shrink={false} style={[styles.reasonTagText, { color: reason === r ? warningColor : colors.textSecondary }]} numberOfLines={1}>{r}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Record Date */}
        <TouchableOpacity 
          style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, marginBottom: 15 }]}
          onPress={() => setShowDatePicker(true)}
        >
          <Calendar size={18} color={warningColor} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <AppText variant="micro" weight="semibold" transform="uppercase" style={{ color: colors.textSecondary }} numberOfLines={1}>{t('common.record_date') || 'Record Date'}</AppText>
            <AppText variant="subtitle" weight="bold" style={{ color: recordDate ? colors.text : colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
              {recordDate || (t('common.today') || 'Today (Default)')}
            </AppText>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.confirmBtn, { backgroundColor: colors.text }]} 
          activeOpacity={0.8} 
          onPress={handleConfirm}
        >
          <ShieldAlert color={colors.background} size={20} />
          <AppText variant="subtitle" weight="bold" style={[styles.confirmText, { color: colors.background }]} numberOfLines={1}>{t('adj.authorize_loss')}</AppText>
        </TouchableOpacity>
        
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 25 },
  header: { marginTop: 20, marginBottom: 30 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerSub: { fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { fontSize: 32, fontFamily: Fonts.bold, letterSpacing: -1 },
  modeBadge: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  impactContainer: { marginBottom: 35 },
  impactCard: { borderRadius: 32, padding: 25, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 5 },
  impactLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', marginBottom: 20, letterSpacing: 1.5 },
  impactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  impactKey: { fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase', marginBottom: 5 },
  impactValueMain: { fontSize: 32, fontFamily: Fonts.bold },
  smallUnit: { fontSize: 14, fontFamily: Fonts.medium },
  impactIconBox: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  divider: { height: 1, marginVertical: 20 },
  impactValueSecondary: { fontSize: 24, fontFamily: Fonts.bold },
  smallCurr: { fontSize: 12 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, justifyContent: 'center' },
  logText: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  boldLog: { },
  formSection: { gap: 20 },
  inputGroup: { gap: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5 },
  fieldLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  inputWrapper: { height: 60, borderRadius: 18, borderWidth: 1, paddingHorizontal: 20, justifyContent: 'center' },
  input: { fontSize: 16, fontFamily: Fonts.medium },
  row: { flexDirection: 'row', alignItems: 'center' },
  unitToggleRow: { flexDirection: 'row', height: 60, padding: 4, borderRadius: 18, borderWidth: 1 },
  unitBtn: { flex: 1, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  activeUnit: { elevation: 2 },
  unitBtnText: { fontFamily: Fonts.bold, fontSize: 13 },
  dropdownWrapper: { height: 60, borderRadius: 18, borderWidth: 1, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 16, fontFamily: Fonts.bold },
  reasonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  reasonTag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  reasonTagText: { fontSize: 12, fontFamily: Fonts.bold },
  resultsPanel: { borderRadius: 20, borderWidth: 1, marginTop: 5, zIndex: 100, maxHeight: 250 },
  resultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, minHeight: 60 },
  resultText: { fontSize: 15, fontFamily: Fonts.bold },
  resultSubtext: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 2 },
  confirmBtn: { height: 65, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 25 },
  confirmText: { fontSize: 16, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  modeText: { fontSize: 11, fontFamily: Fonts.bold },
});

export default DamagedItemForm;