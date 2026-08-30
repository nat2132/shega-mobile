// Persistence for peripheral device configuration and device logs.
//
// Config and logs live in the `app_settings` key/value table so they survive
// restarts and stay fully offline. Pairing secrets (for the future dev-build
// BLE/USB phase) belong in SecureStore, not here — none are stored today
// because no native pairing occurs in Expo Go.

import { getAppSetting, getDB } from '@/database/db';
import type { DeviceLogEntry, PeripheralConfig } from './types';

const DEVICES_KEY = 'peripheral_devices_v1';
const LOGS_KEY = 'peripheral_logs_v1';
const MAX_LOGS = 200;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = getAppSetting(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    const db = getDB();
    db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
  } catch (e) {
    console.warn('Failed to persist peripheral setting', e);
  }
}

export const loadDevices = (): PeripheralConfig[] => readJson<PeripheralConfig[]>(DEVICES_KEY, []);
export const saveDevices = (devices: PeripheralConfig[]): void => writeJson(DEVICES_KEY, devices);

export const loadDeviceLogs = (): DeviceLogEntry[] => readJson<DeviceLogEntry[]>(LOGS_KEY, []);

export const saveDeviceLogs = (logs: DeviceLogEntry[]): void => {
  writeJson(LOGS_KEY, logs.length > MAX_LOGS ? logs.slice(logs.length - MAX_LOGS) : logs);
};

export const clearDeviceLogs = (): void => writeJson(LOGS_KEY, []);

export const newLogId = (): string =>
  `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;