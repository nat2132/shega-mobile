import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, QrCode, RefreshCw, ShieldX } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { AppText } from '@/components/ui';
import { getGlass } from '@/screens/onboarding/glass-theme';
import { getStoredToken } from '@/services/api';
import {
  getActiveBusiness, getRegisters, getLocations,
} from '@/services/businessService';
import { ROLE_ORDER, getBuiltinRole, BuiltinRoleKey } from '@shega/shared';
import {
  issuePairingInvite, revokePairing, PairingInviteIssued,
} from '@/services/pairingService';

const roleLabel = (role: string) => getBuiltinRole(role.trim().toLowerCase() as BuiltinRoleKey)?.name || role;

const PAIRING_ROLES = ROLE_ORDER.filter((r) => r !== 'owner');

export default function PairingQrScreen() {
  const { colors } = useSettings();
  const G = getGlass(colors);
  const { showToast } = useToast();

  const business = getActiveBusiness();
  const registers = business ? getRegisters(business.id) : [];
  const locations = business ? getLocations(business.id) : [];

  const [name, setName] = useState('');
  const [role, setRole] = useState('cashier');
  const [register, setRegister] = useState<string | undefined>(undefined);
  const [location, setLocation] = useState<string | undefined>(undefined);
  const [invite, setInvite] = useState<PairingInviteIssued | null>(null);
  const [generating, setGenerating] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = useMemo(() => {
    if (!invite) return null;
    const m = Math.max(0, Math.floor((new Date(invite.expires_at).getTime() - now) / 1000));
    const mins = Math.floor(m / 60);
    const secs = m % 60;
    return { mins, secs };
  }, [invite, now]);

  const generate = async () => {
    if (!business) { showToast('No active business found', 'error'); return; }
    if (!(await getStoredToken())) { showToast('Log in to your Owner account first', 'error'); router.replace('/login'); return; }
    setGenerating(true);
    try {
      const invite = await issuePairingInvite({
        employeeName: name.trim() || undefined,
        role,
        register: register || undefined,
        location: location || undefined,
      });
      setInvite(invite);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      showToast(e?.detail || e?.message || 'Could not generate invitation', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const revoke = async () => {
    if (!invite) return;
    try {
      await revokePairing(invite.id);
    } catch (e: any) {
      showToast(e?.detail || e?.message || 'Could not revoke', 'error');
    }
    setInvite(null);
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
              <QrCode size={28} color={G.textGlassStrong} />
            </View>
            <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
              {business ? `Pair an Employee · ${business.name}` : 'Pair an Employee'}
            </AppText>
            <AppText variant="body" weight="medium" align="center" style={{ color: G.muted }}>
              Generate a short-lived QR for an employee’s Shega app. They scan it, confirm once, and your approval activates their device.
            </AppText>
          </View>

          {!invite ? (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginBottom: 8 }}>Employee name</AppText>
              <TextInput
                style={[styles.input, { borderColor: G.border, color: G.fg, backgroundColor: G.bg }]}
                placeholder="e.g. Hana"
                placeholderTextColor={G.muted}
                value={name}
                onChangeText={setName}
              />
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginTop: 12, marginBottom: 8 }}>Role (fixed at issue)</AppText>
              <View style={styles.roleWrap}>
                {PAIRING_ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => { Haptics.selectionAsync(); setRole(r); }}
                    style={[styles.roleChip, { backgroundColor: role === r ? G.fg : G.accentGlass, borderColor: G.border }]}
                  >
                    <AppText variant="caption" weight="bold" style={{ color: role === r ? G.bg : G.fg }}>
                      {getBuiltinRole(r)?.name || r}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </View>
              {registers.length > 0 && (
                <>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginTop: 12, marginBottom: 8 }}>Register</AppText>
                  <View style={styles.roleWrap}>
                    {registers.map((r) => (
                      <TouchableOpacity
                        key={r.id}
                        onPress={() => { Haptics.selectionAsync(); setRegister(r.id === register ? undefined : r.id); }}
                        style={[styles.roleChip, { backgroundColor: register === r.id ? G.fg : G.accentGlass, borderColor: G.border }]}
                      >
                        <AppText variant="caption" weight="bold" style={{ color: register === r.id ? G.bg : G.fg }}>{r.name}</AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              {locations.length > 0 && (
                <>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginTop: 12, marginBottom: 8 }}>Location</AppText>
                  <View style={styles.roleWrap}>
                    {locations.map((l) => (
                      <TouchableOpacity
                        key={l.id}
                        onPress={() => { Haptics.selectionAsync(); setLocation(l.id === location ? undefined : l.id); }}
                        style={[styles.roleChip, { backgroundColor: location === l.id ? G.fg : G.accentGlass, borderColor: G.border }]}
                      >
                        <AppText variant="caption" weight="bold" style={{ color: location === l.id ? G.bg : G.fg }}>{l.name}</AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <TouchableOpacity onPress={generate} disabled={generating} style={[styles.primaryBtn, { backgroundColor: G.fg, marginTop: 18, opacity: generating ? 0.6 : 1 }]}>
                <AppText variant="body" weight="bold" style={{ color: G.bg }}>
                  {generating ? 'Generating…' : 'Generate Pairing QR'}
                </AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder, alignItems: 'center' }]}>
              <AppText variant="body" weight="bold" align="center" style={{ color: G.fg, marginBottom: 4 }}>
                {invite.employee_name?.trim() || 'New Member'} · {roleLabel(invite.role)}
              </AppText>
              {invite.register || invite.location ? (
                <AppText variant="caption" weight="medium" align="center" style={{ color: G.muted, marginBottom: 12 }}>
                  {[invite.register, invite.location].filter(Boolean).join(' · ')}
                </AppText>
              ) : (
                <AppText variant="caption" weight="medium" align="center" style={{ color: G.muted, marginBottom: 12 }}>
                  Ask them to scan with their Shega app.
                </AppText>
              )}
              <View style={[styles.qrFrame, { backgroundColor: '#FFFFFF', borderColor: G.border }]}>
                <QRCode value={invite.qr_uri} size={230} />
              </View>
              <View style={[styles.codeBox, { backgroundColor: G.accentGlass, borderColor: G.border, marginTop: 16 }]}>
                <AppText variant="heading-lg" weight="bold" align="center" style={{ color: G.fg, letterSpacing: 3 }}>{invite.code}</AppText>
              </View>
              {remaining && (
                <AppText variant="caption" weight="bold" align="center" style={{ color: remaining.mins === 0 && remaining.secs < 30 ? '#e74c3c' : '#f1c40f', marginTop: 8 }}>
                  Expires in {remaining.mins}m {remaining.secs}s
                </AppText>
              )}
              <AppText variant="caption" weight="medium" align="center" style={{ color: G.muted, marginTop: 6 }}>
                Single use. You&apos;ll approve the device once they accept.
              </AppText>
              <TouchableOpacity onPress={async () => { setInvite(null); await generate(); }} style={[styles.secondaryBtn, { backgroundColor: G.accentGlass, marginTop: 18 }]}>
                <RefreshCw size={16} color={G.fg} />
                <AppText variant="body" weight="bold" style={{ color: G.fg, marginLeft: 6 }}>Regenerate</AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={revoke} style={[styles.secondaryBtn, { backgroundColor: G.bgCard, borderColor: G.border, marginTop: 10 }]}>
                <ShieldX size={16} color="#e74c3c" />
                <AppText variant="body" weight="bold" style={{ color: '#e74c3c', marginLeft: 6 }}>Revoke & Done</AppText>
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
  input: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, fontSize: 16, borderWidth: 1, marginBottom: 6 },
  roleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChip: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1 },
  primaryBtn: { alignItems: 'center', paddingVertical: 15, borderRadius: 999 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 999, alignSelf: 'stretch' },
  qrFrame: { borderRadius: 18, padding: 14, borderWidth: 1 },
  codeBox: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1 },
});