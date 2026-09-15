/**
 * Mobile Companion service — tracks the phone's role as a desktop peripheral
 * (barcode scanner / camera) and reports status to the hub.
 *
 * Companion mode is a *state*, not a screen: the PeripheralCenter and the
 * dashboard both read from it. The dedicated screen lives in
 * screens/settings/devices/CompanionScreen.
 */

import { wsSyncClient } from './wsSyncClient';
import { mdnsDiscovery } from './mdnsDiscovery';

export type CompanionMode = 'idle' | 'scanner' | 'camera';
export type CompanionState = 'disconnected' | 'connecting' | 'connected';

interface CompanionSnapshot {
  state: CompanionState;
  mode: CompanionMode;
  hubUrl: string | null;
  hubName: string | null;
  lastStatusAt: number | null;
}

type Listener = (s: CompanionSnapshot) => void;

class CompanionService {
  private mode: CompanionMode = 'idle';
  private state: CompanionState = 'disconnected';
  private listeners = new Set<Listener>();
  private beaconTimer: ReturnType<typeof setInterval> | null = null;
  private snapshot: CompanionSnapshot = {
    state: 'disconnected', mode: 'idle', hubUrl: null, hubName: null, lastStatusAt: null,
  };

  get(): CompanionSnapshot { return { ...this.snapshot }; }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.get());
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.snapshot = {
      state: this.state,
      mode: this.mode,
      hubUrl: this.snapshot.hubUrl,
      hubName: this.snapshot.hubName,
      lastStatusAt: this.snapshot.lastStatusAt,
    };
    this.listeners.forEach((fn) => fn(this.get()));
  }

  setMode(mode: CompanionMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.emit();
    this.reportStatus();
  }

  refreshConnection(): void {
    const connected = wsSyncClient.isConnected;
    const prev = this.state;
    this.state = connected ? 'connected' : 'disconnected';
    // Discover hub identity when we know of one.
    try {
      const hub = mdnsDiscovery.getDiscoveredHubs()[0];
      if (hub) this.snapshot.hubName = hub.platform === 'desktop' ? 'Shega Desktop' : this.snapshot.hubName;
    } catch {}
    if (prev !== this.state) this.emit();
    if (connected) this.startBeacon();
    else this.stopBeacon();
  }

  /** Periodically beacon our mode to the desktop so its UI stays accurate. */
  private startBeacon(): void {
    if (this.beaconTimer) return;
    this.reportStatus();
    this.beaconTimer = setInterval(() => this.reportStatus(), 15000);
  }

  private stopBeacon(): void {
    if (this.beaconTimer) { clearInterval(this.beaconTimer); this.beaconTimer = null; }
  }

  reportStatus(): void {
    if (!wsSyncClient.isConnected) return;
    try {
      const { getThisDeviceId } = require('@/services/businessService');
      wsSyncClient.sendRaw({
        type: 'PERIPHERAL_STATUS',
        payload: {
          deviceId: getThisDeviceId() || undefined,
          mode: this.mode,
          busy: this.mode !== 'idle',
        },
      });
      this.snapshot.lastStatusAt = Date.now();
    } catch { /* not connected — beacon retries */ }
  }

  /** Disconnect from the desktop entirely (user-initiated). */
  async disconnect(): Promise<void> {
    try { wsSyncClient.unregisterPeripheral(); } catch {}
    try { await wsSyncClient.disconnect(); } catch {}
    this.mode = 'idle';
    this.state = 'disconnected';
    this.stopBeacon();
    this.emit();
  }
}

export const companionService = new CompanionService();
