import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
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
const PriceAdjustmentForm = ({ mode = 'increase', onComplete }: { mode?: 'increase' | 'decrease', onComplete?: () => void }) => {
  const { colors, theme, t } = useSettings();
  const dialog = useDialog();
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
    if (!selectedItem) {
      await dialog.alert({
        title: t('common.error'),
        message: t('adj.select_asset'),
        iconType: 'danger',
      });
      return;
    }

    const price = parseFloat(newPrice);
    if (!newPrice || isNaN(price) || price <= 0) {
      await dialog.alert({
        title: t('common.error'),
        message: t('adj.valid_price'),
        iconType: 'danger',
      });
      return;
    }

    const oldPrice = selectedItem.baseSellingPrice;
    if (price === oldPrice) {
      await dialog.alert({
        title: t('common.error'),
        message: t('adj.no_price_change'),
        iconType: 'danger',
      });
      return;
    }

    if (mode === 'increase' && price < oldPrice) {
      await dialog.alert({
        title: t('common.error'),
        message: t('adj.increase_higher'),
        iconType: 'danger',
      });
      return;
    }

    if (mode === 'decrease' && price > oldPrice) {
      await dialog.alert({
        title: t('common.error'),
        message: t('adj.decrease_lower'),
        iconType: 'danger',
      });
      return;
    }

    if (!reason?.trim()) {
      await dialog.alert({
        title: t('common.error'),
        message: t('adj.select_reason'),
        iconType: 'danger',
      });
      return;
    }

    const adjData = {
      itemId: selectedItem.id,
      type: mode === 'increase' ? 'price_up' : 'price_down',
      oldValue: oldPrice,
      newValue: price,
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
        mainValue: `${parseFloat(newPrice).toLocaleString()} ${t('common.etb')}`,
        secondaryLabel: t('adj.change'),
        secondaryValue: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
        iconType: mode === 'increase' ? 'price_up' : 'price_down',
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
               <AppText variant="body-sm" weight="bold" transform="uppercase" style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.asset_valuation')}</AppText>
               <AppText variant="display-lg" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('adj.price_rectify')}</AppText>
            </View>
            <View style={[styles.modeBadge, { backgroundColor: themeColor + '15' }]}>
               <AppText variant="micro" weight="bold" shrink={false} style={[styles.modeText, { color: themeColor }]} numberOfLines={1}>{t('common.' + mode).toUpperCase()}</AppText>
           </View>
        </View>
      </Animated.View>

      {/* Dynamic Impact Visualization */}
      <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.impactContainer}>
        {selectedItem ? (
          <View style={[styles.impactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.impactMain}>
               <View style={styles.impactSide}>
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.impactLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.original')}</AppText>
                   <AppText variant="title" weight="bold" style={[styles.impactPrice, { color: colors.textSecondary }]} numberOfLines={1}>{selectedItem.baseSellingPrice.toLocaleString()} <AppText variant="micro" weight="bold" style={styles.smallCurr}>{t('common.etb')}</AppText></AppText>
               </View>
               <View style={[styles.impactCenter, { backgroundColor: themeColor }]}>
                  <TrendingUp size={24} color={colors.background} style={{ transform: [{ rotate: mode === 'increase' ? '0deg' : '180deg' }] }} />
               </View>
               <View style={styles.impactSide}>
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.impactLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.new_price')}</AppText>
                   <AppText variant="title" weight="bold" style={[styles.impactPrice, { color: themeColor }]} numberOfLines={1}>{(parseFloat(newPrice) || 0).toLocaleString()} <AppText variant="micro" weight="bold" style={styles.smallCurr}>{t('common.etb')}</AppText></AppText>
               </View>
            </View>
            
            <View style={[styles.impactFooter, { borderTopColor: colors.border }]}>
               <View style={styles.footerItem}>
                  <Activity size={16} color={themeColor} />
                   <AppText variant="body" weight="bold" style={[styles.footerText, { color: themeColor }]} numberOfLines={1}>
                      {val >= 0 ? '+' : ''}{val.toLocaleString()} {t('common.etb')} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                   </AppText>
                </View>
                <AppText variant="caption" weight="medium" style={[styles.footerSub, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.market_impact')}</AppText>
            </View>
          </View>
        ) : (
          <View style={[styles.placeholderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.pIconBox, { backgroundColor: colors.border + '15' }]}>
               <Package color={colors.textSecondary} size={32} />
            </View>
            <AppText variant="body-lg" weight="medium" align="center" style={[styles.placeholderText, { color: colors.textSecondary }]} numberOfLines={2}>{t('adj.select_asset')}</AppText>
          </View>
        )}
      </Animated.View>

      {/* Input Architecture */}
      <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.formSection}>
        <View style={styles.inputGroup}>
           <View style={styles.labelRow}>
              <Search size={14} color={colors.textSecondary} />
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.search_asset')}</AppText>
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
                        <AppText variant="body-lg" weight="bold" style={[styles.resultText, { color: colors.text }]} numberOfLines={1}>{item.name || 'Unknown'}</AppText>
                        <AppText variant="caption" weight="medium" style={[styles.resultSubtext, { color: colors.textSecondary }]} numberOfLines={1}>{item.categoryName || 'General'}</AppText>
                     </View>
                     <AppText variant="body" weight="bold" shrink={false} style={[styles.resultPrice, { color: colors.primary }]} numberOfLines={1}>{item.baseSellingPrice || 0} {t('common.etb')}</AppText>
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
                     <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.precision_price')}</AppText>
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
                  <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.rectification_reason')}</AppText>
               </View>
               <TouchableOpacity style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => Haptics.selectionAsync()}>
                  <AppText variant="body-lg" weight="medium" style={[styles.dropdownText, { color: reason ? colors.text : colors.textSecondary }]} numberOfLines={1}>
                     {reason || t('adj.select_reason_placeholder')}
                  </AppText>
                  <ChevronDown color={colors.textSecondary} size={20} />
               </TouchableOpacity>
               
               <View style={styles.quickReasons}>
                  {[t('adj.reason_market'), t('adj.reason_supplier'), t('adj.reason_policy'), t('adj.reason_promo')].map(r => (
                    <TouchableOpacity 
                      key={r} 
                      style={[styles.reasonChip, { backgroundColor: colors.card, borderColor: reason === r ? themeColor : colors.border }]} 
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReason(r); }}
                    >
                      <AppText variant="caption" weight="bold" shrink={false} style={[styles.chipText, { color: reason === r ? themeColor : colors.textSecondary }]} numberOfLines={1}>{r}</AppText>
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
                <AppText variant="micro" weight="semibold" transform="uppercase" style={{ color: colors.textSecondary }} numberOfLines={1}>{t('common.record_date') || 'Record Date'}</AppText>
                <AppText variant="subtitle" weight="bold" style={{ color: recordDate ? colors.text : colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                  {recordDate || (t('common.today') || 'Today (Default)')}
                </AppText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.confirmBtn, { backgroundColor: colors.text }]} 
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <ShieldCheck color={colors.background} size={20} />
              <AppText variant="subtitle" weight="bold" style={[styles.confirmText, { color: colors.background }]} numberOfLines={1}>{t('adj.commit_adjustment')}</AppText>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>

      <AppText variant="micro" weight="bold" align="center" style={[styles.footer, { color: colors.textSecondary }]} numberOfLines={2}>
        {t('adj.security_footer')} 
      </AppText>
      
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
  resultIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  resultInfo: { flex: 1, marginLeft: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
});

export default PriceAdjustmentForm;