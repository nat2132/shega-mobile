import React, { useState } from 'react';
import {
  View,
  Text as RNText,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  FadeIn,
  Layout
} from 'react-native-reanimated';
import { 
  BadgeCheck, 
  ArrowRight, 
  Calendar,
  CreditCard, 
  Banknote, 
  User,
  ShoppingBag,
  Ticket,
  Percent,
  Calculator,
  ShieldCheck,
  Phone,
  History,
  Info,
  ChevronLeft,
  Sparkles,
  Zap,
  DollarSign
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { insertSale } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import { Fonts } from '@/constants/theme';
import { CustomDatePicker } from '@/components/CustomDatePicker';

interface SaleFormProps {
  cart: any[];
  onFinish?: (saleData: any) => void;
  onBack?: () => void;
}

const GlobalCheckout: React.FC<SaleFormProps> = ({ cart, onFinish, onBack }) => {
  const { colors, t, theme } = useSettings();
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Transfer'>('Cash');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Debt'>('Paid');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState('0');
  const [globalVat, setGlobalVat] = useState('0');
  const [recordDate, setRecordDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.unitType === 'pack' ? item.packSellingPrice : item.baseSellingPrice) * item.quantity, 0);
    const disc = Number(globalDiscount) || 0;
    const vatRate = Number(globalVat) || 0;
    const vatAmount = (subtotal - disc) * (vatRate / 100);
    const total = subtotal - disc + vatAmount;

    return {
      subtotal,
      vatAmount,
      total: Math.max(0, total)
    };
  };

  const { subtotal, vatAmount, total } = calculateTotals();

  const handleCheckout = () => {
    if (paymentStatus === 'Debt' && (!customerName || !customerPhone)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('sale.credit_error'));
      return;
    }
    
    const dueDate = paymentStatus === 'Debt' 
      ? new Date(new Date(recordDate || Date.now()).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onFinish?.({
      paymentMethod,
      paymentStatus,
      customerName,
      customerPhone,
      discount: globalDiscount,
      vat: globalVat,
      totalPrice: total,
      dueDate,
      createdAt: recordDate || undefined,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Checkout Header */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
            <View style={styles.headerRow}>
               <View>
                  <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{t('sale.transaction_logic')}</Text>
                  <Text style={[styles.headerTitle, { color: colors.text }]}>{t('sale.intelligence_setting')}</Text>
               </View>
               <View style={[styles.bagBadge, { backgroundColor: colors.text + '10' }]}>
                  <ShoppingBag size={20} color={colors.text} />
                  <Text style={[styles.bagCount, { color: colors.text }]}>{cart.length}</Text>
               </View>
            </View>
        </Animated.View>

        {/* Settlement Blocks */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.formSection}>

           {/* Record Date */}
           <TouchableOpacity 
             style={[styles.dateRow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 15, flexDirection: 'row', alignItems: 'center' }]}
             onPress={() => setShowDatePicker(true)}
           >
             <Calendar size={18} color={colors.primary} style={{ marginRight: 12 }} />
             <View style={{ flex: 1 }}>
               <Text style={[{ fontSize: 11, fontFamily: Fonts.semibold, color: colors.textSecondary, textTransform: 'uppercase' }]}>{t('common.record_date') || 'Record Date'}</Text>
               <Text style={[{ fontSize: 16, fontFamily: Fonts.bold, color: recordDate ? colors.text : colors.textSecondary, marginTop: 2 }]}>
                 {recordDate || (t('common.today') || 'Today (Default)')}
               </Text>
             </View>
           </TouchableOpacity>
          <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <View style={styles.blockHeader}>
                <Zap size={18} color={colors.primary} />
                <Text style={[styles.blockTitle, { color: colors.text }]}>{t('sale.payment_modality')}</Text>
             </View>
             <View style={styles.toggleRow}>
               <TouchableOpacity 
                 style={[styles.modalBtn, paymentMethod === 'Cash' && [styles.modalActive, { backgroundColor: colors.text }]]}
                 onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPaymentMethod('Cash'); }}
               >
                 <Banknote size={16} color={paymentMethod === 'Cash' ? colors.background : colors.textSecondary} />
                 <Text style={[styles.modalBtnText, { color: paymentMethod === 'Cash' ? colors.background : colors.textSecondary }]}>{t('sale.physical_cash')}</Text>
               </TouchableOpacity>
               <TouchableOpacity 
                 style={[styles.modalBtn, paymentMethod === 'Transfer' && [styles.modalActive, { backgroundColor: colors.text }]]}
                 onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPaymentMethod('Transfer'); }}
               >
                 <CreditCard size={16} color={paymentMethod === 'Transfer' ? colors.background : colors.textSecondary} />
                 <Text style={[styles.modalBtnText, { color: paymentMethod === 'Transfer' ? colors.background : colors.textSecondary }]}>{t('sale.digital_bank')}</Text>
               </TouchableOpacity>
             </View>
          </View>

          <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 15 }]}>
             <View style={styles.blockHeader}>
                <ShieldCheck size={18} color={colors.primary} />
                <Text style={[styles.blockTitle, { color: colors.text }]}>{t('sale.settlement_status')}</Text>
             </View>
             <View style={styles.toggleRow}>
               <TouchableOpacity 
                 style={[styles.modalBtn, paymentStatus === 'Paid' && [styles.modalActive, { backgroundColor: colors.text }]]}
                 onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPaymentStatus('Paid'); }}
               >
                 <Text style={[styles.modalBtnText, { color: paymentStatus === 'Paid' ? colors.background : colors.textSecondary }]}>{t('sale.settled_full')}</Text>
               </TouchableOpacity>
               <TouchableOpacity 
                 style={[styles.modalBtn, paymentStatus === 'Debt' && [styles.modalActive, { backgroundColor: '#FF9500' }]]}
                 onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPaymentStatus('Debt'); }}
               >
                 <Text style={[styles.modalBtnText, { color: paymentStatus === 'Debt' ? '#FFF' : colors.textSecondary }]}>{t('sale.debt_credit')}</Text>
               </TouchableOpacity>
             </View>
          </View>

          {paymentStatus === 'Debt' && (
            <Animated.View entering={FadeInDown} layout={Layout} style={styles.identityNodes}>
               <View style={styles.inputNode}>
                  <View style={styles.nodeHeader}>
                     <User size={14} color={colors.textSecondary} />
                     <Text style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('sale.customer_identity')}</Text>
                  </View>
                  <TextInput 
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
                    placeholder={t('form.official_name')} 
                    placeholderTextColor={colors.textSecondary}
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
               </View>
               <View style={styles.inputNode}>
                  <View style={styles.nodeHeader}>
                     <Phone size={14} color={colors.textSecondary} />
                     <Text style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('sale.contact_string')}</Text>
                  </View>
                  <TextInput 
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
                    placeholder={t('form.contact_placeholder')} 
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                  />
               </View>
            </Animated.View>
          )}

          {/* Pricing Adjustments */}
          <View style={styles.pricingSection}>
             <View style={styles.adjRow}>
                <View style={styles.adjLabelCol}>
                   <Ticket size={16} color={colors.textSecondary} />
                   <Text style={[styles.adjLabel, { color: colors.textSecondary }]}>{t('sale.loyalty_discount')}</Text>
                </View>
                <View style={[styles.adjInputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                   <TextInput 
                      style={[styles.adjInput, { color: colors.text }]}
                      value={globalDiscount}
                      onChangeText={setGlobalDiscount}
                      keyboardType="numeric"
                   />
                   <Text style={[styles.adjCurr, { color: colors.textSecondary }]}>ETB</Text>
                </View>
             </View>
          </View>

          {/* Vault Summary */}
          <View style={[styles.vaultSummary, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
             <View style={styles.summaryLine}>
                <Text style={[styles.vLabel, { color: colors.textSecondary }]}>{t('sale.subtotal')}</Text>
                <Text style={[styles.vValue, { color: colors.text }]}>{subtotal.toLocaleString()} ETB</Text>
             </View>
             <View style={styles.summaryLine}>
                <Text style={[styles.vLabel, { color: colors.textSecondary }]}>{t('sale.discount')}</Text>
                <Text style={[styles.vValue, { color: colors.text }]}>- {Number(globalDiscount).toLocaleString()} ETB</Text>
             </View>
             <View style={[styles.vDivider, { backgroundColor: colors.border }]} />
             <View style={styles.summaryLine}>
                <Text style={[styles.vTotalLabel, { color: colors.text }]}>{t('sale.total_settlement')}</Text>
                <Text style={[styles.vTotalValue, { color: colors.text }]}>{total.toLocaleString()} ETB</Text>
             </View>
          </View>
        </Animated.View>

        <TouchableOpacity 
          onPress={handleCheckout}
          activeOpacity={0.9}
          style={{ marginTop: 35 }}
        >
          <LinearGradient
            colors={[colors.text, theme === 'dark' ? '#1A1A1A' : '#333']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.finishBtn}
          >
            <ShieldCheck size={22} color={colors.background} />
            <RNText style={[styles.finishBtnText, { color: colors.background }]}>{t('sale.authorize_settlement').toUpperCase()}</RNText>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ChevronLeft size={16} color={colors.textSecondary} />
          <Text style={[styles.backText, { color: colors.textSecondary }]}>{t('sale.modify_inventory_cart')}</Text>
        </TouchableOpacity>
        
        <View style={{ height: 100 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      <CustomDatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={(date) => { setRecordDate(date); setShowDatePicker(false); }}
        initialDate={recordDate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 25 },
  header: { marginTop: 20, marginBottom: 30 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerSub: { fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { fontSize: 32, fontFamily: Fonts.bold, letterSpacing: -1 },
  bagBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15 },
  bagCount: { fontSize: 15, fontFamily: Fonts.bold },
  formSection: { },
  intelligenceBlock: { borderRadius: 28, padding: 20, borderWidth: 1 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  blockTitle: { fontSize: 15, fontFamily: Fonts.bold },
  toggleRow: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, height: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  modalActive: { elevation: 4 },
  modalBtnText: { fontSize: 13, fontFamily: Fonts.bold },
  identityNodes: { marginTop: 25, gap: 15 },
  inputNode: { gap: 10 },
  nodeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5 },
  nodeLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  input: { height: 60, borderRadius: 18, borderWidth: 1, paddingHorizontal: 20, fontSize: 16, fontFamily: Fonts.medium },
  pricingSection: { marginVertical: 25 },
  adjRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  adjLabelCol: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adjLabel: { fontSize: 14, fontFamily: Fonts.bold },
  adjInputBox: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 15, width: 140 },
  adjInput: { flex: 1, textAlign: 'right', fontSize: 16, fontFamily: Fonts.bold, paddingRight: 5 },
  adjCurr: { fontSize: 11, fontFamily: Fonts.bold },
  vaultSummary: { borderRadius: 32, padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  vLabel: { fontSize: 11, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  vValue: { fontSize: 15, fontFamily: Fonts.bold, color: '#FFF' },
  vDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
  vTotalLabel: { fontSize: 14, fontFamily: Fonts.bold, color: '#FFF', letterSpacing: 0.5 },
  vTotalValue: { fontSize: 24, fontFamily: Fonts.bold, color: '#FFF' },
  finishBtn: { height: 65, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 35 },
  finishBtnText: { fontSize: 17, fontFamily: Fonts.bold },
  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  backText: { fontSize: 14, fontFamily: Fonts.bold },
});

export default GlobalCheckout;