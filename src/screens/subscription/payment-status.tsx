import { AppText } from '@/components/ui';
import { useAccount } from '@/context/AccountContext';
import { AccountUser, fetchMyPayment, PaymentInfo } from '@/services/api';
import { isOfflineError, OFFLINE_MESSAGE } from '@/services/connectivity';
import { notifyPaymentStatus } from '@/services/notificationService';
import { RefreshCw } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PaymentStatusScreenProps {
  onContinue: () => void;
  onRenew: () => void;
  user: AccountUser | null;
}

const bg = '#ffffff';
const fg = '#000000';
const fgSecondary = '#666666';
const border = '#e5e5e5';
const card = '#f9f9f9';
const gold = '#D4AF37';
const success = '#34C759';
const danger = '#FF3B30';
const warning = '#FF9500';

export default function PaymentStatusScreen({ onContinue, onRenew, user }: PaymentStatusScreenProps) {
  const { subscription, refreshStatus } = useAccount();
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const notifiedRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setOffline(false);
    try {
      const p = await fetchMyPayment();
      setPayment(p);
    } catch (e) {
      if (isOfflineError(e)) setOffline(true);
      setPayment(null);
    }
    await refreshStatus();
    setLoading(false);
  }, [refreshStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const status: string = subscription?.status || payment?.status || 'pending';
  const isActive = status === 'active' || status === 'approved';
  const isTrial = status === 'trial';
  const isRejected = status === 'payment_rejected' || status === 'rejected';
  const isPending = status === 'pending_payment' || status === 'pending' || status === 'pending_verification';
  const isExpired = status === 'expired';

  // Surface an in-app notification reflecting the current subscription status,
  // once per status (deduped via notification group keys).
  useEffect(() => {
    const key = subscription?.status || payment?.status;
    if (!key || key === 'none' || notifiedRef.current === key) return;
    notifiedRef.current = key;
    try {
      notifyPaymentStatus({
        status: isActive
          ? 'approved'
          : isTrial
            ? 'approved'
            : isRejected
              ? 'rejected'
              : 'pending',
        planName: subscription?.plan_name || subscription?.plan,
        reason: payment?.reason,
        expiresAt: subscription?.expires_at,
      });
    } catch {}
  }, [subscription, payment]);

  const badgeText = isRejected
    ? 'Payment Rejected'
    : isActive
      ? 'Subscription Active'
      : isTrial
        ? 'Free Trial Active'
        : isExpired
          ? 'Subscription Expired'
          : isPending
            ? 'Pending Approval'
            : 'No Subscription';
  const badgeColor = isRejected
    ? danger
    : isActive || isTrial
      ? success
      : isExpired
        ? warning
        : isPending
          ? warning
          : fgSecondary;

  const planDisplay = planName(subscription?.plan_name || payment?.plan_name || subscription?.plan);
  const transactionId = payment?.transaction_id || '—';
  const expiresAt = subscription?.expires_at;
  const licenseKey = subscription?.license_key;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <AppText variant="display" weight="bold" style={{ color: fg }}>
            Subscription Status
          </AppText>
          <TouchableOpacity onPress={load} style={styles.refreshBtn}>
            {loading ? <ActivityIndicator size="small" color={fgSecondary} /> : <RefreshCw size={20} color={fgSecondary} />}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={fgSecondary} />
            <AppText variant="body" weight="medium" style={{ color: fgSecondary, marginTop: 12 }}>
              Checking your subscription…
            </AppText>
          </View>
        ) : (
          <>
            {offline ? (
              <View style={[styles.offlineBanner, { backgroundColor: warning + '1A', borderColor: warning }]}>
                <AppText variant="body-sm" weight="semibold" style={{ color: fg, textAlign: 'center', lineHeight: 20 }}>
                  {OFFLINE_MESSAGE}
                </AppText>
                <TouchableOpacity onPress={load} style={[styles.retryBtn, { backgroundColor: warning }]}>
                  <AppText variant="label" weight="bold" style={{ color: bg }}>
                    Retry
                  </AppText>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={[styles.statusCard, { backgroundColor: card, borderColor: border }]}>
              <View style={[styles.statusIcon, { backgroundColor: badgeColor + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: badgeColor }]} />
              </View>
              <AppText variant="heading" weight="bold" style={[styles.statusTitle, { color: badgeColor }]}>
                {badgeText}
              </AppText>
              <AppText variant="body" weight="medium" style={[styles.statusDesc, { color: fgSecondary }]}>
                {pendingCopy(isRejected, isActive, isTrial, isExpired, isPending, payment?.reason)}
              </AppText>
            </View>

            <View style={[styles.detailsCard, { backgroundColor: card, borderColor: border }]}>
              <DetailRow label="Plan" value={planDisplay} />
              <DetailRow label="Transaction ID" value={transactionId} />
              {expiresAt ? <DetailRow label="Expires" value={formatDate(expiresAt)} /> : null}
              {licenseKey ? <DetailRow label="License Key" value={licenseKey} accent /> : null}
            </View>

            {user ? (
              <View style={[styles.userCard, { backgroundColor: card, borderColor: border }]}>
                <AppText variant="caption" weight="bold" style={[styles.userLabel, { color: fgSecondary }]}>
                  ACCOUNT
                </AppText>
                <View style={styles.userRow}>
                  <AppText variant="body" weight="semibold" style={{ color: fg }}>{user.name}</AppText>
                  <AppText variant="caption" weight="medium" style={{ color: fgSecondary }}>{user.email}</AppText>
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: isActive || isTrial ? success : fg }]}
              onPress={isActive || isTrial ? onContinue : onRenew}
              activeOpacity={0.85}
            >
              <AppText variant="heading" weight="bold" style={{ color: bg }}>
                {isActive || isTrial ? 'Continue to Shega' : 'Retry / Renew'}
              </AppText>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function pendingCopy(
  rejected: boolean,
  active: boolean,
  trial: boolean,
  expired: boolean,
  pending: boolean,
  reason?: string,
): string {
  if (rejected) return reason ? `Payment rejected: ${reason}` : 'Your payment was rejected. Please try again.';
  if (trial) return 'Your 7-day free trial is active.';
  if (active) return 'Your subscription is active. You now have full access to Shega.';
  if (expired) return 'Your subscription has expired. Renew to restore full access.';
  if (pending) return 'Your payment is waiting for approval. This usually takes 1-24 hours.';
  return 'You do not have an active subscription yet.';
}

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <AppText variant="caption" weight="bold" style={[styles.detailLabel, { color: fgSecondary }]}>
        {label.toUpperCase()}
      </AppText>
      <AppText variant="body" weight={accent ? 'bold' : 'semibold'} style={{ color: accent ? gold : fg }}>
        {value}
      </AppText>
    </View>
  );
}

/**
 * Normalise a plan label to the canonical editions. Accepts the old restored
 * wording too, so historical payment records never render as basic/premium.
 */
function planName(name: string | undefined): string {
  if (!name) return '—';
  const n = name.toLowerCase();
  if (n.includes('desktop') && n.includes('mobile')) return 'Mobile + Desktop';
  if (n.includes('premium')) return 'Mobile + Desktop';
  if (n.includes('desktop')) return 'Desktop';
  if (n.includes('mobile') || n.includes('basic')) return 'Mobile';
  return name;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  refreshBtn: { padding: 8 },
  centerBox: { alignItems: 'center', paddingVertical: 80 },
  statusCard: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 20,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusDot: { width: 28, height: 28, borderRadius: 14 },
  statusTitle: { marginBottom: 10, textAlign: 'center' },
  statusDesc: { textAlign: 'center', lineHeight: 22 },
  detailsCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    gap: 16,
  },
  detailRow: { gap: 4 },
  detailLabel: { letterSpacing: 1 },
  userCard: { padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  userLabel: { letterSpacing: 1, marginBottom: 8 },
  userRow: { gap: 4 },
  primaryBtn: {
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});