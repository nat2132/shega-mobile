/**
 * Mobile POS Hub — public face of "this phone is the main connector".
 *
 * Assembles everything the mobile hub needs to accept other devices:
 *   - the LAN TCP sync server (react-native-tcp-socket, port 5759)
 *   - mDNS advertisement (_shega-pos._tcp with the pairing token)
 *   - the phone's LAN IP so a QR code / manual entry can point peers at it
 *
 * The pairing payload mirrors the desktop hub's QR scheme
 * (shega://pair?url=...&token=...) so both platforms' scanners understand it.
 */

import { getDB } from '../database/db';
import { getDeviceId } from './syncService';
import {
  startMobileSyncServer,
  stopMobileSyncServer,
  isMobileSyncServerRunning,
  getMobileSyncPort,
} from './mobileSyncServer';
import { publishMobileHub, unpublishMobileHub } from './mobileMdnsPublisher';

const MOBILE_HUB_PORT = 5759;

export interface MobileHubInfo {
  /** True when the TCP sync server is accepting connections. */
  running: boolean;
  /** This phone's hub device id. */
  hubId: string;
  /** 6-char pairing code other devices must enter. */
  pairingToken: string;
  /** LAN port of the TCP sync server. */
  port: number;
  /** Phone's LAN IP (best effort), e.g. 192.168.1.23. */
  ipAddress: string | null;
  /** Fully-qualified hub URL for pairing, e.g. http://192.168.1.23:5759. */
  hubUrl: string | null;
  /** QR payload identical in shape to the desktop hub's. */
  qrPayload: string | null;
}

/** Read/generate the mobile hub's pairing token (persisted in app_settings). */
export function getMobilePairingToken(): string {
  const db = getDB();
  const row = db.getFirstSync(
    "SELECT value FROM app_settings WHERE key = 'mobile_pairing_token'"
  ) as any;
  if (row?.value) return String(row.value);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  const randomBytes = new Uint8Array(6);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < randomBytes.length; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < 6; i++) token += chars[randomBytes[i] % chars.length];
  db.runSync(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('mobile_pairing_token', ?)",
    [token]
  );
  return token;
}

/** Regenerate the pairing code (invalidates old pairings that haven't synced). */
export function regenerateMobilePairingToken(): string {
  const db = getDB();
  db.runSync("DELETE FROM app_settings WHERE key = 'mobile_pairing_token'");
  return getMobilePairingToken();
}

/** Best-effort phone LAN IP via expo-network (may be unavailable in Expo Go). */
async function getLanIp(): Promise<string | null> {
  try {
    const Network = await import('expo-network');
    const state = await Network.getNetworkStateAsync();
    if (!state?.isConnected) return null;
    // getIpAddressAsync is available on the Network module in SDK 49+.
    const anyNet = Network as any;
    if (typeof anyNet.getIpAddressAsync === 'function') {
      const ip = await anyNet.getIpAddressAsync();
      return ip || null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Start the phone acting as a POS Hub: TCP server + mDNS advertisement. */
export async function startMobilePosHub(): Promise<MobileHubInfo> {
  const running = await startMobileSyncServer();
  if (running) publishMobileHub();
  const info = await getMobilePosHubInfo();
  console.log(`[PosHub] start — running=${info.running} url=${info.hubUrl ?? 'n/a'}`);
  return info;
}

/** Stop accepting connections (phone leaves hub mode). */
export function stopMobilePosHub(): void {
  unpublishMobileHub();
  stopMobileSyncServer();
  console.log('[PosHub] stopped');
}

/** Current hub snapshot for UI (Settings → POS Hub screen). */
export async function getMobilePosHubInfo(): Promise<MobileHubInfo> {
  const running = isMobileSyncServerRunning();
  const hubId = getDeviceId();
  const pairingToken = getMobilePairingToken();
  const port = getMobileSyncPort() || MOBILE_HUB_PORT;
  const ipAddress = running ? await getLanIp() : null;
  const hubUrl = ipAddress ? `http://${ipAddress}:${port}` : null;
  const qrPayload = hubUrl
    ? `shega://pair?url=${encodeURIComponent(hubUrl)}&token=${encodeURIComponent(pairingToken)}&platform=mobile`
    : null;
  return { running, hubId, pairingToken, port, ipAddress, hubUrl, qrPayload };
}

/**
 * Connected-client list for the hub UI.
 * Best effort: the TCP server tracks live sockets internally; we surface the
 * devices table rows bound to this phone's hub that have synced recently.
 */
export function getMobileHubClients(): Array<{ deviceId: string; name: string; status: string; lastSeen: string | null }> {
  try {
    const db = getDB();
    const rows = db.getAllSync(
      "SELECT id AS deviceId, name, status, updated_at AS lastSeen FROM devices WHERE platform = 'mobile' AND is_deleted = 0 AND id != ? ORDER BY updated_at DESC LIMIT 20",
      [getDeviceId()]
    ) as any[];
    return rows ?? [];
  } catch {
    return [];
  }
}
