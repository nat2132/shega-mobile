import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, Building2, Loader2, CheckCircle, XCircle, AlertCircle, Plus, RefreshCw, Link2 } from 'lucide-react-native';
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

interface CloudBusiness {
  id: number;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string | null;
}

function BusinessCenterScreen() {
  const { colors, t } = useSettings();

  const [status, setStatus] = useState<SubscriptionStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloudBusinesses, setCloudBusinesses] = useState<CloudBusiness[]>([]);
  const [creating, setCreating] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchSubscriptionStatus();
        if (!cancelled) setStatus(s);
      } catch (e) {
        if (!cancelled) console.error('[BusinessCenter] Failed to load subscription:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadCloudBusinesses = useCallback(async () => {
    try {
      const licenseId = await resolveLicenseId();
      if (!licenseId) { setCloudBusinesses([]); return; }
      const entitlements = await fetchBusinessEntitlements(licenseId);
      // Map entitlements to cloud business requests. Server vocabulary is
      // available | created | expired: only a consumed (`created`) slot means a
      // business actually exists, so that is the one that reads as approved.
      const businessList = entitlements.map((e) => ({
        id: e.id,
        name: 'Business Request #' + e.id,
        status: (e.status === 'created' || e.status === 'used' ? 'approved' : 'pending') as 'pending' | 'approved',
        created_at: e.created_at,
        reviewed_at: e.updated_at,
      }));
      setCloudBusinesses(businessList);
    } catch (err) {
      console.error('[BusinessCenter] Failed to load cloud businesses:', err);
    }
  }, []);

  useEffect(() => {
    loadCloudBusinesses();
  }, [loadCloudBusinesses]);

  const handleCreateCloud = async () => {
    if (!status?.license_key) { Alert.alert('Error', 'No active license'); return; }
    if (!newBusinessName.trim()) { Alert.alert('Error', 'Enter a business name'); return; }

    const licenseId = await resolveLicenseId();
    if (!licenseId) {
      Alert.alert('Error', 'Could not resolve the license for this account. Try again once online.');
      return;
    }

    setCreating(true);
    try {
      const idempotencyKey = `business-${status.license_key}-${newBusinessName}-${Date.now()}`;
      const res = await createBusiness(licenseId, {
        name: newBusinessName.trim(),
        idempotency_key: idempotencyKey,
      });
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Business Requested',
          `Your business "${newBusinessName.trim()}" has been requested and is pending approval.`,
          [{ text: 'OK', onPress: () => { setNewBusinessName(''); loadCloudBusinesses(); } }]
        );
      } else {
        Alert.alert('Creation Failed', res.message);
      }
    } catch (error: any) {
      const handled = handleApiError(error);
      if (isOfflineError(error)) Alert.alert('Offline', handled.message || OFFLINE_MESSAGE);
      else Alert.alert('Creation Failed', handled.message || 'Could not create business');
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (b: CloudBusiness) => {
    switch (b.status) {
      case 'approved':
        return (
          <View style={styles.badgeApproved}>
            <CheckCircle size={10} color={colors.success} />
            <AppText variant="micro" weight="bold" style={{ color: colors.success }}>Approved</AppText>
          </View>
        );
      case 'rejected':
        return (
          <View style={styles.badgeRejected}>
            <XCircle size={10} color={colors.error} />
            <AppText variant="micro" weight="bold" style={{ color: colors.error }}>Rejected</AppText>
          </View>
        );
      default:
        return (
          <View style={styles.badgePending}>
            <AlertCircle size={10} color={colors.warning} />
            <AppText variant="micro" weight="bold" style={{ color: colors.warning }}>Pending Approval</AppText>
          </View>
        );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBackOrFallback('/subscription/manage')} style={styles.backButton}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <AppText variant="heading" weight="bold" style={{ color: colors.text }}>{t('subscription.business_center')}</AppText>
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
        <AppText variant="heading" weight="bold" style={{ color: colors.text }}>{t('subscription.business_center')}</AppText>
        <TouchableOpacity onPress={loadCloudBusinesses} disabled={loading} style={styles.refreshButton}>
          <RefreshCw size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Cloud Business Requests */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <View style={styles.sectionHeader}>
              <AppText variant="title-sm" weight="bold" style={{ color: colors.text }}>
                {t('subscription.cloud_businesses')}
              </AppText>
              <TouchableOpacity style={styles.refreshButton} onPress={loadCloudBusinesses} disabled={loading}>
                <RefreshCw size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginBottom: 10 }}>
              {t('subscription.cloud_businesses_desc')}
            </AppText>

            {cloudBusinesses.length === 0 ? (
              <View style={styles.emptyState}>
                <Building2 size={32} color={colors.textSecondary} />
                <AppText variant="body" weight="medium" style={{ color: colors.textSecondary, marginTop: 8 }}>
                  No cloud business requests
                </AppText>
                <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 2 }}>
                  Purchase an &quot;Additional Business&quot; add-on to request a new business
                </AppText>
              </View>
            ) : (
              <View style={styles.businessList}>
                {cloudBusinesses.map((biz) => (
                  <View key={biz.id} style={[styles.businessCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.businessInfo}>
                      <AppText variant="body" weight="bold" style={{ color: colors.text }} numberOfLines={1}>
                        {biz.name}
                      </AppText>
                      <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 2 }}>
                        Requested {new Date(biz.created_at).toLocaleDateString()}
                      </AppText>
                      {biz.reviewed_at && (
                        <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 2 }}>
                          Reviewed {new Date(biz.reviewed_at).toLocaleDateString()}
                        </AppText>
                      )}
                    </View>
                    {getStatusBadge(biz)}
                  </View>
                ))}
              </View>
            )}
          </Animated.View>

          {/* Create New Business Request */}
          <Animated.View entering={FadeInDown.delay(150).duration(500)}>
            <View style={styles.sectionHeader}>
              <AppText variant="title-sm" weight="bold" style={{ color: colors.text }}>
                {t('subscription.create_new_business')}
              </AppText>
            </View>
            <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginBottom: 10 }}>
              {t('subscription.create_new_business_desc')}
            </AppText>

            <View style={styles.inputGroup}>
              <TextInput
                value={newBusinessName}
                onChangeText={setNewBusinessName}
                placeholder={t('subscription.business_name_placeholder')}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              />
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: creating || !newBusinessName.trim() ? colors.textSecondary : colors.primary }]}
                onPress={handleCreateCloud}
                disabled={creating || !newBusinessName.trim() || !status?.license_key}
                activeOpacity={0.85}
              >
                {creating ? (
                  <><Loader2 size={20} color="#FFF" /><AppText variant="heading" weight="bold" style={{ color: '#FFF', marginLeft: 8 }}>Requesting…</AppText></>
                ) : (
                  <><Plus size={20} color="#FFF" /><AppText variant="heading" weight="bold" style={{ color: '#FFF', marginLeft: 8 }}>{t('subscription.request_cloud')}</AppText></>
                )}
              </TouchableOpacity>
            </View>
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
  refreshButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  businessList: { gap: 10 },
  businessCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, borderWidth: 1 },
  businessInfo: { flex: 1, minWidth: 0 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  badgeApproved: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#34C75915' },
  badgeRejected: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FF3B3015' },
  badgePending: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FF950015' },
});

export default BusinessCenterScreen;