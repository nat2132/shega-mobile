import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  QrCode,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import QrPairScanner from '@/components/QrPairScanner';
import { mobileP2pSync } from '@/services/p2p-sync-manager';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { useSync } from '@/context/SyncContext';
import { AppText } from '@/components/ui';
import { getSettingsGlass } from '@/screens/settings/glass-settings';
import {
  getConflicts, dismissConflict, resolveConflict, resolveAllConflicts,
} from '@/services/syncService';
import { getHubUrl, getHubToken, setHubUrl, setHubToken, pairDevice } from '@/services/syncService';

/**
 * Sync section — one calm status card + POS hub / devices rows.
 * Technical details (URLs, pairing codes, verify) live behind taps in
 * bottom-sheet style modals so the surface stays clean and scannable.
 */
export default function SyncSettings() {
  const { colors, t } = useSettings();
  const G = getSettingsGlass(colors);
  const { showToast } = useToast();
  const { status, busy, lastError, enabled, setEnabled, runSync } = useSync();

  const [hubModal, setHubModal] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>(() => { try { return getConflicts(); } catch { return []; } });
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [pairing, setPairing] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [p2pDevices, setP2pDevices] = useState<any[]>([]);
  // Live hub reachability — a saved URL is NOT "connected". We probe the hub
  // on a timer so the UI reflects reality (the saved URL alone just means the
  // user entered it at some point).
  const [hubOnline, setHubOnline] = useState(false);

  const refreshP2p = () => { try { setP2pDevices(mobileP2pSync.getDevices()); } catch {} };

  const checkHub = useCallback(async () => {
    const hubUrl = getHubUrl();
    if (!hubUrl) { setHubOnline(false); return; }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      await fetch(`${hubUrl}/sync/verify?token=${encodeURIComponent(getHubToken())}`, { signal: ctrl.signal });
      clearTimeout(timer);
      // Any HTTP response means the hub is reachable (even 401 = wrong token).
      setHubOnline(true);
    } catch {
      setHubOnline(false);
    }
  }, []);

  useEffect(() => {
    refreshP2p();
    void checkHub();
    const interval = setInterval(() => {
      refreshP2p();
      void checkHub();
    }, 10000);
    return () => clearInterval(interval);
  }, [checkHub]);

  const online = hubOnline;
  const pending = status?.outboxCount ?? 0;
  const mode = online ? 'LAN' : 'Offline';
  // Auto-sync is only useful when there is a hub or a live peer to sync with.
  const hasConnectedDevice = online || p2pDevices.length > 0;

  // Overall health: syncing > error > pending > up to date > offline
  const health = busy
    ? { label: t('sync_settings.syncing'), color: '#3498DB', Icon: Loader2 as any, spinning: true }
    : lastError
      ? { label: t('sync_settings.sync_issue'), color: '#FF3B30', Icon: AlertTriangle, spinning: false }
      : !online
        ? { label: t('sync_settings.offline'), color: G.muted, Icon: WifiOff, spinning: false }
        : pending > 0
          ? { label: t('sync_settings.pending_changes', { count: String(pending) }), color: '#FFB020', Icon: RefreshCw, spinning: false }
          : { label: t('sync_settings.all_synced'), color: '#2ECC71', Icon: CheckCircle2, spinning: false };

  const openHubModal = () => {
    setUrl(getHubUrl());
    setToken(getHubToken());
    setHubModal(true);
  };

  const doPair = async () => {
    setPairing(true);
    try {
      setHubUrl(url);
      if (token.trim()) setHubToken(token);
      if (token.trim()) {
        await pairDevice();
        showToast(t('sync_settings.device_paired'), 'success');
      } else {
        showToast(t('sync_settings.hub_saved'), 'success');
      }
      setHubModal(false);
    } catch (e: any) {
      showToast(t('sync_settings.pair_failed', { message: e?.message || t('sync_settings.error') }), 'error');
    } finally {
      setPairing(false);
    }
  };

  const doSync = async () => {
    const ok = await runSync();
    showToast(ok ? t('sync_settings.sync_complete') : lastError || t('sync_settings.sync_failed'), ok ? 'success' : 'error');
    try { setConflicts(getConflicts()); } catch {}
  };

  const refreshConflicts = () => {
    try { setConflicts(getConflicts()); } catch {}
    setConflictsOpen((o) => !o);
  };

  const resolveAll = (keepTheirs: boolean) => {
    Alert.alert(
      keepTheirs ? t('sync_settings.keep_desktop_all') : t('sync_settings.keep_mine_all'),
      keepTheirs
        ? t('sync_settings.keep_desktop_all_desc', { count: String(conflicts.length) })
        : t('sync_settings.keep_mine_all_desc', { count: String(conflicts.length) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: keepTheirs ? t('sync_settings.keep_desktop') : t('sync_settings.keep_mine'),
          style: keepTheirs ? 'default' : 'destructive',
          onPress: () => {
            const n = resolveAllConflicts(keepTheirs);
            setConflicts([]);
            setConflictsOpen(false);
            showToast(
              keepTheirs
                ? t('sync_settings.resolved_all_desktop', { count: String(n) })
                : t('sync_settings.resolved_all_mine', { count: String(n) }),
              'success',
            );
          },
        },
      ],
    );
  };

  return (
    <View style={styles.section}>
      {/* ── Status card ── */}
      <View style={[styles.heroCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <View style={styles.heroTop}>
          <View style={[styles.heroIcon, { backgroundColor: health.color + '18' }]}>
            <health.Icon size={22} color={health.color} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
              {health.label}
            </AppText>
            <AppText variant="caption" style={{ color: G.muted }} numberOfLines={1}>
              {status?.lastSyncAt
                ? t('sync_settings.last_sync', { time: new Date(status.lastSyncAt).toLocaleTimeString() })
                : t('sync_settings.not_synced')}
            </AppText>
          </View>
          <View style={[styles.modeChip, { backgroundColor: (online ? G.accent : G.muted) + '18' }]}>
            <AppText variant="micro" weight="bold" style={{ color: online ? G.accent : G.muted }}>
              {mode.toUpperCase()}
            </AppText>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.syncBtn,
            { backgroundColor: G.fg, opacity: busy ? 0.6 : pressed ? 0.9 : 1 },
          ]}
          onPress={doSync}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator size="small" color={G.bg} />
          ) : (
            <RefreshCw size={16} color={G.bg} />
          )}
          <AppText variant="body" weight="bold" style={{ color: G.bg, marginLeft: 8 }}>
            {busy ? t('sync_settings.syncing') : t('sync_settings.sync_now')}
          </AppText>
        </Pressable>
      </View>

      {/* ── Connections group ── */}
      <View style={[styles.group, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        {/* POS Hub */}
        <Pressable style={styles.row} onPress={openHubModal}>
          <View style={[styles.iconBox, { backgroundColor: (online ? '#2ECC71' : G.muted) + '18' }]}>
            {online ? <Wifi size={17} color="#2ECC71" strokeWidth={2.5} /> : <WifiOff size={17} color={G.muted} strokeWidth={2.5} />}
          </View>
          <View style={styles.rowBody}>
            <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
              {t('sync_settings.pos_hub_lan')}
            </AppText>
            <AppText variant="caption" style={{ color: G.muted }} numberOfLines={1}>
              {online ? t('sync_settings.connected_desktop') : t('sync_settings.tap_connect_desktop')}
            </AppText>
          </View>
          <ChevronRight size={16} color={G.muted} />
        </Pressable>

        {/* Connected devices (P2P) — online peers + known-but-offline devices */}
        {(p2pDevices.length > 0 || online) && (
          <>
            <View style={[styles.divider, { backgroundColor: G.border }]} />
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: '#2ECC7118' }]}>
                <CheckCircle2 size={17} color="#2ECC71" strokeWidth={2.5} />
              </View>
              <View style={styles.rowBody}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }}>
                  {t('sync_settings.devices')}
                </AppText>
                {online && (
                  <AppText variant="caption" style={{ color: '#2ECC71' }} numberOfLines={1}>
                    {t('sync_settings.hub_online_lan')}
                  </AppText>
                )}
                {p2pDevices.filter((d) => d.deviceType !== 'desktop' || !online).map((d) => (
                  <AppText key={d.deviceId} variant="caption" style={{ color: G.muted }} numberOfLines={1}>
                    {d.online === false ? '⚪' : '🟢'} {d.deviceType === 'desktop' ? t('sync_settings.desktop') : t('sync_settings.mobile')}{d.name ? ` · ${d.name}` : ''} · {d.online === false ? t('sync_settings.offline') : d.kind === 'lan' ? `${t('sync_settings.lan')}` : d.kind === 'relay' ? t('sync_settings.relay') : t('sync_settings.direct_p2p')}
                  </AppText>
                ))}
                {p2pDevices.length === 0 && !online && (
                  <AppText variant="caption" style={{ color: G.muted }} numberOfLines={1}>
                    {t('sync_settings.no_devices')}
                  </AppText>
                )}
              </View>
            </View>
          </>
        )}

        {/* Auto sync */}
        <View style={[styles.divider, { backgroundColor: G.border }]} />
        <View style={[styles.row, !hasConnectedDevice && styles.rowDisabled]}>
          <View style={[styles.iconBox, { backgroundColor: G.accentGlass }]}>
            <RefreshCw size={17} color={G.fg} strokeWidth={2.5} />
          </View>
          <View style={styles.rowBody}>
            <AppText variant="body" weight="bold" style={{ color: G.fg }}>{t('sync_settings.auto_sync')}</AppText>
            <AppText variant="caption" style={{ color: G.muted }} numberOfLines={1}>
              {hasConnectedDevice ? t('sync_settings.auto_sync_desc') : t('sync_settings.auto_sync_need_devices')}
            </AppText>
          </View>
          <Switch
            value={enabled && hasConnectedDevice}
            onValueChange={(v) => { setEnabled(v); showToast(v ? t('sync_settings.auto_sync_on') : t('sync_settings.auto_sync_off'), 'info'); }}
            disabled={!hasConnectedDevice}
            trackColor={{ false: G.border, true: G.accent + '60' }}
            thumbColor={enabled && hasConnectedDevice ? G.accent : G.muted}
          />
        </View>

        {/* Conflicts — only when they exist */}
        {conflicts.length > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: G.border }]} />
            <Pressable style={styles.row} onPress={refreshConflicts}>
              <View style={[styles.iconBox, { backgroundColor: '#FFB02018' }]}>
                <AlertTriangle size={17} color="#FFB020" strokeWidth={2.5} />
              </View>
              <View style={styles.rowBody}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }}>{t('sync_settings.conflicts')}</AppText>
                <AppText variant="caption" style={{ color: '#FFB020' }}>
                  {t('sync_settings.to_review', { count: String(conflicts.length) })}
                </AppText>
              </View>
              <ChevronRight
                size={16}
                color={G.muted}
                style={{ transform: [{ rotate: conflictsOpen ? '90deg' : '0deg' }] }}
              />
            </Pressable>
            {conflictsOpen && (
              <View style={[styles.bulkRow, { borderColor: G.border }]}>
                <AppText variant="micro" style={{ color: G.muted, flex: 1 }} numberOfLines={2}>
                  {t('sync_settings.bulk_hint')}
                </AppText>
                <Pressable
                  style={[styles.chipBtn, { backgroundColor: '#FFB02022' }]}
                  onPress={() => resolveAll(true)}
                >
                  <AppText variant="micro" weight="bold" style={{ color: '#FFB020' }}>{t('sync_settings.keep_desktop_all')}</AppText>
                </Pressable>
                <Pressable
                  style={[styles.chipBtn, { backgroundColor: '#34C75922' }]}
                  onPress={() => resolveAll(false)}
                >
                  <AppText variant="micro" weight="bold" style={{ color: '#34C759' }}>{t('sync_settings.keep_mine_all')}</AppText>
                </Pressable>
              </View>
            )}
            {conflictsOpen &&
              conflicts.slice(0, 5).map((c) => (
                <View key={c.id} style={[styles.conflictRow, { borderColor: G.border }]}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="caption" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                      {c.entity} · {c.op}
                    </AppText>
                    <AppText variant="micro" style={{ color: G.muted }} numberOfLines={1}>
                      {c.created_at ? new Date(c.created_at).toLocaleTimeString() : ''}
                    </AppText>
                  </View>
                  <Pressable
                    style={[styles.chipBtn, { backgroundColor: G.accentGlass }]}
                    onPress={() => { resolveConflict(c.id, true); refreshConflicts(); showToast(t('sync_settings.kept_desktop'), 'success'); }}
                  >
                    <AppText variant="micro" weight="bold" style={{ color: G.fg }}>{t('sync_settings.keep_desktop')}</AppText>
                  </Pressable>
                  <Pressable
                    style={[styles.chipBtn, { backgroundColor: G.accentGlass }]}
                    onPress={() => { dismissConflict(c.id); refreshConflicts(); }}
                  >
                    <AppText variant="micro" weight="bold" style={{ color: G.fg }}>{t('sync_settings.keep_mine')}</AppText>
                  </Pressable>
                </View>
              ))}
          </>
        )}

        {lastError ? (
          <AppText variant="caption" style={{ color: '#FF3B30', marginTop: 10 }} numberOfLines={2}>
            {lastError}
          </AppText>
        ) : null}
      </View>

      {/* ── POS Hub modal ── */}
      <Modal transparent visible={hubModal} animationType="fade" onRequestClose={() => setHubModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setHubModal(false)}>
          <Pressable style={[styles.modalBox, { backgroundColor: G.bgCard, borderColor: G.border }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalIcon, { backgroundColor: G.accentGlass }]}>
              <Wifi size={22} color={G.fg} strokeWidth={2.5} />
            </View>
            <AppText variant="title" weight="bold" style={{ color: G.fg, marginBottom: 4 }}>
              {t('sync_settings.connect_pos_hub')}
            </AppText>
            <AppText variant="caption" style={{ color: G.muted, marginBottom: 16 }}>
              {t('sync_settings.hub_modal_desc')}
            </AppText>
            <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginBottom: 6 }}>
              {t('sync_settings.desktop_address')}
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
            <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginBottom: 6 }}>
              {t('sync_settings.pairing_code')}
            </AppText>
            <TextInput
              value={token}
              onChangeText={setToken}
              placeholder="6-digit code"
              placeholderTextColor={G.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={[styles.input, { backgroundColor: G.bg, borderColor: G.border, color: G.fg }]}
            />
            <Pressable style={[styles.primaryBtn, { backgroundColor: G.fg }]} onPress={doPair} disabled={pairing}>
              {pairing ? (
                <ActivityIndicator size="small" color={G.bg} />
              ) : (
                <AppText variant="body" weight="bold" style={{ color: G.bg }}>{t('sync_settings.connect')}</AppText>
              )}
            </Pressable>
            <Pressable
              style={[styles.secondaryBtn, { borderColor: G.border }]}
              onPress={() => { setHubModal(false); setQrOpen(true); }}
            >
              <QrCode size={16} color={G.fg} />
              <AppText variant="body" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>
                {t('sync_settings.scan_qr')}
              </AppText>
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
          setHubModal(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28, paddingHorizontal: 25 },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 999,
  },
  group: { borderRadius: 24, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowDisabled: { opacity: 0.45 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowBody: { flex: 1, marginRight: 8 },
  divider: { height: StyleSheet.hairlineWidth },
  conflictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingLeft: 48,
  },
  chipBtn: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    marginLeft: 48,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
  },
  modalIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  primaryBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    marginTop: 4,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 10,
  },
});
