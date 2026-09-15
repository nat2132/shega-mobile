import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2, ShieldAlert, Store } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { AppText } from '@/components/ui';
import { getGlass } from './glass-theme';
import { wsSyncClient } from '@/services/wsSyncClient';
import { validateInviteCode, submitJoinRequest, restoreBusinessFromJoin } from '@/services/invitationService';
import { getThisDeviceId } from '@/services/businessService';
import { acceptPairing, lookupPairingInvite, pairingStatus, type PairingStatus } from '@/services/pairingService';
import { fetchMyMemberships } from '@/services/api';
import { ensureRemoteBusinessSeeded } from '@/services/businessService';
import { setJoinResumeDone } from '@/services/postAuthRouter';

type Stage = 'idle' | 'resolved' | 'sent';

export default function JoinExistingScreen() {
  const { colors } = useSettings();
  const G = getGlass(colors);
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [name, setName] = useState('');
  const [resolved, setResolved] = useState<{
    businessId: string;
    code: string;
    businessName?: string;
    role?: string;
    name?: string;
    source?: 'lan' | 'cloud';
  } | null>(null);
  const [cloudInvitationId, setCloudInvitationId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ status: string; role?: string; joinerUser?: string; name?: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const params = useLocalSearchParams<{ resume?: string }>();
  const resumeId = params.resume;

  // Applies a cloud pairing-status record to the UI. Shared by the resume
  // restore, the manual "Check Approval Status" button and the 4s auto-poll,
  // so a request that resolves while the app is closed (or this screen is
  // open) transitions exactly once. Terminal outcomes are flagged so a later
  // restart does not keep re-hijacking startup onto this screen.
  const applyStatus = async (rec: PairingStatus, opts?: { personName?: string; quiet?: boolean }) => {
    if (rec.status === 'pending' || rec.status === 'used') {
      setDecision({ status: 'pending' });
      if (!opts?.quiet) showToast('Still waiting for the owner to approve.', 'info');
      return;
    }
    void setJoinResumeDone(String(rec.id));
    if (rec.status === 'approved') {
      const personName = (opts?.personName || name.trim() || resolved?.name || 'New Member').trim();
      const bizName = await seedJoinedBusiness(personName);
      setDecision({ status: 'approved', role: rec.role || resolved?.role, name: personName });
      showToast(`You're in! Welcome to ${bizName}.`, 'success');
      router.replace({ pathname: '/initial-sync', params: { business: bizName, role: rec.role || resolved?.role || 'cashier', device: 'This Device' } } as any);
      return;
    }
    setDecision({ status: 'rejected', role: rec.role });
    if (!opts?.quiet) showToast('Request declined.', 'info');
  };

  // Resume after restart: the request lives on the backend, so on mount we
  // restore Waiting for Approval (pending/used), or jump straight to the
  // terminal outcome (approved/rejected/expired) that happened while closed.
  useEffect(() => {
    if (!resumeId) return;
    let cancelled = false;
    (async () => {
      try {
        const rec = await pairingStatus(resumeId);
        if (cancelled) return;
        if (rec.status === 'pending' || rec.status === 'used') {
          setResolved({
            businessId: rec.business_id,
            code: '',
            businessName: rec.business_name,
            role: rec.role,
            name: rec.employee_name ?? undefined,
            source: 'cloud',
          });
          setCloudInvitationId(resumeId);
          setStage('sent');
        } else {
          await applyStatus(rec, { personName: rec.employee_name ?? undefined, quiet: true });
        }
      } catch (e: any) {
        if (!cancelled) showToast(e?.message || 'Could not restore your request. Try the invitation code again.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  // Auto-approval while Waiting: poll the backend pairing record every 4s so
  // the join completes as soon as the owner approves — no manual check needed.
  useEffect(() => {
    if (stage !== 'sent' || !cloudInvitationId || resolved?.source !== 'cloud') return;
    if (decision?.status === 'approved' || decision?.status === 'rejected') return;
    const timer = setInterval(() => {
      (async () => {
        try {
          const rec = await pairingStatus(cloudInvitationId);
          await applyStatus(rec, { quiet: true });
        } catch {
          /* keep polling; transient network noise must not kill the wait */
        }
      })();
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, cloudInvitationId, resolved, decision?.status, name]);

  const resolve = async () => {
    const trimmed = code.trim();
    if (!trimmed) { showToast('Enter the invitation code', 'error'); return; }

    // 1) LAN hub is the fastest path when it is on the same network.
    let inviteInfo: { businessId: string; code: string; businessName?: string; role?: string; name?: string; source?: 'lan' | 'cloud' } | null = null;
    if (wsSyncClient.isConnected) {
      try {
        const res = await wsSyncClient.resolveInvitation(trimmed);
        const inv = res?.invitation;
        if (inv) {
          inviteInfo = {
            businessId: inv.businessId,
            code: inv.code,
            businessName: undefined,
            role: inv.role ?? undefined,
            name: inv.name ?? undefined,
            source: 'lan',
          };
        }
      } catch (e: any) {
        if (String(e?.message).includes('INVITE_INVALID')) {
          showToast('Invitation not found or expired', 'error');
          return;
        }
      }
    }
    // 2) Cloud: the 6-digit manual code resolves against the backend, so a
    //    joining device works anywhere — not only on the owner's LAN.
    if (!inviteInfo) {
      const local = validateInviteCode(trimmed);
      if (local) {
        inviteInfo = { businessId: local.business_id, code: local.code, role: local.role ?? undefined, name: local.name ?? undefined, source: 'lan' };
      } else {
        try {
          const cloud = await lookupPairingInvite({ code: trimmed });
          inviteInfo = {
            businessId: cloud.business_id,
            code: trimmed,
            businessName: cloud.business_name,
            role: cloud.role ?? undefined,
            name: cloud.employee_name ?? undefined,
            source: 'cloud',
          };
        } catch (e: any) {
          const msg = String(e?.message || '');
          if (/already used|used|approved|rejected|cancelled|revoked|expired|not found|no longer open/i.test(msg)) {
            showToast(msg, 'error');
            return;
          }
        }
      }
    }
    if (!inviteInfo) {
      showToast("Can't find that invitation. Connect to your business LAN network and try again.", 'error');
      return;
    }
    setResolved(inviteInfo);
    setStage('resolved');
  };

  const submit = async () => {
    if (!resolved) return;
    const personName = (name.trim() || resolved.name || 'New Member').trim();
    try {
      if (resolved.source === 'cloud') {
        // Cloud path: accept directly against the backend. The device + membership
        // become pending; the owner approves from their BusinessManagement screen.
        const acceptRes = await acceptPairing({
          code: resolved.code,
          deviceName: `My ${Platform.OS}`,
          platform: 'mobile',
        });
        if (acceptRes.status === 'active') {
          await seedJoinedBusiness(personName);
          setDecision({ status: 'approved', role: resolved.role, joinerUser: personName });
          router.replace({ pathname: '/initial-sync', params: { business: resolved.businessName || 'Your Business', role: resolved.role || 'cashier', device: 'This Device' } } as any);
        } else {
          setCloudInvitationId(acceptRes.invitation_id);
          setStage('sent');
          showToast('Request sent. Waiting for the owner to approve.', 'success');
        }
        return;
      }
      await submitJoinRequest({
        businessId: resolved.businessId,
        code: resolved.code,
        joinerName: 'My Device',
        joinerModel: Platform.OS,
        joinerUser: personName,
        role: resolved.role ?? 'cashier',
        platform: 'mobile',
      });
      setStage('sent');
      showToast('Request sent. Waiting for the owner to approve.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Could not send request', 'error');
    }
  };

  const seedJoinedBusiness = async (personName: string) => {
    // Post-approval adoption: the account's memberships now include the joined
    // business, so seed a local cache row the same way a second-install does.
    const memberships = await fetchMyMemberships();
    const seeded = ensureRemoteBusinessSeeded({
      owned: memberships.owned.map((o) => ({ business_name: o.business_name, name: o.name })),
      memberships: memberships.memberships.map((m) => ({ business_name: m.business_name, role: m.role })),
    });
    if (seeded) {
      setResolved((r) => (r ? { ...r, businessName: seeded.name } : r));
      return seeded.name;
    }
    return resolved?.businessName ?? personName;
  };

  const checkStatus = async () => {
    if (!resolved) return;
    setChecking(true);
    try {
      // Cloud path: poll the backend pairing record for terminal state.
      if (resolved.source === 'cloud' && cloudInvitationId) {
        await applyStatus(await pairingStatus(cloudInvitationId));
        return;
      }
      if (!wsSyncClient.isConnected) { showToast('Connect to your business LAN to check approval', 'error'); return; }
      const deviceId = getThisDeviceId() ?? '';
      const res = await wsSyncClient.checkDeviceJoinStatus(resolved.code, deviceId);
      const rec = res?.record;
      if (!rec || rec.status === 'pending') {
        setDecision({ status: 'pending' });
        showToast('Still waiting for the owner to approve.', 'info');
      } else if (rec.status === 'rejected') {
        setDecision({ status: 'rejected' });
      } else if (rec.status === 'approved') {
        const restored = restoreBusinessFromJoin({
          businessId: resolved.businessId,
          name: resolved.businessName ?? 'My Business',
          joinerUser: (name.trim() || resolved.name || 'New Member').trim(),
          role: rec.role || resolved.role || 'cashier',
          joinerName: rec.joinerName || 'My Device',
        });
        setDecision({ status: 'approved' });
        showToast(`You're in! Welcome to ${restored.name}.`, 'success');
        router.replace({ pathname: '/initial-sync', params: { business: restored.name || 'Your Business', role: rec.role || resolved.role || 'cashier', device: 'This Device' } } as any);
      }
    } catch (e: any) {
      showToast(e?.message || 'Could not check approval status', 'error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <ArrowLeft size={20} color={G.fg} />
            <AppText variant="body" weight="bold" style={{ color: G.fg }}>Back</AppText>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <Store size={28} color={G.textGlassStrong} />
            </View>
            <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>Join Existing Business</AppText>
            <AppText variant="body" weight="medium" align="center" style={{ color: G.muted }}>
              Enter the invitation code from your owner to join their business.
            </AppText>
          </View>

          {stage === 'idle' && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginBottom: 8 }}>Invitation code</AppText>
              <TextInput
                style={[styles.input, { borderColor: G.border, color: G.fg, backgroundColor: G.bg }]}
                placeholder="6-digit code (e.g. 482901)"
                placeholderTextColor={G.muted}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={resolve} style={[styles.primaryBtn, { backgroundColor: G.fg }]}>
                <AppText variant="body" weight="bold" style={{ color: G.bg }}>Continue</AppText>
              </TouchableOpacity>
            </View>
          )}

          {stage === 'resolved' && resolved && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <View style={styles.row}>
                <CheckCircle2 size={20} color="#2ecc71" />
                <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>Invitation found</AppText>
              </View>
              <View style={styles.infoRow}>
                <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Business</AppText>
                <AppText variant="body" weight="bold" style={{ color: G.fg }}>{resolved.businessName ?? 'ABC Shop'}</AppText>
              </View>
              {resolved.role && (
                <View style={styles.infoRow}>
                  <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Requested role</AppText>
                  <AppText variant="body" weight="bold" style={{ color: G.fg }}>{resolved.role}</AppText>
                </View>
              )}
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginTop: 14, marginBottom: 8 }}>Your name</AppText>
              <TextInput
                style={[styles.input, { borderColor: G.border, color: G.fg, backgroundColor: G.bg }]}
                placeholder="e.g. Hana"
                placeholderTextColor={G.muted}
                value={name}
                onChangeText={setName}
              />
              <TouchableOpacity onPress={submit} style={[styles.primaryBtn, { backgroundColor: G.fg }]}>
                <AppText variant="body" weight="bold" style={{ color: G.bg }}>Request to Join</AppText>
              </TouchableOpacity>
            </View>
          )}

          {stage === 'sent' && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              {decision?.status === 'approved' ? (
                <>
                  <View style={styles.row}>
                    <CheckCircle2 size={24} color="#2ecc71" />
                    <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>{`Approved — you're in!`}</AppText>
                  </View>
                  <AppText variant="body" weight="medium" style={{ color: G.muted, marginVertical: 12 }}>
                    Your device is now active on this business.
                  </AppText>
                  <TouchableOpacity onPress={() => router.replace('/')} style={[styles.primaryBtn, { backgroundColor: G.fg, marginTop: 16 }]}>
                    <AppText variant="body" weight="bold" style={{ color: G.bg }}>Open Business</AppText>
                  </TouchableOpacity>
                </>
              ) : decision?.status === 'rejected' ? (
                <>
                  <View style={styles.row}>
                    <ShieldAlert size={24} color="#e74c3c" />
                    <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>Request declined</AppText>
                  </View>
                  <AppText variant="body" weight="medium" style={{ color: G.muted, marginVertical: 12 }}>
                    The owner declined your request. Ask them to approve it or generate a new invitation.
                  </AppText>
                  <TouchableOpacity onPress={() => { setDecision(null); setStage('idle'); setCode(''); }} style={[styles.primaryBtn, { backgroundColor: G.fg, marginTop: 16 }]}>
                    <AppText variant="body" weight="bold" style={{ color: G.bg }}>Try another code</AppText>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.row}>
                    <CheckCircle2 size={24} color="#2ecc71" />
                    <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>Request sent</AppText>
                  </View>
                  <AppText variant="body" weight="medium" style={{ color: G.muted, marginVertical: 12 }}>
                    Your device has requested to join. The owner will review and approve it shortly.
                  </AppText>
                  <View style={[styles.infoCard, { backgroundColor: G.accentGlass, borderColor: G.border }]}>
                    <ShieldAlert size={18} color={G.fg} />
                    <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1, marginLeft: 8 }}>
                      {`You'll get full access once the owner approves your device.`}
                    </AppText>
                  </View>
                  <TouchableOpacity onPress={checkStatus} disabled={checking} style={[styles.primaryBtn, { backgroundColor: G.fg, marginTop: 16, opacity: checking ? 0.6 : 1 }]}>
                    <AppText variant="body" weight="bold" style={{ color: G.bg }}>{checking ? 'Checking…' : 'Check Approval Status'}</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.replace('/welcome-choice')} style={[styles.primaryBtn, { backgroundColor: G.accentGlass, marginTop: 10 }]}>
                    <AppText variant="body" weight="bold" style={{ color: G.fg }}>Continue Later</AppText>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingVertical: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 16 },
  card: { borderRadius: 22, padding: 22, borderWidth: 1, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  input: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, fontSize: 16, borderWidth: 1, marginBottom: 14 },
  primaryBtn: { alignItems: 'center', paddingVertical: 15, borderRadius: 999 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  infoCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, borderWidth: 1 },
});
