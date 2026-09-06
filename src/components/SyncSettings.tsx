import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View
} from 'react-native';
import { RefreshCw, Wifi, WifiOff, AlertTriangle, QrCode, Globe, Cloud, CloudOff } from 'lucide-react-native';
import QrPairScanner from '@/components/QrPairScanner';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { useSync } from '@/context/SyncContext';
import { AppText } from '@/components/ui';
import { getSettingsGlass } from '@/screens/settings/glass-settings';
import { getHubUrl, getHubToken, setHubUrl, setHubToken, verifyRemote, pairDevice, getConflicts, dismissConflict, resolveConflict, getCloudUrl, setCloudUrl, getCloudEnabled, setCloudEnabled, cloudSyncNow, cloudSelfStatus } from '@/services/syncService';
import { getStoredToken } from '@/services/api';

export default function SyncSettings() {
  const { colors } = useSettings();
  const G = getSettingsGlass(colors);
  const { showToast } = useToast();
  const { status, cloudStatus, busy, lastError, lastResult, enabled, setEnabled, runSync } = useSync();

  const [modalOpen, setModalOpen] = useState(false);
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [cloudUrl, setCloudUrlState] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [cloudResult, setCloudResult] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [qrOpen, setQrOpen] = useState(false);

  const refreshConflicts = () => {
    setConflicts(getConflicts());
  };

  const openModal = () => {
    setUrl(getHubUrl());
    setToken(getHubToken());
    setVerifyResult(null);
    setModalOpen(true);
  };

  const saveAndPair = async (pair: boolean) => {
    setLocalBusy(true);
    try {
      setHubUrl(url);
      if (pair) setHubToken(token);
      if (pair) {
        await pairDevice();
        showToast('Device paired with hub', 'success');
      } else {
        showToast('Hub URL saved', 'success');
      }
      setModalOpen(false);
    } catch (e: any) {
      showToast(pair ? `Pairing failed: ${e?.message || 'error'}` : 'Hub URL saved', pair ? 'error' : 'success');
      if (pair) {
        setVerifyResult(`Pairing failed: ${e?.message || 'error'}`);
      } else {
        setModalOpen(false);
      }
    } finally {
      setLocalBusy(false);
    }
  };

  const doSync = async () => {
    const ok = await runSync();
    showToast(ok ? `Synced (pushed ${lastResult?.pushed ?? 0}, pulled ${lastResult?.pulled ?? 0})` : lastError || 'Sync failed', ok ? 'success' : 'error');
  };

  const doVerify = async () => {
    setLocalBusy(true);
    try {
      const v = await verifyRemote();
      const tables = Object.keys(v?.tables ?? {});
      setVerifyResult(`Hub OK · ${tables.length} tables · seq ${v?.lastSeq ?? '?'}`);
    } catch (e: any) {
      setVerifyResult(`Hub unreachable: ${e?.message || 'error'}`);
    } finally {
      setLocalBusy(false);
    }
  };

  const openCloudModal = () => {
    setCloudUrlState(getCloudUrl());
    setCloudResult(null);
    setCloudModalOpen(true);
  };

  const saveCloudUrlOnly = async () => {
    setCloudBusy(true);
    try {
      setCloudUrl(cloudUrl);
      const t = await getStoredToken();
      if (!t) {
        setCloudResult('No account session — sign in to your Shega account to sync over the cloud.');
      } else {
        setCloudResult('Cloud URL saved. Enable cloud sync to begin.');
      }
      setCloudModalOpen(false);
    } finally {
      setCloudBusy(false);
    }
  };

  const doCloudSync = async () => {
    setCloudBusy(true);
    try {
      const res = await cloudSyncNow();
      setCloudResult(`Cloud synced — pushed ${res.pushed}, pulled ${res.pulled}.`);
      showToast('Cloud sync complete', 'success');
    } catch (e: any) {
      setCloudResult(`Cloud sync failed: ${e?.message || 'error'}`);
      showToast('Cloud sync failed', 'error');
    } finally {
      setCloudBusy(false);
    }
  };

  const checkCloudStatus = async () => {
    try {
      const s = await cloudSelfStatus();
      setCloudResult(s.blocked ? `Status: ${s.status} — this device is blocked remotely.` : `Status: active`);
    } catch (e: any) {
      setCloudResult(`Status check failed: ${e?.message || 'error'}`);
    }
  };

  const online = !!status?.hub;
  const pending = status?.outboxCount ?? 0;
  const cloudOnline = cloudStatus.configured && cloudStatus.hasToken;
  // Connection mode for §13: LAN / Cloud / Both / Offline.
  const connMode = online && cloudOnline ? 'Both' : online ? 'LAN' : cloudOnline ? 'Cloud' : 'Offline';

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.header, { color: G.muted }]} numberOfLines={1}>Sync</AppText>
        <View style={{ flex: 1 }} />
        {online ? <Wifi size={18} color={G.accent} /> : <WifiOff size={18} color={G.muted} />}
      </View>
      <View style={[styles.group, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <Pressable style={styles.row} onPress={openModal}>
          <View style={[styles.iconBox, { backgroundColor: G.accentGlass }]}>
            <Wifi size={18} color={G.fg} strokeWidth={2.5} />
          </View>
          <View style={styles.rowBody}>
            <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>POS Hub</AppText>
            <AppText variant="caption" style={{ color: G.muted }} numberOfLines={1}>
              {status?.hub ? status.hub : 'Not configured — tap to set LAN address'}
            </AppText>
          </View>
          <RefreshCw size={16} color={G.muted} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: G.border }]} />

        <View style={styles.toggleRow}>
          <View style={styles.rowBody}>
            <AppText variant="body" weight="bold" style={{ color: G.fg }}>Auto sync</AppText>
            <AppText variant="caption" style={{ color: G.muted }} numberOfLines={1}>
              Sync after sales and every minute in the foreground
            </AppText>
          </View>
          <Switch
            value={enabled}
            onValueChange={(v) => {
              setEnabled(v);
              showToast(v ? 'Auto sync enabled' : 'Auto sync disabled', 'info');
            }}
            trackColor={{ false: G.border, true: G.accent + '60' }}
            thumbColor={enabled ? G.accent : G.muted}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: G.border }]} />

        <View style={styles.statusRow}>
          <AppText variant="caption" style={{ color: G.muted }}>
            Last sync: {status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString() : 'never'}
          </AppText>
          <AppText variant="caption" weight="bold" style={{ color: pending > 0 ? G.accent : G.muted }}>
            {pending > 0 ? `${pending} pending` : 'up to date'}
          </AppText>
        </View>
        {lastError ? (
          <AppText variant="caption" style={{ color: '#FF3B30', marginBottom: 8 }} numberOfLines={1}>{lastError}</AppText>
        ) : null}

        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, { backgroundColor: G.accentGlass }]} onPress={doSync} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color={G.fg} /> : <RefreshCw size={16} color={G.fg} />}
            <AppText variant="caption" weight="bold" style={{ color: G.fg, marginLeft: 6 }}>Sync now</AppText>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: G.accentGlass }]} onPress={doVerify} disabled={busy || localBusy}>
            <AppText variant="caption" weight="bold" style={{ color: G.fg }}>Verify</AppText>
          </Pressable>
        </View>
        {verifyResult ? (
          <AppText variant="caption" style={{ color: G.muted, marginTop: 8 }} numberOfLines={2}>{verifyResult}</AppText>
        ) : null}

        <Pressable style={styles.row} onPress={() => { refreshConflicts(); }}>
          <View style={[styles.iconBox, { backgroundColor: G.accentGlass }]}>
            <AlertTriangle size={18} color={conflicts.length > 0 ? '#FFB020' : G.muted} />
          </View>
          <View style={styles.rowBody}>
            <AppText variant="body" weight="bold" style={{ color: G.fg }}>Conflicts</AppText>
            <AppText variant="caption" style={{ color: G.muted }} numberOfLines={1}>
              {conflicts.length > 0 ? `${conflicts.length} to review — tap to resolve` : 'No conflicts'}
            </AppText>
          </View>
        </Pressable>
        {conflicts.length > 0 ? (
          <View style={{ marginTop: 4 }}>
            {conflicts.slice(0, 5).map((c) => (
              <View key={c.id} style={[styles.conflictRow, { borderColor: G.border }]}>
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                    {c.entity} · {c.op}
                  </AppText>
                  <AppText variant="caption" style={{ color: G.muted }} numberOfLines={1}>
                    {c.entity_uuid.slice(0, 18)}… {c.created_at ? new Date(c.created_at).toLocaleTimeString() : ''}
                  </AppText>
                </View>
                <Pressable style={[styles.actionBtn, { backgroundColor: G.accentGlass }]} onPress={() => { resolveConflict(c.id, true); refreshConflicts(); showToast('Kept hub version', 'success'); }}>
                  <AppText variant="caption" weight="bold" style={{ color: G.fg }}>Keep hub</AppText>
                </Pressable>
                <Pressable style={[styles.actionBtn, { backgroundColor: G.accentGlass }]} onPress={() => { dismissConflict(c.id); refreshConflicts(); }}>
                  <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Keep mine</AppText>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={[styles.group, { backgroundColor: G.bgCard, borderColor: G.border, marginTop: 12 }]}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: G.accentGlass }]}>
            {cloudOnline ? <Cloud size={18} color={G.fg} strokeWidth={2.5} /> : <CloudOff size={18} color={G.muted} strokeWidth={2.5} />}
          </View>
          <View style={styles.rowBody}>
            <AppText variant="body" weight="bold" style={{ color: G.fg }}>Cloud Sync</AppText>
            <AppText variant="caption" style={{ color: G.muted }} numberOfLines={1}>
              {cloudOnline
                ? `${cloudStatus.url.replace(/^https?:\/\//, '')} · mode ${connMode}`
                : cloudStatus.configured
                  ? 'Configured — sign in to sync' 
                  : 'Not configured — tap to set cloud address'}
            </AppText>
          </View>
          <Globe size={16} color={G.muted} />
        </View>

        <View style={[styles.divider, { backgroundColor: G.border }]} />

        <View style={styles.toggleRow}>
          <View style={styles.rowBody}>
            <AppText variant="body" weight="bold" style={{ color: G.fg }}>Enable cloud sync</AppText>
            <AppText variant="caption" style={{ color: G.muted }} numberOfLines={1}>
              Sync over the Internet when the POS hub is unreachable
            </AppText>
          </View>
          <Switch
            value={getCloudEnabled()}
            onValueChange={(v) => { setCloudEnabled(v); showToast(v ? 'Cloud sync enabled' : 'Cloud sync disabled', 'info'); }}
            trackColor={{ false: G.border, true: G.accent + '60' }}
            thumbColor={getCloudEnabled() ? G.accent : G.muted}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: G.border }]} />

        <Pressable style={styles.row} onPress={openCloudModal}>
          <View style={[styles.iconBox, { backgroundColor: G.accentGlass }]}>
            <Globe size={18} color={G.fg} strokeWidth={2.5} />
          </View>
          <View style={styles.rowBody}>
            <AppText variant="body" weight="bold" style={{ color: G.fg }}>Cloud address</AppText>
            <AppText variant="caption" style={{ color: G.muted }} numberOfLines={1}>
              {cloudStatus.url ? cloudStatus.url : 'Tap to configure'}
            </AppText>
          </View>
          <RefreshCw size={16} color={G.muted} />
        </Pressable>

        <View style={styles.statusRow}>
          <AppText variant="caption" style={{ color: G.muted }}>
            Cloud: {cloudStatus.lastAt ? new Date(cloudStatus.lastAt).toLocaleTimeString() : 'never'}
          </AppText>
          <AppText variant="caption" weight="bold" style={{ color: cloudStatus.lastError ? '#FF3B30' : cloudOnline ? G.accent : G.muted }}>
            {connMode}
          </AppText>
        </View>
        {cloudStatus.lastError ? (
          <AppText variant="caption" style={{ color: '#FF3B30', marginBottom: 8 }} numberOfLines={2}>{cloudStatus.lastError}</AppText>
        ) : null}
        {cloudResult ? (
          <AppText variant="caption" style={{ color: G.muted, marginBottom: 8 }} numberOfLines={3}>{cloudResult}</AppText>
        ) : null}

        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, { backgroundColor: G.accentGlass }]} onPress={doCloudSync} disabled={cloudBusy}>
            {cloudBusy ? <ActivityIndicator size="small" color={G.fg} /> : <RefreshCw size={16} color={G.fg} />}
            <AppText variant="caption" weight="bold" style={{ color: G.fg, marginLeft: 6 }}>Cloud sync now</AppText>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: G.accentGlass }]} onPress={checkCloudStatus} disabled={cloudBusy}>
            <AppText variant="caption" weight="bold" style={{ color: G.fg }}>Status</AppText>
          </Pressable>
        </View>
      </View>

      <Modal
        transparent
        visible={cloudModalOpen}
        animationType="fade"
        onRequestClose={() => setCloudModalOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setCloudModalOpen(false)}>
          <Pressable style={[styles.modalBox, { backgroundColor: G.bgCard, borderColor: G.border }]} onPress={(e) => e.stopPropagation()}>
            <AppText variant="title" weight="bold" style={{ color: G.fg, marginBottom: 6 }}>Cloud sync</AppText>
            <AppText variant="caption" style={{ color: G.muted, marginBottom: 14 }}>
              Enter your Shega cloud address (https://shega-api-dah3.onrender.com). Sign in to your Shega account so cloud changes are uploaded to your business.
            </AppText>
            <TextInput
              value={cloudUrl}
              onChangeText={setCloudUrlState}
              placeholder="https://shega-api-dah3.onrender.com"
              placeholderTextColor={G.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.input, { backgroundColor: G.bg, borderColor: G.border, color: G.fg }]}
            />
            <Pressable style={[styles.saveBtn, { backgroundColor: G.accent }]} onPress={saveCloudUrlOnly} disabled={cloudBusy}>
              {cloudBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <AppText variant="body" weight="bold" style={{ color: '#FFFFFF' }}>Save cloud address</AppText>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={modalOpen} animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalOpen(false)}>
          <Pressable style={[styles.modalBox, { backgroundColor: G.bgCard, borderColor: G.border }]} onPress={(e) => e.stopPropagation()}>
            <AppText variant="title" weight="bold" style={{ color: G.fg, marginBottom: 6 }}>Sync hub</AppText>
            <AppText variant="caption" style={{ color: G.muted, marginBottom: 14 }}>
              Enter the desktop POS computer's LAN address and the pairing code shown under Settings → Sync Hub → Pair a device.
            </AppText>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="http://192.168.1.10:5757"
              placeholderTextColor={G.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.input, { backgroundColor: G.bg, borderColor: G.border, color: G.fg }]}
            />
            <TextInput
              value={token}
              onChangeText={setToken}
              placeholder="Pairing code"
              placeholderTextColor={G.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={[styles.input, { backgroundColor: G.bg, borderColor: G.border, color: G.fg }]}
            />
            <Pressable style={[styles.saveBtn, { backgroundColor: G.accent }]} onPress={() => saveAndPair(true)} disabled={localBusy}>
              {localBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <AppText variant="body" weight="bold" style={{ color: '#FFFFFF' }}>Pair device</AppText>}
            </Pressable>
            <Pressable style={[styles.saveBtn, { backgroundColor: G.accentGlass, marginTop: 8 }]} onPress={() => saveAndPair(false)} disabled={localBusy}>
              <AppText variant="caption" weight="bold" style={{ color: G.fg }}>Save URL only</AppText>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, { backgroundColor: G.accentGlass, marginTop: 8, flexDirection: 'row', gap: 6 }]}
              onPress={() => { setModalOpen(false); setQrOpen(true); }}
            >
              <QrCode size={16} color={G.fg} />
              <AppText variant="caption" weight="bold" style={{ color: G.fg }}>Scan QR code</AppText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <QrPairScanner
        visible={qrOpen}
        onClose={() => setQrOpen(false)}
        onPaired={(u, t) => {
          setQrOpen(false);
          setUrl(u);
          setToken(t);
          setModalOpen(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28, paddingHorizontal: 25 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  header: { letterSpacing: 1, marginBottom: 12 },
  group: { borderRadius: 24, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowBody: { flex: 1 },
  divider: { height: 1, marginVertical: 10 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  conflictRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingVertical: 8, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalBox: { borderRadius: 18, borderWidth: 1, padding: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 14,
  },
  saveBtn: { alignItems: 'center', paddingVertical: 14, borderRadius: 30 }
});