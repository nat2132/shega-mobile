import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, Smartphone, Monitor, Loader2, CheckCircle, XCircle, AlertCircle, Copy, Check } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  fetchSubscriptionStatus,
  registerDevice,
  fetchDeviceEntitlements,
  resolveLicenseId,
  handleApiError,
  type SubscriptionStatusInfo,
} from '@/services/api';
import { isOfflineError, OFFLINE_MESSAGE } from '@/services/connectivity';
import { safeBackOrFallback } from '@/services/navigation';

type DeviceType = 'MOBILE' | 'DESKTOP';

export default function AddDeviceScreen() {
  const { colors, t } = useSettings();
  const gold = '#D4AF37';

  const [status, setStatus] = useState<SubscriptionStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceType, setDeviceType] = useState<DeviceType>('MOBILE');
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [operatingSystem, setOperatingSystem] = useState('');
  const [busy, setBusy] = useState(false);
  const [entitlementStatus, setEntitlementStatus] = useState<'checking' | 'idle' | 'available' | 'none'>('idle');
  const [availableSlots, setAvailableSlots] = useState(0);
  const [generatedDeviceId, setGeneratedDeviceId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchSubscriptionStatus();
        if (!cancelled) setStatus(s);
      } catch (e) {
        if (!cancelled) console.error('[AddDevice] Failed to load subscription:', e);
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
      const entitlements = await fetchDeviceEntitlements(licenseId);
      const matching = entitlements.filter((e) => e.device_type === deviceType && e.status === 'available');
      if (matching.length > 0) {
        const totalAvailable = matching.reduce((sum, e) => sum + e.quantity, 0);
        if (!cancelled) { setAvailableSlots(totalAvailable); setEntitlementStatus('available'); }
      } else {
        if (!cancelled) { setAvailableSlots(0); setEntitlementStatus('none'); }
      }
    } catch (e) {
      if (!cancelled) setEntitlementStatus('none');
    }
  }, [status, deviceType]);

  useEffect(() => {
    checkEntitlement();
  }, [checkEntitlement, deviceType, status]);

  const generateDeviceId = () => {
    const prefix = deviceType === 'MOBILE' ? 'MOB' : 'DSK';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const id = `${prefix}-${timestamp}-${random}`;
    setGeneratedDeviceId(id);
    setDeviceId(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const copyDeviceId = () => {
    const id = deviceId || generatedDeviceId;
    if (id) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Copied', 'Device ID copied to clipboard');
    }
  };

  const handleSubmit = async () => {
    const licenseKey = status?.license_key;
    if (!licenseKey) return;
    if (!deviceId.trim()) { Alert.alert('Error', 'Enter or generate a Device ID'); return; }
    if (availableSlots <= 0) { Alert.alert('No Entitlement', `No available ${deviceType} device slots. Purchase an add-on first.`); return; }

    const licenseId = await resolveLicenseId();
    if (!licenseId) {
      Alert.alert('Error', 'Could not resolve the license for this account. Try again once online.');
      return;
    }

    setBusy(true);
    try {
      const idempotencyKey = `device-${licenseKey}-${deviceId}-${Date.now()}`;
      const res = await registerDevice(licenseId, {
        device_id: deviceId.trim(),
        device_name: deviceName.trim() || `Shega ${deviceType}`,
        operating_system: operatingSystem.trim() || 'Mobile',
        device_type: deviceType,
        idempotency_key: idempotencyKey,
      });
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Device Registered',
          `Your ${deviceType} device has been registered successfully.`,
          [{ text: 'OK', onPress: () => router.replace('/subscription/status') }]
        );
        setDeviceId(''); setDeviceName(''); setOperatingSystem(''); setGeneratedDeviceId('');
      } else {
        Alert.alert('Registration Failed', res.message);
      }
    } catch (error: any) {
      const handled = handleApiError(error);
      if (isOfflineError(error)) Alert.alert('Offline', handled.message || OFFLINE_MESSAGE);
      else Alert.alert('Registration Failed', handled.message || 'Could not register device');
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
          <AppText variant="heading" weight="bold" style={{ color: colors.text }}>{t('subscription.add_device')}</AppText>
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
        <AppText variant="heading" weight="bold" style={{ color: colors.text }}>{t('subscription.add_device')}</AppText>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <AppText variant="body" weight="medium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
              {t('subscription.add_device_desc')}
            </AppText>
          </Animated.View>

          {/* Device Type Selection */}
          <Animated.View entering={FadeInDown.delay(150).duration(500)}>
            <AppText variant="body" weight="bold" style={{ color: colors.text, marginBottom: 12 }}>
              {t('subscription.device_type')}
            </AppText>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeCard, { borderColor: deviceType === 'MOBILE' ? gold : colors.border, backgroundColor: deviceType === 'MOBILE' ? gold + '1A' : colors.card }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDeviceType('MOBILE'); }}
                activeOpacity={0.85}
              >
                <View style={[styles.typeIcon, { backgroundColor: gold + '1A' }]}><Smartphone size={24} color={gold} /></View>
                <AppText variant="body" weight="bold" style={{ color: colors.text, marginTop: 4 }}>{t('subscription.mobile_device')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeCard, { borderColor: deviceType === 'DESKTOP' ? gold : colors.border, backgroundColor: deviceType === 'DESKTOP' ? gold + '1A' : colors.card }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDeviceType('DESKTOP'); }}
                activeOpacity={0.85}
              >
                <View style={[styles.typeIcon, { backgroundColor: gold + '1A' }]}><Monitor size={24} color={gold} /></View>
                <AppText variant="body" weight="bold" style={{ color: colors.text, marginTop: 4 }}>{t('subscription.desktop_device')}</AppText>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Entitlement Status */}
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
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
                      ? `${availableSlots} ${deviceType} device slot${availableSlots > 1 ? 's' : ''} available`
                      : entitlementStatus === 'checking'
                        ? 'Checking available entitlements…'
                        : 'Purchase an add-on on the Subscription page to unlock device registration.'}
                  </AppText>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Device Details */}
          <Animated.View entering={FadeInDown.delay(250).duration(500)}>
            <AppText variant="body" weight="bold" style={{ color: colors.text, marginBottom: 12 }}>
              {t('subscription.device_details')}
            </AppText>

            <View style={styles.inputGroup}>
              <View style={styles.inputRow}>
                <AppText variant="caption" weight="bold" style={{ color: colors.textSecondary, width: 70 }}>
                  {t('subscription.device_id')}
                </AppText>
                <TextInput
                  value={deviceId}
                  onChangeText={setDeviceId}
                  placeholder={t('subscription.device_id_placeholder')}
                  style={[styles.input, { flex: 1, fontFamily: 'monospace', backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                />
              </View>
              <View style={styles.inputActions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: gold }]} onPress={generateDeviceId}>
                  <Loader2 size={16} color="#FFF" />
                  <AppText variant="caption" weight="bold" style={{ color: '#FFF', marginLeft: 6 }}>Generate</AppText>
                </TouchableOpacity>
                {deviceId && (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={copyDeviceId}>
                    <Copy size={16} color={colors.text} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <TextInput
                value={deviceName}
                onChangeText={setDeviceName}
                placeholder={t('subscription.device_name_placeholder')}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              />
            </View>

            <View style={styles.inputGroup}>
              <TextInput
                value={operatingSystem}
                onChangeText={setOperatingSystem}
                placeholder="OS (auto-detected)"
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              />
            </View>
          </Animated.View>

          {/* Submit Button */}
          <Animated.View entering={FadeInDown.delay(300).duration(500)}>
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: busy || availableSlots === 0 ? colors.textSecondary : gold }]}
              onPress={handleSubmit}
              disabled={busy || availableSlots === 0}
              activeOpacity={0.85}
            >
              {busy ? (
                <><Loader2 size={20} color="#FFF" /><AppText variant="heading" weight="bold" style={{ color: '#FFF', marginLeft: 8 }}>Registering…</AppText></>
              ) : (
                <><Check size={20} color="#FFF" /><AppText variant="heading" weight="bold" style={{ color: '#FFF', marginLeft: 8 }}>{t('subscription.register_device')}</AppText></>
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
  typeRow: { flexDirection: 'row', gap: 12 },
  typeCard: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 1.5 },
  typeIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  entitlementCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 16 },
  entitlementRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  inputGroup: { marginBottom: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  inputActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
});

let cancelled = false;