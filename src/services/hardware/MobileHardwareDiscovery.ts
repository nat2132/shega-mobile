/**
 * Mobile POS hardware — discovery.
 *
 * Reports what the platform can actually offer, and never claims a capability
 * the current Expo build cannot deliver. Network printer probing uses
 * `react-native-tcp-socket` (already a dependency) and is only attempted in a
 * dev build, since it is a native module.
 */

import { EventEmitter } from 'events';
import { Platform } from 'react-native';
import * as Network from 'expo-network';
import { getScannerCapabilities, type ScannerCapabilities } from '@/services/scanner/MobileBarcodeScanner';

export type MobileDeviceType = 'barcode_scanner' | 'receipt_printer';
export type MobileConnectionType = 'camera' | 'hid_wedge' | 'bluetooth' | 'network_tcp';

export interface MobileDetectedDevice {
  deviceId: string;
  deviceType: MobileDeviceType;
  connectionType: MobileConnectionType;
  name: string;
  host?: string;
  networkPort?: number;
  protocol?: 'ESC/POS' | 'HID';
  confidence: 'high' | 'medium' | 'low';
  previouslyConfigured: boolean;
  lastSeen: number;
  available: boolean;
  /** Why this source is unavailable, when applicable. */
  note?: string;
}

/** A TCP printer the user already configured (IP is user-supplied, never scanned). */
export interface KnownNetworkPrinter {
  id: string;
  host: string;
  port: number;
  name: string;
  paperWidth?: 58 | 80;
}

export class MobileHardwareDiscovery extends EventEmitter {
  private known: Map<string, MobileDetectedDevice> = new Map();
  private networkPrinters: KnownNetworkPrinter[] = [];
  private scanning = false;

  getKnownDevices(): MobileDetectedDevice[] {
    return Array.from(this.known.values());
  }

  /** Devices that are inherently always present on the phone. */
  private builtinDevices(): MobileDetectedDevice[] {
    const now = Date.now();
    const caps: ScannerCapabilities = getScannerCapabilities();
    const devices: MobileDetectedDevice[] = [
      {
        deviceId: 'camera_builtin',
        deviceType: 'barcode_scanner',
        connectionType: 'camera',
        name: 'Camera',
        protocol: 'HID',
        confidence: 'high',
        previouslyConfigured: false,
        lastSeen: now,
        available: caps.camera,
        note: caps.camera ? undefined : 'Camera unavailable',
      },
    ];

    if (caps.hidWedge) {
      devices.push({
        deviceId: 'hid_wedge',
        deviceType: 'barcode_scanner',
        connectionType: 'hid_wedge',
        name: 'Bluetooth / USB Keyboard Scanner',
        protocol: 'HID',
        confidence: 'high',
        previouslyConfigured: false,
        lastSeen: now,
        available: true,
        note: 'Pair the scanner in system Bluetooth settings, then scan.',
      });
    }

    if (!caps.bluetoothNative) {
      devices.push({
        deviceId: 'bluetooth_native',
        deviceType: 'barcode_scanner',
        connectionType: 'bluetooth',
        name: 'Native Bluetooth (BLE / SPP)',
        protocol: 'HID',
        confidence: 'low',
        previouslyConfigured: false,
        lastSeen: now,
        available: false,
        note: 'Needs a development build with a Bluetooth native module.',
      });
    }

    return devices;
  }

  /** Register an IP printer the user configured by hand. */
  setNetworkPrinters(printers: KnownNetworkPrinter[]): void {
    this.networkPrinters = printers;
  }

  /**
   * Probe a configured IP for an ESC/POS listener on the print port.
   * Resolves false (never throws) when the native socket module is missing.
   */
  private async probePrinter(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
    try {
      // Native module: absent in Expo Go, present in a dev build.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const TcpSocket = require('react-native-tcp-socket');
      return await new Promise<boolean>((resolve) => {
        let settled = false;
        const done = (ok: boolean) => {
          if (settled) return;
          settled = true;
          try { socket.destroy(); } catch { /* already closed */ }
          resolve(ok);
        };
        const socket = TcpSocket.createConnection({ host, port, timeout: timeoutMs }, () => done(true));
        socket.on('error', () => done(false));
        socket.on('timeout', () => done(false));
      });
    } catch {
      return false;
    }
  }

  async scan(): Promise<MobileDetectedDevice[]> {
    if (this.scanning) return this.getKnownDevices();
    this.scanning = true;
    this.emit('scan:start');

    const now = Date.now();

    for (const d of this.builtinDevices()) {
      this.known.set(d.deviceId, d);
    }

    for (const p of this.networkPrinters) {
      const id = `net_${p.host.replace(/\./g, '_')}_${p.port}`;
      const online = await this.probePrinter(p.host, p.port);
      this.known.set(id, {
        deviceId: id,
        deviceType: 'receipt_printer',
        connectionType: 'network_tcp',
        name: p.name || `Printer ${p.host}`,
        host: p.host,
        networkPort: p.port,
        protocol: 'ESC/POS',
        confidence: 'high',
        previouslyConfigured: true,
        lastSeen: now,
        available: online,
        note: online ? undefined : 'No response on port ' + p.port,
      });
    }

    this.scanning = false;
    const devices = this.getKnownDevices();
    this.emit('scan:complete', { devices });
    return devices;
  }

  /** Local subnet hint for "add a network printer" UI. */
  async localSubnetHint(): Promise<string | null> {
    try {
      const state = await Network.getNetworkStateAsync();
      if (!state.isInternetReachable && !state.isConnected) return null;
      const ip = await Network.getIpAddressAsync();
      if (!ip) return null;
      const parts = ip.split('.');
      return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}` : null;
    } catch {
      return null;
    }
  }

  get platform(): string {
    return Platform.OS;
  }
}

export const mobileHardwareDiscovery = new MobileHardwareDiscovery();
