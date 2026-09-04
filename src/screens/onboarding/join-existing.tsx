import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle2, ShieldAlert, Store } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { AppText } from '@/components/ui';
import { getGlass } from './glass-theme';
import { wsSyncClient } from '@/services/wsSyncClient';
import { validateInviteCode, submitJoinRequest, restoreBusinessFromJoin } from '@/services/invitationService';
import { getThisDeviceId } from '@/services/businessService';

type Stage = 'idle' | 'resolved' | 'sent';

export default function JoinExistingScreen() {
  const { colors } = useSettings();
  const G = getGlass(colors);
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [name, setName] = useState('');
  const [resolved, setResolved] = useState<{
    businessId: string; code: string; businessName?: string; role?: string; name?: string;
  } | null>(null);
  const [decision, setDecision] = useState<{ status: string; role?: string; joinerUser?: string; name?: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const resolve = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { showToast('Enter the invitation code', 'error'); return; }

    let inviteInfo = null;
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
          };
        }
      } catch (e: any) {
        if (String(e?.message).includes('INVITE_INVALID')) {
          showToast('Invitation not found or expired', 'error');
          return;
        }
      }
    }
    if (!inviteInfo) {
      const local = validateInviteCode(trimmed);
      if (local) {
        inviteInfo = { businessId: local.business_id, code: local.code, role: local.role ?? undefined, name: local.name ?? undefined };
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

  const checkStatus = async () => {
    if (!resolved) return;
    setChecking(true);
    try {
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
                placeholder="ABC-123-XYZ"
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
                    <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>Approved — you're in!</AppText>
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
                      You'll get full access once the owner approves your device.
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
