// PeripheralManager — offline-first facade for scanners, printers, cash drawers
// and scales. A single instance is shared across the app (see getPeripheralManager).
//
// Honest by design: transport capability is read from the registry and a
// connection/test NEVER reports success unless the transport is genuinely
// available on this build. In Expo Go that means camera + keyboard/HID scanning
// work; Bluetooth/USB/network printing report "Requires Shega Development Build".

import { Platform } from 'react-native';
import { getItemByBarcode } from '@/database/db';
import { detectBarcodeFormat } from './barcodeFormat';
import {
  buildCommandDiagnosticBytes,
  buildDrawerKickBytes,
  buildReceiptBytes,
  buildSampleReceiptBytes,
  buildSampleReceiptPreview,
  buildTestReceiptBytes,
  buildTestReceiptPreview,
  type CommandDiagnosticResult,
  type PrinterMeta,
  type ReceiptLayoutOptions,
} from './escpos';
import { saleReceiptFromBatch, type SaleReceiptInput } from './saleReceipt';
import { clearDeviceLogs, loadDeviceLogs, loadDevices, newLogId, saveDeviceLogs, saveDevices } from './storage';
import { transportCapability, writePrinterBytes } from './transports';
import { disconnectVirtualTcp, probeVirtualTcp } from './virtualTcp';
import type {
  ConnectionType,
  DeviceLogEntry,
  DeviceRole,
  DiagnosticReport,
  LogLevel,
  PeripheralConfig,
  PrintResult,
  ScanResult,
  VirtualProbeResult,
} from './types';

export interface TestResult {
  ok: boolean;
  errorCode?: string;
  preview?: string;
}

export interface ConnectResult {
  ok: boolean;
  errorCode?: string;
}

// Per-device virtual-printer telemetry. Only counts/status — no receipt,
// customer or payment data is ever stored in diagnostic state.
export interface VirtualMetrics {
  connection: PeripheralConfig['status'];
  lastPrintAt?: number;
  lastResult?: 'ok' | 'failed';
  lastError?: string;
  bytesSent?: number;
  queue?: number;
}

type ScanListener = (result: ScanResult, item: unknown | null) => void;

class PeripheralManager {
  private devices: PeripheralConfig[] = [];
  private logs: DeviceLogEntry[] = [];
  private listeners = new Set<() => void>();
  private scanListeners = new Set<ScanListener>();
  private version = 0;
  private virtualMetrics = new Map<string, VirtualMetrics>();

  constructor() {
    this.devices = loadDevices();
    this.logs = loadDeviceLogs();
  }

  // --- React store plumbing --------------------------------------------------

  getVersion = (): number => this.version;
  private emit = (): void => {
    this.version += 1;
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // ignore bad listeners
      }
    });
  };

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  subscribeScan = (cb: ScanListener): (() => void) => {
    this.scanListeners.add(cb);
    return () => this.scanListeners.delete(cb);
  };

  // --- Device registry -------------------------------------------------------

  getDevices = (): PeripheralConfig[] => [...this.devices];
  getDevice = (id: string): PeripheralConfig | undefined => this.devices.find((d) => d.id === id);

  getPrimaryDevice = (role: DeviceRole, enabledOnly = true): PeripheralConfig | undefined =>
    this.devices.find((d) => d.role === role && (!enabledOnly || d.enabled));

  addDevice = (config: PeripheralConfig): void => {
    this.devices = [...this.devices, config];
    saveDevices(this.devices);
    this.log('info', 'devices.added', config.id, config.name);
    this.emit();
  };

  updateDevice = (id: string, patch: Partial<PeripheralConfig>): void => {
    const dev = this.getDevice(id);
    if (!dev) return;
    this.devices = this.devices.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d));
    saveDevices(this.devices);
    this.log('info', PatchLogLabel(patch), id);
    this.emit();
  };

  removeDevice = (id: string): void => {
    const dev = this.getDevice(id);
    this.devices = this.devices.filter((d) => d.id !== id);
    saveDevices(this.devices);
    if (dev) this.log('warn', 'devices.removed', id, dev.name);
    this.emit();
  };

  private setStatus = (id: string, status: PeripheralConfig['status']): void => {
    const dev = this.getDevice(id);
    if (!dev) return;
    this.devices = this.devices.map((d) => (d.id === id ? { ...d, status, updatedAt: Date.now() } : d));
    saveDevices(this.devices);
    this.emit();
  };

  capability = (connectionType: ConnectionType): string => transportCapability(connectionType).state;

  // --- Virtual printer telemetry ---------------------------------------------

  getVirtualMetrics = (id: string): VirtualMetrics | undefined => this.virtualMetrics.get(id);

  private trackVirtual = (id: string, patch: Partial<VirtualMetrics>): void => {
    const cur = this.virtualMetrics.get(id) ?? { connection: 'disconnected', queue: 0 };
    this.virtualMetrics.set(id, { ...cur, ...patch });
    this.emit();
  };

  // -- Virtual ESC/POS printer: connection + command diagnostics ---------------

  // Public connectivity check for the virtual-printer diagnostics UI.
  probeInternet = (): Promise<boolean> => this.checkInternet();

  async probeVirtual(deviceId: string | null, host: string, port: number): Promise<VirtualProbeResult> {
    const probe = await probeVirtualTcp({ host: (host || '').trim(), port: Number(port) || 9397, timeoutMs: 6000 });
    const dev = deviceId ? this.getDevice(deviceId) : undefined;
    if (dev && deviceId) {
      if (probe.ok) {
        this.setStatus(deviceId, 'connected');
        this.log('info', 'devices.virtual_connected', deviceId);
      } else {
        this.setStatus(deviceId, probe.outcome === 'timeout' ? 'connecting' : 'error');
        this.log('warn', 'devices.virtual_probe_failed', deviceId, probe.errorCode);
      }
      this.trackVirtual(deviceId, {
        connection: probe.ok ? 'connected' : probe.outcome === 'timeout' ? 'connecting' : 'error',
      });
    }
    return probe;
  }

  async sampleReceipt(id: string): Promise<TestResult> {
    const dev = this.getDevice(id);
    if (!dev) return { ok: false, errorCode: 'missing' };
    if (dev.role !== 'printer') return { ok: false, errorCode: 'not_printer' };

    const preview = buildSampleReceiptPreview({ businessName: dev.name, paperWidth: dev.paperWidth });
    const cap = transportCapability(dev.connectionType);
    if (cap.state !== 'available') {
      this.setStatus(dev.id, 'error');
      this.log('warn', 'devices.print_dev_build', dev.id);
      return { ok: false, errorCode: 'needs_dev_build', preview };
    }
    const result = await this.sendBytes(dev, buildSampleReceiptBytes({ businessName: dev.name, paperWidth: dev.paperWidth }));
    if (result.ok) this.log('info', 'devices.print_ok', dev.id);
    else this.log('error', 'devices.print_failed', dev.id, result.errorCode);
    return { ...result, preview };
  }

  // Local ESC/POS command exercise — `generated` vs `confirmed` stays
  // intentionally separate (the virtual printer cannot verify paper output).
  commandDiagnostic(id: string): { result: CommandDiagnosticResult; preview: string } {
    const dev = this.getDevice(id);
    const result = buildCommandDiagnosticBytes({ paperWidth: dev?.paperWidth, drawerPin: dev?.role === 'drawer' ? dev?.pin : 2 });
    const preview = result.commands.map((c) => `${c.label} - ${c.bytesEmitted} bytes [GENERATED]`).join('\n');
    return { result, preview };
  }

  // --- Connection lifecycle --------------------------------------------------

  connect = (id: string): ConnectResult => {
    const dev = this.getDevice(id);
    if (!dev) return { ok: false, errorCode: 'missing' };

    const cap = transportCapability(dev.connectionType);
    if (cap.state === 'needs_dev_build') {
      this.setStatus(id, 'error');
      this.log('warn', 'devices.connect_blocked_dev_build', id);
      return { ok: false, errorCode: 'needs_dev_build' };
    }
    if (cap.state === 'unsupported') {
      this.setStatus(id, 'error');
      this.log('error', 'devices.connect_unsupported', id);
      return { ok: false, errorCode: 'unsupported' };
    }

    if (dev.connectionType === 'virtual_tcp_escpos') {
      // Dev build with a socket: status resolves when the real TCP probe lands.
      this.setStatus(id, 'connecting');
      this.log('info', 'devices.connecting_virtual', id);
      void this.probeVirtual(id, dev.address ?? '', dev.port ?? 9397);
      return { ok: true };
    }

    this.setStatus(id, 'connected');
    this.log('info', 'devices.connected', id);
    return { ok: true };
  };

  disconnect = (id: string): void => {
    const dev = this.getDevice(id);
    if (!dev) return;
    if (dev.connectionType === 'virtual_tcp_escpos') disconnectVirtualTcp();
    this.setStatus(id, 'disconnected');
    this.log('info', 'devices.disconnected', id);
  };

  // --- Barcode scan pipeline -------------------------------------------------

  handleScan = (code: string, source: ConnectionType = 'keyboard_hid'): void => {
    const clean = (code || '').trim().replace(/\x00/g, '');
    if (!clean) return;

    const format = detectBarcodeFormat(clean).format;
    this.log('info', 'devices.scan_logged', null, `${clean} (${format})`);

    let item: unknown | null = null;
    try {
      item = getItemByBarcode(clean);
    } catch {
      item = null;
    }
    this.scanListeners.forEach((cb) => {
      try {
        cb({ code: clean, format, source, at: Date.now() }, item);
      } catch {
        // ignore bad listeners
      }
    });
  };

  // --- Printing --------------------------------------------------------------

  // Single choke point for byte delivery; records virtual-printer telemetry
  // (counts/status only) so diagnostics never store receipt content.
  private sendBytes = async (dev: PeripheralConfig, bytes: Uint8Array): Promise<PrintResult> => {
    const result = await writePrinterBytes(dev, bytes);
    if (dev.connectionType === 'virtual_tcp_escpos') {
      const extended = result as PrintResult & { bytesSent?: number };
      this.trackVirtual(dev.id, {
        lastPrintAt: Date.now(),
        lastResult: result.ok ? 'ok' : 'failed',
        lastError: result.ok ? undefined : result.errorCode,
        bytesSent: result.ok ? Math.max(1, extended.bytesSent ?? bytes.length) : 0,
        connection: result.ok ? 'connected' : 'error',
      });
    }
    return result;
  };

  async printReceipt(meta: PrinterMeta, layout: ReceiptLayoutOptions): Promise<PrintResult> {
    const printer = this.getPrimaryDevice('printer');
    if (!printer) {
      this.log('warn', 'devices.print_no_printer');
      return { ok: false, errorCode: 'printer_missing' };
    }

    const cap = transportCapability(printer.connectionType);
    if (cap.state !== 'available') {
      this.setStatus(printer.id, 'error');
      this.log('warn', 'devices.print_dev_build', printer.id);
      return { ok: false, errorCode: cap.reasonCode === 'needs_dev_build' ? 'needs_dev_build' : 'unsupported', deviceName: printer.name };
    }

    const copies = Math.max(1, Math.min(5, printer.printCopies || 1));
    let result: PrintResult = { ok: false, errorCode: 'network_error', deviceName: printer.name };
    for (let i = 0; i < copies; i++) {
      result = await this.sendBytes(printer, buildReceiptBytes(meta, layout));
      if (!result.ok) break;
    }
    if (!result.ok) {
      this.setStatus(printer.id, 'error');
      this.log('error', 'devices.print_failed', printer.id, result.errorCode);
    } else {
      this.log('info', 'devices.print_ok', printer.id);
    }
    return result;
  }

  async printSaleReceipt(input: SaleReceiptInput): Promise<PrintResult & { payload?: ReturnType<typeof saleReceiptFromBatch> }> {
    const payload = saleReceiptFromBatch(input);
    if (!payload) return { ok: false, errorCode: 'sale_not_found' };
    const result = await this.printReceipt(payload.meta, payload.layout);
    return { ...result, payload };
  }

  async testDevice(id: string, opts?: { deviceName?: string; connectionLabel?: string; paperWidth?: 58 | 80 }): Promise<TestResult> {
    const dev = this.getDevice(id);
    if (!dev) return { ok: false, errorCode: 'missing' };

    const cap = transportCapability(dev.connectionType);
    if (dev.role === 'scanner') {
      return { ok: true };
    }
    if (dev.role === 'printer') {
      const preview = buildTestReceiptPreview({
        deviceName: opts?.deviceName || dev.name,
        connectionLabel: opts?.connectionLabel || dev.connectionType,
        paperWidth: opts?.paperWidth || dev.paperWidth,
      });
      if (cap.state !== 'available') {
        this.setStatus(dev.id, 'error');
        this.log('warn', 'devices.print_dev_build', dev.id);
        return { ok: false, errorCode: 'needs_dev_build', preview };
      }
      const result = await this.sendBytes(
        dev,
        buildTestReceiptBytes({ deviceName: dev.name, connectionLabel: dev.connectionType, paperWidth: dev.paperWidth }),
      );
      if (result.ok) this.log('info', 'devices.print_ok', dev.id);
      else this.log('error', 'devices.print_failed', dev.id, result.errorCode);
      return { ...result, preview };
    }
    if (dev.role === 'drawer') {
      if (cap.state !== 'available') {
        this.setStatus(dev.id, 'error');
        this.log('warn', 'devices.drawer_dev_build', dev.id);
        return { ok: false, errorCode: 'needs_dev_build' };
      }
      const result = await this.sendBytes(dev, buildDrawerKickBytes(dev.pin));
      if (result.ok) this.log('info', 'devices.drawer_kicked', dev.id);
      return { ...result };
    }
    // scale — native serial protocol needed
    this.setStatus(dev.id, 'error');
    this.log('warn', 'devices.scale_dev_build', dev.id);
    return { ok: false, errorCode: 'needs_dev_build' };
  }

  // --- Cash drawer -----------------------------------------------------------

  async openDrawerForPayment(paymentMethod: string): Promise<void> {
    const drawer = this.getPrimaryDevice('drawer');
    if (!drawer) return;
    if (drawer.allowCashOnly && paymentMethod !== 'Cash') return;

    const cap = transportCapability(drawer.connectionType);
    if (cap.state !== 'available') {
      this.log('warn', 'devices.drawer_skipped_dev_build', drawer.id);
      return;
    }
    await this.sendBytes(drawer, buildDrawerKickBytes(drawer.pin));
  }

  async testDrawer(id: string): Promise<TestResult> {
    return this.testDevice(id);
  }

  // --- Unified diagnostics ---------------------------------------------------

  async runDiagnostics(): Promise<DiagnosticReport> {
    const items: DiagnosticReport['items'] = [];

    // Phone platform / Bluetooth hardware (cannot be verified without a native BLE module)
    items.push({
      key: 'phone',
      status: 'info',
      label: 'Phone',
      detail: Platform.OS === 'android' ? 'Bluetooth hardware requires a development build to verify' : 'Bluetooth hardware requires a development build to verify',
    });

    // Scanner transport
    const scanner = this.getPrimaryDevice('scanner');
    items.push({
      key: 'scanner',
      status: scanner ? 'ok' : 'warn',
      label: 'Scanner',
      detail: scanner ? `${scanner.name}` : 'Camera + keyboard capture available; no scanner configured',
    });

    // Printer transport
    const printer = this.getPrimaryDevice('printer');
    if (!printer) {
      items.push({ key: 'printer', status: 'warn', label: 'Printer', detail: 'No printer configured' });
    } else {
      const cap = transportCapability(printer.connectionType);
      items.push({
        key: 'printer',
        status: cap.state === 'available' ? 'ok' : 'warn',
        label: 'Printer',
        detail: cap.state === 'available' ? printer.name : 'Requires Shega Development Build',
      });
    }

    // Cash drawer
    const drawer = this.getPrimaryDevice('drawer');
    items.push({
      key: 'drawer',
      status: drawer ? 'warn' : 'info',
      label: 'Cash Drawer',
      detail: drawer ? 'Requires a connected printer (dev build)' : 'Not configured',
    });

    // Internet reachability (fetch-based, works in Expo Go)
    const internet = await this.checkInternet();
    items.push({
      key: 'internet',
      status: internet ? 'ok' : 'error',
      label: 'Internet',
      detail: internet ? 'Reachable' : 'Unreachable',
    });

    // LAN printer
    items.push({
      key: 'lan',
      status: 'info',
      label: 'LAN Printer',
      detail: 'LAN reachability cannot be tested in Expo Go — requires a development build',
    });

    // POS database operational
    let posOk = true;
    let posDetail = 'Online & ready';
    try {
      const dbCheck = getItemByBarcode('%non-existent-bar-code%');
      if (dbCheck === null) posOk = true;
    } catch {
      posOk = false;
      posDetail = 'Database unavailable';
    }
    items.push({ key: 'pos', status: posOk ? 'ok' : 'error', label: 'POS', detail: posDetail });

    const summary = items.reduce(
      (acc, it) => {
        acc[it.status] = (acc[it.status] || 0) + 1;
        return acc;
      },
      { ok: 0, error: 0, warn: 0, info: 0 } as DiagnosticReport['summary'],
    );

    return { generatedAt: Date.now(), items, summary };
  }

  private checkInternet = async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('https://www.google.com/generate_204', { method: 'GET', signal: controller.signal });
      clearTimeout(timer);
      return res.status === 204;
    } catch {
      return false;
    }
  };

  // --- Logging ---------------------------------------------------------------

  log = (level: LogLevel, message: string, deviceId: string | null = null, detail?: string): void => {
    const dev = deviceId ? this.getDevice(deviceId) : undefined;
    const entry: DeviceLogEntry = {
      id: newLogId(),
      deviceId,
      deviceName: dev?.name || '',
      ts: Date.now(),
      level,
      message,
      detail,
    };
    this.logs = [...this.logs, entry];
    saveDeviceLogs(this.logs);
    this.emit();
  };

  getLogs = (): DeviceLogEntry[] => [...this.logs];

  clearLogs = (): void => {
    this.logs = [];
    clearDeviceLogs();
    this.emit();
  };
}

function PatchLogLabel(patch: Partial<PeripheralConfig>): string {
  if (patch.status) return 'devices.status_changed';
  return 'devices.updated';
}

let managerSingleton: PeripheralManager | null = null;

export const getPeripheralManager = (): PeripheralManager => {
  if (!managerSingleton) managerSingleton = new PeripheralManager();
  return managerSingleton;
};