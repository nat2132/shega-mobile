import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Crown,
  CreditCard,
  Building2,
  Phone,
  Calendar,
  FileText,
  Check,
  ArrowLeft,
  Info,
  Copy,
  Smartphone,
} from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { AppText } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

interface SubscriptionPaymentProps {
  plan: string;
  durationMonths: number;
  price: number;
  onBack: () => void;
  onSuccess: () => void;
}

const SubscriptionPaymentScreen: React.FC<SubscriptionPaymentProps> = ({
  plan,
  durationMonths,
  price,
  onBack,
  onSuccess,
}) => {
  const { colors, theme, t } = useSettings();
  const { submitPayment } = useSubscription();
  const gold = '#D4AF37';

  const [transactionId, setTransactionId] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const telebirrNumber = 'XXXXXXX';
  const telebirrName = t('subscription.telebirr_account_name');

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSubmit = async () => {
    if (!transactionId.trim() || !businessName.trim() || !phoneNumber.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);
    try {
      await submitPayment({
        transactionId: transactionId.trim(),
        businessName: businessName.trim(),
        phoneNumber: phoneNumber.trim(),
        planName: `${plan.toUpperCase()} - ${durationMonths} ${durationMonths > 1 ? t('subscription.duration_months') : t('subscription.duration_month')}`,
        amount: price,
        paymentDate,
        notes: notes.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = transactionId.trim() && businessName.trim() && phoneNumber.trim();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <AppText variant="heading" weight="bold" style={{ color: colors.text }}>
          {t('subscription.payment')}
        </AppText>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.planSummary}>
            <View style={[styles.planBadge, { backgroundColor: gold + '20' }]}>
              <Crown size={20} color={gold} />
              <AppText variant="body" weight="bold" style={{ color: gold }}>
                {t('subscription.plan_name', { plan: plan === 'premium' ? t('subscription.plan_premium') : t('subscription.plan_basic') })}
              </AppText>
            </View>
            <AppText variant="display" weight="black" style={{ color: colors.text }}>
              {price.toLocaleString()} <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>{t('subscription.etb')}</AppText>
            </AppText>
            <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>
              {durationMonths} {durationMonths > 1 ? t('subscription.duration_months') : t('subscription.duration_month')}
            </AppText>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(600)} style={[styles.instructionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.instructionsHeader}>
              <Smartphone size={22} color={gold} />
              <AppText variant="title-sm" weight="bold" style={{ color: colors.text }}>
                {t('subscription.pay_telebirr')}
              </AppText>
            </View>
            <View style={styles.stepsList}>
              <View style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: gold + '20' }]}>
                  <AppText variant="caption" weight="bold" style={{ color: gold }}>1</AppText>
                </View>
                <AppText variant="body" weight="medium" style={{ color: colors.text, flex: 1 }}>
                  {t('subscription.dial_code')}
                </AppText>
              </View>
              <View style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: gold + '20' }]}>
                  <AppText variant="caption" weight="bold" style={{ color: gold }}>2</AppText>
                </View>
                <AppText variant="body" weight="medium" style={{ color: colors.text, flex: 1 }}>
                  {t('subscription.select_send_money')}
                </AppText>
              </View>
              <View style={[styles.telebirrInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.infoRow}>
                  <AppText variant="caption" weight="bold" style={{ color: colors.textSecondary, letterSpacing: 1 }}>
                    {t('subscription.account_label')}
                  </AppText>
                  <View style={styles.copyRow}>
                    <AppText variant="body" weight="bold" style={{ color: colors.text }}>{telebirrNumber}</AppText>
                    <TouchableOpacity onPress={() => copyToClipboard(telebirrNumber)}>
                      <Copy size={16} color={gold} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <AppText variant="caption" weight="bold" style={{ color: colors.textSecondary, letterSpacing: 1 }}>
                    {t('subscription.name_label')}
                  </AppText>
                  <View style={styles.copyRow}>
                    <AppText variant="body" weight="bold" style={{ color: colors.text }}>{telebirrName}</AppText>
                    <TouchableOpacity onPress={() => copyToClipboard(telebirrName)}>
                      <Copy size={16} color={gold} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <AppText variant="caption" weight="bold" style={{ color: colors.textSecondary, letterSpacing: 1 }}>
                    {t('subscription.amount_label')}
                  </AppText>
                  <AppText variant="body" weight="bold" style={{ color: gold }}>{price.toLocaleString()} {t('subscription.etb')}</AppText>
                </View>
              </View>
              <View style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: gold + '20' }]}>
                  <AppText variant="caption" weight="bold" style={{ color: gold }}>3</AppText>
                </View>
                <AppText variant="body" weight="medium" style={{ color: colors.text, flex: 1 }}>
                  {t('subscription.enter_details_below')}
                </AppText>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.formSection}>
            <AppText variant="title-sm" weight="bold" style={{ color: colors.text, marginBottom: 20 }}>
              {t('subscription.transaction_details')}
            </AppText>

            <View style={styles.inputGroup}>
              <AppText variant="caption" weight="bold" style={{ color: colors.textSecondary, marginBottom: 8 }}>
                {t('subscription.transaction_id_required')}
              </AppText>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <FileText size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder={t('subscription.transaction_id_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={transactionId}
                  onChangeText={setTransactionId}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <AppText variant="caption" weight="bold" style={{ color: colors.textSecondary, marginBottom: 8 }}>
                {t('subscription.business_name_required')}
              </AppText>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Building2 size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder={t('subscription.business_name_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={businessName}
                  onChangeText={setBusinessName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <AppText variant="caption" weight="bold" style={{ color: colors.textSecondary, marginBottom: 8 }}>
                {t('subscription.phone_number_required')}
              </AppText>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Phone size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder={t('subscription.phone_number_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <AppText variant="caption" weight="bold" style={{ color: colors.textSecondary, marginBottom: 8 }}>
                {t('subscription.payment_date')}
              </AppText>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Calendar size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder={t('subscription.date_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={paymentDate}
                  onChangeText={setPaymentDate}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginBottom: 8 }}>
                {t('subscription.notes_optional')}
              </AppText>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border, minHeight: 80 }]}>
                <TextInput
                  style={[styles.input, { color: colors.text, minHeight: 80 }]}
                  placeholder={t('subscription.notes_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>
          </Animated.View>

          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Info size={18} color={colors.warning} />
            <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, flex: 1 }}>
              {t('subscription.verification_info')}
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            { opacity: isFormValid && !isSubmitting ? 1 : 0.5 },
          ]}
          onPress={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#F0D060', '#D4AF37', '#B8960C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitGradient}
          >
            {isSubmitting ? (
              <AppText variant="heading" weight="bold" style={{ color: '#FFF' }}>
                {t('subscription.submitting')}
              </AppText>
            ) : (
              <>
                <Check size={20} color="#FFF" strokeWidth={3} />
                <AppText variant="heading" weight="bold" style={{ color: '#FFF' }}>
                  {t('subscription.submit')}
                </AppText>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  planSummary: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  instructionsCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  stepsList: {
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  telebirrInfo: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginLeft: 36,
  },
  infoRow: {
    gap: 4,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formSection: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
  },
  submitButton: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  submitGradient: {
    flexDirection: 'row',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
});

export default SubscriptionPaymentScreen;
