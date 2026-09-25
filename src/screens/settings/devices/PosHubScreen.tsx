/**
 * POS Hub screen — "this phone is the main connector".
 *
 * Shows the phone's pairing QR + 6-char code so desktops and other mobiles
 * can connect to it through Settings → POS Hub, exactly mirroring the
 * desktop hub's pairing flow. Also lists connected/paired clients and lets
 * the owner stop acting as a hub.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView,
  StyleSheet, Switch, View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  CheckCircle2, Copy, QrCode, RefreshCw, Smartphone, Wifi, WifiOff, X,
} from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { getGlass } from '@/screens/onboarding/glass-theme';
import {
  type MobileHubInfo,
  getMobilePosHubInfo,
  getMobileHubClients,
  regenerateMobilePairingToken,
  stopMobilePosHub,
  startMobilePosHub,
} from '@/services/mobilePosHub';

export const PosHubScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { colors } = useSettings();
  const G = getGlass(colors);
  const { showToast } = useToast();

  const [info, setInfo] = useState<MobileHubInfo | null>(null);
  const [clients, setClients] = useState<Array<{ deviceId: string; name: string; status: string; lastSeen: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [hubOn, setHubOn] = useState(false);
  const [toggling, setToggling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const i = await getMobilePosHubInfo();
      setInfo(i);
      setHubOn(i.running);
      setClients(getMobileHubClients());
    } catch (e: any) {
      console.warn('[PosHub] refresh failed:', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  const toggleHub = async (v: boolean) => {
    setToggling(true);
    try {
      if (v) {
        await startMobilePosHub();
        showToast('POS Hub started — other devices can now pair with this phone', 'success');
      } else {
        stopMobilePosHub();
        showToast('POS Hub stopped', 'info');
      }
      setHubOn(v);
      await refresh();
    } catch (e: any) {
      showToast(e?.message || 'Could not change hub mode', 'error');
    } finally {
      setToggling(false);
    }
  };

  const newCode = () => {
    const t = regenerateMobilePairingToken();
    showToast(`New pairing code: ${t}`, 'success');
    void refresh();
  };

  return (
    <View style={styles.fill}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
          <X size={22} color={G.fg} />
        </Pressable>
        <AppText variant="title" weight="bold" style={{ color: G.fg, flex: 1, textAlign: 'center' }}>
          POS Hub
        </AppText>
        <View style={{ width: 36 }} />
      </View>

        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={G.muted} />}
        >
          {/* Status hero */}
          <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.heroRow}>
              <View style={[styles.heroIcon, { backgroundColor: (hubOn ? '#2ECC71' : G.muted) + '18' }]}>
                {hubOn ? <Wifi size={22} color="#2ECC71" strokeWidth={2.5} /> : <WifiOff size={22} color={G.muted} strokeWidth={2.5} />}
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }}>
                  {hubOn ? 'Hub active — accepting connections' : 'Hub off — this phone is not accepting connections'}
                </AppText>
                <AppText variant="caption" style={{ color: G.muted }}>
                  {hubOn && info?.hubUrl ? info.hubUrl : 'Turn on to let devices connect to this phone'}
                </AppText>
              </View>
              <Switch
                value={hubOn}
                onValueChange={toggleHub}
                disabled={toggling}
                trackColor={{ false: G.border, true: '#2ECC7160' }}
                thumbColor={hubOn ? '#2ECC71' : G.muted}
              />
            </View>
          </View>

          {/* Pairing */}
          {hubOn && (
            <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <View style={styles.sectionHead}>
                <QrCode size={16} color={G.fg} />
                <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginLeft: 6 }}>
                  Pair a device
                </AppText>
                <View style={{ flex: 1 }} />
                <Pressable onPress={newCode} hitSlop={8} style={[styles.chipBtn, { borderColor: G.border }]}>
                  <RefreshCw size={12} color={G.fg} />
                  <AppText variant="micro" weight="bold" style={{ color: G.fg, marginLeft: 4 }}>New code</AppText>
                </Pressable>
              </View>
              <View style={styles.qrWrap}>
                {info?.qrPayload ? (
                  <QRCode value={info.qrPayload} size={200} backgroundColor="transparent" color={G.fg} />
                ) : (
                  <ActivityIndicator color={G.muted} />
                )}
              </View>
              <AppText variant="caption" style={{ color: G.muted, textAlign: 'center', marginBottom: 10 }}>
                In the other app: Settings → Sync → POS Hub → scan this QR
              </AppText>
              <View style={[styles.codeRow, { backgroundColor: G.bg, borderColor: G.border }]}>
                <AppText variant="title" weight="bold" style={{ color: G.fg, letterSpacing: 10 }}>
                  {info?.pairingToken ?? '——————'}
                </AppText>
                <Pressable
                  hitSlop={10}
                  onPress={async () => {
                    try {
                      const Clipboard = await import('expo-clipboard');
                      await Clipboard.setStringAsync(info?.pairingToken ?? '');
                      showToast('Code copied', 'success');
                    } catch { /* clipboard unavailable */ }
                  }}
                >
                  <Copy size={18} color={G.muted} />
                </Pressable>
              </View>
            </View>
          )}

          {/* Connected clients */}
          <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.sectionHead}>
              <Smartphone size={16} color={G.fg} />
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginLeft: 6 }}>
                Connected devices
              </AppText>
            </View>
            {clients.length === 0 ? (
              <AppText variant="caption" style={{ color: G.muted }}>
                No devices have paired with this hub yet.
              </AppText>
            ) : (
              clients.map((c) => (
                <View key={c.deviceId} style={styles.clientRow}>
                  <CheckCircle2 size={15} color={c.status === 'revoked' ? '#FF3B30' : c.status === 'pending' ? '#FFB020' : '#2ECC71'} />
                  <AppText variant="body" weight="medium" style={{ color: G.fg, flex: 1, marginLeft: 8 }} numberOfLines={1}>
                    {c.name || c.deviceId.slice(0, 8)}
                  </AppText>
                  <AppText variant="micro" style={{ color: G.muted }}>
                    {c.status === 'pending' ? 'Awaiting approval' : c.status === 'revoked' ? 'Revoked' : 'Active'}
                    {c.lastSeen ? ` · ${new Date(c.lastSeen).toLocaleTimeString()}` : ''}
                  </AppText>
                </View>
              ))
            )}
          </View>

          <AppText variant="micro" style={{ color: G.muted, textAlign: 'center', paddingVertical: 12 }}>
            Devices paired here sync directly with this phone over your local network — no internet needed.
          </AppText>
        </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { width: 36, alignItems: 'center' },
  body: { padding: 20, paddingBottom: 40 },
  card: { borderRadius: 24, borderWidth: 1, padding: 18, marginBottom: 12 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  chipBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1 },
  qrWrap: { alignItems: 'center', paddingVertical: 14 },
  codeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12,
  },
  clientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
});

export default PosHubScreen;
