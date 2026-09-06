import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { getDB } from '@/database/db';
import { getHubUrl, getSyncStatus, syncNow, type SyncStatus, type UnifiedSyncStatus, type PendingChange, type DeviceStatus, type SyncHistoryEntry, getUnifiedSyncStatus, getPendingChanges, getDeviceStatusList, getSyncHistory, recordSyncHistory } from '@/services/syncService';
import {
  cloudSyncNow,
  getCloudStatus,
  getCloudUrl,
  type CloudSyncStatus,
} from '@/services/syncService';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { startPeerSyncManager, stopPeerSyncManager, getPeerSyncState, type PeerSyncState } from '@/services/peerSyncManager';

interface SyncContextValue {
  status: SyncStatus;
  cloudStatus: CloudSyncStatus;
  unifiedStatus: UnifiedSyncStatus | null;
  peerSyncState: PeerSyncState | null;
  busy: boolean;
  lastError: string | null;
  lastResult: { pushed: number; pulled: number; conflicts: number; transport?: 'lan' | 'cloud' | null } | null;
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

const PERIOD_MS = 60 * 1000;
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
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>({
    configured: false,
    enabled: false,
    hasToken: false,
    url: '',
    lastError: null,
    lastAt: null,
    cursor: 0,
  });
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
    getCloudStatus().then(setCloudStatus).catch(() => {});
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
   * Combined runSync (spec §20/§18):
   *  - Prefer LAN when a hub is configured and reachable (no unnecessary cloud
   *    round-trips for changes that can cross the local network).
   *  - Fall back to the Internet/cloud transport when the LAN hub is absent or
   *    unreachable.
   * The shared outbox is only cleared after whichever transport succeeds, so a
   * change is delivered once regardless of path (no duplicates).
   */
  const runSync = useCallback(async (): Promise<boolean> => {
    if (running.current) return false;
    const hubUrl = getHubUrl();
    const cloudUrl = getCloudUrl();
    if (!hubUrl && !cloudUrl) return false;
    running.current = true;
    setBusy(true);
    try {
      let result: SyncContextValue['lastResult'] = null;
      let err: unknown = null;

      if (hubUrl) {
        try {
          const res = await syncNow();
          result = { ...res, transport: 'lan' };
        } catch (e) {
          err = e;
        }
      }

      if (!result && cloudUrl) {
        try {
          const res = await cloudSyncNow();
          result = { ...res, transport: 'cloud' };
          err = null;
        } catch (e) {
          if (!err) err = e;
        }
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

  // Debounced best-effort trigger (used right after a sale/expense is recorded).
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

  return (
    <SyncContext.Provider
      value={{
        status,
        cloudStatus,
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
