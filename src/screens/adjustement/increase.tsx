import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  FlatList,
  Platform,
  Modal,
  KeyboardAvoidingView
} from 'react-native';
import { 
  TrendingUp, 
  Search, 
  CheckCircle2, 
  ChevronDown, 
  Package,
  Activity,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  ChevronLeft
} from 'lucide-react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  FadeIn,
  ScaleInCenter,
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

const PriceAdjustmentForm = ({ mode = 'increase', onComplete }: { mode?: 'increase' | 'decrease', onComplete?: () => void }) => {
  const { colors, theme, t } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [newPrice, setNewPrice] = useState('');
  const [reason, setReason] = useState('');
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
    setNewPrice(item.baseSellingPrice.toString());
    setShowResults(false);
  };

  const calculateChange = () => {
    if (!selectedItem || !newPrice) return { val: 0, pct: 0 };
    const oldP = selectedItem.baseSellingPrice;
    const newP = parseFloat(newPrice) || 0;
    const val = newP - oldP;
    const pct = oldP > 0 ? (val / oldP) * 100 : 0;
    return { val, pct };
  };

  const handleConfirm = async () => {
    if (!selectedItem || !newPrice) {
      Alert.alert(t('common.error'), t('adj.select_asset'));
      return;
    }

    const adjData = {
      itemId: selectedItem.id,
      type: mode === 'increase' ? 'price_up' : 'price_down',
      oldValue: selectedItem.baseSellingPrice,
      newValue: parseFloat(newPrice),
      quantity: 0,
      unitType: 'base',
      reason: reason || (mode === 'increase' ? t('adj.reason_market') : t('adj.reason_policy')),
      date: new Date().toISOString().split('T')[0],
      createdAt: recordDate || undefined
    };

    const result = await insertAdjustment(adjData);
    if (result) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { pct } = calculateChange();
      setSuccessDetails({
        title: mode === 'increase' ? t('adjustment.price_increased') : t('adjustment.price_decreased'),
        subtitle: mode === 'increase' ? t('adj.elevation_complete') : t('adj.reduction_applied'),
        mainLabel: t('adj.new_price'),
        mainValue: `${parseFloat(newPrice).toLocaleString()} ETB`,
        secondaryLabel: t('adj.change'),
        secondaryValue: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
        iconType: mode === 'increase' ? 'price_up' : 'price_down',
        itemName: selectedItem.name
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('adj.record_failed'));
    }
  };

  const { val, pct } = calculateChange();
  const themeColor = mode === 'increase' ? '#34C759' : '#FF3B30';

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
         contentContainerStyle={styles.scrollContent}
         keyboardShouldPersistTaps="handled"
         showsVerticalScrollIndicator={false}
      >
      <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
        <View style={styles.headerRow}>
           <View>
              <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{t('adj.asset_valuation')}</Text>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{t('adj.price_rectify')}</Text>
           </View>
           <View style={[styles.modeBadge, { backgroundColor: themeColor + '15' }]}>
              <Text style={[styles.modeText, { color: themeColor }]}>{t('common.' + mode).toUpperCase()}</Text>
           </View>
        </View>
      </Animated.View>

      {/* Dynamic Impact Visualization */}
      <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.impactContainer}>
        {selectedItem ? (
          <View style={[styles.impactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.impactMain}>
               <View style={styles.impactSide}>
                  <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>{t('adj.original')}</Text>
                  <Text style={[styles.impactPrice, { color: colors.textSecondary }]}>{selectedItem.baseSellingPrice.toLocaleString()} <Text style={styles.smallCurr}>{t('common.etb')}</Text></Text>
               </View>
               <View style={[styles.impactCenter, { backgroundColor: themeColor }]}>
                  <TrendingUp size={24} color={colors.background} style={{ transform: [{ rotate: mode === 'increase' ? '0deg' : '180deg' }] }} />
               </View>
               <View style={styles.impactSide}>
                  <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>{t('adj.new_price')}</Text>
                  <Text style={[styles.impactPrice, { color: themeColor }]}>{(parseFloat(newPrice) || 0).toLocaleString()} <Text style={styles.smallCurr}>{t('common.etb')}</Text></Text>
               </View>
            </View>
            
            <View style={[styles.impactFooter, { borderTopColor: colors.border }]}>
               <View style={styles.footerItem}>
                  <Activity size={16} color={themeColor} />
                  <Text style={[styles.footerText, { color: themeColor }]}>
                     {val >= 0 ? '+' : ''}{val.toLocaleString()} {t('common.etb')} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                  </Text>
               </View>
               <Text style={[styles.footerSub, { color: colors.textSecondary }]}>{t('adj.market_impact')}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.placeholderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.pIconBox, { backgroundColor: colors.border + '15' }]}>
               <Package color={colors.textSecondary} size={32} />
            </View>
            <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>{t('adj.select_asset')}</Text>
          </View>
        )}
      </Animated.View>

      {/* Input Architecture */}
      <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.formSection}>
        <View style={styles.inputGroup}>
           <View style={styles.labelRow}>
              <Search size={14} color={colors.textSecondary} />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('adj.search_asset')}</Text>
           </View>
           <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput 
                style={[styles.input, { color: colors.text }]} 
                placeholder={t("adj.search_placeholder")} 
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
           </View>
           
           {showResults && searchResults.length > 0 && (
             <View style={[styles.resultsPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
               <ScrollView nestedScrollEnabled style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled">
                 {searchResults.map((item, index) => (
                   <TouchableOpacity 
                     key={item.id || index} 
                     style={[styles.resultItem, { borderBottomColor: colors.border }]} 
                     onPress={() => handleSelectItem(item)}
                     activeOpacity={0.7}
                   >
                     <View style={[styles.resultIconBox, { backgroundColor: colors.text + '08' }]}>
                       <Package size={18} color={colors.text} />
                     </View>
                     <View style={styles.resultInfo}>
                        <Text style={[styles.resultText, { color: colors.text }]}>{item.name || 'Unknown'}</Text>
                        <Text style={[styles.resultSubtext, { color: colors.textSecondary }]}>{item.categoryName || 'General'}</Text>
                     </View>
                     <Text style={[styles.resultPrice, { color: colors.primary }]}>{item.baseSellingPrice || 0} ETB</Text>
                   </TouchableOpacity>
                 ))}
               </ScrollView>
             </View>
           )}
        </View>

        {selectedItem && (
          <>
            <View style={styles.inputRow}>
               <View style={[styles.inputGroup, { flex: 1 }]}>
                  <View style={styles.labelRow}>
                     <Zap size={14} color={colors.textSecondary} />
                     <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('adj.precision_price')}</Text>
                  </View>
                  <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                     <TextInput 
                       style={[styles.input, { color: colors.text, fontFamily: Fonts.bold, fontSize: 18 }]} 
                       value={newPrice} 
                       onChangeText={setNewPrice}
                       keyboardType="numeric" 
                     />
                  </View>
               </View>
            </View>

            <View style={styles.inputGroup}>
               <View style={styles.labelRow}>
                  <Info size={14} color={colors.textSecondary} />
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('adj.rectification_reason')}</Text>
               </View>
               <TouchableOpacity style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => Haptics.selectionAsync()}>
                  <Text style={[styles.dropdownText, { color: reason ? colors.text : colors.textSecondary }]}>
                     {reason || t('adj.select_reason_placeholder')}
                  </Text>
                  <ChevronDown color={colors.textSecondary} size={20} />
               </TouchableOpacity>
               
               <View style={styles.quickReasons}>
                  {[t('adj.reason_market'), t('adj.reason_supplier'), t('adj.reason_policy'), t('adj.reason_promo')].map(r => (
                    <TouchableOpacity 
                      key={r} 
                      style={[styles.reasonChip, { backgroundColor: colors.card, borderColor: reason === r ? themeColor : colors.border }]} 
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReason(r); }}
                    >
                      <Text style={[styles.chipText, { color: reason === r ? themeColor : colors.textSecondary }]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
               </View>
            </View>

            {/* Record Date */}
            <TouchableOpacity 
              style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, marginBottom: 15 }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar size={18} color={themeColor} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[{ fontSize: 11, fontFamily: Fonts.semibold, color: colors.textSecondary, textTransform: 'uppercase' }]}>{t('common.record_date') || 'Record Date'}</Text>
                <Text style={[{ fontSize: 16, fontFamily: Fonts.bold, color: recordDate ? colors.text : colors.textSecondary, marginTop: 2 }]}>
                  {recordDate || (t('common.today') || 'Today (Default)')}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.confirmBtn, { backgroundColor: colors.text }]} 
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <ShieldCheck color={colors.background} size={20} />
              <Text style={[styles.confirmText, { color: colors.background }]}>{t('adj.commit_adjustment')}</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>

      <Text style={[styles.footer, { color: colors.textSecondary }]}>
        {t('adj.security_footer')} 
      </Text>
      
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
  modeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  modeText: { fontSize: 11, fontFamily: Fonts.bold },
  impactContainer: { marginBottom: 35 },
  impactCard: { borderRadius: 32, padding: 25, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 5 },
  impactMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 },
  impactSide: { flex: 1, alignItems: 'center' },
  impactCenter: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  impactLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', marginBottom: 8 },
  impactPrice: { fontSize: 18, fontFamily: Fonts.bold },
  smallCurr: { fontSize: 11 },
  impactFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTopWidth: 1 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerText: { fontSize: 14, fontFamily: Fonts.bold },
  footerSub: { fontSize: 12, fontFamily: Fonts.medium },
  placeholderCard: { height: 200, borderRadius: 32, borderStyle: 'dashed', borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  pIconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  placeholderText: { fontSize: 15, fontFamily: Fonts.medium },
  formSection: { gap: 20 },
  inputGroup: { gap: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5 },
  fieldLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  inputContainer: { height: 60, borderRadius: 18, borderWidth: 1, paddingHorizontal: 20, justifyContent: 'center' },
  input: { fontSize: 16, fontFamily: Fonts.medium },
  resultsPanel: { borderRadius: 20, borderWidth: 1, marginTop: 5, zIndex: 100, maxHeight: 250 },
  resultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, minHeight: 60 },
  resultText: { fontSize: 15, fontFamily: Fonts.bold },
  resultSubtext: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 2 },
  resultPrice: { fontSize: 14, fontFamily: Fonts.bold },
  dropdown: { height: 60, borderRadius: 18, borderWidth: 1, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 15, fontFamily: Fonts.medium },
  quickReasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  reasonChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: Fonts.bold },
  confirmBtn: { height: 65, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 25 },
  confirmText: { fontSize: 16, fontFamily: Fonts.bold },
  footer: { textAlign: 'center', fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 2, marginTop: 40, lineHeight: 18 },
});

export default PriceAdjustmentForm;