import { EventEmitter } from 'events';
import { Platform } from 'react-native';
// The library's CJS build exposes the class as exports.default; a named
// ESM import resolves to undefined and `new` throws at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Zeroconf: any = require('react-native-zeroconf').default;

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

class MobileMdnsDiscovery extends EventEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private zeroconf: any | null = null;
  private isScanning = false;
  private warnedUnavailable = false;
  private discoveredHubs = new Map<string, DiscoveredHub>();

  constructor() {
    super();
  }

  start(): void {
    if (this.isScanning) return;

    if (!Zeroconf) {
      if (!this.warnedUnavailable) {
        this.warnedUnavailable = true;
        console.warn('[mDNS] react-native-zeroconf unavailable (native module missing — rebuild the dev client with `npx expo run:android`)');
      }
      this.isScanning = true;
      return;
    }

    try {
      this.zeroconf = new Zeroconf();
    } catch (e: any) {
      console.warn('[mDNS] Zeroconf unavailable:', e?.message);
      this.zeroconf = null;
      this.isScanning = true;
      return;
    }
    this.zeroconf.on('resolved', (service: any) => {
      const deviceId = service.txtRecord?.device_id;
      if (!deviceId) return;

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

      this.discoveredHubs.set(deviceId, hub);
      console.log(`[mDNS] Discovered hub: ${deviceId} at ${service.host}:${service.port}`);
      this.emit('up', hub);
    });

    this.zeroconf.on('remove', (service: any) => {
      const deviceId = service.txtRecord?.device_id;
      if (!deviceId) return;

      const existing = this.discoveredHubs.get(deviceId);
      if (existing) {
        this.discoveredHubs.delete(deviceId);
        console.log(`[mDNS] Hub went down: ${deviceId}`);
        this.emit('down', existing);
      }
    });

    this.zeroconf.on('error', (err: any) => {
      console.error('[mDNS] Zeroconf error:', err);
      this.emit('error', err as Error);
    });

    // Start scanning for _shega-pos._tcp.local.
    this.zeroconf.scan('shega-pos', 'tcp');
    this.isScanning = true;
    console.log('[mDNS] Scanning for Shega POS hubs...');
  }

  getDiscoveredHubs(): DiscoveredHub[] {
    return Array.from(this.discoveredHubs.values());
  }

  getHub(deviceId: string): DiscoveredHub | undefined {
    return this.discoveredHubs.get(deviceId);
  }

  stop(): void {
    if (this.zeroconf) {
      this.zeroconf.stop();
      this.zeroconf = null;
    }
    this.isScanning = false;
    this.discoveredHubs.clear();
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