/**
 * Mobile Peer Sync Manager — the unified sync orchestrator for mobile devices.
 *
 * Coordinates:
 * 1. Local sync server (Mobile↔Mobile via LAN)
 * 2. Sync client (Mobile↔Desktop via LAN)
 *
 * Network behavior:
 * - LAN available → LAN sync
 * - No LAN → Offline mode, queue changes for later
 *
 * This module replaces the ad-hoc sync calls scattered across SyncContext
 * with a single, coordinated sync engine.
 */

import { getDB } from '../database/db';
import {
  getDeviceId,
  getHubUrl,
  setHubUrl,
  setHubToken,
  syncNow as lanSyncNow,
  getSyncStatus,
  getUnifiedSyncStatus,
} from './syncService';
import { mdnsDiscovery, startMdnsDiscovery, stopMdnsDiscovery } from './mdnsDiscovery';
import { mobilePairingBeacon } from './mobilePairingBeacon';
import {
  startMobileSyncServer,
  stopMobileSyncServer,
  isMobileSyncServerRunning,
} from './mobileSyncServer';
import {
  publishMobileHub,
  unpublishMobileHub,
} from './mobileMdnsPublisher';
import type {
  SyncTransport,
  SyncHealth,
  NetworkCapabilities,
  DevicePlatform,
  PeerSyncStatus,
  DiscoveredPeer,
} from '@shega/shared';
import { getSyncStrategy } from '@shega/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

export type SyncMode = 'hub' | 'client' | 'both' | 'offline';

export interface PeerSyncState {
  mode: SyncMode;
  transport: SyncTransport;
  health: SyncHealth;
  isServerRunning: boolean;
  isDiscovering: boolean;
  discoveredPeers: DiscoveredPeer[];
  lastSyncAt: string | null;
  lastError: string | null;
  pendingChanges: number;
}

// ─── Configuration ──────────────────────────────────────────────────────────

const LAN_SYNC_INTERVAL_MS = 5_000;    // 5s for fast real-time sync
const DISCOVERY_INTERVAL_MS = 10_000;   // 10s for peer discovery

// ─── State ──────────────────────────────────────────────────────────────────

let currentMode: SyncMode = 'offline';
let lanTimer: ReturnType<typeof setInterval> | null = null;
let discoveryTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastError: string | null = null;
let autoConnectSince: number | null = null;
let lanSyncInFlight = false;
const peerSyncCleanup: Array<() => void> = [];

// ─── Mode detection ─────────────────────────────────────────────────────────

/**
 * Determine the sync mode for this device based on discovered peers and
 * configuration:
 *
 * - `hub`: This device has a local sync server running and is accepting connections
 * - `client`: This device connects to a discovered hub
 * - `both`: This device is both a hub (for other devices) and a client (to a desktop hub)
 * - `offline`: No network, no hub to connect to
 */
function detectMode(): SyncMode {
  const hubUrl = getHubUrl();
  const hasServerRunning = isMobileSyncServerRunning();
  const discovered = mdnsDiscovery.getDiscoveredHubs();
  const hasPeerHub = discovered.length > 0;

  if (hasServerRunning && hasPeerHub) return 'both';
  if (hasServerRunning) return 'hub';
  if (hasPeerHub || hubUrl) return 'client';
  return 'offline';
}

// ─── Sync cycle ─────────────────────────────────────────────────────────────

/**
 * Perform one LAN sync cycle (single-flight: overlapping triggers — e.g. an
 * interval tick plus a discovery 'up' event — coalesce instead of racing).
 * Push local changes, pull remote changes from any connected hub.
 */
async function performLanSync(): Promise<{ pushed: number; pulled: number; conflicts: number } | null> {
  const hubUrl = getHubUrl();
  if (!hubUrl) return null;
  if (lanSyncInFlight) return null;

  lanSyncInFlight = true;
  try {
    const result = await lanSyncNow();
    lastError = null;
    return result;
  } catch (e: any) {
    lastError = e?.message;
    console.warn('[PeerSync] LAN sync failed:', e?.message);
    // Self-heal: an auth failure usually means the stored pairing token is
    // stale (desktop regenerates it). Re-adopt the token from a discovered
    // hub's mDNS TXT record and retry once.
    if (/403|invalid pairing token|unauthorized/i.test(String(e?.message))) {
      const peer = mdnsDiscovery.getDiscoveredHubs()[0];
      if (peer?.pairingToken) {
        console.log('[PeerSync] Retrying with refreshed pairing token');
        try {
          setHubToken(peer.pairingToken);
          const result2 = await lanSyncNow();
          lastError = null;
          return result2;
        } catch (e2: any) {
          lastError = e2?.message;
          console.warn('[PeerSync] LAN sync retry failed:', e2?.message);
        }
      }
    }
    return null;
  } finally {
    lanSyncInFlight = false;
  }
}

// ─── Discovery cycle ────────────────────────────────────────────────────────

/**
 * Check for new peers and decide whether to connect or advertise.
 * Runs periodically to handle peers joining/leaving the network.
 */
async function performDiscoveryCycle(): Promise<void> {
  let peers = mdnsDiscovery.getDiscoveredHubs();
  const hubUrl = getHubUrl();

  // mDNS-blocked fallback: the pairing-beacon radar's LAN sweep (raw TCP
  // DEVICE_HELLO probes, no multicast) also finds desktop owners. Adopt the
  // first desktop-platform hit as the hub endpoint when mDNS saw nothing.
  if (peers.length === 0) {
    try {
      const swept = mobilePairingBeacon.getNearbyOwners()
        .filter(({ beacon }) => beacon.owner?.platform === 'desktop' && !!beacon.owner?.deviceId);
      for (const { beacon, host } of swept) {
        if (!host) continue;
        peers = [{
          deviceId: beacon.owner!.deviceId,
          name: beacon.owner?.deviceName || 'Desktop Hub',
          host,
          addresses: [host],
          port: 5757,
          pairingToken: (beacon as any).pairingToken,
        } as any];
        console.log(`[PeerSync] mDNS silent — adopting LAN-swept desktop hub at ${host}:5757`);
        break;
      }
    } catch { /* radar not open or no sweep yet */ }
  }

  // Auto-connect / Auto-upgrade: if we discovered a hub on the LAN, adopt or update to the direct LAN endpoint
  if (peers.length > 0) {
    const peer = peers[0];
    const peerUrl = `http://${peer.addresses?.[0] || peer.host}:${peer.port}`;
    if (!hubUrl || (hubUrl !== peerUrl && peer.pairingToken)) {
      console.log(`[PeerSync] Auto-connecting / upgrading to discovered LAN hub: ${peerUrl}`);
      try {
        setHubUrl(peerUrl);
        if (peer.pairingToken) setHubToken(peer.pairingToken);
        autoConnectSince = Date.now();
      } catch (e: any) {
        console.warn('[PeerSync] Auto-connect / upgrade failed:', e?.message);
      }
    }
  }

  // If we're a hub and there are no peer hubs, stay as hub
  // If we're a hub and there are peer hubs, we could be both
  currentMode = detectMode();
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Start the peer sync manager.
 * Initializes the local sync server (if TCP server is available),
 * starts mDNS discovery, and begins periodic sync cycles.
 */
export async function startPeerSyncManager(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  console.log('[PeerSync] Starting peer sync manager...');

  // Try to start the local sync server (enables hub mode)
  const serverStarted = await startMobileSyncServer();
  if (serverStarted) {
    publishMobileHub();
    console.log('[PeerSync] Running in hub mode');
  } else {
    console.log('[PeerSync] Running in client-only mode (TCP server unavailable)');
  }

  // Start mDNS discovery (find other hubs)
  try {
    startMdnsDiscovery();
  } catch (e: any) {
    console.warn('[PeerSync] mDNS discovery unavailable:', e?.message);
  }

  // Event-driven triggers: a hub appearing/disappearing on the LAN is the
  // strongest reconnect signal (device cames back online / network restored /
  // network switched). React to it immediately instead of waiting up to
  // 15s (discovery poll) to pick the hub back up.
  const onHubUp = (hub: { deviceId: string }) => {
    console.log(`[PeerSync] Hub appeared: ${hub.deviceId}`);
    performDiscoveryCycle()
      .then(() => {
        const mode = detectMode();
        if (mode === 'client' || mode === 'both') return performLanSync();
        return null;
      })
      .catch((e: any) => console.warn('[PeerSync] hub-up cycle failed:', e?.message));
  };
  const onHubDown = (hub: { deviceId: string }) => {
    console.log(`[PeerSync] Hub went away: ${hub.deviceId}`);
    // mark offline; next periodic cycle / re-discovery will recover
    currentMode = detectMode();
  };
  mdnsDiscovery.on('up', onHubUp);
  mdnsDiscovery.on('down', onHubDown);
  peerSyncCleanup.push(() => mdnsDiscovery.off('up', onHubUp));
  peerSyncCleanup.push(() => mdnsDiscovery.off('down', onHubDown));

  // Detect initial mode
  currentMode = detectMode();
  console.log(`[PeerSync] Initial mode: ${currentMode}`);

  // Run one discovery + sync cycle immediately so a freshly opened app
  // connects to a visible hub right away instead of waiting 15–30s.
  (async () => {
    try {
      await performDiscoveryCycle();
      const mode = detectMode();
      if (mode === 'client' || mode === 'both') await performLanSync();
    } catch (e: any) { console.warn('[PeerSync] initial cycle failed:', e?.message); }
  })();

  // Start periodic sync cycles
  if (lanTimer) clearInterval(lanTimer);
  lanTimer = setInterval(async () => {
    const mode = detectMode();
    if (mode === 'client' || mode === 'both') {
      await performLanSync();
    }
  }, LAN_SYNC_INTERVAL_MS);

  if (discoveryTimer) clearInterval(discoveryTimer);
  discoveryTimer = setInterval(async () => {
    await performDiscoveryCycle();
  }, DISCOVERY_INTERVAL_MS);

  console.log('[PeerSync] Peer sync manager started');
}

/**
 * Stop the peer sync manager.
 */
export function stopPeerSyncManager(): void {
  if (lanTimer) { clearInterval(lanTimer); lanTimer = null; }
  if (discoveryTimer) { clearInterval(discoveryTimer); discoveryTimer = null; }

  peerSyncCleanup.splice(0).forEach((fn) => fn());

  stopMobileSyncServer();
  unpublishMobileHub();
  stopMdnsDiscovery();

  isRunning = false;
  currentMode = 'offline';
  console.log('[PeerSync] Peer sync manager stopped');
}

/**
 * Get the current peer sync state.
 */
export async function getPeerSyncState(): Promise<PeerSyncState> {
  const unified = await getUnifiedSyncStatus();
  const discovered = mdnsDiscovery.getDiscoveredHubs().map((h): DiscoveredPeer => ({
    deviceId: h.deviceId,
    platform: 'desktop',
    schemaVersion: h.schemaVersion,
    port: h.port,
    host: h.host,
    addresses: h.addresses,
    capabilities: h.capabilities,
    discoveredAt: h.discoveredAt,
  }));

  return {
    mode: detectMode(),
    transport: unified.transport,
    health: unified.health,
    isServerRunning: isMobileSyncServerRunning(),
    isDiscovering: mdnsDiscovery.isScanningActive(),
    discoveredPeers: discovered,
    lastSyncAt: unified.lastSyncAt,
    lastError,
    pendingChanges: unified.pendingOutbound,
  };
}

/**
 * Trigger an immediate sync (user-initiated).
 */
export async function triggerSync(): Promise<{
  lan: { pushed: number; pulled: number; conflicts: number } | null;
}> {
  const lan = await performLanSync();
  return { lan };
}
