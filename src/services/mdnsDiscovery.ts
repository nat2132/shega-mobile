import { EventEmitter } from 'events';
import { mdnsRegistry } from './mobileMdnsRegistry';

export interface DiscoveredHub {
  deviceId: string;
  pairingToken: string;
  schemaVersion: number;
  port: number;
  host: string;
  addresses: string[];
  capabilities: string[];
  discoveredAt: number;
  platform?: string;
  businessId?: string;
}

type DiscoveryEventMap = {
  up: [DiscoveredHub];
  down: [DiscoveredHub];
  error: [Error];
};

/**
 * Hub discovery (mobile side) for `_shega-pos._tcp`.
 *
 * All native NSD access is arbitrated by `mdnsRegistry`: Android allows ONE
 * discovery listener per app, so this module requests the `shega-pos` browse
 * (the app's default) and consumes events from the registry's single Zeroconf
 * instance. The pairing radar may temporarily preempt the browse while it is
 * open; the registry restores this one when the radar closes.
 *
 * mDNS is NOT the only discovery path — the pairing module also runs a TCP LAN
 * sweep that works when multicast is blocked (Windows Firewall / AP isolation).
 */
class MobileMdnsDiscovery extends EventEmitter {
  private isScanning = false;
  private warnedUnavailable = false;
  private discoveredHubs = new Map<string, DiscoveredHub>();
  /** Instance name → deviceId, so 'remove' events (name-only) can be matched. */
  private nameToId = new Map<string, string>();
  private unsubs: Array<() => void> = [];

  constructor() {
    super();
  }

  start(): void {
    if (this.isScanning) return;

    if (!mdnsRegistry.nativePresent || !mdnsRegistry.getSnapshot().zcCreated) {
      if (!this.warnedUnavailable) {
        this.warnedUnavailable = true;
        console.warn('[mDNS] react-native-zeroconf unavailable (native module missing — rebuild the dev client with `npx expo run:android`)');
      }
      this.isScanning = true;
      return;
    }

    this.attachListeners();
    mdnsRegistry.browse('shega-pos');
    this.isScanning = true;
    console.log('[mDNS] Scanning for Shega POS hubs...');
  }

  private attachListeners(): void {
    if (this.unsubs.length > 0) return;
    this.unsubs.push(mdnsRegistry.on('resolved', (service: any) => {
      const deviceId = service?.txtRecord?.device_id;
      if (!deviceId) return;
      // Pairing beacons (`_shega-pair` and legacy shega-pos ads that carry a
      // `beacon` payload) are NOT hubs — skip them here to keep this list clean.
      if (service?.txtRecord?.beacon) return;
      const svcName = service?.name || '';

      const hub: DiscoveredHub = {
        deviceId,
        pairingToken: service.txtRecord?.pairing_token || '',
        schemaVersion: parseInt(service.txtRecord?.schema_version || '0', 10),
        port: service.port,
        host: service.host,
        addresses: [service.ip],
        capabilities: (service.txtRecord?.capabilities || '').split(',').filter(Boolean),
        discoveredAt: Date.now(),
        platform: service.txtRecord?.platform || 'desktop',
        businessId: service.txtRecord?.business_id || undefined,
      };

      if (svcName) this.nameToId.set(svcName, deviceId);
      this.discoveredHubs.set(deviceId, hub);
      console.log(`[mDNS] Discovered hub: ${deviceId} at ${service.host}:${service.port}`);
      this.emit('up', hub);
    }));

    this.unsubs.push(mdnsRegistry.on('remove', (data: any) => {
      // The library relays RNZeroconfServiceRemoved as a bare instance name;
      // the registry normalizes it to { name } — accept both shapes.
      const name: string = typeof data === 'string' ? data : data?.name;
      if (!name) return;
      const deviceId = this.nameToId.get(name);
      if (!deviceId) return;
      this.nameToId.delete(name);
      const existing = this.discoveredHubs.get(deviceId);
      if (existing) {
        this.discoveredHubs.delete(deviceId);
        console.log(`[mDNS] Hub went down: ${deviceId}`);
        this.emit('down', existing);
      }
    }));

    this.unsubs.push(mdnsRegistry.on('error', (err: any) => {
      console.error('[mDNS] Zeroconf error:', err);
      this.emit('error', err as Error);
    }));
  }

  getDiscoveredHubs(): DiscoveredHub[] {
    return Array.from(this.discoveredHubs.values());
  }

  getHub(deviceId: string): DiscoveredHub | undefined {
    return this.discoveredHubs.get(deviceId);
  }

  stop(): void {
    for (const unsub of this.unsubs) {
      try { unsub(); } catch { /* best-effort */ }
    }
    this.unsubs = [];
    this.isScanning = false;
    this.discoveredHubs.clear();
    this.nameToId.clear();
    console.log('[mDNS] Stopped scanning');
  }

  isScanningActive(): boolean {
    return this.isScanning;
  }
}

// Export singleton
export const mdnsDiscovery = new MobileMdnsDiscovery();

export function startMdnsDiscovery(): void {
  mdnsDiscovery.start();
}

export function stopMdnsDiscovery(): void {
  mdnsDiscovery.stop();
}