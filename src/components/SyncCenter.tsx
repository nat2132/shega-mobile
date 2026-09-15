import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import {
  AlertTriangle,
  CheckCircle2,
  FileClock,
  RefreshCw,
  Server,
  Smartphone,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { useSync } from '@/context/SyncContext';
import { AppText } from '@/components/ui';
import { getSettingsGlass } from '@/screens/settings/glass-settings';
import {
  type PendingChange,
  type SyncHistoryEntry,
  type UnifiedSyncStatus,
} from '@/services/syncService';

// §24 Sync Center — unified LAN synchronization status, pending changes,
// online devices, conflicts, history and manual sync controls.

const HEALTH_LABEL: Record<string, string> = {
  synced: 'Everything synchronized',
  pending: 'Changes pending',
  syncing: 'Synchronizing…',
  error: 'Sync error',
  offline: 'Offline',
};

const HEALTH_COLOR: Record<string, string> = {
  synced: '#2ECC71',
  pending: '#FFB020',
  syncing: '#3498DB',
  error: '#FF3B30',
  offline: '#9AA0A6',
};

function healthDot(health: string) {
  switch (health) {
    case 'synced':
      return <CheckCircle2 size={18} color={HEALTH_COLOR.synced} />;
    case 'pending':
      return <AlertTriangle size={18} color={HEALTH_COLOR.pending} />;
    case 'syncing':
      return <ActivityIndicator size="small" color={HEALTH_COLOR.syncing} />;
    case 'error':
      return <XCircle size={18} color={HEALTH_COLOR.error} />;
    default:
      return <WifiOff size={18} color={HEALTH_COLOR.offline} />;
  }
}

function modeLabel(status: UnifiedSyncStatus): string {
  const lan = status.lan.configured;
  if (lan) return 'LAN';
  return 'Offline';
}

export default function SyncCenter() {
  const { colors } = useSettings();
  const G = getSettingsGlass(colors);
  const { showToast } = useToast();
  const {
    status,
    unifiedStatus: unified,
    busy,
    lastError,
    lastResult,
    enabled,
    setEnabled,
    runSync,
    refreshUnifiedStatus,
    getPendingChanges,
    getDeviceStatusList,
    getSyncHistory,
  } = useSync();

  const [pending, setPending] = useState<PendingChange[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(() => {
    refreshUnifiedStatus().catch(() => {});
    try { setPending(getPendingChanges()); } catch {}
    try { setDevices(getDeviceStatusList()); } catch {}
    try { setHistory(getSyncHistory(20)); } catch {}
  }, [refreshUnifiedStatus, getPendingChanges, getDeviceStatusList, getSyncHistory]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const doSync = async () => {
    setSyncing(true);
    try {
      const ok = await runSync();
      showToast(ok ? 'Sync complete' : lastError || 'Sync failed', ok ? 'success' : 'error');
    } finally {
      setSyncing(false);
      load();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Health banner */}
        <View style={[styles.banner, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <View style={styles.bannerLeft}>
            {unified ? healthDot(unified.health) : <WifiOff size={18} color={G.muted} />}
            <View style={styles.bannerText}>
              <AppText variant="body" weight="bold" style={{ color: G.fg }}>
                {unified ? HEALTH_LABEL[unified.health] : 'Sync'}
              </AppText>
              <AppText variant="caption" style={{ color: G.muted }}>
                {unified
                  ? `Last sync ${unified.lastSyncAt ? new Date(unified.lastSyncAt).toLocaleString() : 'never'}`
                  : 'Loading…'}
              </AppText>
            </View>
          </View>
          <View style={[styles.modeChip, { backgroundColor: G.accentGlass }]}>
            <AppText variant="caption" weight="bold" style={{ color: G.fg }}>
              {unified ? modeLabel(unified) : '—'}
            </AppText>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppText variant="display" weight="bold" style={[styles.statValue, { color: G.fg }]}>
              {unified?.pendingOutbound ?? 0}
            </AppText>
            <AppText variant="caption" style={{ color: G.muted }}>Pending</AppText>
          </View>
          <View style={[styles.statCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppText variant="display" weight="bold" style={[styles.statValue, { color: G.fg }]}>
              {unified?.conflicts ?? 0}
            </AppText>
            <AppText variant="caption" style={{ color: G.muted }}>Conflicts</AppText>
          </View>
          <View style={[styles.statCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppText variant="display" weight="bold" style={[styles.statValue, { color: G.fg }]}>
              {devices.filter((d) => d.status === 'online').length}
            </AppText>
            <AppText variant="caption" style={{ color: G.muted }}>Online</AppText>
          </View>
        </View>

        {/* Sync Now */}
        <Pressable
          style={[styles.syncBtn, { backgroundColor: G.accent }]}
          onPress={doSync}
          disabled={busy || syncing}
        >
          {busy || syncing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <RefreshCw size={18} color="#FFFFFF" />
          )}
          <AppText variant="body" weight="bold" style={{ color: '#FFFFFF', marginLeft: 8 }}>
            {busy || syncing ? 'Syncing…' : 'Sync now'}
          </AppText>
        </Pressable>

        {/* Auto sync toggle */}
        <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <AppText variant="body" weight="bold" style={{ color: G.fg }}>Auto sync</AppText>
              <AppText variant="caption" style={{ color: G.muted }}>
                Sync after sales and every minute in the foreground
              </AppText>
            </View>
            <Switch
              value={enabled}
              onValueChange={(v) => { setEnabled(v); showToast(v ? 'Auto sync enabled' : 'Auto sync disabled', 'info'); }}
              trackColor={{ false: G.border, true: G.accent + '60' }}
              thumbColor={enabled ? G.accent : G.muted}
            />
          </View>
        </View>

        {/* Connections */}
        <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.muted }]}>Connections</AppText>
          <View style={styles.connRow}>
            {status?.hub ? <Wifi size={16} color={G.accent} /> : <WifiOff size={16} color={G.muted} />}
            <AppText variant="body" weight="bold" style={[styles.connLabel, { color: G.fg }]}>POS Hub (LAN)</AppText>
            <AppText variant="caption" style={{ color: status?.hub ? '#2ECC71' : G.muted, flex: 1, textAlign: 'right' }}>
              {status?.hub ? 'Connected' : 'Not configured'}
            </AppText>
          </View>
        </View>

        {/* Pending changes */}
        <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.muted }]}>
            Pending changes ({pending.length})
          </AppText>
          {pending.length === 0 ? (
            <AppText variant="caption" style={{ color: G.muted }}>Nothing waiting to sync</AppText>
          ) : (
            pending.slice(0, 20).map((p) => (
              <View key={p.id} style={[styles.commRow, { borderColor: G.border }]}>
                <AppText variant="caption" weight="bold" style={{ color: G.fg, flex: 1 }} numberOfLines={1}>
                  {p.op} {p.entity}
                </AppText>
                <AppText variant="caption" style={{ color: G.muted }}>{p.transport}</AppText>
              </View>
            ))
          )}
        </View>

        {/* Devices online */}
        <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.muted }]}>
            Devices ({devices.length})
          </AppText>
          <View style={styles.deviceGrid}>
            {devices.map((d) => (
              <View key={d.device_id} style={[styles.deviceTile, { backgroundColor: G.accentGlass }]}>
                <Smartphone size={18} color={d.is_self ? G.accent : G.fg} />
                <AppText variant="caption" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                  {d.is_self ? 'This device' : d.name}
                </AppText>
                <View style={[styles.statusPill, { backgroundColor: d.status === 'online' ? '#2ECC71' : '#9AA0A6' }]}>
                  <AppText variant="micro" weight="bold" style={{ color: '#FFFFFF' }}>
                    {d.status === 'online' ? 'Online' : d.status === 'offline' ? 'Offline' : 'Unknown'}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Sync history */}
        <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.muted }]}>
            Sync history
          </AppText>
          {history.length === 0 ? (
            <AppText variant="caption" style={{ color: G.muted }}>No syncs recorded yet</AppText>
          ) : (
            history.slice(0, 10).map((h) => (
              <View key={h.id} style={[styles.commRow, { borderColor: G.border }]}>
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" weight="bold" style={{ color: G.fg }}>
                    {h.status === 'success' ? 'Success' : h.status === 'partial' ? 'Partial' : 'Failed'} · {h.transport}
                  </AppText>
                  <AppText variant="micro" style={{ color: G.muted }}>
                    ↑{h.pushed} ↓{h.pulled} · {h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}
                  </AppText>
                </View>
                <FileClock size={16} color={G.muted} />
              </View>
            ))
          )}
        </View>

        {/* Errors */}
        {lastError ? (
          <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: '#FF3B30' }]}>Errors</AppText>
            {lastError ? <AppText variant="caption" style={{ color: '#FF3B30' }}>{lastError}</AppText> : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  bannerText: { marginLeft: 12, flex: 1 },
  modeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { fontSize: 28, marginBottom: 2 },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 30,
    marginBottom: 14,
  },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardTitle: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  connRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  connLabel: { marginLeft: 10, flex: 1 },
  divider: { height: 1, marginVertical: 4 },
  commRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  deviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deviceTile: {
    width: '48%',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  statusPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
});
