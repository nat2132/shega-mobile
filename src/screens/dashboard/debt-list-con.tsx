import React, { useState } from 'react';
import { Fonts } from '@/constants/theme';
import { ArrowLeft, User, Phone, ChevronLeft, Check, Pencil } from 'lucide-react-native';
import { router } from 'expo-router';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '@/context/SettingsContext';
import { AppText, AppRow, AppCard, AppButton, AppListItem } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
const DebtManagementFlow = () => {
  const { t } = useSettings();
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [paymentType, setPaymentType] = useState('full'); // 'full' or 'partial'

  if (showPaymentOptions) {
    // SCREEN 3: Choose Amount Paid
    return (
      <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={() => setShowPaymentOptions(false)} style={styles.backButton}>
          <ChevronLeft size={24} color="#000" />
        </TouchableOpacity>
        <AppText variant="title" weight="bold" style={styles.screenTitle} numberOfLines={1}>{t('dash.payment')}</AppText>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.paymentCard}>
        <AppText variant="title" weight="bold" style={styles.sectionTitle} numberOfLines={2}>{t('dash.choose_paid')}</AppText>

        {/* Full Payment Option */}
        <TouchableOpacity
          style={[styles.optionRow, paymentType === 'full' && styles.selectedOption]}
          onPress={() => setPaymentType('full')}
        >
          <View style={styles.radioCircle}>
            {paymentType === 'full' && <View style={styles.radioInner} />}
          </View>
          <AppText variant="body-lg" weight="medium" style={{ flex: 1 }} numberOfLines={2}>{t('dash.paid_full')}</AppText>
          <AppText variant="body-lg" weight="bold" shrink={false} style={styles.optionAmount} numberOfLines={1}>$1,769.00 Birr</AppText>
        </TouchableOpacity>

        {/* Partial Payment Option */}
        <TouchableOpacity
          style={[styles.optionRow, paymentType === 'partial' && styles.selectedOption]}
          onPress={() => setPaymentType('partial')}
        >
          <View style={styles.radioCircle}>
            {paymentType === 'partial' && <View style={styles.radioInner} />}
          </View>
          <AppText variant="body-lg" weight="medium" style={{ flex: 1 }} numberOfLines={2}>{t('dash.partial_payment')}</AppText>
          <AppText variant="title" shrink={false} style={styles.editIcon}>✏️</AppText>
        </TouchableOpacity>

        {paymentType === 'partial' && (
          <View style={styles.inputWrapper}>
            <AppText variant="body-lg" weight="medium" style={styles.inputLabel} numberOfLines={1}>{t('dash.enter_amount')}</AppText>
            <View style={styles.textInputContainer}>
              <AppText variant="title" weight="bold" shrink={false} style={styles.currencyPrefix}>$</AppText>
              <TextInput style={styles.textInput} keyboardType="numeric" placeholder="0.00" />
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.fullWidthButton}>
          <Check size={18} color="#FFF" />
          <AppText variant="body" weight="bold" shrink={false} style={styles.buttonText}>Mark as Paid</AppText>
        </TouchableOpacity>
      </View>
      </SafeAreaView>
    );
  }

  // SCREEN 2: Abebe Kebede Debt Details
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#000" />
        </TouchableOpacity>
        <AppText variant="title" weight="bold" style={styles.screenTitle} numberOfLines={1}>{t('dash.debt_details')}</AppText>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <User size={24} color="#000" />
            <View style={{ flex: 1 }}>
              <AppText variant="title" weight="bold" style={styles.title} numberOfLines={2}>Abebe Kebede</AppText>
              <AppText variant="body" weight="medium" style={styles.phone} numberOfLines={1}>+(251) 9-123-456</AppText>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.overdueBadge}><View style={styles.dot} /><AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={styles.overdueText} numberOfLines={1}>{t('dash.overdue')}</AppText></View>
            <AppText variant="caption" weight="medium" style={styles.daysText} numberOfLines={1}>6 days overdue</AppText>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.itemsContainer}>
          <AppRow label="Nails x 2kg" value="500.00 Birr" valueVariant="body" valueWeight="bold" labelMaxLines={2} style={{ marginBottom: Spacing.sm }} />
          <AppRow label="Paint x 2 cans" value="1,249.00 Birr" valueVariant="body" valueWeight="bold" labelMaxLines={2} style={{ marginBottom: Spacing.sm }} />
          <AppRow label="Screw x 2 pieces" value="20.00 Birr" valueVariant="body" valueWeight="bold" labelMaxLines={2} style={{ marginBottom: Spacing.sm }} />
        </View>

        <View style={styles.divider} />

        <AppRow label={t('dash.total_debt')} value="1,769.00 Birr" valueVariant="title-sm" valueWeight="bold" labelMaxLines={2} style={{ marginBottom: Spacing.lg }} />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.markPaidButton}
            onPress={() => setShowPaymentOptions(true)}
          >
            <Check size={18} color="#FFF" />
            <AppText variant="body" weight="bold" shrink={false} style={styles.buttonText} numberOfLines={1}>{t('dash.mark_as_paid')}</AppText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.lossButton}>
            <AppText variant="body" weight="bold" shrink={false} style={styles.buttonText} numberOfLines={1}>{t('dash.mark_loss')}</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  screenHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  backButton: { padding: 4 },
  screenTitle: { fontSize: 18, fontFamily: Fonts.bold, fontWeight: 'bold' },
  card: { flex: 1, padding: 20 },
  itemsContainer: { marginVertical: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 18, fontFamily: Fonts.bold, fontWeight: 'bold' },
  phone: { fontSize: 14, color: '#888' },
  headerRight: { alignItems: 'flex-end' },
  overdueBadge: { backgroundColor: '#000', flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF', marginRight: 5, marginTop: 4 },
  overdueText: { color: '#FFF', fontSize: 10, fontFamily: Fonts.bold, fontWeight: 'bold' },
  daysText: { fontSize: 12, marginTop: 5 },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  itemLabel: { fontSize: 15, color: '#888' },
  itemValue: { fontSize: 15, fontFamily: Fonts.semibold, fontWeight: '600' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  totalLabel: { fontSize: 16, color: '#444' },
  totalValue: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  markPaidButton: { backgroundColor: '#000', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, flex: 1, marginRight: 10, justifyContent: 'center' },
  lossButton: { backgroundColor: '#000', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, flex: 1, justifyContent: 'center' },
  buttonIcon: { color: '#FFF', marginRight: 8 },
  buttonText: { color: '#FFF', fontFamily: Fonts.bold, fontWeight: 'bold' },

  // Payment Screen Styles
  paymentCard: { flex: 1, paddingTop: 50 },
  sectionTitle: { fontSize: 18, fontFamily: Fonts.bold, fontWeight: 'bold', marginBottom: 20 },
  optionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 15, padding: 18, marginBottom: 15 },
  selectedOption: { borderColor: '#000', borderWidth: 2 },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#000', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#000' },
  optionText: { flex: 1, fontSize: 16, fontFamily: Fonts.medium, fontWeight: '500' },
  optionAmount: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: 'bold' },
  editIcon: { fontSize: 18 },
  inputWrapper: { marginTop: 20 },
  inputLabel: { fontSize: 16, marginBottom: 10 },
  textInputContainer: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 55 },
  currencyPrefix: { fontSize: 18, marginRight: 5 },
  textInput: { flex: 1, fontSize: 18 },
  fullWidthButton: { backgroundColor: '#000', flexDirection: 'row', paddingVertical: 16, borderRadius: 10, justifyContent: 'center', marginTop: 'auto', marginBottom: 20 }
});

export default DebtManagementFlow;