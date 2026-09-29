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
 *   5758  desktop WS hub    → TCP connect only         (presence fallback)
 *   5759  mobile LAN hub    → `DEVICE_HELLO`           (identity)
 *
 * 5758 is probed as a bare TCP connect and only when 5757 did not answer, so
 * a desktop owner is still discovered when something blocks its HTTP port
 * (firewall rule, port already bound by a stale process) while its WS listener
 * is reachable. It yields presence without a name, exactly like the desktop
 * sweep's equivalent fallback.
 *
 * Both answers are identity-only (name, platform, business name) — no data,
 * no tokens, nothing an attacker on the LAN doesn't already see in an mDNS
 * beacon. Sweeps are serialized and cached, because the discovery screens poll
 * every few seconds and a sweep costs a couple of hundred connects.
 */

import { Platform } from 'react-native';
import { getThisDeviceName } from './deviceIdentity';
import { markPeerFound, countPeerFound } from './syncDiagnostics';

export interface LanSweepHit {
  deviceId: string;
  deviceName: string;
  platform: 'desktop' | 'mobile';
  host: string;
  port: number;
  businessName?: string | null;
  /** Open invitation the peer is currently advertising, if any. */
  inviteCode?: string | null;
  via: 'http' | 'hello' | 'port';
}

const DESKTOP_HTTP_PORT = 5757;
const DESKTOP_WS_PORT = 5758;
const MOBILE_PORT = 5759;
const IDENTITY_TIMEOUT_MS = 800;
const CONNECT_TIMEOUT_MS = 250;
const CONCURRENCY = 128;
const DISCOVERY_TTL_MS = 45_000;

/** How often a host that has answered before is re-probed on its own. */
const KNOWN_REPROBE_MS = 3_000;
/** A known host that stops answering is dropped after this long. */
const KNOWN_STALE_MS = 15_000;
/** Full /24-plus sweep cadence. The subnet walk is expensive, so it is rare. */
const FULL_SWEEP_MS = 30_000;

let cache: { at: number; items: LanSweepHit[] } = { at: 0, items: [] };
let inflight: Promise<LanSweepHit[]> | null = null;

/**
 * Hosts that answered a previous probe, with the last time they were seen.
 *
 * The full sweep walks ~3,800 hosts and takes tens of seconds, so a UI that
 * awaits it shows a stale list for that whole window — the user taps "refresh"
 * and the radar does not change. Re-probing just the hosts that have
 * answered before is ~10 connects, finishes in well under a second, and is
 * what makes discovery feel instant once a peer is known.
 */
const known = new Map<string, { hit: LanSweepHit; lastSeen: number }>();
let lastFullSweepAt = 0;
let lastKnownReprobeAt = 0;
let fullSweepRunning: Promise<LanSweepHit[]> | null = null;

/** Merge fresh hits, refresh known-host liveness, and expire stale entries. */
function reconcile(fresh: LanSweepHit[]): LanSweepHit[] {
  const now = Date.now();
  for (const hit of fresh) known.set(hit.host, { hit, lastSeen: now });
  for (const [host, entry] of known) {
    if (now - entry.lastSeen > KNOWN_STALE_MS) known.delete(host);
  }
  // P0 telemetry: only the first hit of the current window sets the latency, so
  // re-observing an already-known host does not re-time the cycle.
  for (const hit of fresh) {
    markPeerFound(hit.deviceId, { via: hit.via, host: hit.host, platform: hit.platform });
  }
  countPeerFound(fresh.length);
  return [...known.values()].map((e) => e.hit);
}

/** This phone's IPv4 on the LAN, or fallback subnets when the platform can't report it. */
async function ownIPv4(): Promise<string | null> {
  try {
    const Network = require('expo-network');
    const ip = await Network?.getIpAddressAsync?.();
    if (typeof ip === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(ip) && !ip.startsWith('127.') && ip !== '0.0.0.0') return ip;
  } catch { /* expo-network unavailable */ }
  return null;
}

function hostList(ip: string | null): string[] {
  const hosts = new Set<string>();

  // PRIORITY 1: Hotspot & Router Gateways FIRST (< 15ms probe)
  const priorityGateways = [
    '192.168.43.1',  // Android Hotspot Gateway
    '172.20.10.1',   // iOS Personal Hotspot Gateway
    '192.168.137.1', // Windows Mobile Hotspot Gateway
    '192.168.173.1', // Windows 11 Hotspot Gateway
    '192.168.49.1',  // Wi-Fi Direct / P2P Gateway
    '192.168.1.1',   // Standard Wi-Fi Router
    '192.168.0.1',   // Standard Wi-Fi Router
    '10.0.0.1',      // Generic Router
    '192.168.2.1',   // macOS/Linux Sharing
    '192.168.3.1',   // macOS/Linux Sharing
  ];

  if (ip && ip.split('.').length === 4) {
    const parts = ip.split('.');
    const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
    priorityGateways.unshift(`${prefix}.1`);
    priorityGateways.unshift(`${prefix}.254`);
  }

  for (const gw of priorityGateways) {
    if (gw !== ip) hosts.add(gw);
  }

  const addSubnet = (prefix: string, skipIp?: string) => {
    for (let i = 1; i <= 254; i += 1) {
      const h = `${prefix}.${i}`;
      if (h !== skipIp) hosts.add(h);
    }
  };

  if (ip && ip.split('.').length === 4) {
    const parts = ip.split('.');
    const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
    addSubnet(prefix, ip);
  }

  // Mobile & Desktop Hotspot subnets
  const hotspotSubnets = [
    '192.168.43',  // Android Hotspot
    '192.168.49',  // Android Wi-Fi Direct / P2P
    '192.168.50',  // Android Hotspot variant
    '192.168.100', // Android Hotspot variant
    '192.168.225', // Android Hotspot variant
    '172.20.10',   // iOS Personal Hotspot
    '192.168.137', // Windows Mobile Hotspot
    '192.168.173', // Windows 11 Mobile Hotspot variant
    '192.168.2',   // macOS / Linux Internet Sharing
    '192.168.3',   // macOS / Linux Internet Sharing
    '10.0.0',      // Generic Hotspot / Router
    '10.0.1',      // Generic Hotspot / Router
    '192.168.1',
    '192.168.0',
  ];

  for (const sub of hotspotSubnets) {
    addSubnet(sub);
  }

  return [...hosts];
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
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`http://${host}:${DESKTOP_HTTP_PORT}/sync/info`, {
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timer);
    if (!res || !res.ok) return null;
    const info = await res.json().catch(() => null);
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

/**
 * TCP-connect-only presence probe, used to detect a desktop owner whose HTTP
 * identity port is unreachable. We still have to reach the hub's real sync
 * channels to join, so this only affects discoverability, not authorization.
 */
async function probeTcpPresence(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    let TcpSocket: any;
    try {
      TcpSocket = require('react-native-tcp-socket');
    } catch { return resolve(false); }
    let settled = false;
    let socket: any;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      try { socket?.destroy?.(); } catch { /* already gone */ }
      resolve(ok);
    };
    try {
      socket = TcpSocket.createConnection({ host, port }, () => finish(true));
      socket.on('error', () => finish(false));
      socket.on('close', () => finish(false));
      socket.setTimeout?.(CONNECT_TIMEOUT_MS, () => finish(false));
      setTimeout(() => finish(false), CONNECT_TIMEOUT_MS + 200);
    } catch {
      finish(false);
    }
  });
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

async function probeHost(host: string): Promise<LanSweepHit[]> {
  const [desktop, mobile] = await Promise.all([probeDesktop(host), probeMobile(host)]);
  const out: LanSweepHit[] = [];
  if (desktop) out.push(desktop);
  if (mobile) out.push(mobile);
  // Neither identity port answered. A desktop owner may still be running with
  // its HTTP port unreachable, so fall back to a bare TCP connect on the WS
  // hub. Presence without a name is still worth showing on the radar.
  if (!desktop) {
    const wsOpen = await probeTcpPresence(host, DESKTOP_WS_PORT);
    if (wsOpen) {
      out.push({
        deviceId: `lan-${host}`,
        deviceName: `Shega device (${host})`,
        platform: 'desktop',
        host,
        port: DESKTOP_WS_PORT,
        businessName: null,
        inviteCode: null,
        via: 'port',
      });
    }
  }
  return out;
}

/** Cheap pass over hosts that have already answered once. */
async function reprobeKnown(): Promise<LanSweepHit[]> {
  const hosts = [...known.keys()];
  if (!hosts.length) return [];
  const out: LanSweepHit[] = [];
  for (let i = 0; i < hosts.length; i += CONCURRENCY) {
    const slice = hosts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((h) => probeHost(h).catch(() => [] as LanSweepHit[])));
    for (const list of results) out.push(...list);
  }
  return out;
}

/** Expensive walk of every candidate host on the phone's subnet. */
async function runSweep(): Promise<LanSweepHit[]> {
  const ip = await ownIPv4();
  const hosts = hostList(ip);
  const out: LanSweepHit[] = [];
  for (let i = 0; i < hosts.length; i += CONCURRENCY) {
    const slice = hosts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((h) => probeHost(h).catch(() => [] as LanSweepHit[])));
    for (const list of results) out.push(...list);
  }
  return out;
}

/**
 * Kick off a full subnet sweep without blocking on it. Returns the previous
 * (or current) result so the caller can render immediately; the discovery
 * emitter re-renders when the walk finishes.
 */
export function startFullSweep(): Promise<LanSweepHit[]> {
  if (fullSweepRunning) return fullSweepRunning;
  lastFullSweepAt = Date.now();
  fullSweepRunning = runSweep()
    .then((fresh) => {
      const items = reconcile(fresh);
      cache = { at: Date.now(), items };
      return items;
    })
    .catch(() => cache.items)
    .finally(() => { fullSweepRunning = null; });
  return fullSweepRunning;
}

/**
 * Devices found by sweeping the LAN, normalized to the beacon shape so the
 * discovery lists can merge them with mDNS results.
 *
 * Never blocks on the subnet walk: known hosts are re-probed inline (fast, so
 * a returning peer shows up within a refresh) and the full sweep runs in the
 * background, refreshing the cache for the next poll.
 */
export async function sweepLanRaw(): Promise<LanSweepHit[]> {
  const now = Date.now();

  // Re-probe known hosts inline, but at most every KNOWN_REPROBE_MS.
  const dueForReprobe = !inflight && now - lastKnownReprobeAt >= KNOWN_REPROBE_MS;
  if (dueForReprobe) {
    lastKnownReprobeAt = now;
    inflight = reprobeKnown()
      .then((fresh) => {
        const items = reconcile(fresh);
        cache = { at: Date.now(), items };
        return items;
      })
      .catch(() => cache.items)
      .finally(() => { inflight = null; });
  }

  // Keep a full sweep warm in the background so newly-joined devices are
  // still found, but only when the subnet is actually due for one.
  if (!fullSweepRunning && now - lastFullSweepAt >= FULL_SWEEP_MS) {
    void startFullSweep();
  }

  if (inflight) return inflight;
  return cache.items;
}

/** Nearby devices in the same `{ beacon, host, platform }` shape as beacons. */
export async function sweepLanAsBeacons(): Promise<Array<{ beacon: any; host: string; platform: string; via: 'lan' }>> {
  const hits = await sweepLanRaw();
  return hits.map(toBeaconShape);
}

/** True when this phone can attempt a sweep. Always enabled to probe hotspot & Wi-Fi subnets. */
export async function canSweepLan(): Promise<boolean> {
  return true;
}

export const LAN_SWEEP_SELF_NAME = getThisDeviceName();
export const LAN_SWEEP_PLATFORM = Platform.OS;

/**
 * The LAN sweep is a presence probe only: it proves a device is on the LAN.
 * When the swept device has no open invitation advertised, the JOINER still
 * cannot join from that probe — so lanSweep carries invitCode: null and the
 * discovery screens intentionally keep it out of the joinable list until the
 * owner side has published an open invite (see setDiscoverable).
 *
 * Role tagging is informational. The swept device is a potential joiner/
 * team target from the owner's perspective regardless of what beacon.role said.
 * We tag it 'owner' here only because the beacon shape's `role` field is the
 * device's self-declared party (owner of its own business, or joiner target).
 * The owner-side radar re-tags by `beacon.role === 'team'` for display, and
 * real join authorization comes from the invite code + the owner's approval,
 * never from this field.
 */
