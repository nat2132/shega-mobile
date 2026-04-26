import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  Switch, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  Alert,
  Platform,
  Modal,
  KeyboardAvoidingView
} from 'react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  FadeIn,
  Layout
} from 'react-native-reanimated';
import { 
  ChevronLeft, 
  Calendar as CalendarIcon, 
  Wallet,
  TrendingDown,
  Info,
  Calendar,
  History,
  ShieldCheck,
  Zap,
  Repeat,
  Bell,
  ArrowRight,
  Tag,
  CreditCard,
  DollarSign
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { insertExpense } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import { Fonts } from '@/constants/theme';
import { formatDate } from '@/utils/date-utils';
import BusinessSuccessModal, { BusinessSuccessDetails } from '@/components/BusinessSuccessModal';
import { CustomDatePicker } from '@/components/CustomDatePicker';

const AddExpenseScreen = ({ onSaveSuccess }: { onSaveSuccess?: () => void }) => {
  const { colors, theme, t, calendarType, language } = useSettings();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(t('common.general'));
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('Monthly'); // Daily, Weekly, Monthly, Yearly
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [notify, setNotify] = useState(false);
  const [successDetails, setSuccessDetails] = useState<BusinessSuccessDetails | null>(null);
  const [recordDate, setRecordDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const calculateNextBilling = (start: string, freq: string) => {
    const date = new Date(start);
    if (freq === 'Daily') date.setDate(date.getDate() + 1);
    else if (freq === 'Weekly') date.setDate(date.getDate() + 7);
    else if (freq === 'Monthly') date.setMonth(date.getMonth() + 1);
    else if (freq === 'Yearly') date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  };

  const handleSave = async () => {
    if (!name.trim() || !amount || isNaN(Number(amount))) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('expense.validation_error'));
      return;
    }

    const nextBilling = isRecurring ? calculateNextBilling(startDate, frequency) : null;

    const expenseData = {
      name,
      amount: Number(amount),
      category,
      date: startDate,
      isRecurring,
      frequency: isRecurring ? frequency : null,
      nextBillingDate: nextBilling,
      createdAt: recordDate || undefined,
    };

    const id = await insertExpense(expenseData);
    if (id) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessDetails({
        title: t('expense.commit_success'),
        subtitle: t('expense.magnitude_logged'),
        mainLabel: t('expense.magnitude'),
        mainValue: `${Number(amount).toLocaleString()} ${t('common.etb')}`,
        secondaryLabel: t('expense.status'),
        secondaryValue: isRecurring ? t(`expense.${frequency.toLowerCase()}`) : t('expense.one_time'),
        iconType: 'expense',
        itemName: name
      });
    } else {
      Alert.alert(t('common.error'), t('expense.failed_to_save'));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Outflow Header */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
            <View style={styles.headerRow}>
               <View>
                  <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{t('expense.capital_management')}</Text>
                  <Text style={[styles.headerTitle, { color: colors.text }]}>{t('expense.outflow_intelligence')}</Text>
               </View>
               <View style={[styles.walletBadge, { backgroundColor: '#FF3B3015' }]}>
                  <TrendingDown size={20} color="#FF3B30" />
               </View>
            </View>
        </Animated.View>

        {/* Magnitude Card */}
        <Animated.View entering={FadeInDown.delay(200)} style={[styles.magnitudeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.magnitudeLabel, { color: colors.textSecondary }]}>{t('expense.capital_magnitude')}</Text>

          {/* Record Date */}
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 15 }}
            onPress={() => setShowDatePicker(true)}
          >
            <CalendarIcon size={18} color={colors.primary} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[{ fontSize: 11, fontFamily: Fonts.semibold, color: colors.textSecondary, textTransform: 'uppercase' }]}>{t('common.record_date')}</Text>
              <Text style={[{ fontSize: 16, fontFamily: Fonts.bold, color: recordDate ? colors.text : colors.textSecondary, marginTop: 2 }]}>
                {recordDate || t('common.today')}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.magnitudeInputRow}>
            <TextInput
              style={[styles.magnitudeValue, { color: colors.text }]}
              placeholder="0.00"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholderTextColor={colors.border}
              onFocus={() => Haptics.selectionAsync()}
            />
            <Text style={[styles.magnitudeCurr, { color: colors.textSecondary }]}>{t('common.etb')}</Text>
          </View>
          <View style={styles.magnitudeFooter}>
             <ShieldCheck size={12} color={colors.textSecondary} />
             <Text style={[styles.magnitudeFooterText, { color: colors.textSecondary }]}>{t('expense.security_active')}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400)} style={styles.formSection}>
          {/* Identity Nodes */}
          <View style={styles.inputNode}>
             <View style={styles.nodeHeader}>
                <Zap size={14} color={colors.textSecondary} />
                <Text style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('expense.desc_payee')}</Text>
             </View>
             <TextInput 
               style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
               placeholder={t('expense.desc_placeholder')} 
               placeholderTextColor={colors.textSecondary}
               value={name}
               onChangeText={setName}
             />
          </View>

          {/* Automation Blocks */}
          <View style={[styles.automationBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <View style={styles.blockHeader}>
                <Repeat size={18} color={colors.primary} />
                <Text style={[styles.blockTitle, { color: colors.text }]}>{t('expense.automate_outflow')}</Text>
                <TouchableOpacity 
                   onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsRecurring(!isRecurring); }}
                   style={[styles.switch, { backgroundColor: isRecurring ? colors.text : colors.border }]}
                >
                   <View style={[styles.switchThumb, { backgroundColor: colors.background, left: isRecurring ? 24 : 2 }]} />
                </TouchableOpacity>
             </View>
             
             {isRecurring && (
               <Animated.View entering={FadeIn} style={styles.recurringConfig}>
                  <View style={styles.freqRow}>
                    {['Daily', 'Weekly', 'Monthly', 'Yearly'].map(freq => (
                      <TouchableOpacity 
                        key={freq} 
                        style={[styles.freqChip, { backgroundColor: colors.background, borderColor: colors.border }, frequency === freq && { borderColor: colors.text, backgroundColor: colors.card }]}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFrequency(freq); }}
                      >
                        <Text style={[styles.freqText, { color: frequency === freq ? colors.text : colors.textSecondary }]}>{t(`expense.${freq.toLowerCase()}`)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.dateIntake}>
                     <View style={[styles.dateNode, { borderRightWidth: 1, borderColor: colors.border }]}>
                        <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{t('expense.start_date')}</Text>
                        <Text style={[styles.dateValue, { color: colors.text }]}>{formatDate(new Date(startDate), calendarType, language)}</Text>
                     </View>
                     <View style={styles.dateNode}>
                        <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{t('expense.next_drill')}</Text>
                        <Text style={[styles.dateValue, { color: colors.primary }]}>{formatDate(new Date(calculateNextBilling(startDate, frequency)), calendarType, language)}</Text>
                     </View>
                  </View>
               </Animated.View>
             )}
          </View>

          <View style={[styles.rowBetween, { marginTop: 10 }]}>
             <View style={styles.nodeHeader}>
                <Bell size={14} color={colors.textSecondary} />
                <Text style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('expense.prior_notification')}</Text>
             </View>
             <Switch 
               value={notify} 
               onValueChange={(val) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNotify(val); }}
               trackColor={{ false: colors.border, true: colors.text }}
               thumbColor={notify ? colors.background : colors.textSecondary}
             />
          </View>

          <TouchableOpacity 
            style={[styles.finishBtn, { backgroundColor: colors.text }]} 
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <ShieldCheck size={22} color={colors.background} />
            <Text style={[styles.finishBtnText, { color: colors.background }]}>{t('expense.commit_ledger')}</Text>
          </TouchableOpacity>
        </Animated.View>
        
        <View style={{ height: 100 }} />

        <Modal visible={!!successDetails} transparent animationType="fade">
          <BusinessSuccessModal 
            details={successDetails!} 
            onClose={() => {
              setSuccessDetails(null);
              onSaveSuccess?.();
            }} 
          />
        </Modal>
      </ScrollView>
      </KeyboardAvoidingView>

      <CustomDatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={(date) => { setRecordDate(date); setShowDatePicker(false); }}
        initialDate={recordDate}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 25 },
  header: { marginTop: 20, marginBottom: 30 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerSub: { fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { fontSize: 32, fontFamily: Fonts.bold, letterSpacing: -1 },
  walletBadge: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  magnitudeCard: { borderRadius: 32, padding: 30, borderWidth: 1, alignItems: 'center', marginBottom: 35 },
  magnitudeLabel: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1.5, marginBottom: 15 },
  magnitudeInputRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
  magnitudeValue: { fontSize: 48, fontFamily: Fonts.bold, textAlign: 'center' },
  magnitudeCurr: { fontSize: 18, fontFamily: Fonts.bold, marginLeft: 8 },
  magnitudeFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.5 },
  magnitudeFooterText: { fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 1 },
  formSection: { gap: 25 },
  inputNode: { gap: 10 },
  nodeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5 },
  nodeLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  input: { height: 60, borderRadius: 18, borderWidth: 1, paddingHorizontal: 20, fontSize: 16, fontFamily: Fonts.medium },
  automationBlock: { borderRadius: 28, padding: 20, borderWidth: 1 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 5 },
  blockTitle: { flex: 1, fontSize: 15, fontFamily: Fonts.bold },
  switch: { width: 50, height: 28, borderRadius: 14, padding: 2, position: 'relative' },
  switchThumb: { width: 24, height: 24, borderRadius: 12, position: 'absolute', top: 2 },
  recurringConfig: { marginTop: 20, gap: 20 },
  freqRow: { flexDirection: 'row', gap: 8 },
  freqChip: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  freqText: { fontSize: 11, fontFamily: Fonts.bold },
  dateIntake: { flexDirection: 'row', height: 65, borderRadius: 16, overflow: 'hidden' },
  dateNode: { flex: 1, justifyContent: 'center', paddingLeft: 20 },
  dateLabel: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  dateValue: { fontSize: 14, fontFamily: Fonts.bold, marginTop: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  finishBtn: { height: 65, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 },
  finishBtnText: { fontSize: 16, fontFamily: Fonts.bold },
});

export default AddExpenseScreen;