import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  FileText,
  Check,
  ArrowLeft,
  Smartphone,
  Copy,
  Info,
} from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { createPayment } from '@/services/api';

interface SubscriptionPaymentProps {
  planId: number;
  onBack: () => void;
  onSuccess: () => void;
}

const SubscriptionPaymentScreen: React.FC<SubscriptionPaymentProps> = ({
  planId,
  onBack,
  onSuccess,
}) => {
  const { colors, t } = useSettings();
  const gold = '#D4AF37';

  const [transactionId, setTransactionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const telebirrNumber = '+251925319901';
  const telebirrName = 'Aselefech';

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSubmit = async () => {
    if (!transactionId.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);
    try {
      await createPayment({
        plan_id: planId,
        transaction_id: transactionId.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        t('subscription.payment_error_title'),
        error?.message || t('subscription.payment_error_message'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = transactionId.trim().length > 0;

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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: { padding: 8 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 100 },
  instructionsCard: { padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 24 },
  instructionsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  stepsList: { gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  telebirrInfo: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 12, marginLeft: 36 },
  infoRow: { gap: 4 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formSection: { marginBottom: 24 },
  inputGroup: { marginBottom: 16 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36, borderTopWidth: 1 },
  submitButton: { borderRadius: 20, overflow: 'hidden', elevation: 6, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  submitGradient: { flexDirection: 'row', height: 60, justifyContent: 'center', alignItems: 'center', gap: 10 },
});

export default SubscriptionPaymentScreen;