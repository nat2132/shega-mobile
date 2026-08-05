import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  Platform,
  Modal,
  KeyboardAvoidingView
} from 'react-native';
import { 
  TrendingUp, 
  Search, 
  ChevronDown, 
  Package,
  Activity,
  ShieldCheck,
  Zap,
  Info, Calendar } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
import { useFormDrafts } from '@/hooks/useFormDrafts';
import { DraftSection } from '@/components/DraftSection';
import { Draft } from '@/services/draftService';

import { AppNumber, AppText} from '@/components/ui';
import { getAdjustmentGlass } from './glass-adjustment';
import { useTutorial, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { priceIncreaseTutorial, priceDecreaseTutorial } from '@/tutorials/definitions';
const PriceAdjustmentForm = ({ mode = 'increase', onComplete }: { mode?: 'increase' | 'decrease', onComplete?: () => void }) => {
  const { colors, calendarType, language, t } = useSettings();
  const { isReadOnly } = useSubscription();
  const G = getAdjustmentGlass(colors);
  const dialog = useDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [newPrice, setNewPrice] = useState('');
  const [reason, setReason] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [successDetails, setSuccessDetails] = useState<BusinessSuccessDetails | null>(null);
  const [recordDate, setRecordDate] = useState('');
  const draftFormKey = `adj-price-${mode}`;
  const draftFormData = useFormDrafts({
    screen: 'adjustment-price',
    formKey: draftFormKey,
    getPayload: useCallback(() => ({
      searchQuery,
      selectedItem,
      newPrice,
      reason,
      recordDate,
      mode,
    }), [searchQuery, selectedItem, newPrice, reason, recordDate, mode]),
    getTitle: useCallback(() => (selectedItem?.name 
      ? `${mode === 'increase' ? 'Increase' : 'Decrease'} - ${selectedItem.name}` 
      : `${mode === 'increase' ? 'Increase' : 'Decrease'} Draft`), [selectedItem, mode]),
    getSubtitle: useCallback(() => `${newPrice ? `ETB ${newPrice}` : 'No price set'}`, [newPrice]),
    enabled: !successDetails,
  });

  const tutorial = useTutorial({
    tutorial: mode === 'increase' ? priceIncreaseTutorial : priceDecreaseTutorial,
  });

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
    if (isReadOnly) {
      await dialog.alert({ title: t('common.read_only_mode'), message: t('common.read_only_mode'), iconType: 'warning' });
      return;
    }
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
      playNice();
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

  const { val, pct } = calculateChange();
  const themeColor = mode === 'increase' ? colors.success : colors.error;

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: G.bg }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={{ position: 'absolute', top: -80, right: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: G.mutedLight, opacity: 0.4, pointerEvents: 'none' }} />
      <View style={{ position: 'absolute', top: 180, left: -70, width: 200, height: 200, borderRadius: 100, backgroundColor: G.mutedLight, opacity: 0.25, pointerEvents: 'none' }} />
      <View style={{ position: 'absolute', bottom: 80, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: G.mutedLight, opacity: 0.2, pointerEvents: 'none' }} />
      <TutorialScrollView 
         contentContainerStyle={styles.scrollContent}
         keyboardShouldPersistTaps="handled"
         showsVerticalScrollIndicator={false}
      >
      {draftFormData.showDrafts && (
        <DraftSection
          drafts={draftFormData.drafts}
          onRestore={async (draft) => {
            const d = draft.data;
            setSearchQuery(d.searchQuery || '');
            setNewPrice(d.newPrice || '');
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
      <TutorialTarget id="pi-header">
      <TutorialTarget id="pd-header">
      <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
        <View style={styles.headerRow}>
           <View>
               <AppText variant="body-sm" weight="bold" transform="uppercase" style={[styles.headerSub, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.asset_valuation')}</AppText>
               <AppText variant="display-lg" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{t('adj.price_rectify')}</AppText>
            </View>
            <View style={[styles.modeBadge, { backgroundColor: themeColor + '15' }]}>
               <AppText variant="micro" weight="bold" shrink={false} style={[styles.modeText, { color: themeColor }]} numberOfLines={1}>{t('common.' + mode).toUpperCase()}</AppText>
           </View>
        </View>
      </Animated.View>
      </TutorialTarget>
      </TutorialTarget>

      {/* Dynamic Impact Visualization */}
      <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.impactContainer}>
        {selectedItem ? (
          <View style={[styles.impactCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.impactMain}>
               <View style={styles.impactSide}>
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.impactLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.original')}</AppText>
                   <AppNumber value={selectedItem.baseSellingPrice} showCurrency size="title" weight="bold" style={[{ color: G.fgSecondary }]} />
               </View>
               <View style={[styles.impactCenter, { backgroundColor: themeColor }]}>
                  <TrendingUp size={24} color={G.bg} style={{ transform: [{ rotate: mode === 'increase' ? '0deg' : '180deg' }] }} />
               </View>
               <View style={styles.impactSide}>
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.impactLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.new_price')}</AppText>
                   <AppNumber value={parseFloat(newPrice) || 0} showCurrency size="title" weight="bold" style={[{ color: themeColor }]} />
               </View>
            </View>
            
            <View style={[styles.impactFooter, { borderTopColor: G.border }]}>
               <View style={styles.footerItem}>
                  <Activity size={16} color={themeColor} />
                   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                     <AppNumber value={val} showCurrency size="body" weight="bold" showSign style={{ color: themeColor }} />
                     <AppText variant="body" weight="bold" style={[styles.footerText, { color: themeColor }]}>(</AppText>
                      <AppNumber value={pct} size="body" weight="bold" suffix="%" showSign={true} decimals={1} style={{ color: themeColor }} />
                      <AppText variant="body" weight="bold" style={[styles.footerText, { color: themeColor }]}>{'\u0029'}</AppText>
                   </View>
                </View>
                <AppText variant="caption" weight="medium" style={[styles.footerSub, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.market_impact')}</AppText>
            </View>
          </View>
        ) : (
          <View style={[styles.placeholderCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={[styles.pIconBox, { backgroundColor: G.border + '15' }]}>
               <Package color={G.fgSecondary} size={32} />
            </View>
            <AppText variant="body-lg" weight="medium" align="center" style={[styles.placeholderText, { color: G.fgSecondary }]} numberOfLines={2}>{t('adj.select_asset')}</AppText>
          </View>
        )}
      </Animated.View>

      {/* Input Architecture */}
      <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.formSection}>
        <View style={styles.inputGroup}>
           <View style={styles.labelRow}>
              <Search size={14} color={G.fgSecondary} />
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.search_asset')}</AppText>
           </View>
            <TutorialTarget id="pi-search">
            <TutorialTarget id="pd-search">
            <View style={[styles.inputContainer, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <TextInput 
                style={[styles.input, { color: G.fg }]} 
                placeholder={t("adj.search_placeholder")} 
                placeholderTextColor={G.fgSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
           </View>
            </TutorialTarget>
            </TutorialTarget>
           
           {showResults && searchResults.length > 0 && (
              <TutorialTarget id="pi-item-select">
              <TutorialTarget id="pd-item-select">
              <View style={[styles.resultsPanel, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled">
                  {searchResults.map((item, index) => (
                    <TouchableOpacity 
                      key={item.id || index} 
                      style={[styles.resultItem, { borderBottomColor: G.border }]} 
                      onPress={() => handleSelectItem(item)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.resultIconBox, { backgroundColor: G.fg + '08' }]}>
                        <Package size={18} color={G.fg} />
                      </View>
                      <View style={styles.resultInfo}>
                         <AppText variant="body-lg" weight="bold" style={[styles.resultText, { color: G.fg }]} numberOfLines={1}>{item.name || 'Unknown'}</AppText>
                         <AppText variant="caption" weight="medium" style={[styles.resultSubtext, { color: G.fgSecondary }]} numberOfLines={1}>{item.categoryName || 'General'}</AppText>
                      </View>
                      <AppNumber value={item.baseSellingPrice ?? 0} showCurrency size="body" weight="bold" style={[styles.resultPrice, { color: colors.primary }]} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              </TutorialTarget>
              </TutorialTarget>
            )}
        </View>

        {selectedItem && (
          <>
            <View style={styles.inputRow}>
               <View style={[styles.inputGroup, { flex: 1 }]}>
                  <View style={styles.labelRow}>
                     <Zap size={14} color={G.fgSecondary} />
                     <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.precision_price')}</AppText>
                  </View>
                   <TutorialTarget id="pi-new-price">
                   <TutorialTarget id="pd-new-price">
                   <View style={[styles.inputContainer, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                      <TextInput 
                        style={[styles.input, { color: G.fg, fontFamily: Fonts.bold, fontSize: 18 }]} 
                        value={newPrice} 
                        onChangeText={setNewPrice}
                        keyboardType="numeric" 
                      />
                   </View>
                   </TutorialTarget>
                   </TutorialTarget>
               </View>
            </View>

            <TutorialTarget id="pi-reason">
            <TutorialTarget id="pd-reason">
            <View style={styles.inputGroup}>
               <View style={styles.labelRow}>
                  <Info size={14} color={G.fgSecondary} />
                  <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('adj.rectification_reason')}</AppText>
               </View>
               <TouchableOpacity style={[styles.dropdown, { backgroundColor: G.bgCard, borderColor: G.border }]} onPress={() => Haptics.selectionAsync()}>
                  <AppText variant="body-lg" weight="medium" style={[styles.dropdownText, { color: reason ? G.fg : G.fgSecondary }]} numberOfLines={1}>
                     {reason || t('adj.select_reason_placeholder')}
                  </AppText>
                  <ChevronDown color={G.fgSecondary} size={20} />
               </TouchableOpacity>
               
               <View style={styles.quickReasons}>
                  {[t('adj.reason_market'), t('adj.reason_supplier'), t('adj.reason_policy'), t('adj.reason_promo')].map(r => (
                    <TouchableOpacity 
                      key={r} 
                      style={[styles.reasonChip, { backgroundColor: G.bgCard, borderColor: reason === r ? themeColor : G.border }]} 
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReason(r); }}
                    >
                      <AppText variant="caption" weight="bold" shrink={false} style={[styles.chipText, { color: reason === r ? themeColor : G.fgSecondary }]} numberOfLines={1}>{r}</AppText>
                    </TouchableOpacity>
                  ))}
               </View>
            </View>
            </TutorialTarget>
            </TutorialTarget>

            {/* Record Date */}
            <TutorialTarget id="pi-date">
            <TutorialTarget id="pd-date">
            <TouchableOpacity 
              style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderWidth: 1, borderColor: G.border, borderRadius: 20, padding: 16, marginBottom: 15 }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar size={18} color={themeColor} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <AppText variant="micro" weight="semibold" transform="uppercase" style={{ color: G.fgSecondary }} numberOfLines={1}>{t('common.record_date') || 'Record Date'}</AppText>
                <AppText variant="subtitle" weight="bold" style={{ color: recordDate ? G.fg : G.fgSecondary, marginTop: 2 }} numberOfLines={1}>
                  {recordDate ? formatDate(new Date(recordDate), calendarType, language) : (t('common.today') || 'Today (Default)')}
                </AppText>
              </View>
            </TouchableOpacity>
            </TutorialTarget>
            </TutorialTarget>

            <TutorialTarget id="pi-commit-btn">
            <TutorialTarget id="pd-commit-btn">
            <TouchableOpacity 
              style={[styles.confirmBtn, { backgroundColor: G.fg }]} 
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <ShieldCheck color={G.bg} size={20} />
              <AppText variant="subtitle" weight="bold" style={[styles.confirmText, { color: G.bg }]} numberOfLines={1}>{t('adj.commit_adjustment')}</AppText>
            </TouchableOpacity>
            </TutorialTarget>
            </TutorialTarget>
            <TutorialButton tutorialId={mode === 'increase' ? 'price-increase' : 'price-decrease'} screenName={mode === 'increase' ? t('screen.price_increase') : t('screen.price_decrease')} />
          </>
        )}
      </Animated.View>

      <AppText variant="micro" weight="bold" align="center" style={[styles.footer, { color: G.fgSecondary }]} numberOfLines={2}>
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
  modeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  modeText: { fontSize: 11, fontFamily: Fonts.bold },
  impactContainer: { marginBottom: 20 },
  impactCard: { borderRadius: 28, padding: 18, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 14, elevation: 3, overflow: 'hidden' },
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
  placeholderCard: { height: 150, borderRadius: 28, borderStyle: 'dashed', borderWidth: 2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  pIconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  placeholderText: { fontSize: 15, fontFamily: Fonts.medium },
  formSection: { gap: 14 },
  inputGroup: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5 },
  fieldLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  inputContainer: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, justifyContent: 'center' },
  input: { fontSize: 16, fontFamily: Fonts.medium },
  resultsPanel: { borderRadius: 20, borderWidth: 1, marginTop: 5, zIndex: 100, maxHeight: 250, overflow: 'hidden' },
  resultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, minHeight: 60 },
  resultText: { fontSize: 15, fontFamily: Fonts.bold },
  resultSubtext: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 2 },
  resultPrice: { fontSize: 14, fontFamily: Fonts.bold },
  dropdown: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 15, fontFamily: Fonts.medium },
  quickReasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  reasonChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: Fonts.bold },
  confirmBtn: { height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16 },
  confirmText: { fontSize: 16, fontFamily: Fonts.bold },
  footer: { textAlign: 'center', fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 2, marginTop: 20, lineHeight: 16 },
  resultIconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  resultInfo: { flex: 1, marginLeft: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
});

export default PriceAdjustmentForm;