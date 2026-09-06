import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ArrowLeft, CheckCircle2, ScanLine, ShieldAlert, Store, Type, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { AppText } from '@/components/ui';
import { getGlass } from '@/screens/onboarding/glass-theme';
import { getStoredToken } from '@/services/api';
import { restoreBusinessFromJoin } from '@/services/invitationService';
import {
  lookupPairingToken, acceptPairingToken, pairingStatus, PairingLookup,
} from '@/services/pairingService';

type Stage = 'scan' | 'manual' | 'resolved' | 'pending' | 'approved' | 'rejected' | 'error';

const extractToken = (raw: string): string => {
  const m = /shega:\/\/join\?t=([^&]+)/.exec(raw.trim());
  return m ? decodeURIComponent(m[1]) : raw.trim();
};

export default function ScanJoinScreen() {
  const { colors } = useSettings();
  const G = getGlass(colors);
  const { showToast } = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>('scan');
  const [token, setToken] = useState('');
  const [manual, setManual] = useState('');
  const [lookup, setLookup] = useState<PairingLookup | null>(null);
  const [name, setName] = useState('');
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [scanning, setScanning] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleToken = async (raw: string) => {
    if (!scanning && stage === 'scan') return;
    const t = extractToken(raw);
    if (!t || t.length < 8) { showToast('Not a valid pairing QR', 'error'); return; }
    setScanning(false);
    try {
      const info = await lookupPairingToken(t);
      setLookup(info);
      setName(info.employee_name || '');
      setToken(t);
      setStage('resolved');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      const detail = e?.detail;
      const reason = typeof detail === 'object' ? detail?.reason : undefined;
      if (reason === 'used') showToast('This invitation was already used', 'error');
      else if (reason === 'revoked') showToast('This invitation was revoked by the owner', 'error');
      else if (reason === 'expired') showToast('This invitation has expired', 'error');
      else showToast(e?.message || 'Invitation not found', 'error');
      setScanning(true);
    }
  };

  const resolveManual = async () => {
    if (!manual.trim()) { showToast('Enter the pairing code or token', 'error'); return; }
    setStage('scan');
    setScanning(true);
    await handleToken(manual.trim());
  };

  const accept = async () => {
    if (!lookup || !token) return;
    if (!(await getStoredToken())) {
      showToast('Log in or create an account first', 'error');
      router.replace('/login');
      return;
    }
    setChecking(true);
    try {
      const res = await acceptPairingToken({ token, deviceName: 'My Device' });
      setInviteId(res.invitation_id);
      setStage('pending');
      pollRef.current = setInterval(pollStatus, 10000);
    } catch (e: any) {
      const detail = e?.detail;
      const reason = typeof detail === 'object' ? detail?.reason : undefined;
      if (e?.status === 401) { showToast('Log in to accept this invitation', 'error'); router.replace('/login'); }
      else if (reason === 'used') showToast('This invitation was already used', 'error');
      else if (reason === 'expired') showToast('This invitation has expired', 'error');
      else showToast(e?.message || 'Could not accept the invitation', 'error');
    } finally {
      setChecking(false);
    }
  };

  const pollStatus = async () => {
    if (!inviteId) return;
    try {
      const s = await pairingStatus(inviteId);
      if (s.status === 'revoked' || s.device_status === 'disabled') {
        if (pollRef.current) clearInterval(pollRef.current);
        setStage('rejected');
      } else if (s.device_status === 'active') {
        if (pollRef.current) clearInterval(pollRef.current);
        const restored = restoreBusinessFromJoin({
          businessId: s.business_id,
          name: s.business_name,
          joinerUser: (name.trim() || s.employee_name || 'New Member') ?? 'New Member',
          role: s.role || 'cashier',
          joinerName: 'My Device',
        });
        setStage('approved');
        showToast(`You're in! Welcome to ${restored.name}.`, 'success');
      }
    } catch {
      // transient — keep polling
    }
  };

  const retryScan = () => {
    setStage('scan');
    setScanning(true);
    setManual('');
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
              <ScanLine size={28} color={G.textGlassStrong} />
            </View>
            <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>Join by QR</AppText>
            <AppText variant="body" weight="medium" align="center" style={{ color: G.muted }}>
              Scan the pairing QR the owner showed you. You'll confirm the role once, then wait for their approval.
            </AppText>
          </View>

          {stage === 'scan' && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              {!permission?.granted ? (
                <View style={styles.centerBox}>
                  <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginBottom: 14 }}>
                    Camera access is needed to scan the pairing QR.
                  </AppText>
                  <TouchableOpacity onPress={requestPermission} style={[styles.primaryBtn, { backgroundColor: G.fg }]}>
                    <AppText variant="body" weight="bold" style={{ color: G.bg }}>Allow camera</AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <CameraView
                    style={styles.camera}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={scanning ? ({ data }) => handleToken(data) : undefined}
                  />
                  <AppText variant="caption" weight="medium" align="center" style={{ color: G.muted, marginVertical: 10 }}>
                    Point the camera at the owner's QR code.
                  </AppText>
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); setStage('manual'); }}
                    style={[styles.secondaryBtn, { backgroundColor: G.accentGlass, borderColor: G.border }]}
                  >
                    <Type size={16} color={G.fg} />
                    <AppText variant="body" weight="bold" style={{ color: G.fg, marginLeft: 6 }}>Enter code instead</AppText>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {stage === 'manual' && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginBottom: 8 }}>Pairing code / token</AppText>
              <TextInput
                style={[styles.input, { borderColor: G.border, color: G.fg, backgroundColor: G.bg }]}
                placeholder="e.g. ABCDEF-GHIJ-KLMN or paste the full token"
                placeholderTextColor={G.muted}
                value={manual}
                onChangeText={setManual}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={resolveManual} style={[styles.primaryBtn, { backgroundColor: G.fg }]}>
                <AppText variant="body" weight="bold" style={{ color: G.bg }}>Continue</AppText>
              </TouchableOpacity>
            </View>
          )}

          {stage === 'resolved' && lookup && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <View style={styles.row}>
                <CheckCircle2 size={20} color="#2ecc71" />
                <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>Invitation found</AppText>
              </View>
              <View style={styles.infoRow}>
                <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Business</AppText>
                <AppText variant="body" weight="bold" style={{ color: G.fg }}>{lookup.business_name}</AppText>
              </View>
              <View style={styles.infoRow}>
                <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Role</AppText>
                <AppText variant="body" weight="bold" style={{ color: G.fg }}>{lookup.role}</AppText>
              </View>
              {lookup.register && (
                <View style={styles.infoRow}>
                  <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Register</AppText>
                  <AppText variant="body" weight="bold" style={{ color: G.fg }}>{lookup.register}</AppText>
                </View>
              )}
              {lookup.location && (
                <View style={styles.infoRow}>
                  <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Location</AppText>
                  <AppText variant="body" weight="bold" style={{ color: G.fg }}>{lookup.location}</AppText>
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
              <View style={[styles.infoCard, { backgroundColor: G.accentGlass, borderColor: G.border }]}>
                <Store size={18} color={G.fg} />
                <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1, marginLeft: 8 }}>
                  Your device stays inactive until the owner approves. You'll need a Shega account to accept.
                </AppText>
              </View>
              <TouchableOpacity onPress={accept} disabled={checking} style={[styles.primaryBtn, { backgroundColor: G.fg, marginTop: 16, opacity: checking ? 0.6 : 1 }]}>
                <AppText variant="body" weight="bold" style={{ color: G.bg }}>
                  {checking ? 'Submitting…' : 'Accept & Register My Device'}
                </AppText>
              </TouchableOpacity>
            </View>
          )}

          {stage === 'pending' && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <View style={styles.row}>
                <CheckCircle2 size={24} color="#2ecc71" />
                <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>Pairing submitted</AppText>
              </View>
              <AppText variant="body" weight="medium" style={{ color: G.muted, marginVertical: 12 }}>
                Your request is waiting for the owner to approve. Please hold tight — you'll get full access once approved.
              </AppText>
              <View style={[styles.infoCard, { backgroundColor: G.accentGlass, borderColor: G.border }]}>
                <ShieldAlert size={18} color={G.fg} />
                <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1, marginLeft: 8 }}>
                  Checking every 10 seconds. Continue later and the request stays saved.
                </AppText>
              </View>
              <TouchableOpacity onPress={pollStatus} disabled={checking} style={[styles.secondaryBtn, { backgroundColor: G.accentGlass, borderColor: G.border, marginTop: 16 }]}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }}>{checking ? 'Checking…' : 'Check Approval Status'}</AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.replace('/welcome-choice')} style={[styles.secondaryBtn, { backgroundColor: G.bgCard, borderColor: G.border, marginTop: 10 }]}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }}>Continue Later</AppText>
              </TouchableOpacity>
            </View>
          )}

          {stage === 'approved' && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
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
            </View>
          )}

          {stage === 'rejected' && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <View style={styles.row}>
                <ShieldAlert size={24} color="#e74c3c" />
                <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>Request declined</AppText>
              </View>
              <AppText variant="body" weight="medium" style={{ color: G.muted, marginVertical: 12 }}>
                The owner declined your pairing request. Ask them to approve it or generate a new invitation.
              </AppText>
              <TouchableOpacity onPress={retryScan} style={[styles.secondaryBtn, { backgroundColor: G.accentGlass, borderColor: G.border, marginTop: 16 }]}>
                <X size={16} color={G.fg} />
                <AppText variant="body" weight="bold" style={{ color: G.fg, marginLeft: 6 }}>Scan another code</AppText>
              </TouchableOpacity>
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
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, borderRadius: 999, borderWidth: 1 },
  centerBox: { alignItems: 'center', paddingVertical: 16 },
  camera: { height: 300, borderRadius: 18, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  infoCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, borderWidth: 1 },
});