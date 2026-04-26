import React, { useState } from 'react';
import { Fonts } from '@/constants/theme';
import { 
  User, 
  Check, 
  ChevronLeft, 
  CreditCard, 
  ArrowUpRight, 
  AlertCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Calendar,
  AlertTriangle,
  Info
} from 'lucide-react-native';
import {
  StyleSheet,
  Text as RNText,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  TextInput,
  Alert
} from 'react-native';
import { useSettings } from '@/context/SettingsContext';
import { getDebtCustomers, getDebtSales, processDebtPayment, markDebtAsLoss } from '@/database/db';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

const DebtDetailView = ({ customer, onBack }: { customer: any, onBack: () => void }) => {
  const { colors, t, theme } = useSettings();
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [debtSales, setDebtSales] = useState<any[]>([]);

  React.useEffect(() => {
    const loadItems = async () => {
      const sales = await getDebtSales(customer.customerName);
      setDebtSales(sales);
    };
    loadItems();
  }, [customer]);

  if (showPaymentOptions) {
    return (
      <View style={[styles.detailContainer, { backgroundColor: colors.background }]}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setShowPaymentOptions(false)} style={styles.backBtnCircle}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <View>
            <RNText style={[styles.headerSub, { color: colors.textSecondary }]}>{t('dash.settlement')}</RNText>
            <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('dash.payment_orchestration')}</RNText>
          </View>
        </View>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(500)}>
            <RNText style={[styles.sectionHeading, { color: colors.textSecondary }]}>{t('dash.select_calculus')}</RNText>
            
            <TouchableOpacity 
              style={[
                styles.paymentOptionNode, 
                { backgroundColor: colors.card, borderColor: colors.border },
                paymentType === 'full' && { borderColor: colors.primary, borderWidth: 2 }
              ]} 
              onPress={() => setPaymentType('full')}
              activeOpacity={0.8}
            >
              <View style={[styles.radioBox, { borderColor: colors.border }, paymentType === 'full' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {paymentType === 'full' && <Check size={12} color="#FFF" strokeWidth={4} />}
              </View>
              <View style={{ flex: 1 }}>
                <RNText style={[styles.optionLabel, { color: colors.text }]}>{t('dashboard.full_payment')}</RNText>
                <RNText style={[styles.optionSub, { color: colors.textSecondary }]}>{t('dash.settle_entire')}</RNText>
              </View>
              <RNText style={[styles.optionPrice, { color: colors.primary }]}>{customer.oweAmount.toLocaleString()} ETB</RNText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.paymentOptionNode, 
                { backgroundColor: colors.card, borderColor: colors.border },
                paymentType === 'partial' && { borderColor: colors.primary, borderWidth: 2 }
              ]} 
              onPress={() => setPaymentType('partial')}
              activeOpacity={0.8}
            >
              <View style={[styles.radioBox, { borderColor: colors.border }, paymentType === 'partial' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {paymentType === 'partial' && <Check size={12} color="#FFF" strokeWidth={4} />}
              </View>
              <View style={{ flex: 1 }}>
                <RNText style={[styles.optionLabel, { color: colors.text }]}>{t('dashboard.partial_payment')}</RNText>
                <RNText style={[styles.optionSub, { color: colors.textSecondary }]}>{t('dash.record_fractional')}</RNText>
              </View>
            </TouchableOpacity>

            {paymentType === 'partial' && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.partialInputContainer}>
                <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('dash.amount_to_settle')}</RNText>
                <View style={[styles.inputNodeBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.partialInput, { color: colors.text }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={partialAmount}
                    onChangeText={setPartialAmount}
                  />
                  <RNText style={[styles.inputUnit, { color: colors.textSecondary }]}>ETB</RNText>
                </View>
              </Animated.View>
            )}

            <TouchableOpacity 
              style={[styles.primaryActionBtn, { backgroundColor: colors.text }]}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const amount = paymentType === 'full' ? customer.oweAmount : parseFloat(partialAmount);
                if (paymentType === 'partial' && (!amount || amount <= 0 || amount > customer.oweAmount)) {
                  Alert.alert(t('common.error'), t('dash.invalid_amount') || 'Please enter a valid amount');
                  return;
                }
                const success = await processDebtPayment(customer.customerName, amount, paymentType);
                if (success) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  onBack();
                }
              }}
            >
              <RNText style={[styles.primaryActionText, { color: colors.background }]}>{t('dash.commit_settlement')}</RNText>
              <ShieldCheck size={20} color={colors.background} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.lossBtn, { borderColor: colors.error + '40' }]}
              onPress={() => {
                Alert.alert(
                  t('dash.mark_as_loss'),
                  t('dash.loss_confirm') || 'Are you sure you want to mark this debt as a loss? This will remove it from outstanding debts.',
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    { 
                      text: t('common.confirm') || 'Confirm', 
                      style: 'destructive',
                      onPress: async () => {
                        const success = await markDebtAsLoss(customer.customerName);
                        if (success) {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          onBack();
                        }
                      }
                    }
                  ]
                );
              }}
            >
              <ShieldAlert size={18} color={colors.error} />
              <RNText style={[styles.lossBtnText, { color: colors.error }]}>{t('dash.mark_as_loss')}</RNText>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.detailContainer, { backgroundColor: colors.background }]}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtnCircle}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <RNText style={[styles.headerSub, { color: colors.textSecondary }]}>{t('dash.intelligence')}</RNText>
          <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('dash.settlement_bp')}</RNText>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)}>
          {/* Main Blueprint Card */}
          <View style={[styles.blueprintCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.blueprintHeader}>
              <View style={[styles.userIconBox, { backgroundColor: colors.text + '08' }]}>
                <User size={28} color={colors.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <RNText style={[styles.blueprintName, { color: colors.text }]}>{customer.customerName}</RNText>
                <RNText style={[styles.blueprintPhone, { color: colors.textSecondary }]}>
                  ID: {customer.customerPhone || 'UNREGISTERED'}
                </RNText>
              </View>
              <View style={[styles.statusNode, { backgroundColor: colors.primary + '15' }]}>
                 <AlertCircle size={14} color={colors.primary} />
                 <RNText style={[styles.statusNodeText, { color: colors.primary }]}>{t('dash.active_debt')}</RNText>
              </View>
            </View>

            <View style={[styles.blueprintDivider, { backgroundColor: colors.border }]} />

            <RNText style={[styles.listHeader, { color: colors.textSecondary }]}>{t('dash.trans_history')}</RNText>
            {debtSales.map((sale, idx) => (
              <View key={idx} style={styles.blueprintRow}>
                <View style={styles.rowLeft}>
                   <Clock size={14} color={colors.textSecondary} />
                   <View>
                     <RNText style={[styles.rowItemLabel, { color: colors.text }]}>
                       {sale.itemName} <RNText style={{ color: colors.textSecondary }}>x {sale.quantity}</RNText>
                     </RNText>
                     <RNText style={[styles.saleMeta, { color: colors.textSecondary }]}>
                       {new Date(sale.createdAt).toLocaleDateString()}
                     </RNText>
                     {sale.dueDate && (
                       <View style={styles.dueRow}>
                         <AlertTriangle size={10} color={colors.error} />
                         <RNText style={[styles.dueText, { color: colors.error }]}>
                           {t('dash.due_date')}: {new Date(sale.dueDate).toLocaleDateString()}
                         </RNText>
                       </View>
                     )}
                   </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <RNText style={[styles.rowItemValue, { color: colors.text }]}>
                    {sale.totalPrice.toLocaleString()} <RNText style={styles.currency}>ETB</RNText>
                  </RNText>
                  {sale.paidAmount > 0 && (
                    <View style={styles.partialBadge}>
                      <RNText style={[styles.partialText, { color: colors.success }]}>
                        {t('dashboard.paid') || 'Paid'}: {sale.paidAmount.toLocaleString()}
                      </RNText>
                    </View>
                  )}
                </View>
              </View>
            ))}

            <View style={[styles.blueprintDivider, { backgroundColor: colors.border }]} />

            <View style={styles.blueprintFooter}>
              <View>
                <RNText style={[styles.totalLabel, { color: colors.textSecondary }]}>{t('dash.outstanding_balance')}</RNText>
                <RNText style={[styles.totalValue, { color: colors.primary }]}>
                   {customer.oweAmount.toLocaleString()} <RNText style={styles.totalCurrency}>ETB</RNText>
                </RNText>
              </View>
              <TouchableOpacity 
                style={[styles.settleBtn, { backgroundColor: colors.text }]} 
                onPress={() => setShowPaymentOptions(true)}
              >
                <RNText style={[styles.settleBtnText, { color: colors.background }]}>{t('dash.analyze_payment')}</RNText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Secondary Stats Cluster */}
          <View style={styles.statsCluster}>
             <View style={[styles.statNode, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <RNText style={[styles.statNodeLabel, { color: colors.textSecondary }]}>{t('dash.history')}</RNText>
                <RNText style={[styles.statNodeValue, { color: colors.text }]}>{customer.totalDebts} Records</RNText>
             </View>
             <View style={[styles.statNode, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <RNText style={[styles.statNodeLabel, { color: colors.textSecondary }]}>Exposure</RNText>
                <View style={styles.exposureRow}>
                   <ArrowUpRight size={14} color={colors.primary} />
                   <RNText style={[styles.statNodeValue, { color: colors.text }]}>High Risk</RNText>
                </View>
             </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const OnCreditCustomersScreen = () => {
  const { colors, t } = useSettings();
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);

  React.useEffect(() => {
    const loadData = async () => {
      const data = await getDebtCustomers();
      setCustomers(data);
    };
    loadData();
  }, []);

  if (selectedCustomer) {
    return <DebtDetailView customer={selectedCustomer} onBack={() => setSelectedCustomer(null)} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        contentContainerStyle={styles.listContainer} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerNode}>
           <RNText style={[styles.headerSub, { color: colors.textSecondary }]}>{t('dash.financial_health')}</RNText>
           <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('dash.liability_ledger')}</RNText>
        </View>

        {customers.map((item, idx) => (
          <Animated.View key={idx} entering={FadeInDown.delay(idx * 50).duration(500)}>
            <TouchableOpacity 
              style={[styles.nodeCard, { backgroundColor: colors.card, borderColor: colors.border }]} 
              activeOpacity={0.7} 
              onPress={() => setSelectedCustomer(item)}
            >
              <View style={styles.cardMain}>
                <View style={[styles.iconNode, { backgroundColor: colors.text + '05' }]}>
                  <User size={22} color={colors.text} />
                </View>
                <View style={styles.infoArea}>
                  <RNText style={[styles.itemName, { color: colors.text }]}>{item.customerName}</RNText>
                  <View style={styles.metaRow}>
                    <Calendar size={12} color={colors.textSecondary} />
                    <RNText style={[styles.itemSub, { color: colors.textSecondary }]}>
                      {t('dash.records_count', { count: item.totalDebts.toString() })}
                    </RNText>
                  </View>
                </View>
                <View style={styles.statArea}>
                   <RNText style={[styles.debtPrice, { color: colors.primary }]}>
                     {item.oweAmount.toLocaleString()} <RNText style={styles.currencySmall}>ETB</RNText>
                   </RNText>
                   {new Date() > new Date(new Date(item.lastBorrowed).getTime() + 30 * 24 * 60 * 60 * 1000) ? (
                     <View style={[styles.overdueBadge, { backgroundColor: colors.error + '15' }]}>
                        <AlertTriangle size={10} color={colors.error} />
                        <RNText style={[styles.overdueText, { color: colors.error }]}>{t('dash.overdue')}</RNText>
                     </View>
                   ) : (
                     <View style={[styles.statusBadgeSmall, { backgroundColor: colors.primary + '15' }]}>
                        <AlertCircle size={10} color={colors.primary} />
                        <RNText style={[styles.statusBadgeText, { color: colors.primary }]}>Pending</RNText>
                     </View>
                   )}
                </View>
              </View>

              <View style={[styles.cardFooter, { backgroundColor: colors.text + '03' }]}>
                 <RNText style={[styles.footerText, { color: colors.textSecondary }]}>
                   Awaiting Settlement Orchestration
                 </RNText>
                 <ChevronRight size={16} color={colors.border} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}

        {customers.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.success + '10' }]}>
               <ShieldCheck size={40} color={colors.success} />
            </View>
            <RNText style={[styles.emptyTitle, { color: colors.text }]}>{t('dash.liability_free')}</RNText>
            <RNText style={[styles.emptySub, { color: colors.textSecondary }]}>{t('dash.no_credit_detected')}</RNText>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContainer: { paddingHorizontal: 25, paddingBottom: 40, paddingTop: 20 },
  headerNode: { marginBottom: 25 },
  headerSub: { fontSize: 11, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { fontSize: 24, fontFamily: Fonts.bold },
  nodeCard: { borderRadius: 24, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  iconNode: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  infoArea: { flex: 1, marginLeft: 16 },
  itemName: { fontSize: 17, fontFamily: Fonts.bold, marginBottom: 2 },
  itemSub: { fontSize: 13, fontFamily: Fonts.medium },
  statArea: { alignItems: 'flex-end' },
  debtPrice: { fontSize: 16, fontFamily: Fonts.bold },
  currencySmall: { fontSize: 11, opacity: 0.6 },
  statusBadgeSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4, gap: 4 },
  statusBadgeText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  footerText: { fontSize: 11, fontFamily: Fonts.medium, fontStyle: 'italic' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontFamily: Fonts.bold },
  emptySub: { fontSize: 14, fontFamily: Fonts.medium, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },

  // Detail View
  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 60, paddingBottom: 20, gap: 16 },
  backBtnCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flex: 1, paddingHorizontal: 25 },
  blueprintCard: { borderRadius: 30, borderWidth: 1, padding: 22, marginBottom: 20 },
  blueprintHeader: { flexDirection: 'row', alignItems: 'center' },
  userIconBox: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  blueprintName: { fontSize: 20, fontFamily: Fonts.bold },
  blueprintPhone: { fontSize: 13, fontFamily: Fonts.medium, marginTop: 2 },
  statusNode: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, gap: 4 },
  statusNodeText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  blueprintDivider: { height: 1, marginVertical: 20 },
  listHeader: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1, marginBottom: 15 },
  blueprintRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowItemLabel: { fontSize: 15, fontFamily: Fonts.medium },
  rowItemValue: { fontSize: 15, fontFamily: Fonts.bold },
  currency: { fontSize: 11, opacity: 0.6 },
  blueprintFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  totalLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: 4 },
  totalValue: { fontSize: 26, fontFamily: Fonts.bold },
  totalCurrency: { fontSize: 16, opacity: 0.6 },
  settleBtn: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14 },
  settleBtnText: { color: '#FFF', fontSize: 14, fontFamily: Fonts.bold },
  statsCluster: { flexDirection: 'row', gap: 12, marginBottom: 40 },
  statNode: { flex: 1, borderRadius: 20, borderWidth: 1, padding: 18 },
  statNodeLabel: { fontSize: 11, fontFamily: Fonts.medium, marginBottom: 4 },
  statNodeValue: { fontSize: 16, fontFamily: Fonts.bold },
  exposureRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // Payment Options
  sectionHeading: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 20, marginTop: 10 },
  paymentOptionNode: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 16, gap: 16 },
  radioBox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  optionLabel: { fontSize: 17, fontFamily: Fonts.bold, marginBottom: 2 },
  optionSub: { fontSize: 13, fontFamily: Fonts.medium },
  optionPrice: { fontSize: 17, fontFamily: Fonts.bold },
  primaryActionBtn: { flexDirection: 'row', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 40 },
  primaryActionText: { fontSize: 16, fontFamily: Fonts.bold },

  // New Styles
  partialInputContainer: { marginTop: 20, marginBottom: 10 },
  inputNodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 20,
    marginTop: 8
  },
  partialInput: { flex: 1, fontSize: 18, fontFamily: Fonts.bold },
  inputUnit: { fontSize: 14, fontFamily: Fonts.bold, marginLeft: 10 },
  lossBtn: {
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 15,
    borderStyle: 'dashed'
  },
  lossBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  dueText: { fontSize: 11, fontFamily: Fonts.bold },
  partialBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(52, 199, 89, 0.1)', alignSelf: 'flex-start', marginTop: 5 },
  partialText: { fontSize: 10, fontFamily: Fonts.bold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  overdueBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 5 },
  overdueText: { fontSize: 9, fontFamily: Fonts.bold, textTransform: 'uppercase' },
});

export default OnCreditCustomersScreen;