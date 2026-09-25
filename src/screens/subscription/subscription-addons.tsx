import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, Smartphone, Monitor, Briefcase, Plus, Minus, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { fetchSubscriptionStatus, createPayment, fetchPlans, handleApiError, type Plan, type SubscriptionStatusInfo } from '@/services/api';
import { isOfflineError, OFFLINE_MESSAGE } from '@/services/connectivity';
import { safeBackOrFallback } from '@/services/navigation';

type AddonKey = 'additional_mobile_device' | 'additional_desktop_device' | 'additional_business';

interface AddonOption {
  key: AddonKey;
  priceKey: 'addon_mobile_price' | 'addon_desktop_price' | 'addon_business_price';
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  allocatedKey: 'mobile' | 'desktop' | 'businesses';
  usedKey: 'mobile' | 'desktop';
}

export default function SubscriptionAddonsScreen() {
  const { colors, t } = useSettings();
  const gold = '#D4AF37';

  const [status, setStatus] = useState<SubscriptionStatusInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AddonOption['key'] | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, pl] = await Promise.all([fetchSubscriptionStatus(), fetchPlans()]);
        if (!cancelled) { setStatus(s); setPlans(pl || []); }
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message || 'Could not load your subscription.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fullAccess = !!status && (status.status === 'active' || status.status === 'trial');
  const currentPlan = plans.find((p) => p.name === status?.plan);
  const planId = currentPlan?.id ?? null;

  // The customer's current plan owns add-on pricing (server-computed amounts).
  // A missing server price disables the option rather than guessing a number.
  const unitPrice = (key: AddonKey): number | null => {
    switch (key) {
      case 'additional_mobile_device': return currentPlan?.addon_mobile_price ?? null;
      case 'additional_desktop_device': return currentPlan?.addon_desktop_price ?? null;
      case 'additional_business': return currentPlan?.addon_business_price ?? null;
    }
  };

  const OPTIONS: AddonOption[] = useMemo(() => [
    { key: 'additional_mobile_device', priceKey: 'addon_mobile_price', icon: <Smartphone size={20} color={gold} />, titleKey: 'subscription.add_mobile_device', descKey: 'subscription.add_mobile_device_desc', allocatedKey: 'mobile', usedKey: 'mobile' },
    { key: 'additional_desktop_device', priceKey: 'addon_desktop_price', icon: <Monitor size={20} color={gold} />, titleKey: 'subscription.add_desktop_device', descKey: 'subscription.add_desktop_device_desc', allocatedKey: 'desktop', usedKey: 'desktop' },
    { key: 'additional_business', priceKey: 'addon_business_price', icon: <Briefcase size={20} color={gold} />, titleKey: 'subscription.add_business', descKey: 'subscription.add_business_desc', allocatedKey: 'businesses', usedKey: 'mobile' },
  ], [gold]);

  const selectedOption = OPTIONS.find((o) => o.key === selected) ?? null;

  const adjustQty = (delta: number) => setQuantity((q) => Math.max(1, Math.min(10, q + delta)));

  const handleSubmit = async () => {
    if (!selectedOption) return;
    if (unitPrice(selectedOption.key) == null) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('subscription.payment_error_title'), t('subscription.addons_price_unavailable'));
      return;
    }
    if (!transactionId.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    setError(null);
    try {
      await createPayment({
        plan_id: planId ?? undefined,
        transaction_id: transactionId.trim(),
        payment_type: selectedOption.key,
        quantity,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('subscription.addons_success'),
        `${selectedOption ? t(selectedOption.titleKey) : ''} x${quantity} — ${t('subscription.addons_pending')}`,
        [{ text: 'OK', onPress: () => router.replace('/subscription/status') }],
      );
    } catch (error: any) {
      const handled = handleApiError(error);
      if (isOfflineError(error)) {
        Alert.alert(t('subscription.payment_error_title'), handled.message || OFFLINE_MESSAGE);
      } else {
        Alert.alert(t('subscription.payment_error_title'), handled.message || t('subscription.payment_error_message'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBackOrFallback('/subscription/manage')} style={styles.backButton}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <AppText variant="heading" weight="bold" style={{ color: colors.text }}>{t('subscription.addons_title')}</AppText>
          <View style={{ width: 32 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>Loading…</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBackOrFallback('/subscription/manage')} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <AppText variant="heading" weight="bold" style={{ color: colors.text }}>
          {t('subscription.addons_title')}
        </AppText>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <AppText variant="body" weight="medium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
              {t('subscription.addons_desc')}
            </AppText>
          </Animated.View>

          {error && !status && (
            <Animated.View entering={FadeInDown.delay(100).duration(500)} style={[styles.lockedCard, { backgroundColor: colors.card, borderColor: colors.error }]}>
              <AlertCircle size={22} color={colors.error} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>{error}</AppText>
                <TouchableOpacity onPress={() => router.replace('/subscription/manage')} activeOpacity={0.7}>
                  <AppText variant="body-sm" weight="bold" style={{ color: gold, marginTop: 4 }}>{t('subscription.addons_manage')}</AppText>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {!fullAccess && (
            <Animated.View entering={FadeInDown.delay(150).duration(500)} style={[styles.lockedCard, { backgroundColor: colors.card, borderColor: colors.warning }]}>
              <ShieldCheck size={22} color={colors.warning} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>{t('subscription.addons_active_required')}</AppText>
                <TouchableOpacity onPress={() => router.push('/subscription/plans')} activeOpacity={0.7}>
                  <AppText variant="body-sm" weight="bold" style={{ color: gold, marginTop: 4 }}>{t('subscription.addons_choose_plan')}</AppText>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {fullAccess && (
            <>
              {OPTIONS.map((opt, idx) => {
                const allocated = opt.allocatedKey === 'businesses'
                  ? status?.businesses?.allocated ?? 0
                  : status?.devices?.[opt.allocatedKey as 'mobile' | 'desktop']?.allocated ?? 0;
                const used = opt.allocatedKey === 'businesses'
                  ? status?.businesses?.used ?? 0
                  : status?.devices?.[opt.usedKey]?.used ?? 0;
                const unit = unitPrice(opt.key);
                const isSelected = selected === opt.key;
                return (
                  <Animated.View key={opt.key} entering={FadeInDown.delay(200 + idx * 100).duration(500)}>
                    <TouchableOpacity
                      style={[styles.optionCard, { backgroundColor: colors.card, borderColor: isSelected ? gold : colors.border }]}
                      disabled={unit == null}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelected(isSelected ? null : opt.key); if (!isSelected) setQuantity(1); }}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.optionIcon, { backgroundColor: gold + '1A' }]}>{opt.icon}</View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="body" weight="bold" style={{ color: colors.text }}>{t(opt.titleKey)}</AppText>
                        <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>{t(opt.descKey)}</AppText>
                        <AppText variant="caption" weight="semibold" style={{ color: gold, marginTop: 2 }}>
                          {unit == null
                            ? t('subscription.addons_price_unavailable')
                            : t('subscription.addons_etb_month', { price: String(unit.toLocaleString()) })}
                        </AppText>
                        <AppText variant="micro" weight="medium" style={{ color: colors.textSecondary }}>
                          {used > 0
                            ? t('subscription.addons_usage', { used: String(used), allocated: String(allocated) })
                            : t('subscription.addons_included', { allocated: String(allocated) })}
                        </AppText>
                      </View>
                      <View style={[styles.qtyDot, { backgroundColor: isSelected ? gold : 'transparent', borderColor: isSelected ? gold : colors.border }]}>
                        {isSelected && <Minus size={14} color="#FFF" />}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}

              {selectedOption && (
                <Animated.View entering={FadeInDown.duration(400)} style={[styles.payCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.qtyRow}>
                    <AppText variant="body" weight="bold" style={{ color: colors.text }}>{t('subscription.addons_quantity')}</AppText>
                    <View style={styles.qtyStepper}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(-1)} activeOpacity={0.7}><Minus size={16} color={colors.text} /></TouchableOpacity>
                      <AppText variant="title" weight="black" style={{ color: colors.text, minWidth: 50, textAlign: 'center' }}>{quantity}</AppText>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(1)} activeOpacity={0.7}><Plus size={16} color={colors.text} /></TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.totalRow}>
                    <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>{t('subscription.addons_total')}</AppText>
                    <AppText variant="title" weight="black" style={{ color: colors.text }}>
                      {(() => { const u = unitPrice(selectedOption.key) ?? 0; return (u * quantity).toLocaleString(); })()} {t('subscription.etb')}
                    </AppText>
                  </View>

                  <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 8 }}>
                    {t('subscription.addons_txn_label')}
                  </AppText>
                  <TextInput
                    value={transactionId}
                    onChangeText={setTransactionId}
                    placeholder={t('subscription.addons_txn_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  />

                  <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: submitting ? colors.textSecondary : gold }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                    activeOpacity={0.85}
                  >
                    {submitting ? (
                      <AppText variant="heading" weight="bold" style={{ color: '#FFF' }}>…</AppText>
                    ) : (
                      <LinearGradient colors={[gold + 'E6', '#B8960C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitGradient}>
                        <AppText variant="heading" weight="bold" style={{ color: '#FFF' }}>{t('subscription.addons_submit')}</AppText>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  lockedCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  optionCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 12 },
  optionIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  qtyDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  payCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 8 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyStepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(128,128,128,0.12)', alignItems: 'center', justifyContent: 'center' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8, fontSize: 15 },
  submitBtn: { borderRadius: 14, marginTop: 18, overflow: 'hidden' },
  submitGradient: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
});