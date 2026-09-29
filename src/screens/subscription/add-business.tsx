import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, Building2, Loader2, CheckCircle, XCircle, AlertCircle, Check } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  fetchSubscriptionStatus,
  createBusiness,
  fetchBusinessEntitlements,
  resolveLicenseId,
  handleApiError,
  type SubscriptionStatusInfo,
} from '@/services/api';
import { isOfflineError, OFFLINE_MESSAGE } from '@/services/connectivity';
import { safeBackOrFallback } from '@/services/navigation';

export default function AddBusinessScreen() {
  const { colors, t } = useSettings();
  const gold = '#D4AF37';

  const [status, setStatus] = useState<SubscriptionStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [busy, setBusy] = useState(false);
  const [entitlementStatus, setEntitlementStatus] = useState<'checking' | 'idle' | 'available' | 'none'>('idle');
  const [availableSlots, setAvailableSlots] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchSubscriptionStatus();
        if (!cancelled) setStatus(s);
      } catch (e) {
        if (!cancelled) console.error('[AddBusiness] Failed to load subscription:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const checkEntitlement = useCallback(async () => {
    const licenseKey = status?.license_key;
    if (!licenseKey) return;
    setEntitlementStatus('checking');
    try {
      const licenseId = await resolveLicenseId();
      if (!licenseId) { if (!cancelled) setEntitlementStatus('none'); return; }
      const entitlements = await fetchBusinessEntitlements(licenseId);
      const matching = entitlements.filter((e) => e.status === 'available');
      if (matching.length > 0) {
        const totalAvailable = matching.reduce((sum, e) => sum + e.quantity, 0);
        if (!cancelled) { setAvailableSlots(totalAvailable); setEntitlementStatus('available'); }
      } else {
        if (!cancelled) { setAvailableSlots(0); setEntitlementStatus('none'); }
      }
    } catch (e) {
      if (!cancelled) setEntitlementStatus('none');
    }
  }, [status]);

  useEffect(() => {
    checkEntitlement();
  }, [checkEntitlement, status]);

  const handleSubmit = async () => {
    const licenseKey = status?.license_key;
    if (!licenseKey) return;
    if (!businessName.trim()) { Alert.alert('Error', 'Enter a business name'); return; }
    if (availableSlots <= 0) { Alert.alert('No Entitlement', 'No available business slots. Purchase an "Additional Business" add-on first.'); return; }

    const licenseId = await resolveLicenseId();
    if (!licenseId) {
      Alert.alert('Error', 'Could not resolve the license for this account. Try again once online.');
      return;
    }

    setBusy(true);
    try {
      const idempotencyKey = `business-${licenseKey}-${businessName}-${Date.now()}`;
      const res = await createBusiness(licenseId, {
        name: businessName.trim(),
        idempotency_key: idempotencyKey,
      });
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Business Created',
          `Your business "${businessName.trim()}" has been created and is pending approval.`,
          [{ text: 'OK', onPress: () => router.replace('/subscription/status') }]
        );
        setBusinessName('');
      } else {
        Alert.alert('Creation Failed', res.message);
      }
    } catch (error: any) {
      const handled = handleApiError(error);
      if (isOfflineError(error)) Alert.alert('Offline', handled.message || OFFLINE_MESSAGE);
      else Alert.alert('Creation Failed', handled.message || 'Could not create business');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBackOrFallback('/subscription/manage')} style={styles.backButton}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <AppText variant="heading" weight="bold" style={{ color: colors.text }}>{t('subscription.add_business')}</AppText>
          <View style={{ width: 32 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Loader2 size={28} color={colors.textSecondary} />
          <AppText variant="body" weight="medium" style={{ color: colors.textSecondary, marginTop: 12 }}>Loading…</AppText>
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
        <AppText variant="heading" weight="bold" style={{ color: colors.text }}>{t('subscription.add_business')}</AppText>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <AppText variant="body" weight="medium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
              {t('subscription.add_business_desc')}
            </AppText>
          </Animated.View>

          {/* Entitlement Status */}
          <Animated.View entering={FadeInDown.delay(150).duration(500)}>
            <View style={[styles.entitlementCard, {
              backgroundColor: colors.card,
              borderColor: entitlementStatus === 'checking' ? colors.primary :
                entitlementStatus === 'available' ? colors.success :
                  colors.warning
            }]}>
              <View style={styles.entitlementRow}>
                {entitlementStatus === 'checking' && <Loader2 size={20} color={colors.primary} />}
                {entitlementStatus === 'available' && <CheckCircle size={20} color={colors.success} />}
                {entitlementStatus === 'none' && <AlertCircle size={20} color={colors.warning} />}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>
                    {entitlementStatus === 'checking' ? t('subscription.checking_entitlement') :
                     entitlementStatus === 'available' ? t('subscription.entitlement_available') :
                       t('subscription.no_entitlement')}
                  </AppText>
                  <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
                    {entitlementStatus === 'available'
                      ? `${availableSlots} business slot${availableSlots > 1 ? 's' : ''} available`
                      : entitlementStatus === 'checking'
                        ? 'Checking available entitlements…'
                        : 'Purchase an "Additional Business" add-on on the Subscription page to unlock business creation.'}
                  </AppText>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Business Details */}
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <AppText variant="body" weight="bold" style={{ color: colors.text, marginBottom: 12 }}>
              {t('subscription.business_details')}
            </AppText>

            <View style={styles.inputGroup}>
              <TextInput
                value={businessName}
                onChangeText={setBusinessName}
                placeholder={t('subscription.business_name_placeholder')}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              />
            </View>
          </Animated.View>

          {/* Submit Button */}
          <Animated.View entering={FadeInDown.delay(250).duration(500)}>
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: busy || availableSlots === 0 ? colors.textSecondary : gold }]}
              onPress={handleSubmit}
              disabled={busy || availableSlots === 0}
              activeOpacity={0.85}
            >
              {busy ? (
                <><Loader2 size={20} color="#FFF" /><AppText variant="heading" weight="bold" style={{ color: '#FFF', marginLeft: 8 }}>Creating…</AppText></>
              ) : (
                <><Check size={20} color="#FFF" /><AppText variant="heading" weight="bold" style={{ color: '#FFF', marginLeft: 8 }}>{t('subscription.create_business')}</AppText></>
              )}
            </TouchableOpacity>
          </Animated.View>
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
  entitlementCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 16 },
  entitlementRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  inputGroup: { marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
});

let cancelled = false;