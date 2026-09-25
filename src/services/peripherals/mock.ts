// Mock peripheral harness for Shega Mobile.
//
// When USE_MOCK_PERIPHERALS is true (default in dev) the shared SDK's mock
// scanners + ESC/POS printer are wired into the app's PeripheralManager, so a
// scan or print can be triggered from the dev console without any hardware.
//
// Honest by design: mock results always carry `simulated: true`, mock scans map
// to `keyboard_hid` (camera capture still works for real reads), and USB is
// never offered on mobile — supportsUsb() is desktop-only.

import {
  getPeripheralMockService,
  installGlobalHelpers,
  installMockPeripherals as installSharedMockPeripherals,
  sampleReceiptPayload,
  USE_MOCK_PERIPHERALS,
  type MockStatusSnapshot,
  type PrintJobEvent,
  type ReceiptPayload,
  type ScannedBarcode,
} from '@shega/shared';
import { getPeripheralManager } from './peripheralManager';
import { detectBarcodeFormat } from './barcodeFormat';

let installed = false;

export function mockPeripheralsEnabled(): boolean {
  return USE_MOCK_PERIPHERALS;
}

/**
 * Idempotent bootstrap: hot-wires the shared mock service into this app's
 * PeripheralManager (subscriptions) and exposes __shegaMock* console helpers.
 * Safe to call multiple times / from lazy screens.
 */
export function installMockPeripherals(): boolean {
  if (!USE_MOCK_PERIPHERALS) return false;
  if (installed) return true;
  installed = true;

  installSharedMockPeripherals();
  const svc = getPeripheralMockService();
  const manager = getPeripheralManager();

  // Route every mock scan into the same pipeline a keyboard-wedge scanner uses.
  svc.subscribeScan((scan) =>
    manager.handleScan(scan.code, scan.transport === 'serial' ? 'keyboard_hid' : 'keyboard_hid'),
  );

  // Keep a readable trace in device logs for scans pressed from the console.
  manager.log('info', 'mock.ready', null, 'Mock peripherals attached');
  return true;
}

/** Trigger a synthetic scan (HID keystroke wedge by default). */
export async function simulateMockScan(
  code?: string,
  mode: 'hid' | 'serial' = 'hid',
): Promise<{ code: string; format: string; simulated: true; transport: 'hid' | 'serial' }> {
  installMockPeripherals();
  const scan: ScannedBarcode = await getPeripheralMockService().scan(code, mode);
  return { code: scan.code, format: detectBarcodeFormat(scan.code).format, simulated: true, transport: mode };
}

/** Send a structured receipt through the mock ESC/POS driver. */
export async function simulateMockPrint(
  payload?: Partial<ReceiptPayload>,
): Promise<{ ok: true; jobId: string; byteLength: number; ascii: string; html: string; simulated: true }> {
  installMockPeripherals();
  const job: PrintJobEvent = await getPeripheralMockService().print(payload);
  return {
    ok: true,
    simulated: true,
    jobId: job.jobId,
    byteLength: job.byteLength,
    ascii: job.preview.ascii,
    html: job.preview.html,
  };
}

/** Send raw ESC/POS bytes through the mock network/cable driver. */
export async function simulateMockPrintBytes(
  bytes: Uint8Array | number[],
): Promise<{ ok: boolean; jobId?: string; commands?: number; error?: string }> {
  installMockPeripherals();
  const job = await getPeripheralMockService().printBytes(bytes);
  return { ok: true, jobId: job.jobId, commands: job.decoded.commands.length };
}

/** Live counters/probes for the mock world. */
export function mockPeripheralStatus(): MockStatusSnapshot {
  installMockPeripherals();
  return getPeripheralMockService().status();
}

/** Dev-console convenience for building a realistic receipt payload. */
export function mockReceiptTemplate(): ReceiptPayload {
  return sampleReceiptPayload();
}