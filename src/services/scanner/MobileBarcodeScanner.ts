/**
 * Mobile POS hardware — unified scanner facade.
 *
 * ARCHITECTURAL NOTE
 * The app already has a working app-level scanner interface in
 * `src/services/peripherals/peripheralManager.ts`:
 *
 *   manager.handleScan(code, source)   // publish
 *   manager.onScan(cb)                  // subscribe -> (ScanResult, item | null)
 *
 * Camera (`BarcodeScanner.tsx`), keyboard-wedge/Bluetooth-HID
 * (`HidScannerCapture.tsx`) and the mock bridge all already funnel through it,
 * and it resolves the product for you before notifying subscribers. This module
 * therefore adds no second event bus; it only exposes the unified event type and
 * a couple of helpers so callers do not depend on PeripheralManager internals.
 *
 * Real platform capability today:
 *  - camera     : yes (expo-camera)
 *  - HID wedge  : yes — this is how Bluetooth and USB barcode guns present on a
 *                 phone, so BT scanners are supported *via the wedge*
 *  - native BLE : no native module in this Expo build (reported honestly below)
 *  - serial OTG : no native module in this Expo build
 */

import { getPeripheralManager } from '@/services/peripherals/peripheralManager';
import type { ConnectionType, ScanResult } from '@/services/peripherals/types';

/** The single application-level scan event shape, per the hardware spec. */
export type BarcodeScanSource = 'serial' | 'hid' | 'camera' | 'bluetooth' | 'remote';

export interface BarcodeScanEvent {
  barcode: string;
  source: BarcodeScanSource;
  deviceId?: string;
  timestamp: number;
}

export interface ScannerCapabilities {
  camera: boolean;
  hidWedge: boolean;
  bluetoothNative: boolean;
  serial: boolean;
}

/** Map the app's internal ConnectionType onto the public scan-event source. */
export function toScanSource(connectionType: ConnectionType | string): BarcodeScanSource {
  switch (connectionType) {
    case 'camera':
      return 'camera';
    case 'keyboard_hid':
    case 'usb_hid':
      return 'hid';
    case 'bluetooth_hid':
    case 'bluetooth_spp':
      return 'bluetooth';
    case 'serial':
      return 'serial';
    default:
      // Paired-desktop relay and anything else we do not model explicitly.
      return 'remote';
  }
}

export function getScannerCapabilities(): ScannerCapabilities {
  return {
    camera: true,
    hidWedge: true,
    // Raw BLE/SPP needs a native module that this Expo build does not include.
    bluetoothNative: false,
    serial: false,
  };
}

/** Publish a decoded camera scan. */
export function publishCameraScan(barcode: string): void {
  getPeripheralManager().handleScan(barcode, 'camera');
}

/** Publish a keystroke-delimited HID wedge scan. */
export function publishHidScan(barcode: string): void {
  getPeripheralManager().handleScan(barcode, 'keyboard_hid');
}

/** Publish a scan relayed from a paired desktop (phone-as-scanner). */
export function publishRemoteScan(barcode: string): void {
  getPeripheralManager().handleScan(barcode, 'keyboard_hid');
}

/**
 * Subscribe to every scan regardless of origin.
 *
 * The peripheral manager resolves the matching item before notifying, so the
 * cart can add the product directly — this is the same path the POS uses, and
 * it works fully offline because the lookup is local.
 */
export function onBarcodeScan(
  handler: (event: BarcodeScanEvent, item: unknown | null) => void
): () => void {
  return getPeripheralManager().subscribeScan((result: ScanResult, item: unknown | null) => {
    handler(
      {
        barcode: result?.code ?? '',
        source: toScanSource(result?.source),
        deviceId: undefined,
        timestamp: result?.at ?? Date.now(),
      },
      item
    );
  });
}
