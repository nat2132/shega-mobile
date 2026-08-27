import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { getDB } from '@/database/db';
import { getHubUrl, getSyncStatus, syncNow, type SyncStatus } from '@/services/syncService';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface SyncContextValue {
  status: SyncStatus;
  busy: boolean;
  lastError: string | null;
  lastResult: { pushed: number; pulled: number; conflicts: number } | null;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  runSync: () => Promise<boolean>;
  requestSync: () => void;
  expoPushToken?: string;
  registerPushToken: () => Promise<void>;
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
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncContextValue['lastResult']>(null);
  const [enabled, setEnabledState] = useState<boolean>(readEnabled);
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const running = useRef(false);
  const failures = useRef(0);

  const { expoPushToken: hookPushToken } = usePushNotifications();

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

  const refresh = useCallback(() => {
    setStatus(getSyncStatus());
  }, []);

  const runSync = useCallback(async (): Promise<boolean> => {
    if (running.current) return false;
    if (!getHubUrl()) return false;
    running.current = true;
    setBusy(true);
    try {
      const res = await syncNow();
      failures.current = 0;
      setLastResult(res);
      setLastError(null);
      refresh();
      return true;
    } catch (e: any) {
      failures.current += 1;
      setLastError(e?.message || 'Sync failed');
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [refresh]);

  // Debounced best-effort trigger (used right after a sale/expense is recorded).
  const pending = useRef(false);
  const requestSync = useCallback(() => {
    if (!enabled || !getHubUrl()) return;
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
        busy,
        lastError,
        lastResult,
        enabled,
        setEnabled,
        runSync,
        requestSync,
        expoPushToken,
        registerPushToken,
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