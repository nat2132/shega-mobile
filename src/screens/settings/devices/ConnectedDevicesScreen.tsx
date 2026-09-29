/**
 * ConnectedDevicesScreen — the mobile mirror of the desktop Connected Devices
 * panel. Shows every paired Shega device (Mobile or Desktop) with live sync
 * state, connection type, last sync, pending changes; supports pairing via QR
 * / pairing code, rename, revoke, and a per-device detail view.
 *
 * Works for Mobile ↔ Mobile and Mobile ↔ Desktop alike — no hub assumption.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  MonitorSmartphone, Monitor, Plus,
  ShieldOff, Pencil, Check, X, ChevronLeft, RefreshCw, Clock, ChevronRight, Copy,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { AppText, AppButton } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
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
import { getDeviceId, getDeviceStatusList } from '@/services/syncService';
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
  const { t, colors } = useSettings();
  const G = getSettingsGlass(colors);
  const { showToast } = useToast();
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pairOpen, setPairOpen] = useState(false);
  const [detail, setDetail] = useState<DeviceRow | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const businessName = getActiveBusiness()?.name || 'this business';

  const load = useCallback(() => {
    // Live WebRTC peers + the synced roster (paired devices with presence,
    // joined to the users table for name/role) — one merged list, so the owner
    // sees every connected, offline and pending device with how it connects.
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
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const discover = () => {
    Haptics.selectionAsync();
    mobileP2pSync.announce();
    companionService.refreshConnection();
    showToast('Searching for nearby Shega devices on this network…', 'info');
    setTimeout(load, 1500);
  };

  const [confirmUnpair, setConfirmUnpair] = useState<DeviceRow | null>(null);

  const revoke = (deviceId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    mobileP2pSync.revokeDevice(deviceId);
    showToast('Device unpaired — it must be paired again before it can sync.', 'success');
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
        <View style={[styles.rowIcon, { backgroundColor: d.online ? (who ? G.accentGlass : G.accentGlass) : G.mutedLight }]}>
          {who ? (
            <AppText variant="body" weight="bold" style={{ color: d.online ? G.accent : G.muted, fontSize: 12 }}>
              {initials(who)}
            </AppText>
          ) : (
            <Monitor size={17} color={d.online ? G.accent : G.muted} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
            {d.name || (d.deviceType === 'desktop' ? 'Shega Desktop' : 'Shega Mobile')}
          </AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
            {who ? `${who} — ` : ''}
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

  const online = devices.filter((d) => d.online);
  const offline = devices.filter((d) => !d.online);

  return (
    <View style={styles.flex}>
      <TouchableOpacity onPress={onBack} style={styles.backBar}>
        <ChevronLeft size={22} color={G.fg} />
        <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1 }}>Connected Devices</AppText>
        <TouchableOpacity onPress={discover} style={styles.findBtn}>
          <RefreshCw size={15} color={G.fg} />
        </TouchableOpacity>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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

        {devices.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <MonitorSmartphone size={28} color={G.muted} />
            <AppText variant="body" weight="bold" style={{ color: G.fg, marginTop: 10 }}>No devices yet</AppText>
            <AppText variant="caption" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 4 }}>
              Connect another phone or desktop to sync products, sales, inventory and more — directly, device to device.
            </AppText>
          </View>
        ) : (
          <>
            {online.length > 0 && (
              <>
                <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginBottom: 8 }}>Connected</AppText>
                {online.map(renderRow)}
              </>
            )}
            {offline.length > 0 && (
              <>
                <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginBottom: 8, marginTop: 16 }}>Offline</AppText>
                {offline.map(renderRow)}
              </>
            )}
          </>
        )}

        <AppButton
          label="Add Device"
          variant="primary"
          fullWidth
          leftIcon={<Plus size={17} color={G.bg} />}
          onPress={() => { Haptics.selectionAsync(); setPairOpen(true); }}
          style={{ marginTop: 18 }}
        />

        <AppText variant="micro" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 }}>
          Devices sync business data directly over Wi-Fi/P2P — no cloud needed. Each device keeps its own local
          users and sign-in; connecting a device never creates or copies an account.
        </AppText>
      </ScrollView>

      {/* Pair modal */}
      <Modal visible={pairOpen} transparent animationType="fade" onRequestClose={() => setPairOpen(false)}>
        <View style={styles.modalOverlay}>
          <PairCard businessName={businessName} businessId={getActiveBusiness()?.id || ''} counts={counts} onClose={() => { mobilePairingBeacon.stopPublishing(); setPairOpen(false); load(); }} G={G} />
        </View>
      </Modal>

      {/* Detail modal */}
      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetail(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.detailCard, { backgroundColor: G.bgCard }]}>
            {detail && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1 }}>
                    {detail.name || (detail.deviceType === 'desktop' ? 'Shega Desktop' : 'Shega Mobile')}
                  </AppText>
                  <TouchableOpacity onPress={() => setRenaming({ id: detail.deviceId, value: detail.name || '' })} style={{ marginRight: 8 }}>
                    <Pencil size={15} color={G.fg} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDetail(null)}>
                    <X size={16} color={G.muted} />
                  </TouchableOpacity>
                </View>
                {[
                  ['Type', detail.deviceType === 'desktop' ? 'Desktop' : 'Mobile'],
                  ['User', detail.userName || '—'],
                  ['Status', STATE_LABEL[deviceState(detail)]],
                  ['Connection', detail.online ? (METHOD_LABEL[detail.method ?? 'lan'] ?? 'Connected via LAN') : '—'],
                  ['Last seen', lastSyncLabel((detail.lastSeenAt ?? detail.connectedAt) || null)],
                  ['Last sync', lastSyncLabel(detail.lastSyncAt)],
                  ['Device ID', detail.deviceId],
                ].map(([k, v]) => (
                  <View key={k} style={styles.detailRow}>
                    <AppText variant="caption" weight="medium" style={{ color: G.muted }}>{k}</AppText>
                    <AppText variant="caption" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{v}</AppText>
                  </View>
                ))}
                <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginTop: 14, marginBottom: 6 }}>
                  Business data
                </AppText>
                <View style={styles.countGrid}>
                  {Object.entries(counts).slice(0, 9).map(([label, n]) => (
                    <View key={label} style={[styles.countTile, { backgroundColor: G.bg, borderColor: G.border }]}>
                      <AppText variant="body" weight="bold" style={{ color: G.fg }}>{n.toLocaleString()}</AppText>
                      <AppText variant="micro" weight="bold" style={{ color: G.muted }}>{label}</AppText>
                    </View>
                  ))}
                </View>
                <AppButton
                  label="Unpair Device"
                  variant="danger"
                  fullWidth
                  leftIcon={<ShieldOff size={15} color="#fff" />}
                  onPress={() => setConfirmUnpair(detail)}
                  style={{ marginTop: 16 }}
                />
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Unpair confirmation */}
      <Modal visible={!!confirmUnpair} transparent animationType="fade" onRequestClose={() => setConfirmUnpair(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setConfirmUnpair(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppText variant="heading" weight="bold" style={{ color: G.fg }}>Unpair &quot;{confirmUnpair?.name || confirmUnpair?.model || 'this device'}&quot;?</AppText>
            <AppText variant="caption" style={{ color: G.muted, marginTop: 8 }}>
              It will immediately stop syncing and lose access to {businessName}. Business data is kept on your remaining devices. The device must be paired and approved again before it can sync.
            </AppText>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <View style={{ flex: 1 }}>
                <AppButton label="Cancel" variant="ghost" fullWidth onPress={() => setConfirmUnpair(null)} />
              </View>
              <View style={{ flex: 1 }}>
                <AppButton label="Unpair" variant="danger" fullWidth leftIcon={<ShieldOff size={15} color="#fff" />} onPress={() => confirmUnpair && revoke(confirmUnpair.deviceId)} />
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/** One discovered device as rendered on the Add-Team radar. */
type PairPeer = { id: string; name: string; platform?: string; hasInvite?: boolean; host?: string };

/**
 * Identity check for the radar's peer list. Discovery notifications arrive far
 * more often than the visible set actually changes (one per resolved service,
 * per UDP reply, and once per hit on every LAN sweep pass), so this is what
 * keeps the card from re-rendering — and re-fading — for nothing.
 */
function samePeers(a: PairPeer[], b: PairPeer[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id || a[i].name !== b[i].name || a[i].hasInvite !== b[i].hasInvite) return false;
  }
  return true;
}

/**
 * Pairing card — invitation code + QR first, discovery radar second.
 *
 * Opens the business's invitation as a live beacon, shows the invite code and
 * its QR so the other device can scan it, type it, or simply be discovered
 * here (which also covers a network that blocks mDNS / broadcast). Selecting a
 * nearby device connects it for business-data sync — no role, no user and no
 * member row is created on either side.
 */
function PairCard({ businessName, businessId, counts, onClose, G }: {
  businessName: string;
  businessId: string;
  counts: Record<string, number>;
  onClose: () => void;
  G: any;
}) {
  const [invite, setInvite] = useState<{ code: string; id: string; qrUri: string; expiresAt: string } | null>(null);
  const [peers, setPeers] = useState<PairPeer[]>([]);
  const [peerPhase, setPeerPhase] = useState<Record<string, 'idle' | 'approving' | 'waiting'>>({});
  const [selfName] = useState(getThisDeviceName());
  const [now, setNow] = useState(Date.now());
  const { showToast } = useToast();

  const generate = async () => {
    try {
      // Offline-first: generate the invitation locally (no cloud dependency),
      // then advertise a pairing beacon so nearby devices discover us.
      // Device-only invitation: it carries no role and authorises no user. The
      // other device joins for BUSINESS-DATA sync and keeps its own local
      // accounts, sign-in and PIN.
      const inv = generateInvitation({ businessId, platform: 'mobile' });
      mobilePairingBeacon.advertiseInvitation({ id: inv.id, code: inv.code, businessId, expiresAt: inv.expiresAt });
      if (wsSyncClient.isConnected) {
        wsSyncClient.publishInvitation({ id: inv.id, businessId, code: inv.code, platform: 'mobile', expiresAt: inv.expiresAt }).catch(() => {});
      }
      setInvite({ code: inv.code, id: inv.id, qrUri: inv.qrUri, expiresAt: inv.expiresAt });
    } catch (e: any) {
      showToast(e?.message || 'Could not start discovery.', 'error');
    }
  };

  React.useEffect(() => { void generate(); }, []);

  // Keep the expiry countdown fresh without any extra polling machinery — the
  // discovery refresh below already re-renders this card every few seconds.
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  // Discovery must be ACTIVE on the owner side too, not just publish-only.
  // Without it the mDNS scan and the LAN sweep — which populate
  // getNearbyOwners() — stay dormant, so nearby joiners never appear on the
  // radar even though the joiner has been in Join Business the whole time.
  // The owner also runs the 5759 join channel during pairing so a discovered
  // joiner can resolve + submit the invite over TCP with no cloud dependency.
  const ownServerRef = useRef(false);
  React.useEffect(() => {
    try {
      mobilePairingBeacon.startBrowsing();
      const bName = businessName || 'Shega';
      mobilePairingBeacon.setDiscoverable(true, bName, 'owner');
    } catch { /* native mDNS missing — LAN sweep still runs */ }
    if (!isMobileSyncServerRunning()) {
      ownServerRef.current = true;
      void startMobileSyncServer();
    }
    return () => {
      try { mobilePairingBeacon.stopBrowsing(); } catch { /* ignore */ }
      try { mobilePairingBeacon.setDiscoverable(false); } catch { /* ignore */ }
      if (ownServerRef.current) {
        try { stopMobileSyncServer(); } catch { /* ignore */ }
      }
    };
  }, [businessName]);

  // Live discovery of devices that are visible on this network — refreshed
  // without a button. The owner sees every nearby device that has turned itself
  // discoverable (join-mode phones, other owner devices in pairing mode,
  // desktops in join mode). Discovery is mutual: the moment THIS owner opens an
  // invite for their business, those devices can see THIS device too.
  //
  // What makes a device joinable is not beacon.role (that is the device's own
  // self-description and can say 'owner' even for a joiner's phone — because the
  // phone is the owner of its own app session). What makes a join possible is:
  //   1) the device is visible now (it is in discovery / join mode),
  //   2) THIS owner has an open invite for their business, and
  //   3) the owner taps it to connect it.
  //
  // So we list every visible nearby device; tapping one pairs the DEVICE for
  // business-data sync. No code entry, no role selection, no user created.
  React.useEffect(() => {
    const refresh = () => {
      try {
        const list = mobilePairingBeacon
          .getNearbyOwners()
          // The LAN sweep knocks on our own port too — never list this phone.
          .filter(({ beacon }: any) => beacon?.owner?.deviceId && beacon.owner.deviceId !== getDeviceId())
          // Every visible device is a potential team target for the owner.
          // Do not gate on beacon.role — a joiner's phone reports 'owner' in
          // its own discovery beacon (it is the owner of its own session).
          .map(({ beacon, host }: any): PairPeer => ({
            id: beacon.owner?.deviceId || beacon.businessId,
            name: beacon.owner?.deviceName || 'Nearby device',
            platform: beacon.owner?.platform,
            hasInvite: !!beacon.code,
            host,
          }))
          // Stable order so a peer flipping between two transports (mDNS vs
          // LAN sweep) cannot reshuffle the list under the user's finger.
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        // onFound fires once per peer (and the LAN sweep re-broadcasts every
        // hit on each pass), so only commit when the visible set really
        // changed — otherwise the card re-renders dozens of times per sweep.
        setPeers((prev) => (samePeers(prev, list) ? prev : list));
      } catch { setPeers([]); }
    };
    refresh();
    // Event-driven: a device that IS found must appear immediately. Polling
    // alone left the radar on "Searching for nearby devices…" for a full tick
    // after every hit, and — because onFound was never subscribed here at all
    // — a hit could sit invisible for as long as the poll took to observe it.
    const unsubscribe = mobilePairingBeacon.onFound(refresh);
    // The poll stays as a backstop: it is what drops entries whose beacon has
    // expired, and it picks up peers that were already cached before we
    // subscribed.
    const t = setInterval(refresh, 3000);
    return () => {
      unsubscribe();
      clearInterval(t);
    };
  }, []);

  /**
   * Pairs one nearby device for business-data sync.
   *
   * There is deliberately nothing to configure: no role, no permissions, no
   * member row. Each device keeps its own local users, sign-in and PIN, and
   * only business data (products, sales, inventory, customers, suppliers,
   * debts, stock movements) is exchanged once the two are connected.
   */
  const pairDevice = (peer: PairPeer) => {
    Haptics.selectionAsync();
    setPeerPhase((x) => ({ ...x, [peer.id]: 'approving' }));
    preassignJoinIdentity(peer.id, { name: peer.name || 'Shega Device' });
    if (invite) {
      mobilePairingBeacon.advertiseInvitation({ id: invite.id, code: invite.code, businessId, expiresAt: invite.expiresAt });
      if (wsSyncClient.isConnected) {
        wsSyncClient.publishInvitation({ id: invite.id, businessId, code: invite.code, platform: 'mobile', expiresAt: invite.expiresAt }).catch(() => {});
      }
    }
    showToast(`${peer.name || 'Device'} will start syncing business data as soon as it connects.`, 'success');
    setPeerPhase((x) => ({ ...x, [peer.id]: 'waiting' }));
  };

  const peerDetail = (p: PairPeer): string => {
    switch (peerPhase[p.id]) {
      case 'approving': return `Connecting ${p.name}…`;
      case 'waiting': return 'Connected — waiting for it to come online…';
      default: return `${p.platform === 'desktop' ? 'Desktop' : 'Mobile'}${p.hasInvite ? ' · Ready to connect' : ' · Listening'} · tap to connect`;
    }
  };

  const phasePending = Object.values(peerPhase).some((s) => s === 'approving' || s === 'waiting');
  const radarTone = (Object.values(peerPhase).some((s) => s === 'approving') ? 'connecting'
    : Object.values(peerPhase).some((s) => s === 'waiting') ? 'connected'
      : peers.length > 0 ? 'found' : 'searching') as any;
  const radarStatus = (Object.values(peerPhase).some((s) => s === 'approving') ? 'Connecting device…'
    : Object.values(peerPhase).some((s) => s === 'waiting') ? 'Connected — waiting for its next sync'
      : peers.length > 0 ? `${peers.length} device${peers.length === 1 ? '' : 's'} found`
        : 'Searching for nearby devices…');

  return (
    <TouchableOpacity activeOpacity={1} style={[styles.detailCard, { backgroundColor: G.bgCard }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1 }}>Add Device</AppText>
        <TouchableOpacity onPress={onClose}><X size={16} color={G.muted} /></TouchableOpacity>
      </View>

      {invite && (
        <View style={{ marginBottom: 16 }}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, textAlign: 'center', marginBottom: 8 }}>
            Invitation code — share it or scan the QR
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <View style={[styles.codeChip, { backgroundColor: G.bg, borderColor: G.border }]}>
              <AppText variant="title" weight="bold" style={{ color: G.fg, letterSpacing: 5, fontSize: 20 }}>{invite.code}</AppText>
            </View>
            <TouchableOpacity
              onPress={async () => {
                try {
                  const Clipboard = await import('expo-clipboard');
                  await Clipboard.setStringAsync(invite.code);
                  showToast('Code copied', 'success');
                } catch { /* clipboard unavailable */ }
              }}
              style={[styles.copyBtn, { backgroundColor: G.accentGlass, borderColor: G.border }]}
            >
              <Copy size={16} color={G.fg} />
            </TouchableOpacity>
          </View>
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <View style={[styles.qrFrame, { backgroundColor: '#FFFFFF', borderColor: G.border }]}>
              <QRCode value={invite.qrUri} size={168} />
            </View>
          </View>
          <AppText variant="micro" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 8 }}>
            On the other device: Settings → Connected Devices → Add Device, then scan this QR or enter {invite.code}.
            Valid {Math.max(0, Math.round((new Date(invite.expiresAt).getTime() - now) / 60000))} more min.
          </AppText>
        </View>
      )}

      <RadarPulse
        glass={G}
        compact
        deviceName={selfName}
        tone={radarTone}
        status={radarStatus}
        peers={peers.map((p) => ({
          id: p.id,
          name: p.name,
          platform: p.platform,
          detail: peerDetail(p),
          disabled: peerPhase[p.id] === 'approving' || peerPhase[p.id] === 'waiting' || phasePending,
        }))}
        onPickPeer={(p) => pairDevice(p)}
        emptyHint={`On the other device open Shega → Settings → Connected Devices → Add Device. Devices on this Wi-Fi appear here for ${businessName}.`}
      />

      {Object.keys(counts).length > 0 && (
        <AppText variant="micro" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 14 }}>
          Once connected: {Object.entries(counts).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(' · ')} syncs to the new device.
        </AppText>
      )}

    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  findBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(128,128,128,0.12)' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1,
    padding: 13, marginBottom: 8, gap: 10,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stateCol: { alignItems: 'center', gap: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  syncCol: { alignItems: 'center', gap: 2 },
  empty: {
    borderRadius: 20, borderWidth: 1, padding: 28, alignItems: 'center', marginTop: 8,
  },
  renameCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 10,
  },
  renameInput: {
    flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12,
    fontSize: 14, fontWeight: '600',
  },
  renameSave: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  detailCard: { width: '100%', maxWidth: 380, borderRadius: 22, padding: 20 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)', paddingVertical: 7,
  },
  countGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  countTile: { width: '31%', borderRadius: 10, borderWidth: 1, padding: 8, alignItems: 'center' },
  qrFrame: { borderRadius: 16, padding: 12, alignItems: 'center', justifyContent: 'center', width: 194, height: 194 },
  codeChip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  copyBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, borderRadius: 20, borderWidth: 1, padding: 20 },
});
