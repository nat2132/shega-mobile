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
import { getThisDeviceId } from '@/services/businessService';
import { mdnsDiscovery } from '@/services/mdnsDiscovery';
import { wsSyncClient } from '@/services/wsSyncClient';
import {
  lookupPairingToken, acceptPairingToken, pairingStatus, PairingLookup,
} from '@/services/pairingService';

type Stage = 'scan' | 'manual' | 'resolved' | 'pending' | 'approved' | 'rejected' | 'error';

const extractToken = (raw: string): string => {
  const m = /shega:\/\/join\?t=([^&]+)/.exec(raw.trim());
  return m ? decodeURIComponent(m[1]) : raw.trim();
};

/** Is this raw scan a desktop-generated user invite (QR JSON or raw code)? */
const parseHubInvite = (raw: string): string | null => {
  const text = raw.trim();
  try {
    const parsed = JSON.parse(text);
    if (parsed?.t === 'shega-invite' && typeof parsed.c === 'string') return parsed.c;
  } catch { /* not JSON */ }
  if (/^SHG-[0-9A-F]{6}$/i.test(text)) return text.toUpperCase();
  return null;
};

/**
 * Owner-side invitation QR (`shega://join?b=...&c=XXX-XXX-XXX` from the mobile
 * Add Team / Device card, or a bare invitation code). Resolves into the
 * standard join flow with the code prefilled — no manual typing.
 */
const extractInviteCode = (raw: string): string | null => {
  const text = raw.trim();
  const codeParam = /[?&]c=([A-Z0-9-]+)/i.exec(text);
  const candidate = codeParam ? decodeURIComponent(codeParam[1]) : text;
  return /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/i.test(candidate) ? candidate.toUpperCase() : null;
};

export default function ScanJoinScreen() {
  const { colors, t } = useSettings();
  const G = getGlass(colors);
  const roleKeyLabel = (key?: string) =>
    key && ['owner', 'manager', 'cashier', 'inventory', 'accountant', 'reports', 'warehouse'].includes(key)
      ? t(`teams.role_${key}`)
      : key ?? '';
  const { showToast } = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>('scan');
  const [token, setToken] = useState('');
  const [manual, setManual] = useState('');
  const [lookup, setLookup] = useState<PairingLookup | null>(null);
  const [name, setName] = useState('');
  const [inviteId, setInviteId] = useState<string | null>(null);
  // Desktop user-invite (LAN hub) state:
  const [hubCode, setHubCode] = useState<string | null>(null);
  const [hubInfo, setHubInfo] = useState<{ businessName: string; suggestedRole: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [scanning, setScanning] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleToken = async (raw: string) => {
    if (!scanning && stage === 'scan') return;

    // Owner's mobile invitation QR / bare invitation code → standard join flow.
    const inviteCode = extractInviteCode(raw);
    if (inviteCode) {
      setScanning(false);
      router.replace({ pathname: '/join-existing', params: { code: inviteCode } } as any);
      return;
    }

    // Desktop user invite? (LAN hub claim + poll; falls back to cloud lookup off-LAN)
    const hubInviteCode = parseHubInvite(raw);
    if (hubInviteCode) {
      setScanning(false);
      setHubCode(hubInviteCode);
      await claimHubInvite(hubInviteCode);
      return;
    }

    const rawToken = extractToken(raw);
    if (!rawToken || rawToken.length < 8) { showToast(t('join.toast_invalid_qr'), 'error'); return; }
    setScanning(false);
    try {
      const info = await lookupPairingToken(rawToken);
      setLookup(info);
      setName(info.employee_name || '');
      setToken(rawToken);
      setStage('resolved');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      const detail = e?.detail;
      const reason = typeof detail === 'object' ? detail?.reason : undefined;
      if (reason === 'used') showToast(t('join.toast_used'), 'error');
      else if (reason === 'revoked') showToast(t('join.toast_revoked'), 'error');
      else if (reason === 'expired') showToast(t('join.toast_expired'), 'error');
      else showToast(e?.message || t('join.toast_not_found'), 'error');
      setScanning(true);
    }
  };

  const resolveManual = async () => {
    if (!manual.trim()) { showToast(t('join.toast_enter_code'), 'error'); return; }
    setStage('scan');
    setScanning(true);
    await handleToken(manual.trim());
  };

  const accept = async () => {
    if (hubCode) { await submitHubInvite(); return; }
    if (!lookup || !token) return;
    if (!(await getStoredToken())) {
      showToast(t('join.toast_login_first'), 'error');
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
      if (e?.status === 401) { showToast(t('join.toast_login_to_accept'), 'error'); router.replace('/login'); }
      else if (reason === 'used') showToast(t('join.toast_used'), 'error');
      else if (reason === 'expired') showToast(t('join.toast_expired'), 'error');
      else showToast(e?.message || t('join.toast_accept_failed'), 'error');
    } finally {
      setChecking(false);
    }
  };

  // ---------- Desktop (LAN hub) user-invite flow ----------

  const claimHubInvite = async (code: string) => {
    try {
      if (!(await getStoredToken())) {
        showToast(t('join.toast_login_first'), 'error');
        router.replace('/login');
        setScanning(true);
        return;
      }
      const hub = mdnsDiscovery.getDiscoveredHubs()[0];
      if (!hub) {
        showToast(t('join.toast_no_desktop'), 'error');
        setScanning(true);
        return;
      }
      await wsSyncClient.connect({
        hubUrl: `http://${hub.host}:${hub.port}`,
        hubToken: hub.pairingToken,
        deviceId: getThisDeviceId() ?? `dev-${Date.now().toString(36)}`,
      });
      const res = await wsSyncClient.getHubInviteStatus(code);
      const inv = res?.invite;
      if (!inv || inv.status === 'expired') throw new Error(t('join.toast_invite_issue'));
      if (inv.status !== 'open') throw new Error(t('join.toast_used'));
      setHubInfo({ businessName: inv.businessName || 'Business', suggestedRole: inv.suggestedRole || 'cashier' });
      setStage('resolved');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      showToast(e?.message || t('join.toast_unreachable'), 'error');
      setHubCode(null);
      setScanning(true);
    }
  };

  const submitHubInvite = async () => {
    if (!hubCode) return;
    setChecking(true);
    try {
      const joinerName = name.trim() || 'New member';
      const res = await wsSyncClient.claimHubInvite(hubCode, joinerName, getThisDeviceId() ?? `dev-${Date.now().toString(36)}`);
      if (res?.invite?.status !== 'pending') throw new Error(t('join.toast_submit_failed'));
      setStage('pending');
      pollRef.current = setInterval(pollHubStatus, 10000);
    } catch (e: any) {
      showToast(e?.message || t('join.toast_submit_failed'), 'error');
    } finally {
      setChecking(false);
    }
  };

  const pollHubStatus = async () => {
    if (!hubCode) return;
    try {
      const res = await wsSyncClient.getHubInviteStatus(hubCode);
      const inv = res?.invite;
      if (!inv) return; // transient — keep polling
      if (inv.status === 'rejected' || inv.status === 'expired') {
        if (pollRef.current) clearInterval(pollRef.current);
        setStage('rejected');
      } else if (inv.status === 'approved') {
        if (pollRef.current) clearInterval(pollRef.current);
        restoreBusinessFromJoin({
          businessId: String(inv.businessId),
          name: inv.businessName || 'Business',
          joinerUser: name.trim() || 'New Member',
          role: inv.suggestedRole || 'cashier',
          joinerName: 'My Device',
        });
        setStage('approved');
        showToast(t('join.toast_welcome', { name: inv.businessName }), 'success');
        router.replace({ pathname: '/initial-sync', params: { business: inv.businessName || 'Your Business', role: inv.suggestedRole || 'cashier', device: 'This Device' } } as any);
      }
    } catch {
      // transient — keep polling
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
        showToast(t('join.toast_welcome', { name: restored.name }), 'success');
        router.replace({ pathname: '/initial-sync', params: { business: restored.name || 'Your Business', role: s.role || 'cashier', device: 'This Device' } } as any);
      }
    } catch {
      // transient — keep polling
    }
  };

  const retryScan = () => {
    setStage('scan');
    setScanning(true);
    setManual('');
    setHubCode(null);
    setHubInfo(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <ArrowLeft size={20} color={G.fg} />
            <AppText variant="body" weight="bold" style={{ color: G.fg }}>{t('join.back')}</AppText>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <ScanLine size={28} color={G.textGlassStrong} />
            </View>
            <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>{t('join.title')}</AppText>
            <AppText variant="body" weight="medium" align="center" style={{ color: G.muted }}>
              {t('join.subtitle')}
            </AppText>
          </View>

          {stage === 'scan' && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              {!permission?.granted ? (
                <View style={styles.centerBox}>
                  <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginBottom: 14 }}>
                    {t('join.camera_needed')}
                  </AppText>
                  <TouchableOpacity onPress={requestPermission} style={[styles.primaryBtn, { backgroundColor: G.fg }]}>
                    <AppText variant="body" weight="bold" style={{ color: G.bg }}>{t('join.allow_camera')}</AppText>
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
                    {t('join.point_camera')}
                  </AppText>
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); setStage('manual'); }}
                    style={[styles.secondaryBtn, { backgroundColor: G.accentGlass, borderColor: G.border }]}
                  >
                    <Type size={16} color={G.fg} />
                    <AppText variant="body" weight="bold" style={{ color: G.fg, marginLeft: 6 }}>{t('join.enter_code')}</AppText>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {stage === 'manual' && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginBottom: 8 }}>{t('join.pairing_code_label')}</AppText>
              <TextInput
                style={[styles.input, { borderColor: G.border, color: G.fg, backgroundColor: G.bg }]}
                placeholder={t('join.pairing_code_placeholder')}
                placeholderTextColor={G.muted}
                value={manual}
                onChangeText={setManual}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={resolveManual} style={[styles.primaryBtn, { backgroundColor: G.fg }]}>
                <AppText variant="body" weight="bold" style={{ color: G.bg }}>{t('join.continue')}</AppText>
              </TouchableOpacity>
            </View>
          )}

          {stage === 'resolved' && (lookup || hubInfo) && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <View style={styles.row}>
                <CheckCircle2 size={20} color="#2ecc71" />
                <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>{t('join.invitation_found')}</AppText>
              </View>
              <View style={styles.infoRow}>
                <AppText variant="caption" weight="bold" style={{ color: G.muted }}>{t('join.business')}</AppText>
                <AppText variant="body" weight="bold" style={{ color: G.fg }}>{lookup ? lookup.business_name : hubInfo!.businessName}</AppText>
              </View>
              <View style={styles.infoRow}>
                <AppText variant="caption" weight="bold" style={{ color: G.muted }}>{t('join.role')}</AppText>
                <AppText variant="body" weight="bold" style={{ color: G.fg }}>{lookup ? roleKeyLabel(lookup.role) : roleKeyLabel(hubInfo!.suggestedRole)}</AppText>
              </View>
              {lookup?.register && (
                <View style={styles.infoRow}>
                  <AppText variant="caption" weight="bold" style={{ color: G.muted }}>{t('join.register')}</AppText>
                  <AppText variant="body" weight="bold" style={{ color: G.fg }}>{lookup.register}</AppText>
                </View>
              )}
              {lookup?.location && (
                <View style={styles.infoRow}>
                  <AppText variant="caption" weight="bold" style={{ color: G.muted }}>{t('join.location')}</AppText>
                  <AppText variant="body" weight="bold" style={{ color: G.fg }}>{lookup.location}</AppText>
                </View>
              )}
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginTop: 14, marginBottom: 8 }}>{t('join.your_name')}</AppText>
              <TextInput
                style={[styles.input, { borderColor: G.border, color: G.fg, backgroundColor: G.bg }]}
                placeholder={t('join.name_placeholder')}
                placeholderTextColor={G.muted}
                value={name}
                onChangeText={setName}
              />
              <View style={[styles.infoCard, { backgroundColor: G.accentGlass, borderColor: G.border }]}>
                <Store size={18} color={G.fg} />
                <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1, marginLeft: 8 }}>
                  {t('join.inactive_note')}
                </AppText>
              </View>
              <TouchableOpacity onPress={accept} disabled={checking} style={[styles.primaryBtn, { backgroundColor: G.fg, marginTop: 16, opacity: checking ? 0.6 : 1 }]}>
                <AppText variant="body" weight="bold" style={{ color: G.bg }}>
                  {checking ? t('join.submitting') : lookup ? t('join.accept_register') : t('join.join_team')}
                </AppText>
              </TouchableOpacity>
            </View>
          )}

          {stage === 'pending' && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <View style={styles.row}>
                <CheckCircle2 size={24} color="#2ecc71" />
                <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>{t('join.submitted')}</AppText>
              </View>
              <AppText variant="body" weight="medium" style={{ color: G.muted, marginVertical: 12 }}>
                {t('join.submitted_msg')}
              </AppText>
              <View style={[styles.infoCard, { backgroundColor: G.accentGlass, borderColor: G.border }]}>
                <ShieldAlert size={18} color={G.fg} />
                <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1, marginLeft: 8 }}>
                  {t('join.checking_msg')}
                </AppText>
              </View>
              <TouchableOpacity onPress={pollStatus} disabled={checking} style={[styles.secondaryBtn, { backgroundColor: G.accentGlass, borderColor: G.border, marginTop: 16 }]}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }}>{checking ? t('join.checking') : t('join.check_status')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.replace('/setup-wizard')} style={[styles.secondaryBtn, { backgroundColor: G.bgCard, borderColor: G.border, marginTop: 10 }]}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }}>{t('join.continue_later')}</AppText>
              </TouchableOpacity>
            </View>
          )}

          {stage === 'approved' && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <View style={styles.row}>
                <CheckCircle2 size={24} color="#2ecc71" />
                <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>{t('join.approved')}</AppText>
              </View>
              <AppText variant="body" weight="medium" style={{ color: G.muted, marginVertical: 12 }}>
                {t('join.approved_msg')}
              </AppText>
              <TouchableOpacity onPress={() => router.replace('/')} style={[styles.primaryBtn, { backgroundColor: G.fg, marginTop: 16 }]}>
                <AppText variant="body" weight="bold" style={{ color: G.bg }}>{t('join.open_business')}</AppText>
              </TouchableOpacity>
            </View>
          )}

          {stage === 'rejected' && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <View style={styles.row}>
                <ShieldAlert size={24} color="#e74c3c" />
                <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>{t('join.declined')}</AppText>
              </View>
              <AppText variant="body" weight="medium" style={{ color: G.muted, marginVertical: 12 }}>
                {t('join.declined_msg')}
              </AppText>
              <TouchableOpacity onPress={retryScan} style={[styles.secondaryBtn, { backgroundColor: G.accentGlass, borderColor: G.border, marginTop: 16 }]}>
                <X size={16} color={G.fg} />
                <AppText variant="body" weight="bold" style={{ color: G.fg, marginLeft: 6 }}>{t('join.scan_another')}</AppText>
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