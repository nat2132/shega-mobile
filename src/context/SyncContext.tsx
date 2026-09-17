import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { getDB } from '@/database/db';
import { getHubUrl, getHubToken, getSyncStatus, type SyncStatus, type UnifiedSyncStatus, type PendingChange, type DeviceStatus, type SyncHistoryEntry, getUnifiedSyncStatus, getPendingChanges, getDeviceStatusList, getSyncHistory, recordSyncHistory } from '@/services/syncService';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { startPeerSyncManager, stopPeerSyncManager, getPeerSyncState, type PeerSyncState } from '@/services/peerSyncManager';
import { mobileP2pSync } from '@/services/p2p-sync-manager';
import { wsSyncClient } from '@/services/wsSyncClient';
import { getActiveBusiness } from '@/services/businessService';

interface SyncContextValue {
  status: SyncStatus;
  unifiedStatus: UnifiedSyncStatus | null;
  peerSyncState: PeerSyncState | null;
  busy: boolean;
  lastError: string | null;
  lastResult: { pushed: number; pulled: number; conflicts: number; transport?: 'lan' | null } | null;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  runSync: () => Promise<boolean>;
  requestSync: () => void;
  expoPushToken?: string;
  registerPushToken: () => Promise<void>;
  // §24 Sync Center
  refreshUnifiedStatus: () => Promise<void>;
  getPendingChanges: () => PendingChange[];
  getDeviceStatusList: () => DeviceStatus[];
  getSyncHistory: (limit?: number) => SyncHistoryEntry[];
  // Peer sync
  refreshPeerSyncState: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const PERIOD_MS = 20 * 1000;
const BACKOFF_BASE_MS = 5 * 1000;
const BACKOFF_MAX_MS = 5 * 60 * 1000;

function readEnabled(): boolean {
  const db = getDB();
  const row = db.getFirstSync("SELECT value FROM app_settings WHERE key = 'sync_auto_enabled'") as any;
  return row?.value === 'true';
}

function writeEnabled(v: boolean): void {
  const db = getDB();
  db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['sync_auto_enabled', String(v)]);
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  const [unifiedStatus, setUnifiedStatus] = useState<UnifiedSyncStatus | null>(null);
  const [peerSyncState, setPeerSyncState] = useState<PeerSyncState | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncContextValue['lastResult']>(null);
  const [enabled, setEnabledState] = useState<boolean>(readEnabled);
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const running = useRef(false);
  const failures = useRef(0);

  const { expoPushToken: hookPushToken } = usePushNotifications();

  const refresh = useCallback(() => {
    setStatus(getSyncStatus());
  }, []);

  const refreshUnifiedStatus = useCallback(async () => {
    const unified = await getUnifiedSyncStatus();
    setUnifiedStatus(unified);
  }, []);

  const refreshPeerSyncState = useCallback(async () => {
    const state = await getPeerSyncState();
    setPeerSyncState(state);
  }, []);

  // Refresh unified status periodically
  useEffect(() => {
    refreshUnifiedStatus();
    refreshPeerSyncState();
    const interval = setInterval(() => {
      refreshUnifiedStatus();
      refreshPeerSyncState();
    }, 30000); // every 30 seconds
    return () => clearInterval(interval);
  }, [refreshUnifiedStatus, refreshPeerSyncState]);

  // Start the peer sync manager on mount (enables hub mode if TCP server available)
  useEffect(() => {
    if (enabled) {
      startPeerSyncManager().catch((e) => {
        console.warn('[SyncContext] Failed to start peer sync:', e);
      });
    }
    return () => {
      stopPeerSyncManager();
    };
  }, [enabled]);

  // P2P Yjs+WebRTC sync — keyed to the active business so switching businesses
  // swaps the Y.Doc context (start() closes the old business doc and
  // bootstraps the new one). The active-business tick re-runs this effect
  // whenever the user switches businesses, keeping sync business-isolated.
  const activeBizId = getActiveBusiness()?.id ?? null;
  useEffect(() => {
    try {
      if (activeBizId) {
        mobileP2pSync.start(String(activeBizId));
        mobileP2pSync.announce();
      }
    } catch (e) {
      console.warn('[SyncContext] P2P sync start failed:', e);
    }
    const t = setInterval(() => { try { mobileP2pSync.announce(); } catch {} }, 30000);
    return () => clearInterval(t);
  }, [activeBizId]);

  const registerPushToken = useCallback(async () => {
    if (!expoPushToken) return;
    const hubUrl = getHubUrl();
    if (!hubUrl) return;
    const deviceId = getDB().getFirstSync('SELECT device_id FROM sync_meta WHERE id = 1') as any;
    if (!deviceId?.device_id) return;
    
    try {
      await fetch(`${hubUrl}/api/push/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId.device_id,
          push_token: expoPushToken,
          platform: Platform.OS,
        }),
      });
    } catch (e) {
      console.warn('Failed to register push token:', e);
    }
  }, [expoPushToken, enabled]);

  // Sync push token from hook to state
  useEffect(() => {
    if (hookPushToken && hookPushToken.data) {
      setExpoPushToken(hookPushToken.data);
    }
  }, [hookPushToken]);

  // Register push token with backend when available
  useEffect(() => {
    if (expoPushToken && enabled) {
      registerPushToken();
    }
  }, [expoPushToken, enabled, registerPushToken]);

  /**
   * Combined runSync (spec §20/§18): push/pull over the LAN hub when configured.
   * The outbox is only cleared after the hub ACKs, so a change is delivered
   * once regardless of path (no duplicates).
   */
  const runSync = useCallback(async (): Promise<boolean> => {
    if (running.current) return false;
    const hubUrl = getHubUrl();
    if (!hubUrl) return false;
    running.current = true;
    setBusy(true);
    try {
      let result: SyncContextValue['lastResult'] = null;
      let err: unknown = null;

      try {
        // Prefer the peer-sync path: it includes mDNS discovery adoption and
        // the stale-pairing-token retry (403 → re-adopt token → retry), which
        // raw syncNow lacks. Without it, a token refresh on the desktop made
        // the manual Sync Now button fail forever while background sync worked.
        const { triggerSync } = await import('@/services/peerSyncManager');
        const res = await triggerSync();
        if (res?.lan) {
          result = { ...res.lan, transport: 'lan' };
        } else if (!getHubUrl()) {
          // No hub configured and discovery found none — surface a real error
          // instead of a silent no-op.
          err = new Error('No sync hub found. Check that the desktop app is running on the same network.');
        }
      } catch (e) {
        err = e;
      }

      if (result) {
        failures.current = 0;
        setLastResult(result);
        setLastError(err ? (err as any)?.message || 'Sync warning' : null);
        // Record successful sync to history
        recordSyncHistory({
          transport: result.transport ?? 'lan',
          pushed: result.pushed,
          pulled: result.pulled,
          conflicts: result.conflicts,
          status: 'success',
        });
      } else {
        failures.current += 1;
        const errorMsg = (err as any)?.message || 'Sync failed';
        setLastError(errorMsg);
        recordSyncHistory({
          transport: 'lan',
          pushed: 0,
          pulled: 0,
          conflicts: 0,
          status: 'failed',
          error: errorMsg,
        });
      }
      refresh();
      refreshUnifiedStatus();
      return !!result;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [refresh]);

  // Debounced best-effort trigger (used right after a sale is recorded).
  const pending = useRef(false);
  const requestSync = useCallback(() => {
    if (!enabled) return;
    if (pending.current) return;
    pending.current = true;
    setTimeout(() => {
      pending.current = false;
      runSync();
    }, 2500);
  }, [enabled, runSync]);

  const setEnabled = useCallback((v: boolean) => {
    writeEnabled(v);
    setEnabledState(v);
    if (v) {
      refresh();
      runSync();
    }
  }, [refresh, runSync]);

  // Period + foreground auto-sync with exponential backoff + jitter (3.4).
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const schedule = (delay: number) => {
      if (cancelled) return;
      timer = setTimeout(async () => {
        if (cancelled || AppState.currentState !== 'active') return;
        const ok = await runSync();
        const next = ok
          ? PERIOD_MS
          : Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.min(failures.current - 1, 6)) * (0.8 + Math.random() * 0.4);
        schedule(next);
      }, delay);
    };
    schedule(3000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
        runSync();
      }
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [enabled, refresh, runSync]);

  // Live LAN path (BREAK-03 fix): keep ONE persistent WebSocket to the hub from
  // app launch (not just the join-existing flow). The hub pushes DATA_CHANGED
  // whenever any device persists data, which triggers an immediate pull below
  // while the WS client's own SYNC_PULL converges SQLite. This also keeps the
  // WebRTC signalling channel alive for dev builds.
  //
  // Re-runs whenever `hubUrl` becomes non-empty — including when the peer sync
  // manager auto-adopts a discovered desktop hub (peerSyncManager.setHubUrl),
  // so no app restart is needed for the signalling channel to come up.
  const [hubUrlTick, setHubUrlTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      const u = getHubUrl();
      if (u && u !== lastSeenHubUrl.current) {
        lastSeenHubUrl.current = u;
        setHubUrlTick((n) => n + 1);
      }
    }, 3000);
    return () => clearInterval(t);
  }, []);
  const lastSeenHubUrl = useRef<string>('');
  useEffect(() => {
    if (!enabled) return;
    const hubUrl = getHubUrl();
    if (!hubUrl) return;
    const device = getDB().getFirstSync('SELECT device_id FROM sync_meta WHERE id = 1') as any;
    if (!device?.device_id) return;

    // Desktop WS sync server listens on 5758 (the HTTP hub is 5757). The client
    // appends '/sync' itself, so hand it the http-form URL for the WS port.
    const wsHubUrl = hubUrl.replace(':5757', ':5758');

    const onLive = () => {
      refresh();
      refreshUnifiedStatus();
      // The WS path converged/pushed; also drive the HTTP path so its cursor
      // and status stay in sync, then refresh the UI via data-version bumps.
      runSync();
    };
    const onConnected = () => {
      refresh();
      refreshUnifiedStatus();
    };

    wsSyncClient.on('dataChanged', onLive);
    wsSyncClient.on('connected', onConnected);
    wsSyncClient.on('syncCompleted', onConnected);

    wsSyncClient.connect({ hubUrl: wsHubUrl, hubToken: getHubToken(), deviceId: device.device_id })
      .catch((e) => console.warn('[SyncContext] WS connect failed:', e));

    return () => {
      wsSyncClient.off('dataChanged', onLive);
      wsSyncClient.off('connected', onConnected);
      wsSyncClient.off('syncCompleted', onConnected);
      try { wsSyncClient.disconnect(); } catch {}
    };
  }, [enabled, hubUrlTick, refresh, refreshUnifiedStatus, runSync]);

  return (
    <SyncContext.Provider
      value={{
        status,
        unifiedStatus,
        peerSyncState,
        busy,
        lastError,
        lastResult,
        enabled,
        setEnabled,
        runSync,
        requestSync,
        expoPushToken,
        registerPushToken,
        // §24 Sync Center
        refreshUnifiedStatus,
        getPendingChanges,
        getDeviceStatusList,
        getSyncHistory,
        // Peer sync
        refreshPeerSyncState,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
