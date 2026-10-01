/**
 * ConnectedDevicesScreen — Consolidated Connected Devices panel for Shega Mobile.
 *
 * Shows:
 * 1. Connection / Sync Status banner (Live status, auto-sync active)
 * 2. Primary Actions: "Scan QR Code", "Enter Pairing Code", "My QR Code"
 * 3. Connected Devices (online peers/desktops with live status, mode, last sync)
 * 4. Disconnected / Previously Connected Devices (offline devices with last seen)
 * 5. Device options: Rename, Device details, Unpair.
 *
 * Devices sync business data directly device-to-device automatically in the background.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Clipboard from 'expo-clipboard';
import {
  Monitor,
  Smartphone,
  ShieldOff,
  Pencil,
  Check,
  X,
  ChevronLeft,
  RefreshCw,
  Clock,
  ChevronRight,
  Copy,
  QrCode,
  KeyRound,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  Radio,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText, AppButton } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { useSync } from '@/context/SyncContext';
import { getSettingsGlass } from '../glass-settings';
import { mobileP2pSync } from '@/services/p2p-sync-manager';
import { companionService } from '@/services/companionService';
import { wsSyncClient } from '@/services/wsSyncClient';
import { getActiveBusiness } from '@/services/businessService';
import { generateInvitation } from '@/services/invitationService';
import { mobilePairingBeacon, getThisDeviceName } from '@/services/mobilePairingBeacon';
import {
  preassignJoinIdentity,
  startMobileSyncServer,
  stopMobileSyncServer,
  isMobileSyncServerRunning,
} from '@/services/mobileSyncServer';
import {
  getDeviceId,
  getDeviceStatusList,
  getHubUrl,
  getHubToken,
  setHubUrl,
  setHubToken,
  pairDevice,
} from '@/services/syncService';
import QrPairScanner from '@/components/QrPairScanner';
import { parsePairingData } from '@/services/pairingParser';
import { RadarPulse } from '@/components/RadarPulse';

const METHOD_LABEL: Record<string, string> = {
  lan: 'Connected via LAN',
  p2p: 'Peer-to-Peer',
  relay: 'TURN relay',
  cloud: 'Cloud',
  offline: 'Offline',
};

type DeviceMethod = 'lan' | 'p2p' | 'relay' | 'cloud' | 'offline';
type DeviceStatusT = 'connected' | 'connecting' | 'offline' | 'reconnecting';

const STATE_DOT: Record<string, string> = {
  synced: '#2ECC71',
  syncing: '#3498DB',
  waiting: '#FFB020',
  pending: '#FF8C42',
  error: '#FF3B30',
  offline: '#9AA0A6',
};

const STATE_LABEL: Record<string, string> = {
  synced: 'Synced',
  syncing: 'Syncing…',
  waiting: 'Waiting for device',
  pending: 'Changes pending',
  error: 'Sync failed',
  offline: 'Offline',
};

function lastSyncLabel(ts: number | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  if (diff < 45_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(ts).toLocaleDateString();
}

function initials(name?: string | null): string {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

interface DeviceRow {
  deviceId: string;
  deviceType: string;
  kind: string;
  method?: DeviceMethod;
  online: boolean;
  status?: DeviceStatusT;
  name?: string;
  model?: string | null;
  userName?: string | null;
  connectedAt: number;
  lastSyncAt: number | null;
  lastSeenAt?: number | null;
}

export function ConnectedDevicesScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useSettings();
  const G = getSettingsGlass(colors);
  const { showToast } = useToast();
  const { status: syncCtxStatus, busy: syncBusy, runSync } = useSync();

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [enterCodeOpen, setEnterCodeOpen] = useState(false);
  const [myQrOpen, setMyQrOpen] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [connectingCode, setConnectingCode] = useState(false);
  const [detail, setDetail] = useState<DeviceRow | null>(null);
  const [confirmUnpair, setConfirmUnpair] = useState<DeviceRow | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const businessName = getActiveBusiness()?.name || 'this business';

  const load = useCallback(() => {
    const live = (mobileP2pSync.getDevices() || []) as Array<any>;
    const byId = new Map<string, DeviceRow>();
    for (const p of live) {
      const kind = p.kind || 'p2p-direct';
      byId.set(p.deviceId, {
        deviceId: p.deviceId,
        deviceType: p.deviceType === 'desktop' ? 'desktop' : 'mobile',
        kind,
        method: kind === 'relay' ? 'relay' : kind === 'p2p-direct' ? 'p2p' : 'lan',
        connectedAt: p.connectedAt || Date.now(),
        lastSyncAt: p.lastSyncAt ?? null,
        lastSeenAt: Date.now(),
        online: true,
        status: 'connected',
      });
    }
    try {
      const roster = getDeviceStatusList();
      for (const d of roster) {
        const existing = byId.get(d.device_id);
        const isOnline = !!existing || d.is_self || d.status === 'online';
        if (existing) {
          byId.set(d.device_id, {
            ...existing,
            name: existing.name ?? d.name,
            model: existing.model ?? d.model ?? null,
            userName: d.userName ?? null,
          });
        } else {
          const seenTs = d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0;
          byId.set(d.device_id, {
            deviceId: d.device_id,
            deviceType: d.platform === 'desktop' ? 'desktop' : 'mobile',
            kind: 'lan',
            method: isOnline ? 'lan' : 'offline',
            connectedAt: seenTs || 0,
            lastSyncAt: d.last_sync_at ? new Date(d.last_sync_at).getTime() : null,
            lastSeenAt: seenTs || null,
            online: isOnline,
            status: isOnline ? 'connected' : d.status === 'unknown' ? 'offline' : 'reconnecting',
            name: d.name ?? d.device_id.slice(0, 8),
            model: d.model ?? null,
            userName: d.userName ?? null,
          });
        }
      }
    } catch { /* roster unavailable yet */ }
    setDevices([...byId.values()]);
    setCounts(mobileP2pSync.getRecordCounts());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  const refreshSync = () => {
    Haptics.selectionAsync();
    mobileP2pSync.announce();
    companionService.refreshConnection();
    runSync();
    showToast('Refreshing device connection & syncing…', 'info');
    setTimeout(load, 1200);
  };

  const handleManualPair = async () => {
    const trimmed = manualInput.trim();
    if (!trimmed) {
      showToast('Enter a pairing code or token', 'error');
      return;
    }

    setConnectingCode(true);
    try {
      const parsed = parsePairingData(trimmed);
      if (!parsed.valid) {
        showToast('Invalid pairing code or format', 'error');
        setConnectingCode(false);
        return;
      }

      if (parsed.url) {
        setHubUrl(parsed.url);
        if (parsed.token) setHubToken(parsed.token);
        try {
          await pairDevice();
        } catch { /* best effort */ }
        runSync();
        setEnterCodeOpen(false);
        setManualInput('');
        showToast('Device connected! Synchronization started automatically.', 'success');
      } else if (parsed.code) {
        if (parsed.token) setHubToken(parsed.code);
        try {
          const { lookupPairingInvite, acceptPairing } = await import('@/services/pairingService');
          const inv = await lookupPairingInvite({ code: parsed.code });
          if (inv) {
            await acceptPairing({ inviteId: inv.id, personName: 'Shega Mobile' });
            showToast('Pairing request submitted! Synchronization started automatically.', 'success');
          } else {
            showToast(`Pairing code set: ${parsed.code}`, 'success');
          }
        } catch {
          showToast(`Pairing code saved: ${parsed.code}`, 'success');
        }
        runSync();
        setEnterCodeOpen(false);
        setManualInput('');
      }
    } catch (e: any) {
      showToast(e?.message || 'Could not connect device', 'error');
    } finally {
      setConnectingCode(false);
      load();
    }
  };

  const revoke = (deviceId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    mobileP2pSync.revokeDevice(deviceId);
    showToast('Device unpaired', 'success');
    setDetail(null);
    setConfirmUnpair(null);
    load();
  };

  const rename = () => {
    if (!renaming?.value.trim()) return;
    setBusy(true);
    const ok = mobileP2pSync.renameDevice(renaming.id, renaming.value.trim());
    setBusy(false);
    showToast(ok ? 'Device renamed.' : 'Rename failed.', ok ? 'success' : 'error');
    setRenaming(null);
    load();
  };

  const deviceState = (d: DeviceRow): string => {
    if (d.status === 'connecting') return 'syncing';
    if (d.status === 'reconnecting') return 'waiting';
    if (!d.online || d.status === 'offline') return 'offline';
    return 'synced';
  };

  const onlineDevices = devices.filter((d) => d.online);
  const offlineDevices = devices.filter((d) => !d.online);

  const renderRow = (d: DeviceRow) => {
    const st = deviceState(d);
    const who = d.userName;
    const method = METHOD_LABEL[d.method ?? (d.online ? 'lan' : 'offline')] ?? 'Connected via LAN';
    return (
      <TouchableOpacity
        key={d.deviceId}
        style={[styles.row, { backgroundColor: G.bgCard, borderColor: G.border, opacity: d.online ? 1 : 0.65 }]}
        onPress={() => setDetail(d)}
      >
        <View style={[styles.rowIcon, { backgroundColor: d.online ? G.accentGlass : G.mutedLight }]}>
          {d.deviceType === 'desktop' ? (
            <Monitor size={17} color={d.online ? G.accent : G.muted} />
          ) : (
            <Smartphone size={17} color={d.online ? G.accent : G.muted} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
            {d.name || (d.deviceType === 'desktop' ? 'Shega Desktop' : 'Shega Mobile')}
          </AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
            {who ? `${who} · ` : ''}
            <AppText variant="caption" weight="bold" style={{ color: d.online ? '#2ECC71' : G.muted }}>
              {d.online ? method : `Last seen ${lastSyncLabel((d.lastSeenAt ?? d.connectedAt) || null)}`}
            </AppText>
          </AppText>
        </View>

        <View style={styles.stateCol}>
          <View style={[styles.dot, { backgroundColor: STATE_DOT[st] }]} />
          <AppText variant="micro" weight="bold" style={{ color: d.online ? G.fg : G.muted }}>
            {STATE_LABEL[st]}
          </AppText>
        </View>

        <View style={styles.syncCol}>
          <Clock size={10} color={G.muted} />
          <AppText variant="micro" weight="bold" style={{ color: G.fg }}>
            {lastSyncLabel(d.lastSyncAt)}
          </AppText>
        </View>

        <ChevronRight size={15} color={G.muted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.flex}>
      {/* Header Bar */}
      <TouchableOpacity onPress={onBack} style={styles.backBar}>
        <ChevronLeft size={22} color={G.fg} />
        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="bold" style={{ color: G.fg }}>Connected Devices</AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.muted }}>Automatic Background Sync</AppText>
        </View>
        <TouchableOpacity onPress={refreshSync} style={styles.findBtn}>
          <RefreshCw size={16} color={G.fg} />
        </TouchableOpacity>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Live Sync / Connection Status Banner */}
        <View style={[styles.statusHero, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <View style={styles.statusHeroRow}>
            <View style={[styles.statusHeroIcon, { backgroundColor: syncBusy ? '#3498DB20' : onlineDevices.length > 0 ? '#2ECC7120' : '#9AA0A620' }]}>
              {syncBusy ? (
                <ActivityIndicator size="small" color="#3498DB" />
              ) : onlineDevices.length > 0 ? (
                <Wifi size={20} color="#2ECC71" />
              ) : (
                <WifiOff size={20} color={G.muted} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="body" weight="bold" style={{ color: G.fg }}>
                {syncBusy ? 'Syncing changes…' : onlineDevices.length > 0 ? 'Connected & Synchronized' : 'No Devices Connected'}
              </AppText>
              <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                {onlineDevices.length > 0
                  ? `${onlineDevices.length} active device${onlineDevices.length === 1 ? '' : 's'} · Background sync on`
                  : 'Pair a device to sync products, sales, and inventory'}
              </AppText>
            </View>
          </View>
        </View>

        {/* Primary Action Buttons: Scan QR Code, Enter Pairing Code, My QR Code */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: G.accent, borderColor: G.accent }]}
            onPress={() => {
              Haptics.selectionAsync();
              setScannerOpen(true);
            }}
          >
            <QrCode size={22} color="#FFFFFF" />
            <AppText variant="body" weight="bold" style={{ color: '#FFFFFF', marginTop: 8 }}>
              Scan QR Code
            </AppText>
            <AppText variant="micro" style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 2 }}>
              Point camera at Desktop QR
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
            onPress={() => {
              Haptics.selectionAsync();
              setEnterCodeOpen(true);
            }}
          >
            <KeyRound size={22} color={G.fg} />
            <AppText variant="body" weight="bold" style={{ color: G.fg, marginTop: 8 }}>
              Enter Code
            </AppText>
            <AppText variant="micro" style={{ color: G.muted, textAlign: 'center', marginTop: 2 }}>
              Type pairing code / token
            </AppText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.myQrBtn, { backgroundColor: G.bgCard, borderColor: G.border }]}
          onPress={() => {
            Haptics.selectionAsync();
            setMyQrOpen(true);
          }}
        >
          <QrCode size={18} color={G.fg} />
          <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1, marginLeft: 10 }}>
            Show My QR / Pairing Code
          </AppText>
          <ChevronRight size={16} color={G.muted} />
        </TouchableOpacity>

        {/* Rename bar if active */}
        {renaming ? (
          <View style={[styles.renameCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <TextInput
              value={renaming.value}
              onChangeText={(v) => setRenaming({ ...renaming, value: v })}
              placeholder="Device name"
              placeholderTextColor={G.muted}
              style={[styles.renameInput, { borderColor: G.border, color: G.fg }]}
              autoFocus
            />
            <TouchableOpacity onPress={rename} disabled={busy} style={[styles.renameSave, { backgroundColor: G.fg }]}>
              <Check size={16} color={G.bg} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRenaming(null)} style={[styles.renameSave, { backgroundColor: G.bgCard, borderWidth: 1, borderColor: G.border }]}>
              <X size={16} color={G.fg} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Devices List */}
        {devices.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <Monitor size={28} color={G.muted} />
            <AppText variant="body" weight="bold" style={{ color: G.fg, marginTop: 10 }}>No connected devices</AppText>
            <AppText variant="caption" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 4 }}>
              Tap &quot;Scan QR Code&quot; to connect to Shega Desktop or another mobile device. Synchronization starts automatically after connecting.
            </AppText>
          </View>
        ) : (
          <>
            {onlineDevices.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginBottom: 8 }}>
                  Connected Devices ({onlineDevices.length})
                </AppText>
                {onlineDevices.map(renderRow)}
              </View>
            )}

            {offlineDevices.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginBottom: 8 }}>
                  Disconnected / Previous Devices ({offlineDevices.length})
                </AppText>
                {offlineDevices.map(renderRow)}
              </View>
            )}
          </>
        )}

        <AppText variant="micro" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 20, paddingHorizontal: 16 }}>
          All paired devices synchronize sales, products, and inventory automatically in the background whenever connected to the same network or cloud.
        </AppText>
      </ScrollView>

      {/* ── QR Scanner Modal ── */}
      <QrPairScanner
        visible={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          load();
        }}
        onPaired={(url, token) => {
          setScannerOpen(false);
          runSync();
          load();
        }}
      />

      {/* ── Enter Pairing Code Modal ── */}
      <Modal visible={enterCodeOpen} transparent animationType="fade" onRequestClose={() => setEnterCodeOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEnterCodeOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.cardModal, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <KeyRound size={20} color={G.fg} style={{ marginRight: 8 }} />
              <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1 }}>Enter Pairing Code</AppText>
              <TouchableOpacity onPress={() => setEnterCodeOpen(false)}>
                <X size={18} color={G.muted} />
              </TouchableOpacity>
            </View>

            <AppText variant="caption" style={{ color: G.muted, marginBottom: 12 }}>
              Enter the 6-character pairing code or token shown on the Shega Desktop or Mobile POS screen.
            </AppText>

            <TextInput
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="e.g. ABCDEF or token / IP"
              placeholderTextColor={G.muted}
              style={[styles.codeInput, { backgroundColor: G.bg, borderColor: G.border, color: G.fg }]}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <AppButton label="Cancel" variant="ghost" fullWidth onPress={() => setEnterCodeOpen(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <AppButton
                  label={connectingCode ? 'Connecting…' : 'Connect'}
                  variant="primary"
                  fullWidth
                  disabled={connectingCode}
                  onPress={handleManualPair}
                />
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Show My QR Code Modal ── */}
      <Modal visible={myQrOpen} transparent animationType="fade" onRequestClose={() => setMyQrOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMyQrOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.cardModal, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <QrCode size={20} color={G.fg} style={{ marginRight: 8 }} />
              <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1 }}>Pairing Code &amp; QR</AppText>
              <TouchableOpacity onPress={() => setMyQrOpen(false)}>
                <X size={18} color={G.muted} />
              </TouchableOpacity>
            </View>

            <PairCard
              businessName={businessName}
              businessId={getActiveBusiness()?.id || ''}
              counts={counts}
              onClose={() => setMyQrOpen(false)}
              G={G}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Device Detail / Unpair Modal ── */}
      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetail(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.cardModal, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            {detail && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1 }}>
                    {detail.name || (detail.deviceType === 'desktop' ? 'Shega Desktop' : 'Shega Mobile')}
                  </AppText>
                  <TouchableOpacity onPress={() => setRenaming({ id: detail.deviceId, value: detail.name || '' })} style={{ marginRight: 10 }}>
                    <Pencil size={16} color={G.fg} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDetail(null)}>
                    <X size={18} color={G.muted} />
                  </TouchableOpacity>
                </View>

                {[
                  ['Type', detail.deviceType === 'desktop' ? 'Desktop' : 'Mobile'],
                  ['User', detail.userName || '—'],
                  ['Status', STATE_LABEL[deviceState(detail)]],
                  ['Connection', detail.online ? (METHOD_LABEL[detail.method ?? 'lan'] ?? 'Connected via LAN') : 'Offline'],
                  ['Last seen', lastSyncLabel((detail.lastSeenAt ?? detail.connectedAt) || null)],
                  ['Last sync', lastSyncLabel(detail.lastSyncAt)],
                  ['Device ID', detail.deviceId],
                ].map(([k, v]) => (
                  <View key={k} style={styles.detailRow}>
                    <AppText variant="caption" weight="medium" style={{ color: G.muted }}>{k}</AppText>
                    <AppText variant="caption" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{v}</AppText>
                  </View>
                ))}

                <AppButton
                  label="Unpair Device"
                  variant="danger"
                  fullWidth
                  leftIcon={<ShieldOff size={15} color="#fff" />}
                  onPress={() => setConfirmUnpair(detail)}
                  style={{ marginTop: 18 }}
                />
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Unpair Confirmation Modal */}
      <Modal visible={!!confirmUnpair} transparent animationType="fade" onRequestClose={() => setConfirmUnpair(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setConfirmUnpair(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.cardModal, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppText variant="heading" weight="bold" style={{ color: G.fg }}>
              Unpair &quot;{confirmUnpair?.name || 'this device'}&quot;?
            </AppText>
            <AppText variant="caption" style={{ color: G.muted, marginTop: 8 }}>
              This device will stop syncing with {businessName}. Business data is preserved on your remaining devices.
            </AppText>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <View style={{ flex: 1 }}>
                <AppButton label="Cancel" variant="ghost" fullWidth onPress={() => setConfirmUnpair(null)} />
              </View>
              <View style={{ flex: 1 }}>
                <AppButton
                  label="Unpair"
                  variant="danger"
                  fullWidth
                  leftIcon={<ShieldOff size={15} color="#fff" />}
                  onPress={() => confirmUnpair && revoke(confirmUnpair.deviceId)}
                />
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/** Inner PairCard component for displaying local QR & code */
function PairCard({ businessName, businessId, counts, onClose, G }: {
  businessName: string;
  businessId: string;
  counts: Record<string, number>;
  onClose: () => void;
  G: any;
}) {
  const [invite, setInvite] = useState<{ code: string; id: string; qrUri: string; expiresAt: string } | null>(null);
  const { showToast } = useToast();

  const generate = async () => {
    try {
      const inv = generateInvitation({ businessId, platform: 'mobile' });
      mobilePairingBeacon.advertiseInvitation({ id: inv.id, code: inv.code, businessId, expiresAt: inv.expiresAt });
      if (wsSyncClient.isConnected) {
        wsSyncClient.publishInvitation({ id: inv.id, businessId, code: inv.code, platform: 'mobile', expiresAt: inv.expiresAt }).catch(() => {});
      }
      setInvite({ code: inv.code, id: inv.id, qrUri: inv.qrUri, expiresAt: inv.expiresAt });
    } catch (e: any) {
      showToast(e?.message || 'Could not generate code.', 'error');
    }
  };

  useEffect(() => {
    void generate();
  }, []);

  return (
    <View style={{ alignItems: 'center' }}>
      {invite ? (
        <>
          <AppText variant="caption" weight="medium" style={{ color: G.muted, textAlign: 'center', marginBottom: 8 }}>
            Scan this QR code from another device or enter the pairing code:
          </AppText>

          <View style={[styles.codeChip, { backgroundColor: G.bg, borderColor: G.border }]}>
            <AppText variant="title" weight="bold" style={{ color: G.fg, letterSpacing: 4, fontSize: 20 }}>
              {invite.code}
            </AppText>
            <TouchableOpacity
              onPress={async () => {
                await Clipboard.setStringAsync(invite.code);
                showToast('Pairing code copied', 'success');
              }}
              style={{ padding: 6 }}
            >
              <Copy size={16} color={G.fg} />
            </TouchableOpacity>
          </View>

          <View style={[styles.qrFrame, { backgroundColor: '#FFFFFF', borderColor: G.border, marginTop: 12 }]}>
            <QRCode value={invite.qrUri} size={160} />
          </View>

          <AppText variant="micro" style={{ color: G.muted, textAlign: 'center', marginTop: 12 }}>
            Valid for device-to-device pairing. Sync will start automatically once connected.
          </AppText>
        </>
      ) : (
        <ActivityIndicator size="small" color={G.fg} style={{ marginVertical: 20 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  findBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(128,128,128,0.12)' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  statusHero: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  statusHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusHeroIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  actionGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    justify: 'center',
  },

  myQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    marginBottom: 8,
    gap: 10,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stateCol: { alignItems: 'center', gap: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  syncCol: { alignItems: 'center', gap: 2 },
  empty: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    marginTop: 8,
  },

  renameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  renameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  renameSave: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cardModal: { width: '100%', maxWidth: 380, borderRadius: 22, padding: 20, borderWidth: 1 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
    paddingVertical: 7,
  },

  codeInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },

  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  qrFrame: { padding: 12, borderRadius: 16, borderWidth: 1 },
});

export default ConnectedDevicesScreen;
