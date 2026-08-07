import { AppText } from '@/components/ui';
import { useAccount } from '@/context/AccountContext';
import { AccountUser, fetchMyPayment, PaymentInfo } from '@/services/api';
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
  const notifiedRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await fetchMyPayment();
      setPayment(p);
    } catch {
      setPayment(null);
    }
    await refreshStatus();
    setLoading(false);
  }, [refreshStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const status: string = subscription?.status || payment?.status || 'pending';
  const approved = status === 'active' || status === 'approved';
  const rejected = status === 'rejected';

  // Surface an in-app notification reflecting the current subscription status,
  // once per status (deduped via notification group keys).
  useEffect(() => {
    const key = subscription?.status || payment?.status;
    if (!key || key === 'none' || notifiedRef.current === key) return;
    notifiedRef.current = key;
    try {
      notifyPaymentStatus({
        status: key === 'active' || key === 'approved'
          ? 'approved'
          : key === 'rejected'
            ? 'rejected'
            : 'pending',
        planName: subscription?.plan_name || subscription?.plan,
        reason: payment?.reason,
        expiresAt: subscription?.expires_at,
      });
    } catch {}
  }, [subscription, payment]);

  const badgeText = rejected ? 'Payment Rejected' : approved ? 'Subscription Active' : 'Pending Approval';
  const badgeColor = rejected ? danger : approved ? success : warning;

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
            <View style={[styles.statusCard, { backgroundColor: card, borderColor: border }]}>
              <View style={[styles.statusIcon, { backgroundColor: badgeColor + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: badgeColor }]} />
              </View>
              <AppText variant="heading" weight="bold" style={[styles.statusTitle, { color: badgeColor }]}>
                {badgeText}
              </AppText>
              <AppText variant="body" weight="medium" style={[styles.statusDesc, { color: fgSecondary }]}>
                {pendingCopy(rejected, approved, payment?.reason)}
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
              style={[styles.primaryBtn, { backgroundColor: approved ? success : fg }]}
              onPress={approved ? onContinue : onRenew}
              activeOpacity={0.85}
            >
              <AppText variant="heading" weight="bold" style={{ color: bg }}>
                {approved ? 'Continue to Shega' : 'Retry / Renew'}
              </AppText>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function pendingCopy(rejected: boolean, approved: boolean, reason?: string): string {
  if (rejected) return reason ? `Payment rejected: ${reason}` : 'Your payment was rejected. Please try again.';
  if (approved) return 'Your subscription is active. You now have full access to Shega.';
  return 'Your payment is waiting for approval. This usually takes 1-24 hours.';
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

function planName(name: string | undefined): string {
  if (!name) return '—';
  const n = name.toLowerCase();
  if (n.includes('premium') && n.includes('basic')) return name;
  if (n.includes('premium')) return 'Premium';
  if (n.includes('basic')) return 'Basic';
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