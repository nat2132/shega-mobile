/**
 * ConnectedDevicesScreen — the mobile mirror of the desktop Connected Devices
 * panel. Shows every paired Shega device (Mobile or Desktop) with live sync
 * state, connection type, last sync, pending changes; supports pairing via QR
 * / pairing code, rename, revoke, and a per-device detail view.
 *
 * Works for Mobile ↔ Mobile and Mobile ↔ Desktop alike — no hub assumption.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Image, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  MonitorSmartphone, Smartphone, Monitor, Plus,
  ShieldOff, Pencil, Check, X, ChevronLeft, RefreshCw, Clock, ChevronRight,
} from 'lucide-react-native';
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
import { preassignJoinIdentity } from '@/services/mobileSyncServer';
import { RadarPulse } from '@/components/RadarPulse';
import MemberApprovalModal, { type MemberApprovalConfig } from '@/components/MemberApprovalModal';

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

interface DeviceRow {
  deviceId: string;
  deviceType: string;
  kind: string;
  online: boolean;
  name?: string;
  model?: string;
  connectedAt: number;
  lastSyncAt: number | null;
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
    setDevices(mobileP2pSync.getDevices() as DeviceRow[]);
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

  const deviceState = (d: DeviceRow): string => (!d.online ? 'offline' : 'synced');

  const renderRow = (d: DeviceRow) => {
    const st = deviceState(d);
    const Icon = d.deviceType === 'desktop' ? Monitor : Smartphone;
    return (
      <TouchableOpacity
        key={d.deviceId}
        style={[styles.row, { backgroundColor: G.bgCard, borderColor: d.online ? G.border : G.border, opacity: d.online ? 1 : 0.65 }]}
        onPress={() => setDetail(d)}
      >
        <View style={[styles.rowIcon, { backgroundColor: d.online ? G.accentGlass : G.mutedLight }]}>
          <Icon size={17} color={d.online ? G.accent : G.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
            {d.name || (d.deviceType === 'desktop' ? 'Shega Desktop' : 'Shega Mobile')}
          </AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
            {d.deviceType === 'desktop' ? 'Desktop' : 'Mobile'} · {d.online ? (d.kind === 'lan' ? 'LAN' : 'P2P') : `Last seen ${lastSyncLabel(d.connectedAt || null)}`}
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
          label="Add Team / Device"
          variant="primary"
          fullWidth
          leftIcon={<Plus size={17} color={G.bg} />}
          onPress={() => { Haptics.selectionAsync(); setPairOpen(true); }}
          style={{ marginTop: 18 }}
        />

        <AppText variant="micro" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 }}>
          Devices sync directly over Wi-Fi/P2P — no cloud needed. Business data stays isolated per business.
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
                  ['Status', STATE_LABEL[deviceState(detail)]],
                  ['Connection', detail.online ? (detail.kind === 'lan' ? 'LAN' : 'Direct P2P') : '—'],
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
            <AppText variant="heading" weight="bold" style={{ color: G.fg }}>Unpair "{confirmUnpair?.name || confirmUnpair?.model || 'this device'}"?</AppText>
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

/**
 * Pairing card — discovery radar, no QR and no pairing code.
 *
 * Opens the business's invitation as a live beacon, then shows every nearby
 * device that is waiting to join ("Team"). Selecting one opens the member
 * setup, and the request is approved with the assigned identity the moment
 * that device connects.
 */
function PairCard({ businessName, businessId, counts, onClose, G }: {
  businessName: string;
  businessId: string;
  counts: Record<string, number>;
  onClose: () => void;
  G: any;
}) {
  const [invite, setInvite] = useState<{ code: string; id: string; expiresAt?: string } | null>(null);
  const [peers, setPeers] = useState<Array<{ id: string; name: string; platform?: string }>>([]);
  const [setupFor, setSetupFor] = useState<{ deviceId: string; name: string } | null>(null);
  const [selfName] = useState(getThisDeviceName());
  const { showToast } = useToast();

  const generate = async () => {
    try {
      // Offline-first: generate the invitation locally (no cloud dependency),
      // then advertise a pairing beacon so nearby devices discover us.
      const inv = generateInvitation({ businessId, role: 'cashier', platform: 'mobile' });
      mobilePairingBeacon.advertiseInvitation({ id: inv.id, code: inv.code, businessId, role: 'cashier', expiresAt: inv.expiresAt });
      if (wsSyncClient.isConnected) {
        wsSyncClient.publishInvitation({ id: inv.id, businessId, code: inv.code, role: 'cashier', platform: 'mobile', expiresAt: inv.expiresAt }).catch(() => {});
      }
      setInvite({ code: inv.code, id: inv.id, expiresAt: inv.expiresAt });
    } catch (e: any) {
      showToast(e?.message || 'Could not start discovery.', 'error');
    }
  };

  React.useEffect(() => { void generate(); }, []);

  // Live discovery of devices waiting to join — refreshed without a button.
  React.useEffect(() => {
    const refresh = () => {
      try {
        const list = mobilePairingBeacon
          .getNearbyOwners()
          .filter(({ beacon }: any) => beacon.role === 'team')
          .map(({ beacon }: any) => ({
            id: beacon.owner?.deviceId || beacon.businessId,
            name: beacon.owner?.deviceName || 'Nearby device',
            platform: beacon.owner?.platform,
          }));
        setPeers(list);
      } catch { setPeers([]); }
    };
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  const confirmMember = async (cfg: MemberApprovalConfig) => {
    const target = setupFor;
    if (!target) return;
    // One confirmation: the request from this device is approved with the
    // assigned identity the instant it arrives.
    preassignJoinIdentity(target.deviceId, {
      name: cfg.name,
      avatar: cfg.avatar,
      role: cfg.role,
      permissions: cfg.permissions,
    });
    if (invite) {
      mobilePairingBeacon.advertiseInvitation({ id: invite.id, code: invite.code, businessId, role: cfg.role, expiresAt: invite.expiresAt });
      if (wsSyncClient.isConnected) {
        wsSyncClient.publishInvitation({ id: invite.id, businessId, code: invite.code, role: cfg.role, platform: 'mobile', expiresAt: invite.expiresAt }).catch(() => {});
      }
    }
    showToast(`${cfg.name} joins as ${cfg.role} as soon as their device connects.`, 'success');
    setSetupFor(null);
  };

  return (
    <TouchableOpacity activeOpacity={1} style={[styles.detailCard, { backgroundColor: G.bgCard }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1 }}>Add Team / Device</AppText>
        <TouchableOpacity onPress={onClose}><X size={16} color={G.muted} /></TouchableOpacity>
      </View>

      <RadarPulse
        glass={G}
        compact
        deviceName={selfName}
        tone={peers.length > 0 ? 'found' : 'searching'}
        status={peers.length > 0 ? `${peers.length} device${peers.length === 1 ? '' : 's'} found` : 'Searching for nearby devices…'}
        peers={peers.map((p) => ({
          id: p.id,
          name: p.name,
          platform: p.platform,
          detail: `Waiting to join · tap to set up`,
        }))}
        onPickPeer={(p) => setSetupFor({ deviceId: p.id, name: p.name })}
        emptyHint={`Ask your teammate to open Shega → Join a Business. Devices on this Wi-Fi appear here for ${businessName}.`}
      />

      {Object.keys(counts).length > 0 && (
        <AppText variant="micro" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 14 }}>
          After approval: {Object.entries(counts).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(' · ')} will sync to the new device.
        </AppText>
      )}

      {setupFor && (
        <MemberApprovalModal
          glass={G}
          request={{ joinerUser: setupFor.name, joinerName: setupFor.name, platform: 'mobile' }}
          onClose={() => setSetupFor(null)}
          onConfirm={(cfg) => void confirmMember(cfg)}
        />
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, borderRadius: 20, borderWidth: 1, padding: 20 },
});
