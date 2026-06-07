import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Pressable
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
import { insertSale, getDebtCustomers } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import { Fonts } from '@/constants/theme';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
interface SaleFormProps {
  cart: any[];
  onFinish?: (saleData: any) => void;
  onBack?: () => void;
}

const GlobalCheckout: React.FC<SaleFormProps> = ({ cart, onFinish, onBack }) => {
  const { colors, t, theme } = useSettings();
  const dialog = useDialog();
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Transfer'>('Cash');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Debt'>('Paid');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState('0');
  const [globalVat, setGlobalVat] = useState('0');
  const [recordDate, setRecordDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [existingCustomers, setExistingCustomers] = useState<any[]>([]);

  const calculateTotals = () => {
    // Ensure cart is valid
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return { subtotal: 0, vatAmount: 0, total: 0 };
    }

    const subtotal = cart.reduce((sum, item) => {
      const price = item.unitType === 'pack' ? item.packSellingPrice : item.baseSellingPrice;
      const qty = Math.max(0, item.quantity || 0);
      return sum + (parseFloat(price) || 0) * qty;
    }, 0);

    const disc = Math.max(0, parseFloat(globalDiscount) || 0);
    const vatRate = Math.min(100, Math.max(0, parseFloat(globalVat) || 0));
    const vatAmount = (subtotal - disc) * (vatRate / 100);
    const total = Math.max(0, subtotal - disc + vatAmount);

    return { subtotal, vatAmount, total };
  };

  const { subtotal, vatAmount, total } = calculateTotals();

  const handleCheckout = async () => {
    // Validate cart is not empty
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({ title: t('common.error'), message: 'No items in cart to checkout.', iconType: 'danger' });
      return;
    }

    // Validate discount is non-negative
    const parsedDiscount = parseFloat(globalDiscount) || 0;
    if (parsedDiscount < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({ title: t('common.error'), message: 'Discount cannot be negative.', iconType: 'danger' });
      return;
    }

    // Validate VAT is within range 0-100
    const parsedVat = parseFloat(globalVat) || 0;
    if (parsedVat < 0 || parsedVat > 100) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({ title: t('common.error'), message: 'VAT must be between 0% and 100%.', iconType: 'danger' });
      return;
    }

    // Validate debt customer info
    if (paymentStatus === 'Debt') {
      if (!customerName || !customerName.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await dialog.alert({ title: t('common.error'), message: t('sale.credit_error'), iconType: 'danger' });
        return;
      }
      if (!customerPhone || !customerPhone.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await dialog.alert({ title: t('common.error'), message: t('sale.credit_error'), iconType: 'danger' });
        return;
      }
      if (!/^\+?[\d\s\-()]{7,20}$/.test(customerPhone.trim())) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await dialog.alert({ title: t('sale.invalid_phone'), message: t('sale.invalid_phone_msg'), iconType: 'warning' });
        return;
      }
    }

    // Validate total is a valid number
    if (isNaN(total) || total < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({ title: t('common.error'), message: t('sale.invalid_total'), iconType: 'danger' });
      return;
    }

    // Stock validation: check each item has sufficient stock before checkout
    for (const item of cart) {
      const requiredQty = item.unitType === 'pack' ? item.quantity : item.quantity;
      const availableStock = item.unitType === 'pack'
        ? Math.floor(item.totalPackQuantity || 0)
        : Math.floor(item.totalBaseQuantity || 0);
      if (requiredQty > availableStock) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const unitLabel = item.unitType === 'pack' ? item.purchaseUnit : item.baseUnit;
        await dialog.alert({
          title: 'Insufficient Stock',
          message: `${item.name}: Required ${requiredQty} ${unitLabel}, but only ${availableStock} available.`,
          iconType: 'danger',
        });
        return;
      }
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 90}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Checkout Header */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
            <View style={styles.headerRow}>
                <View>
                   <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.transaction_logic')}</AppText>
                   <AppText variant="title" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('sale.intelligence_setting')}</AppText>
                </View>
                <View style={[styles.bagBadge, { backgroundColor: colors.text + '10' }]}>
                   <ShoppingBag size={20} color={colors.text} />
                   <AppText variant="title" weight="bold" shrink={false} style={[styles.bagCount, { color: colors.text }]} numberOfLines={1}>{cart.length}</AppText>
                </View>
            </View>
        </Animated.View>

        {/* Settlement Blocks */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.formSection}>

           {/* Record Date */}
           <TouchableOpacity 
             style={[{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 15, flexDirection: 'row', alignItems: 'center' }]}
             onPress={() => setShowDatePicker(true)}
           >
             <Calendar size={18} color={colors.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: colors.textSecondary }} numberOfLines={1}>{t('common.record_date') || 'Record Date'}</AppText>
                <AppText variant="body" weight="bold" style={{ color: recordDate ? colors.text : colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                  {recordDate || (t('common.today') || 'Today (Default)')}
                </AppText>
              </View>
           </TouchableOpacity>
          <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.blockHeader}>
                 <Zap size={18} color={colors.primary} />
                 <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: colors.text }]} numberOfLines={2}>{t('sale.payment_modality')}</AppText>
              </View>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, paymentMethod === 'Cash' && [styles.modalActive, { backgroundColor: colors.text }]]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPaymentMethod('Cash'); }}
                >
                  <Banknote size={16} color={paymentMethod === 'Cash' ? colors.background : colors.textSecondary} />
                  <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.modalBtnText, { color: paymentMethod === 'Cash' ? colors.background : colors.textSecondary }]} numberOfLines={1}>{t('sale.physical_cash')}</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, paymentMethod === 'Transfer' && [styles.modalActive, { backgroundColor: colors.text }]]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPaymentMethod('Transfer'); }}
                >
                  <CreditCard size={16} color={paymentMethod === 'Transfer' ? colors.background : colors.textSecondary} />
                  <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.modalBtnText, { color: paymentMethod === 'Transfer' ? colors.background : colors.textSecondary }]} numberOfLines={1}>{t('sale.digital_bank')}</AppText>
                </TouchableOpacity>
              </View>
           </View>

           <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 15 }]}>
              <View style={styles.blockHeader}>
                 <ShieldCheck size={18} color={colors.primary} />
                 <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: colors.text }]} numberOfLines={2}>{t('sale.settlement_status')}</AppText>
              </View>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, paymentStatus === 'Paid' && [styles.modalActive, { backgroundColor: colors.text }]]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPaymentStatus('Paid'); }}
                >
                  <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.modalBtnText, { color: paymentStatus === 'Paid' ? colors.background : colors.textSecondary }]} numberOfLines={1}>{t('sale.settled_full')}</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, paymentStatus === 'Debt' && [styles.modalActive, { backgroundColor: '#FF9500' }]]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPaymentStatus('Debt'); }}
                >
                  <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.modalBtnText, { color: paymentStatus === 'Debt' ? '#FFF' : colors.textSecondary }]} numberOfLines={1}>{t('sale.debt_credit')}</AppText>
                </TouchableOpacity>
              </View>
           </View>

          {paymentStatus === 'Debt' && (
            <Animated.View entering={FadeInDown} layout={Layout} style={styles.identityNodes}>
               <TouchableOpacity 
                 style={[{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10 }]}
                 onPress={() => {
                   const customers = getDebtCustomers();
                   setExistingCustomers(customers);
                   setCustomerSearchQuery('');
                   setShowCustomerSearch(true);
                 }}
               >
                  <History size={16} color={colors.primary} />
                  <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.nodeLabel, { color: colors.primary, marginLeft: 8 }]} numberOfLines={1}>Select existing customer</AppText>
                </TouchableOpacity>
                <View style={styles.inputNode}>
                   <View style={styles.nodeHeader}>
                      <User size={14} color={colors.textSecondary} />
                      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.customer_identity')}</AppText>
                   </View>
                    <TextInput
                      style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                      placeholder={t('form.official_name')}
                      placeholderTextColor={colors.textSecondary}
                      value={customerName}
                      onChangeText={(val) => { if (val.length <= 50) setCustomerName(val); }}
                      maxLength={50}
                    />
                    <AppText variant="micro" weight="medium" align="right" shrink={false} style={{ color: colors.textSecondary, marginTop: 4 }} numberOfLines={1}>{customerName.length}/50</AppText>
                </View>
                <View style={styles.inputNode}>
                   <View style={styles.nodeHeader}>
                      <Phone size={14} color={colors.textSecondary} />
                      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.contact_string')}</AppText>
                   </View>
                    <TextInput
                      style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                      placeholder={t('form.contact_placeholder')}
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="phone-pad"
                      value={customerPhone}
                      onChangeText={(val) => { if (val.length <= 20) setCustomerPhone(val); }}
                      maxLength={20}
                    />
                    <AppText variant="micro" weight="medium" align="right" shrink={false} style={{ color: colors.textSecondary, marginTop: 4 }} numberOfLines={1}>{customerPhone.length}/20</AppText>
                </View>
            </Animated.View>
          )}

          {/* Customer Search Modal */}
          <Modal visible={showCustomerSearch} transparent animationType="fade">
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }} onPress={() => setShowCustomerSearch(false)}>
              <View style={[{ backgroundColor: colors.card, margin: 30, borderRadius: 24, padding: 20, maxHeight: 400, borderWidth: 1, borderColor: colors.border }]}>
                <AppText variant="title" weight="bold" style={[styles.nodeLabel, { color: colors.text, marginBottom: 12 }]} numberOfLines={2}>Select Customer</AppText>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                  placeholder={t('sales.search_customers')}
                  placeholderTextColor={colors.textSecondary}
                  value={customerSearchQuery}
                  onChangeText={setCustomerSearchQuery}
                />
                <ScrollView style={{ maxHeight: 250 }}>
                  {existingCustomers
                    .filter(c => c.customerName?.toLowerCase().includes(customerSearchQuery.toLowerCase()))
                    .map((customer, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }]}
                        onPress={() => {
                          setCustomerName(customer.customerName);
                          setCustomerPhone(customer.customerPhone || '');
                          setShowCustomerSearch(false);
                        }}
                      >
                        <User size={16} color={colors.textSecondary} />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <AppText variant="body" weight="bold" style={[styles.nodeLabel, { color: colors.text }]} numberOfLines={1}>{customer.customerName}</AppText>
                          <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>
                            {customer.customerPhone || 'No phone'} • {(customer.oweAmount || 0).toLocaleString()} {t('common.etb')} owed
                          </AppText>
                        </View>
                      </TouchableOpacity>
                    ))}
                  {existingCustomers.length === 0 && (
                    <AppText variant="body" weight="medium" align="center" style={{ color: colors.textSecondary, paddingVertical: 20 }} numberOfLines={2}>No existing customers found</AppText>
                  )}
                </ScrollView>
                <TouchableOpacity onPress={() => setShowCustomerSearch(false)} style={{ marginTop: 15, alignSelf: 'center' }}>
                  <AppText variant="body" weight="bold" shrink={false} style={[styles.nodeLabel, { color: colors.primary }]} numberOfLines={1}>Cancel</AppText>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>

          {/* Pricing Adjustments */}
          <View style={styles.pricingSection}>
             <View style={styles.adjRow}>
                <View style={styles.adjLabelCol}>
                   <Ticket size={16} color={colors.textSecondary} />
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.adjLabel, { color: colors.textSecondary }]} numberOfLines={2}>{t('sale.loyalty_discount')}</AppText>
                </View>
                <View style={[styles.adjInputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                   <TextInput
                      style={[styles.adjInput, { color: colors.text }]}
                      value={globalDiscount}
                      onChangeText={setGlobalDiscount}
                      keyboardType="numeric"
                   />
                   <AppText variant="body" weight="bold" shrink={false} style={[styles.adjCurr, { color: colors.textSecondary }]} numberOfLines={1}>{t('common.etb')}</AppText>
                </View>
              </View>
           </View>

           {/* Vault Summary */}
           <View style={[styles.vaultSummary, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
              <View style={styles.summaryLine}>
                 <AppText variant="caption" weight="medium" style={[styles.vLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.subtotal')}</AppText>
                 <AppText variant="body" weight="bold" shrink={false} style={[styles.vValue, { color: colors.text }]} numberOfLines={1}>{subtotal.toLocaleString()} {t('common.etb')}</AppText>
              </View>
              <View style={styles.summaryLine}>
                 <AppText variant="caption" weight="medium" style={[styles.vLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.discount')}</AppText>
                 <AppText variant="body" weight="bold" shrink={false} style={[styles.vValue, { color: colors.text }]} numberOfLines={1}>- {Number(globalDiscount).toLocaleString()} {t('common.etb')}</AppText>
              </View>
              <View style={[styles.vDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryLine}>
                 <AppText variant="title" weight="bold" style={[styles.vTotalLabel, { color: colors.text }]} numberOfLines={1}>{t('sale.total_settlement')}</AppText>
                 <AppText variant="title" weight="bold" shrink={false} style={[styles.vTotalValue, { color: colors.text }]} numberOfLines={1}>{total.toLocaleString()} {t('common.etb')}</AppText>
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
             <AppText variant="body" weight="bold" shrink={false} style={[styles.finishBtnText, { color: colors.background }]} numberOfLines={2}>{t('sale.authorize_settlement').toUpperCase()}</AppText>
           </LinearGradient>
         </TouchableOpacity>

         <TouchableOpacity style={styles.backBtn} onPress={onBack}>
           <ChevronLeft size={16} color={colors.textSecondary} />
           <AppText variant="body-sm" weight="medium" style={[styles.backText, { color: colors.textSecondary }]} numberOfLines={2}>{t('sale.modify_inventory_cart')}</AppText>
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