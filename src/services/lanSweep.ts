/**
 * LAN presence sweep — phone-side discovery that does not depend on mDNS.
 *
 * Android drops inbound multicast unless the app holds a WifiManager
 * MulticastLock (and many Wi-Fi networks — guest SSIDs, AP isolation,
 * Windows-firewalled hosts — block it regardless). When that happens the
 * beacon channel goes silent even though both devices sit on the same subnet
 * and can talk TCP perfectly well, which is exactly the "same Wi-Fi but they
 * can't find each other" failure.
 *
 * So we sweep our own /24 and knock on the ports Shega devices already listen on:
 *
 *   5757  desktop sync hub  → raw HTTP `GET /sync/info` (identity)
 *   5759  mobile LAN hub    → `DEVICE_HELLO`            (identity)
 *
 * Both answers are identity-only (name, platform, business name) — no data,
 * no tokens, nothing an attacker on the LAN doesn't already see in an mDNS
 * beacon. Sweeps are serialized and cached, because the discovery screens poll
 * every few seconds and a sweep costs a couple of hundred connects.
 */

import { Platform } from 'react-native';
import { getThisDeviceName } from './deviceIdentity';

export interface LanSweepHit {
  deviceId: string;
  deviceName: string;
  platform: 'desktop' | 'mobile';
  host: string;
  port: number;
  businessName?: string | null;
  /** Open invitation the peer is currently advertising, if any. */
  inviteCode?: string | null;
  via: 'http' | 'hello';
}

const DESKTOP_HTTP_PORT = 5757;
const MOBILE_PORT = 5759;
const CONNECT_TIMEOUT_MS = 320;
const IDENTITY_TIMEOUT_MS = 800;
const CONCURRENCY = 20;
const CACHE_MS = 12_000;
const DISCOVERY_TTL_MS = 45_000;

let cache: { at: number; items: LanSweepHit[] } = { at: 0, items: [] };
let inflight: Promise<LanSweepHit[]> | null = null;

/** This phone's IPv4 on the LAN, or null when the platform can't report it. */
async function ownIPv4(): Promise<string | null> {
  try {
    const Network = require('expo-network');
    const ip = await Network?.getIpAddressAsync?.();
    if (typeof ip === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(ip) && !ip.startsWith('127.')) return ip;
  } catch { /* expo-network unavailable */ }
  return null;
}

function hostList(ip: string): string[] {
  const parts = ip.split('.');
  if (parts.length !== 4) return [];
  const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const out: string[] = [];
  for (let i = 1; i <= 254; i += 1) {
    const host = `${prefix}.${i}`;
    if (host !== ip) out.push(host);
  }
  return out;
}

/** One-shot TCP exchange: connect, send, wait for the first matching line. */
function probe(
  host: string,
  port: number,
  request: (socket: any) => void,
  matches: (line: string) => boolean,
): Promise<string | null> {
  return new Promise((resolve) => {
    let TcpSocket: any;
    try {
      TcpSocket = require('react-native-tcp-socket');
    } catch { return resolve(null); }

    let settled = false;
    let socket: any;
    let buffer = '';
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      try { socket?.destroy?.(); } catch { /* already gone */ }
      resolve(value);
    };

    try {
      socket = TcpSocket.createConnection({ host, port }, () => {
        try { request(socket); } catch { finish(null); }
      });
      socket.setTimeout?.(IDENTITY_TIMEOUT_MS, () => finish(null));
      socket.on('data', (chunk: any) => {
        buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        const line = buffer.split('\n').find(matches);
        if (line) finish(line);
        else if (buffer.length > 8192) finish(null);
      });
      socket.on('error', () => finish(null));
      socket.on('close', () => {
        const line = buffer.split('\n').find(matches);
        finish(line ?? null);
      });
      setTimeout(() => finish(null), IDENTITY_TIMEOUT_MS + 200);
    } catch {
      finish(null);
    }
  });
}

async function probeDesktop(host: string): Promise<LanSweepHit | null> {
  const line = await probe(
    host,
    DESKTOP_HTTP_PORT,
    (socket) => socket.write(`GET /sync/info HTTP/1.0\r\nHost: ${host}\r\nConnection: close\r\n\r\n`),
    (l) => l.trim().startsWith('{'),
  );
  if (!line) return null;
  try {
    const info = JSON.parse(line.trim());
    if (!info?.hub) return null;
    return {
      deviceId: String(info.hub),
      deviceName: String(info.deviceName || 'Shega Desktop'),
      platform: 'desktop',
      host,
      port: DESKTOP_HTTP_PORT,
      businessName: info.businessName ?? null,
      inviteCode: info.inviteCode ? String(info.inviteCode) : null,
      via: 'http',
    };
  } catch {
    return null;
  }
}

async function probeMobile(host: string): Promise<LanSweepHit | null> {
  const requestId = `hello_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const line = await probe(
    host,
    MOBILE_PORT,
    (socket) => socket.write(`${JSON.stringify({ type: 'DEVICE_HELLO', requestId })}\n`),
    (l) => l.includes('DEVICE_HELLO'),
  );
  if (!line) return null;
  try {
    const msg = JSON.parse(line);
    const p = msg?.payload || {};
    if (!p.deviceId) return null;
    return {
      deviceId: String(p.deviceId),
      deviceName: String(p.deviceName || 'Shega Mobile'),
      platform: 'mobile',
      host,
      port: MOBILE_PORT,
      businessName: p.businessName ?? null,
      inviteCode: p.inviteCode ? String(p.inviteCode) : null,
      via: 'hello',
    };
  } catch {
    return null;
  }
}

function toBeaconShape(hit: LanSweepHit) {
  return {
    beacon: {
      v: 1,
      businessId: '',
      businessName: hit.businessName || 'Shega',
      owner: { deviceId: hit.deviceId, deviceName: hit.deviceName, platform: hit.platform },
      // Carries the peer's open invite when it advertised one, so the join
      // flow works with zero code entry even without mDNS.
      code: hit.inviteCode || '',
      role: 'owner' as const,
      expiresAt: new Date(Date.now() + DISCOVERY_TTL_MS).toISOString(),
      suggestedRole: 'cashier',
    },
    host: hit.host,
    platform: hit.platform,
    via: 'lan' as const,
  };
}

async function runSweep(): Promise<LanSweepHit[]> {
  const ip = await ownIPv4();
  if (!ip) return [];
  const hosts = hostList(ip);
  const out: LanSweepHit[] = [];
  for (let i = 0; i < hosts.length; i += CONCURRENCY) {
    const slice = hosts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (h) => {
        const [desktop, mobile] = await Promise.all([
          probeDesktop(h),
          probeMobile(h),
        ]);
        if (desktop) return [desktop, ...(mobile ? [mobile] : [])];
        return mobile ? [mobile] : [];
      }),
    );
    for (const list of results) out.push(...list);
  }
  return out;
}

/**
 * Devices found by sweeping the LAN, normalized to the beacon shape so the
 * discovery lists can merge them with mDNS results. Cached + serialized.
 */
export async function sweepLanRaw(): Promise<LanSweepHit[]> {
  if (Date.now() - cache.at < CACHE_MS) return cache.items;
  if (inflight) return inflight;
  inflight = runSweep()
    .then((items) => {
      cache = { at: Date.now(), items };
      return items;
    })
    .catch(() => cache.items)
    .finally(() => { inflight = null; });
  return inflight;
}

/** Nearby devices in the same `{ beacon, host, platform }` shape as beacons. */
export async function sweepLanAsBeacons(): Promise<Array<{ beacon: any; host: string; platform: string; via: 'lan' }>> {
  const hits = await sweepLanRaw();
  return hits.map(toBeaconShape);
}

/** True when this phone can even attempt a sweep (needs its own LAN address). */
export async function canSweepLan(): Promise<boolean> {
  return !!(await ownIPv4());
}

export const LAN_SWEEP_SELF_NAME = getThisDeviceName();
export const LAN_SWEEP_PLATFORM = Platform.OS;
