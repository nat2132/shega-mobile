/**
 * P0 instrumentation — connection-timing telemetry (mobile).
 *
 * Mirror of shega-desktop/src/main/sync/diagnostics.ts, deliberately kept
 * dependency-free and Hermes-safe: no node imports, no structured logger, just
 * console output behind a single tag so timings can be grepped out of the
 * React Native logs alongside the existing `[PeerSync]` / `[pair]` tags.
 *
 * Measures the three latencies the connection redesign targets:
 *   timeToFirstPeer  — search started -> a hub/peer was identified
 *   timeToConnected  — search started -> an authenticated link is up
 *   timeToFirstSync  — link up -> first successful push/ack round-trip
 *
 * Passive: owns no sockets, timers or database handles, and every entry point
 * swallows its own errors so telemetry can never break a sync path.
 */

const TAG = '[ShegaDiag]';

export type CycleReason =
  | 'startup'
  | 'network-changed'
  | 'hub-up'
  | 'hub-down'
  | 'interval-lan'
  | 'interval-discovery'
  | 'manual'
  | string;

export interface CycleTimings {
  reason: CycleReason;
  startedAt: number;
  durationMs: number;
  timeToFirstPeerMs: number | null;
  timeToConnectedMs: number | null;
  timeToFirstSyncMs: number | null;
  peersFound: number;
  mode?: string;
}

export interface PeerDiagnostics {
  deviceId: string;
  deviceName?: string;
  platform?: string;
  transport: 'lan-ws' | 'lan-http' | 'lan-tcp' | 'cloud' | 'none' | string;
  addresses: string[];
  connected: boolean;
  lastHeartbeatAt: number | null;
  lastSyncAt: number | null;
  cursor: number | null;
  pendingOutbox: number | null;
  deadLetter: number | null;
}

export interface DiagnosticsSnapshot {
  now: number;
  current: { reason: CycleReason; startedAt: number; elapsedMs: number } | null;
  last: CycleTimings | null;
  recent: CycleTimings[];
  peers: PeerDiagnostics[];
}

const RECENT_CYCLES = 20;
const PEER_STALE_MS = 5 * 60_000;

let currentReason: CycleReason | null = null;
let currentStartedAt = 0;
let currentFirstPeerAt: number | null = null;
let currentFirstConnectedAt: number | null = null;
let currentFirstSyncAt: number | null = null;
let currentPeersFound = 0;

let lastCycle: CycleTimings | null = null;
const recentCycles: CycleTimings[] = [];
const peers = new Map<string, PeerDiagnostics>();

/** Open a measurement window. Re-entrant calls are ignored on purpose. */
export function beginCycle(reason: CycleReason): void {
  try {
    if (currentReason !== null) return;
    currentReason = reason;
    currentStartedAt = Date.now();
    currentFirstPeerAt = null;
    currentFirstConnectedAt = null;
    currentFirstSyncAt = null;
    currentPeersFound = 0;
  } catch {
    /* telemetry must never break discovery */
  }
}

/** A peer or hub was identified. Only the first one in a cycle is timed. */
export function markPeerFound(deviceId?: string, meta?: Record<string, unknown>): void {
  try {
    if (currentReason !== null && currentFirstPeerAt === null) {
      currentFirstPeerAt = Date.now();
      console.log(`${TAG} first_peer`, currentReason, currentFirstPeerAt - currentStartedAt, 'ms', deviceId ?? '', meta ?? '');
    }
    if (deviceId) touchPeer(deviceId);
  } catch {
    /* ignore */
  }
}

/** An authenticated link is up (WS/HTTP/TCP handshake completed). */
export function markConnected(deviceId?: string, meta?: Record<string, unknown>): void {
  try {
    if (currentReason !== null && currentFirstConnectedAt === null) {
      currentFirstConnectedAt = Date.now();
      console.log(`${TAG} connected`, currentReason, currentFirstConnectedAt - currentStartedAt, 'ms', deviceId ?? '', meta ?? '');
    }
    if (deviceId) {
      const p = touchPeer(deviceId);
      p.connected = true;
      if (meta?.transport) p.transport = String(meta.transport);
      if (Array.isArray(meta?.addresses)) p.addresses = meta.addresses.map(String);
    }
  } catch {
    /* ignore */
  }
}

/** First successful push/ack round-trip on a freshly connected link. */
export function markFirstSync(deviceId?: string, meta?: Record<string, unknown>): void {
  try {
    if (currentReason !== null && currentFirstSyncAt === null) {
      currentFirstSyncAt = Date.now();
      const sinceConnected = currentFirstConnectedAt !== null ? currentFirstSyncAt - currentFirstConnectedAt : null;
      console.log(`${TAG} first_sync`, currentReason, currentFirstSyncAt - currentStartedAt, 'ms', 'sinceConnected=', sinceConnected, deviceId ?? '', meta ?? '');
    }
    if (deviceId) touchPeer(deviceId).lastSyncAt = Date.now();
  } catch {
    /* ignore */
  }
}

/** Arbitrary named mark. */
export function mark(name: string, meta?: Record<string, unknown>): void {
  try {
    console.log(`${TAG} mark ${name}`, meta ?? '');
  } catch {
    /* ignore */
  }
}

/** Count peers seen in the current window (called by the discovery layers). */
export function countPeerFound(n = 1): void {
  currentPeersFound += n;
}

/** Close the window. No-op when no window is open. */
export function endCycle(extra?: { mode?: string }): CycleTimings | null {
  if (currentReason === null) return null;
  const endedAt = Date.now();
  const cycle: CycleTimings = {
    reason: currentReason,
    startedAt: currentStartedAt,
    durationMs: endedAt - currentStartedAt,
    timeToFirstPeerMs: currentFirstPeerAt !== null ? currentFirstPeerAt - currentStartedAt : null,
    timeToConnectedMs: currentFirstConnectedAt !== null ? currentFirstConnectedAt - currentStartedAt : null,
    timeToFirstSyncMs: currentFirstSyncAt !== null ? currentFirstSyncAt - currentStartedAt : null,
    peersFound: currentPeersFound,
    ...(extra?.mode ? { mode: extra.mode } : {}),
  };
  currentReason = null;
  currentFirstPeerAt = null;
  currentFirstConnectedAt = null;
  currentFirstSyncAt = null;
  lastCycle = cycle;
  recentCycles.push(cycle);
  if (recentCycles.length > RECENT_CYCLES) recentCycles.shift();
  console.log(`${TAG} cycle`, cycle);
  return cycle;
}

export function isCycleOpen(): boolean {
  return currentReason !== null;
}

function touchPeer(deviceId: string): PeerDiagnostics {
  let p = peers.get(deviceId);
  if (!p) {
    p = {
      deviceId,
      transport: 'none',
      addresses: [],
      connected: false,
      lastHeartbeatAt: null,
      lastSyncAt: null,
      cursor: null,
      pendingOutbox: null,
      deadLetter: null,
    };
    peers.set(deviceId, p);
  }
  return p;
}

export function markHeartbeat(deviceId: string, meta?: Record<string, unknown>): void {
  try {
    const p = touchPeer(deviceId);
    p.lastHeartbeatAt = Date.now();
    if (meta?.transport) p.transport = String(meta.transport);
  } catch {
    /* ignore */
  }
}

export function markDisconnected(deviceId: string): void {
  try {
    const p = peers.get(deviceId);
    if (p) {
      p.connected = false;
      p.transport = 'none';
    }
  } catch {
    /* ignore */
  }
}

/** Cursor + backlog counters for the diagnostics view. */
export function setPeerCounters(
  deviceId: string,
  counters: { cursor?: number | null; pendingOutbox?: number | null; deadLetter?: number | null },
): void {
  try {
    const p = touchPeer(deviceId);
    if (counters.cursor !== undefined) p.cursor = counters.cursor;
    if (counters.pendingOutbox !== undefined) p.pendingOutbox = counters.pendingOutbox;
    if (counters.deadLetter !== undefined) p.deadLetter = counters.deadLetter;
  } catch {
    /* ignore */
  }
}

export function getDiagnosticsSnapshot(): DiagnosticsSnapshot {
  const now = Date.now();
  const live: PeerDiagnostics[] = [];
  for (const p of peers.values()) {
    const lastHeard = Math.max(p.lastHeartbeatAt ?? 0, p.lastSyncAt ?? 0);
    if (lastHeard > 0 && now - lastHeard > PEER_STALE_MS) continue;
    live.push({ ...p });
  }
  live.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
  return {
    now,
    current:
      currentReason !== null
        ? { reason: currentReason, startedAt: currentStartedAt, elapsedMs: now - currentStartedAt }
        : null,
    last: lastCycle,
    recent: [...recentCycles],
    peers: live,
  };
}

/** Test hook: reset all state. */
export function __resetDiagnostics(): void {
  currentReason = null;
  currentStartedAt = 0;
  currentFirstPeerAt = null;
  currentFirstConnectedAt = null;
  currentFirstSyncAt = null;
  currentPeersFound = 0;
  lastCycle = null;
  recentCycles.length = 0;
  peers.clear();
}
