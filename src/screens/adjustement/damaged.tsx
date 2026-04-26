import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  Alert,
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
import BusinessSuccessModal, { BusinessSuccessDetails } from '@/components/BusinessSuccessModal';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { Calendar } from 'lucide-react-native';

const DamagedItemForm = ({ onComplete }: { onComplete?: () => void }) => {
  const { colors, theme, t } = useSettings();
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
    if (!selectedItem || !quantity || isNaN(parseFloat(quantity))) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('adj.select_asset'));
      return;
    }

    const adjData = {
      itemId: selectedItem.id,
      type: 'damaged',
      oldValue: null,
      newValue: null,
      quantity: parseFloat(quantity),
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
        secondaryValue: `-${calculateLossValue().toLocaleString()} ETB`,
        iconType: 'damaged',
        itemName: selectedItem.name
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('adj.record_failed'));
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
                <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{t('adj.integrity_audit')}</Text>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('adj.stock_integrity')}</Text>
             </View>
               <View style={[styles.modeBadge, { backgroundColor: warningColor + '15' }]}>
                  <Text style={[styles.modeText, { color: warningColor }]}>{t('common.damaged').toUpperCase()}</Text>
               </View>
            </View>
        </Animated.View>

        {/* Integrity Impact Visualization */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.impactContainer}>
           <View style={[styles.impactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>{t('adj.valuation_impact')}</Text>
             
             <View style={styles.impactRow}>
                <View style={{ flex: 1 }}>
                   <Text style={[styles.impactKey, { color: colors.textSecondary }]}>{t('adj.asset_drain')}</Text>
                   <Text style={[styles.impactValueMain, { color: colors.text }]}>
                     - {quantity || '0'} 
                     <Text style={styles.smallUnit}> {unitType === 'pack' ? (selectedItem?.purchaseUnit || t('adj.pack')) : (selectedItem?.baseUnit || t('adj.unit'))}</Text>
                   </Text>
                </View>
                <View style={[styles.impactIconBox, { backgroundColor: warningColor + '15' }]}>
                   <TrendingDown size={28} color={warningColor} />
                </View>
             </View>

             <View style={[styles.divider, { backgroundColor: colors.border }]} />

             <View style={styles.impactRow}>
                <Text style={[styles.impactKey, { color: colors.textSecondary }]}>{t('adj.loss_magnitude')}</Text>
                <Text style={[styles.impactValueSecondary, { color: warningColor }]}>
                  - {lossValue.toLocaleString()} <Text style={styles.smallCurr}>{t('common.etb')}</Text>
                </Text>
             </View>

             <View style={styles.logRow}>
               <History size={12} color={colors.textSecondary} />
               <Text style={[styles.logText, { color: colors.textSecondary }]}>
                 {t('adj.audit_id')}: <Text style={styles.boldLog}>LSS-{new Date().getTime().toString().slice(-6)}</Text>
               </Text>
             </View>
           </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.formSection}>
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
               <Search size={14} color={colors.textSecondary} />
               <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('adj.target_asset')}</Text>
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
                       <Text style={[styles.resultText, { color: colors.text }]}>{item.name}</Text>
                       <Text style={[styles.resultSubtext, { color: colors.textSecondary }]}>{t('adj.available')}: {item.totalBaseQuantity} {item.baseUnit}</Text>
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
                 <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('adj.loss_qty')}</Text>
              </View>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.text, fontFamily: Fonts.bold, fontSize: 18 }]}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
            
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <View style={styles.labelRow}>
                 <LayoutGrid size={14} color={colors.textSecondary} />
                 <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('adj.scale')}</Text>
              </View>
              <View style={[styles.unitToggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                 <TouchableOpacity 
                   style={[styles.unitBtn, unitType === 'base' && [styles.activeUnit, { backgroundColor: colors.text }]]} 
                   onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUnitType('base'); }}
                 >
                   <Text style={[styles.unitBtnText, { color: colors.textSecondary }, unitType === 'base' && { color: colors.background }]}>{t('adj.unit')}</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.unitBtn, unitType === 'pack' && [styles.activeUnit, { backgroundColor: colors.text }]]} 
                   onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUnitType('pack'); }}
                 >
                   <Text style={[styles.unitBtnText, { color: colors.textSecondary }, unitType === 'pack' && { color: colors.background }]}>{t('adj.pack')}</Text>
                 </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
               <Info size={14} color={colors.textSecondary} />
               <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('adj.loss_reason')}</Text>
            </View>
            <TouchableOpacity style={[styles.dropdownWrapper, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => Haptics.selectionAsync()}>
              <Text style={[styles.dropdownText, { color: colors.text }]}>{reason}</Text>
              <ChevronDown color={colors.textSecondary} size={20} />
            </TouchableOpacity>
            <View style={styles.reasonsRow}>
              {[t('adj.reason_broken'), t('adj.reason_expired'), t('adj.reason_defective'), t('adj.reason_water')].map(r => (
                <TouchableOpacity 
                  key={r} 
                  style={[styles.reasonTag, { backgroundColor: colors.card, borderColor: reason === r ? warningColor : colors.border }]} 
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReason(r); }}
                >
                  <Text style={[styles.reasonTagText, { color: reason === r ? warningColor : colors.textSecondary }]}>{r}</Text>
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
            <Text style={[{ fontSize: 11, fontFamily: Fonts.semibold, color: colors.textSecondary, textTransform: 'uppercase' }]}>{t('common.record_date') || 'Record Date'}</Text>
            <Text style={[{ fontSize: 16, fontFamily: Fonts.bold, color: recordDate ? colors.text : colors.textSecondary, marginTop: 2 }]}>
              {recordDate || (t('common.today') || 'Today (Default)')}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.confirmBtn, { backgroundColor: colors.text }]} 
          activeOpacity={0.8} 
          onPress={handleConfirm}
        >
          <ShieldAlert color={colors.background} size={20} />
          <Text style={[styles.confirmText, { color: colors.background }]}>{t('adj.authorize_loss')}</Text>
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
});

export default DamagedItemForm;