import { EventEmitter } from 'events';
import { Platform } from 'react-native';

// ============================================
// Transport Types
// ============================================

export type PrinterTransportType = 'usb' | 'tcp' | 'bluetooth' | 'ble';

export interface PrinterTransportConfig {
  type: PrinterTransportType;
  // USB
  vendorId?: number;
  productId?: number;
  // TCP
  host?: string;
  port?: number;
  // Bluetooth Classic
  deviceId?: string;
  // BLE
  serviceUuid?: string;
  characteristicUuid?: string;
}

export interface PrinterTransport {
  connect(config: PrinterTransportConfig): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;
  getType(): PrinterTransportType;
  on?(event: string, listener: (...args: any[]) => void): void;
  off?(event: string, listener: (...args: any[]) => void): void;
  emit?(event: string, ...args: any[]): void;
}

// ============================================
// TCP Transport (React Native)
// ============================================

export class TcpTransportMobile extends EventEmitter implements PrinterTransport {
  private socket: any = null;

  async connect(config: PrinterTransportConfig): Promise<void> {
    if (!config.host || !config.port) {
      throw new Error('TCP transport requires host and port');
    }

    const TcpSocket = require('react-native-tcp-socket').TcpSocket;
    
    return new Promise((resolve, reject) => {
      this.socket = TcpSocket.createConnection(
        { host: config.host, port: config.port, tls: false },
        () => {
          console.log(`[TCP] Connected to printer at ${config.host}:${config.port}`);
          resolve();
        }
      );

      this.socket.on('data', (data: string) => {
        // Convert string back to Uint8Array
        const bytes = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
          bytes[i] = data.charCodeAt(i);
        }
        this.emit('data', bytes);
      });

      this.socket.on('close', () => {
        console.warn('[TCP] Connection closed');
        this.emit('close');
      });

      this.socket.on('error', (err: Error) => {
        console.error('[TCP] Error:', err);
        this.emit('error', err);
      });

      this.socket.setTimeout(5000);
    });
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.socket) throw new Error('TCP not connected');

    return new Promise((resolve, reject) => {
      // Convert Uint8Array to string for react-native-tcp-socket
      let str = '';
      for (let i = 0; i < data.length; i++) {
        str += String.fromCharCode(data[i]);
      }
      
      this.socket.write(str, () => {
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }

  getType(): 'tcp' {
    return 'tcp';
  }
}

// ============================================
// Bluetooth Classic Transport (Android)
// ============================================

export class BluetoothTransportMobile extends EventEmitter implements PrinterTransport {
  private socket: any = null;

  async connect(config: PrinterTransportConfig): Promise<void> {
    if (!config.deviceId) {
      throw new Error('Bluetooth transport requires deviceId');
    }

    // Using react-native-bluetooth-classic or similar
    const { BluetoothManager } = require('react-native-bluetooth-classic');
    
    return new Promise((resolve, reject) => {
      BluetoothManager.connect(config.deviceId)
        .then((socket: any) => {
          this.socket = socket;
          console.log(`[BT] Connected to printer ${config.deviceId}`);
          
          socket.on('data', (data: string) => {
            const bytes = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) {
              bytes[i] = data.charCodeAt(i);
            }
            this.emit('data', new Uint8Array(bytes));
          });

          socket.on('closed', () => {
            console.warn('[BT] Connection closed');
            this.emit('close');
          });

          socket.on('error', (err: Error) => {
            console.error('[BT] Error:', err);
            this.emit('error', err);
          });

          resolve();
        })
        .catch(reject);
    });
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.socket) throw new Error('Bluetooth not connected');

    let str = '';
    for (let i = 0; i < data.length; i++) {
      str += String.fromCharCode(data[i]);
    }

    return new Promise((resolve, reject) => {
      this.socket.write(str, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket !== null;
  }

  getType(): 'bluetooth' {
    return 'bluetooth';
  }
}

// ============================================
// BLE Transport (for BLE printers)
// ============================================

export class BleTransportMobile extends EventEmitter implements PrinterTransport {
  private device: any = null;
  private characteristic: any = null;

  async connect(config: PrinterTransportConfig): Promise<void> {
    if (!config.deviceId || !config.serviceUuid || !config.characteristicUuid) {
      throw new Error('BLE transport requires deviceId, serviceUuid, and characteristicUuid');
    }

    const { NativeModules } = require('react-native');
    const { BleManager } = NativeModules;

    return new Promise((resolve, reject) => {
      BleManager.connect(config.deviceId)
        .then(() => BleManager.discoverServices(config.deviceId))
        .then(() => BleManager.readCharacteristic(
          config.deviceId,
          config.serviceUuid,
          config.characteristicUuid
        ))
        .then((characteristic: any) => {
          this.characteristic = characteristic;
          
          // Subscribe to notifications
          BleManager.monitorCharacteristicForDevice(
            config.deviceId,
            config.serviceUuid,
            config.characteristicUuid
          ).then(() => {
            console.log(`[BLE] Connected to printer ${config.deviceId}`);
            resolve();
          });
        })
        .catch(reject);
    });
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.characteristic) throw new Error('BLE not connected');

    // Convert to base64 for BLE write
    let base64 = '';
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    return new Promise((resolve, reject) => {
      const { BleManager } = require('react-native').NativeModules;
      BleManager.writeCharacteristicWithResponseForDevice(
        this.device.id,
        this.characteristic.serviceUUID,
        this.characteristic.uuid,
        base64Data
      ).then(resolve).catch(reject);
    });
  }

  async close(): Promise<void> {
    if (this.device) {
      const { BleManager } = require('react-native').NativeModules;
      BleManager.disconnect(this.device.id);
      this.device = null;
      this.characteristic = null;
    }
  }

  isConnected(): boolean {
    return this.device !== null && this.characteristic !== null;
  }

  getType(): 'ble' {
    return 'ble';
  }
}

// ============================================
// USB Transport (Android only, via react-native-usb)
// ============================================

export class UsbTransportMobile extends EventEmitter implements PrinterTransport {
  private device: any = null;
  private interface: any = null;

  async connect(config: PrinterTransportConfig): Promise<void> {
    if (!config.vendorId || !config.productId) {
      throw new Error('USB transport requires vendorId and productId');
    }

    const Usb = require('react-native-usb');

    return new Promise((resolve, reject) => {
      Usb.requestPermission(config.vendorId, config.productId)
        .then(() => Usb.openDevice(config.vendorId, config.productId))
        .then((device: any) => {
          this.device = device;
          
          // Find interface and endpoints
          const interfaces = device.interfaces || [];
          const iface = interfaces[(config as any).interfaceNumber || 0];
          if (!iface) throw new Error('Interface not found');
          
          this.interface = iface;
          
          console.log(`[USB] Connected to printer ${config.vendorId}:${config.productId}`);
          resolve();
        })
        .catch(reject);
    });
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.device || !this.interface) throw new Error('USB not connected');

    // Find OUT endpoint
    const endpoints = this.interface.endpoints || [];
    const outEndpoint = endpoints.find((ep: any) => ep.direction === 'out' && ep.type === 'bulk');
    if (!outEndpoint) throw new Error('No bulk OUT endpoint found');

    return new Promise((resolve, reject) => {
      const { NativeModules } = require('react-native');
      const { UsbManager } = NativeModules;
      
      // Convert Uint8Array to base64
      let binary = '';
      for (let i = 0; i < data.length; i++) {
        binary += String.fromCharCode(data[i]);
      }
      const base64 = btoa(binary);

      NativeModules.UsbManager.bulkTransfer(
        this.device.deviceId,
        outEndpoint.address,
        base64,
        data.length,
        5000
      ).then(resolve).catch(reject);
    });
  }

  async close(): Promise<void> {
    if (this.device) {
      const { NativeModules } = require('react-native');
      NativeModules.UsbManager.closeDevice(this.device.deviceId);
      this.device = null;
    }
  }

  isConnected(): boolean {
    return this.device !== null;
  }

  getType(): 'usb' {
    return 'usb';
  }
}

// ============================================
// Transport Factory
// ============================================

export function createTransport(type: PrinterTransportType): PrinterTransport {
  switch (type) {
    case 'tcp': return new TcpTransportMobile();
    case 'bluetooth': return new BluetoothTransportMobile();
    case 'ble': return new BleTransportMobile();
    case 'usb': return new UsbTransportMobile();
    default: throw new Error(`Unknown transport type: ${type}`);
  }
}

// ============================================
// ESC/POS Writer (same as desktop)
// ============================================

export class EscposWriter {
  private bytes: number[] = [];

  raw(...b: number[]): this {
    this.bytes.push(...b);
    return this;
  }

  rawString(s: string): this {
    for (let i = 0; i < s.length; i++) this.bytes.push(s.charCodeAt(i) & 0xff);
    return this;
  }

  text(s: string): this {
    return this.rawString(s);
  }

  init(): this {
    return this.raw(0x1b, 0x40);
  }

  lineFeed(n: number = 1): this {
    return this.raw(0x0a).raw(0x1b, 0x64, Math.max(0, Math.min(255, n)));
  }

  align(n: 0 | 1 | 2): this {
    return this.raw(0x1b, 0x61, n);
  }

  bold(on: boolean): this {
    return this.raw(0x1b, 0x45, on ? 1 : 0);
  }

  size(width: number, height: number): this {
    const w = Math.max(0, Math.min(7, width));
    const h = Math.max(0, Math.min(7, height));
    return this.raw(0x1d, 0x21, (w << 4) | h);
  }

  underline(on: boolean): this {
    return this.raw(0x1b, 0x2d, on ? 1 : 0);
  }

  codePage(n: number): this {
    return this.raw(0x1b, 0x74, n);
  }

  column(label: string, value: string, width: number): this {
    const line = `${label}${' '.repeat(Math.max(1, width - label.length - value.length))}${value}`;
    return this.text(line).lineFeed();
  }

  barcode(m: number, data: string): this {
    this.raw(0x1d, 0x6b, m, data.length).rawString(data).raw(0x00);
    return this.lineFeed();
  }

  barcodeEan13(data: string): this {
    const digits = data.replace(/\D/g, '').slice(0, 13);
    if (digits.length < 12) throw new Error('EAN-13 requires at least 12 digits');
    const body = digits.length === 13 ? digits.slice(0, 12) : digits;
    const check = this.ean13CheckDigit(body);
    return this.barcode(2, body + String(check));
  }

  barcodeCode128(data: string): this {
    return this.barcode(4, data);
  }

  qr(data: string, moduleSize: number = 6, ecLevel: 0 | 1 | 2 | 3 = 0): this {
    const n = Math.max(1, Math.min(16, moduleSize));
    this.raw(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, n);
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 48 + ecLevel);
    const payload: number[] = [0x1d, 0x28, 0x6b, 0x00, 0x00, 0x31, 0x50, 0x30];
    for (let i = 0; i < data.length; i++) payload.push(data.charCodeAt(i) & 0xff);
    payload[3] = (payload.length - 4) & 0xff;
    payload[4] = ((payload.length - 4) >> 8) & 0xff;
    this.raw(...payload);
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this.lineFeed();
  }

  raster(rows: Uint8Array, widthPx: number): this {
    const bytesPerRow = Math.ceil(widthPx / 8);
    const y = rows.length / bytesPerRow;
    if (y > 65535 || bytesPerRow > 65535) throw new Error('Raster dimensions out of range');
    this.raw(0x1d, 0x76, 0x30, 0x00);
    this.raw(bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff);
    this.raw(y & 0xff, (y >> 8) & 0xff);
    this.raw(...Array.from(rows));
    return this.lineFeed();
  }

  cut(partial: boolean = true): this {
    return this.raw(0x1d, 0x56, partial ? 0x42 : 0x41, 0x00);
  }

  openDrawer(pin: 2 | 5 = 2, t1: number = 0x19, t2: number = 0xfa): this {
    return this.raw(0x1b, 0x70, pin === 5 ? 1 : 0, t1, t2);
  }

  private ean13CheckDigit(d12: string): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const d = parseInt(d12[i], 10);
      sum += i % 2 === 0 ? d : d * 3;
    }
    return (10 - (sum % 10)) % 10;
  }

  getBytes(): number[] {
    return this.bytes;
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }

  get length(): number {
    return this.bytes.length;
  }
}

// ============================================
// ESC/POS Driver with Multi-Transport Support
// ============================================

export interface PrinterConfig {
  transport: PrinterTransportType;
  vendorId?: number;
  productId?: number;
  host?: string;
  port?: number;
  deviceId?: string;
  serviceUuid?: string;
  characteristicUuid?: string;
  drawerPin?: 2 | 5;
  autoOpenDrawer?: boolean;
  enabled?: boolean;
}

export class EscposDriver extends EventEmitter {
  private transport: PrinterTransport | null = null;
  private config: PrinterConfig | null = null;
  private writer: any;

  constructor() {
    super();
    this.writer = {
      init: () => [0x1b, 0x40],
      lineFeed: (n = 1) => [0x0a, 0x1b, 0x64, Math.max(0, Math.min(255, n))],
      align: (n: 0 | 1 | 2) => [0x1b, 0x61, n],
      bold: (on: boolean) => [0x1b, 0x45, on ? 1 : 0],
      size: (width: number, height: number) => {
        const w = Math.max(0, Math.min(7, width));
        const h = Math.max(0, Math.min(7, height));
        return [0x1d, 0x21, (w << 4) | h];
      },
      text: (s: string) => Array.from(s).map(c => c.charCodeAt(0) & 0xff),
      cut: (partial = true) => [0x1d, 0x56, partial ? 0x42 : 0x41, 0x00],
      openDrawer: (pin: 2 | 5 = 2) => [0x1b, 0x70, pin === 5 ? 1 : 0, 0x19, 0xfa],
    };
  }

  async connect(config: PrinterConfig): Promise<void> {
    if (this.transport && this.transport.isConnected()) {
      await this.disconnect();
    }

    this.config = config;
    this.transport = createTransport(config.transport);

    this.transport.on?.('data', (data: Uint8Array) => {
      this.emit('data', data);
    });
    this.transport.on?.('error', (err: Error) => {
      this.emit('error', err);
    });
    this.transport.on?.('close', () => {
      this.emit('close');
    });

    await this.transport.connect({
      type: config.transport,
      vendorId: config.vendorId,
      productId: config.productId,
      host: config.host,
      port: config.port,
      deviceId: config.deviceId,
      serviceUuid: config.serviceUuid,
      characteristicUuid: config.characteristicUuid,
    });
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    // Simple queue implementation
    return fn();
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.transport || !this.transport.isConnected()) {
      throw new Error('Printer not connected');
    }
    await this.transport.write(data);
  }

  async init(): Promise<void> {
    await this.write(new Uint8Array(this.writer.init()));
  }

  async printText(text: string, options?: { bold?: boolean; align?: 0 | 1 | 2; size?: { width: number; height: number } }): Promise<void> {
    const commands: number[] = [];
    if (options?.align !== undefined) commands.push(...this.writer.align(options.align));
    if (options?.bold) commands.push(...this.writer.bold(true));
    if (options?.size) commands.push(...this.writer.size(options.size.width, options.size.height));
    commands.push(...this.writer.text(text));
    commands.push(...this.writer.lineFeed());
    await this.write(new Uint8Array(commands));
  }

  async printReceipt(lines: { label: string; value: string }[]): Promise<void> {
    const w = new (require('./escpos-writer'))();
    // Simplified for mobile - just send text commands
    const commands: number[] = w.init();
    w.align(1); w.bold(true); w.text('RECEIPT'); w.lineFeed(); w.bold(false); w.align(0);
    
    for (const line of lines) {
      w.column(line.label, line.value, 42);
    }
    w.cut(true);
    
    await this.write(new Uint8Array(w.getBytes()));
  }

  async cut(partial: boolean = true): Promise<void> {
    const w = new (require('./escpos-writer'))();
    w.cut(partial);
    await this.write(new Uint8Array(w.getBytes()));
  }

  async openDrawer(pin: 2 | 5 = 2): Promise<void> {
    const w = new (require('./escpos-writer'))();
    w.openDrawer(pin);
    await this.write(new Uint8Array(w.getBytes()));
  }

  isConnected(): boolean {
    return this.transport?.isConnected() ?? false;
  }

  getConfig(): PrinterConfig | null {
    return this.config;
  }
}

export const escposDriver = new (class extends EventEmitter {
  private instance: any = null;

  async connect(config: any) {
    if (this.instance) await this.instance.disconnect();
    this.instance = new (require('./escpos-driver')).EscposDriver();
    this.instance.on('data', (d: any) => this.emit('data', d));
    this.instance.on('error', (e: Error) => this.emit('error', e));
    this.instance.on('close', () => this.emit('close'));
    this.instance.on('connected', () => this.emit('connected'));
    return this.instance.connect(config);
  }

  async disconnect() {
    await this.instance?.disconnect();
    this.instance = null;
  }

  async write(data: Uint8Array) {
    return this.instance?.write(data);
  }

  async init() {
    return this.instance?.init();
  }

  async printText(text: string, options?: any) {
    return this.instance?.printText(text, options);
  }

  async printReceipt(lines: any[]) {
    return this.instance?.printReceipt(lines);
  }

  async cut(partial = true) {
    return this.instance?.cut(partial);
  }

  async openDrawer(pin = 2) {
    return this.instance?.openDrawer(pin);
  }

  get isConnected() {
    return this.instance?.isConnected() ?? false;
  }
})();

export default {
  createTransport,
  TcpTransportMobile,
  BluetoothTransportMobile,
  BleTransportMobile,
  UsbTransportMobile,
  EscposDriver,
  EscposWriter,
  escposDriver,
};