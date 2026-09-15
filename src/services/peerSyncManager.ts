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
  syncNow as lanSyncNow,
  getSyncStatus,
  getUnifiedSyncStatus,
} from './syncService';
import { mdnsDiscovery, startMdnsDiscovery, stopMdnsDiscovery } from './mdnsDiscovery';
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

const LAN_SYNC_INTERVAL_MS = 30_000;   // 30s
const DISCOVERY_INTERVAL_MS = 15_000;    // 15s

// ─── State ──────────────────────────────────────────────────────────────────

let currentMode: SyncMode = 'offline';
let lanTimer: NodeJS.Timeout | null = null;
let discoveryTimer: NodeJS.Timeout | null = null;
let isRunning = false;
let lastError: string | null = null;

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
 * Perform one LAN sync cycle.
 * Push local changes, pull remote changes from any connected hub.
 */
async function performLanSync(): Promise<{ pushed: number; pulled: number; conflicts: number } | null> {
  const hubUrl = getHubUrl();
  if (!hubUrl) return null;

  try {
    const result = await lanSyncNow();
    console.log('[PeerSync] LAN sync:', result);
    return result;
  } catch (e: any) {
    lastError = e?.message;
    console.warn('[PeerSync] LAN sync failed:', e?.message);
    return null;
  }
}

// ─── Discovery cycle ────────────────────────────────────────────────────────

/**
 * Check for new peers and decide whether to connect or advertise.
 * Runs periodically to handle peers joining/leaving the network.
 */
async function performDiscoveryCycle(): Promise<void> {
  const peers = mdnsDiscovery.getDiscoveredHubs();
  const hubUrl = getHubUrl();

  // If we found a new peer hub and we're not connected to any hub yet,
  // automatically configure the connection
  if (peers.length > 0 && !hubUrl) {
    const peer = peers[0]; // Connect to the first discovered hub
    const peerUrl = `http://${peer.host}:${peer.port}`;
    console.log(`[PeerSync] Auto-connecting to discovered hub: ${peerUrl}`);
    // The caller should set the hub URL and token via the settings UI
    // For now, we just log the discovery
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

  // Detect initial mode
  currentMode = detectMode();
  console.log(`[PeerSync] Initial mode: ${currentMode}`);

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
