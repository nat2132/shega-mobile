import React, { useMemo, useState } from 'react';
import { Fonts , Spacing } from '@/constants/theme';
import { User, ChevronLeft, Check} from 'lucide-react-native';
import { router } from 'expo-router';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '@/context/SettingsContext';
import { AppNumber, AppText} from '@/components/ui';

import { getDashGlass } from './glass-dashboard';
const DebtManagementFlow = () => {
  const { t, colors } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [paymentType, setPaymentType] = useState('full'); // 'full' or 'partial'

  if (showPaymentOptions) {
    // SCREEN 3: Choose Amount Paid
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={{ position: 'absolute', top: -40, left: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: G.mutedLight, opacity: 0.25 }} />
      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={() => setShowPaymentOptions(false)} style={styles.backButton}>
          <ChevronLeft size={24} color={G.fg} />
        </TouchableOpacity>
        <AppText variant="title" weight="bold" style={[styles.screenTitle, { color: G.fg }]} numberOfLines={1}>{t('dash.payment')}</AppText>
        <View style={{ width: 24 }} />
      </View>
      <View style={[styles.paymentCard, { backgroundColor: G.bg }]}>
        <AppText variant="title" weight="bold" style={[styles.sectionTitle, { color: G.fg }]} numberOfLines={2}>{t('dash.choose_paid')}</AppText>

        {/* Full Payment Option */}
        <TouchableOpacity
          style={[styles.optionRow, { borderColor: G.border }, paymentType === 'full' && [styles.selectedOption, { borderColor: G.fg }]]}
          onPress={() => setPaymentType('full')}
        >
          <View style={[styles.radioCircle, { borderColor: G.fg }]}>
            {paymentType === 'full' && <View style={[styles.radioInner, { backgroundColor: G.fg }]} />}
          </View>
          <AppText variant="body-lg" weight="medium" style={{ flex: 1, color: G.fg }} numberOfLines={2}>{t('dash.paid_full')}</AppText>
          <AppNumber value={1769} size="body-lg" prefix="$ " suffix="Birr" numberOfLines={1} />
        </TouchableOpacity>

        {/* Partial Payment Option */}
        <TouchableOpacity
          style={[styles.optionRow, { borderColor: G.border }, paymentType === 'partial' && [styles.selectedOption, { borderColor: G.fg }]]}
          onPress={() => setPaymentType('partial')}
        >
          <View style={[styles.radioCircle, { borderColor: G.fg }]}>
            {paymentType === 'partial' && <View style={[styles.radioInner, { backgroundColor: G.fg }]} />}
          </View>
          <AppText variant="body-lg" weight="medium" style={{ flex: 1, color: G.fg }} numberOfLines={2}>{t('dash.partial_payment')}</AppText>
          <AppText variant="title" shrink={false} style={styles.editIcon}>âœï¸</AppText>
        </TouchableOpacity>

        {paymentType === 'partial' && (
          <View style={styles.inputWrapper}>
            <AppText variant="body-lg" weight="medium" style={[styles.inputLabel, { color: G.fg }]} numberOfLines={1}>{t('dash.enter_amount')}</AppText>
            <View style={[styles.textInputContainer, { borderColor: G.border }]}>
              <AppText variant="title" weight="bold" shrink={false} style={[styles.currencyPrefix, { color: G.fg }]}>$</AppText>
              <TextInput style={[styles.textInput, { color: G.fg }]} keyboardType="numeric" placeholder="0.00" placeholderTextColor={G.fgSecondary} />
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.fullWidthButton}>
          <Check size={18} color={G.fg} />
          <AppText variant="body" weight="bold" shrink={false} style={styles.buttonText}>{t('common.mark_paid')}</AppText>
        </TouchableOpacity>
      </View>
      </SafeAreaView>
    );
  }

  // SCREEN 2: Abebe Kebede Debt Details
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={{ position: 'absolute', top: -80, left: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: G.mutedLight, opacity: 0.3 }} />
      <View style={{ position: 'absolute', bottom: -50, right: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: G.mutedLight, opacity: 0.2 }} />
      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={G.fg} />
        </TouchableOpacity>
        <AppText variant="title" weight="bold" style={[styles.screenTitle, { color: G.fg }]} numberOfLines={1}>{t('dash.debt_details')}</AppText>
        <View style={{ width: 24 }} />
      </View>
      <View style={[styles.card, { backgroundColor: G.bgCard }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <User size={24} color={G.fg} />
            <View style={{ flex: 1 }}>
              <AppText variant="title" weight="bold" style={[styles.title, { color: G.fg }]} numberOfLines={2}>Abebe Kebede</AppText>
              <AppText variant="body" weight="medium" style={[styles.phone, { color: G.fgSecondary }]} numberOfLines={1}>+(251) 9-123-456</AppText>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.overdueBadge}><View style={styles.dot} /><AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={styles.overdueText} numberOfLines={1}>{t('dash.overdue')}</AppText></View>
            <AppText variant="caption" weight="medium" style={[styles.daysText, { color: G.fgSecondary }]} numberOfLines={1}>6 days overdue</AppText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: G.border }]} />

        <View style={styles.itemsContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <AppText variant="body" numberOfLines={2} style={{ color: G.fgSecondary }}>Nails x 2kg</AppText>
            <AppNumber value={500} size="body" prefix="ETB " numberOfLines={1} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <AppText variant="body" numberOfLines={2} style={{ color: G.fgSecondary }}>Paint x 2 cans</AppText>
            <AppNumber value={1249} size="body" prefix="ETB " numberOfLines={1} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <AppText variant="body" numberOfLines={2} style={{ color: G.fgSecondary }}>Screw x 2 pieces</AppText>
            <AppNumber value={20} size="body" prefix="ETB " numberOfLines={1} />
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: G.border }]} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
          <AppText variant="body" numberOfLines={2} style={{ color: G.fgSecondary }}>{t('dash.total_debt')}</AppText>
          <AppNumber value={1769} size="title-sm" prefix="ETB " numberOfLines={1} />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.markPaidButton}
            onPress={() => setShowPaymentOptions(true)}
          >
            <Check size={18} color={G.fg} />
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

const createStyles = (G: any) => StyleSheet.create({
  container: { flex: 1 },
  screenHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  backButton: { padding: 4 },
  screenTitle: { fontSize: 18, fontFamily: Fonts.bold, fontWeight: 'bold' },
  card: { flex: 1, padding: 20, overflow: 'hidden' },
  itemsContainer: { marginVertical: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 18, fontFamily: Fonts.bold, fontWeight: 'bold' },
  phone: { fontSize: 14 },
  headerRight: { alignItems: 'flex-end' },
  overdueBadge: { backgroundColor: G.bgCard, flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: G.fg, marginRight: 5, marginTop: 4 },
  overdueText: { color: G.fg, fontSize: 10, fontFamily: Fonts.bold, fontWeight: 'bold' },
  daysText: { fontSize: 12, marginTop: 5 },
  divider: { height: 1, marginVertical: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  itemValue: { fontSize: 15, fontFamily: Fonts.semibold, fontWeight: '600' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  totalValue: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  markPaidButton: { backgroundColor: G.bgCard, flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, flex: 1, marginRight: 10, justifyContent: 'center' },
  lossButton: { backgroundColor: G.bgCard, flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, flex: 1, justifyContent: 'center' },
  buttonText: { color: G.fg, fontFamily: Fonts.bold, fontWeight: 'bold' },

  // Payment Screen Styles
  paymentCard: { flex: 1, paddingTop: 50, overflow: 'hidden' },
  sectionTitle: { fontSize: 18, fontFamily: Fonts.bold, fontWeight: 'bold', marginBottom: 20 },
  optionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 15, padding: 18, marginBottom: 15 },
  selectedOption: { borderWidth: 2 },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  optionAmount: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: 'bold' },
  editIcon: { fontSize: 18 },
  inputWrapper: { marginTop: 20 },
  inputLabel: { fontSize: 16, marginBottom: 10 },
  textInputContainer: { borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 55 },
  currencyPrefix: { fontSize: 18, marginRight: 5 },
  textInput: { flex: 1, fontSize: 18 },
  fullWidthButton: { backgroundColor: G.bgCard, flexDirection: 'row', paddingVertical: 16, borderRadius: 10, justifyContent: 'center', marginTop: 'auto', marginBottom: 20 }
});

export default DebtManagementFlow;