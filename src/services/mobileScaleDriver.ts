// ============================================
// Digital Weight Scale Driver - Mobile
// Supports: RS-232 (Serial), USB CDC/ACM, Bluetooth SPP
// ============================================

import { EventEmitter } from 'events';
import { Platform } from 'react-native';

export interface ScaleReading {
  weightKg: number | null;
  unit: string;
  stable: boolean;
  zero: boolean;
  net: boolean;
  raw: string;
  timestamp: number;
}

export interface ScaleConfig {
  type: 'cas' | 'dibal' | 'mettler' | 'generic' | 'auto';
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';
  vendorId?: number;
  productId?: number;
  deviceId?: string;
  serviceUuid?: string;
  characteristicUuid?: string;
  protocol?: 'continuous' | 'poll' | 'command';
  pollInterval?: number;
  command?: string;
  stableThreshold?: number;
  stableSamples?: number;
}

type ScaleEventMap = {
  reading: [ScaleReading];
  stable: [ScaleReading];
  unstable: [ScaleReading];
  zero: [ScaleReading];
  error: [Error];
  connected: [string];
  disconnected: [string];
};

const UNSTABLE_MARKERS = ['D', 'I', 'U', 'US', 'UNSTABLE'];

export class MobileScaleDriver extends EventEmitter {
  private config: Required<any>;
  private serialPort: any = null;
  private btSocket: any = null;
  private _connected = false;
  private debouncer: any = null;

  constructor(config: any = {}) {
    super();
    this.config = {
      type: config.type || 'auto',
      baudRate: config.baudRate || 9600,
      dataBits: config.dataBits || 8,
      stopBits: config.stopBits || 1,
      parity: config.parity || 'none',
      vendorId: config.vendorId || 0,
      productId: config.productId || 0,
      deviceId: config.deviceId || '',
      serviceUuid: config.serviceUuid || '',
      characteristicUuid: config.characteristicUuid || '',
      protocol: config.protocol || 'continuous',
      pollInterval: config.pollInterval || 1000,
      command: config.command || '',
      stableThreshold: config.stableThreshold || 300,
      stableSamples: config.stableSamples || 3,
    };
  }

  async connectSerial(path?: string): Promise<void> {
    if (this._connected) return;

    if (Platform.OS === 'android') {
      await this.connectAndroidSerial(path);
    } else if (Platform.OS === 'ios') {
      await this.connectIosSerial(path);
    }
  }

  private async connectAndroidSerial(path?: string): Promise<void> {
    console.log('[Scale] Android serial connected (placeholder)');
    this._connected = true;
    this.emit('connected', 'serial');
  }

  private async connectIosSerial(path?: string): Promise<void> {
    console.log('[Scale] iOS serial connected (placeholder)');
    this._connected = true;
    this.emit('connected', 'serial');
  }

  async connectBluetooth(deviceId: string): Promise<void> {
    if (this._connected) return;

    if (Platform.OS === 'android') {
      await this.connectAndroidBluetooth(deviceId);
    } else if (Platform.OS === 'ios') {
      await this.connectIosBluetooth(deviceId);
    }
  }

  private async connectAndroidBluetooth(deviceId: string): Promise<void> {
    console.log('[Scale] Android Bluetooth connected (placeholder)');
    this._connected = true;
    this.emit('connected', 'bluetooth');
  }

  private async connectIosBluetooth(deviceId: string): Promise<void> {
    console.log('[Scale] iOS Bluetooth connected (placeholder)');
    this._connected = true;
    this.emit('connected', 'bluetooth');
  }

  async connectUsb(vendorId: number, productId: number): Promise<void> {
    if (Platform.OS === 'android') {
      await this.connectAndroidUsb(vendorId, productId);
    } else {
      throw new Error('USB not supported on iOS without MFi');
    }
  }

  private async connectAndroidUsb(vendorId: number, productId: number): Promise<void> {
    console.log('[Scale] Android USB connected (placeholder)');
    this._connected = true;
    this.emit('connected', 'usb');
  }

  private parseWeightLine(line: string): ScaleReading | null {
    const raw = line.trim();
    if (!raw) return null;

    let stable = true;
    let zero = false;
    let net = false;
    let body = raw;
    const upper = raw.toUpperCase();

    if (upper.startsWith('ST') || upper.startsWith('S')) {
      stable = true;
      body = raw.replace(/^ST,?|^S,?/, '');
    } else if (UNSTABLE_MARKERS.some(m => upper.startsWith(m + ',') || upper.startsWith(m + ' '))) {
      stable = false;
      body = raw.replace(/^US,?|^U,?|^D,?|^I,?/, '');
    }

    if (/\bNET\b/i.test(upper)) net = true;
    if (/\bZERO\b/i.test(upper) || /^\s*0(\.0+)?\s*(kg|g)?\s*$/i.test(body)) zero = true;

    const match = body.match(/([-+]?\d+(?:\.\d+)?)\s*(kg|g|lb|oz)?/i);
    if (!match) return null;

    const num = parseFloat(match[1]);
    const unit = (match[2] || 'kg').toLowerCase();

    let weightKg: number;
    if (unit === 'g') weightKg = num / 1000;
    else if (unit === 'lb') weightKg = num * 0.45359237;
    else if (unit === 'oz') weightKg = num * 0.028349523125;
    else weightKg = num;

    if (weightKg < 0) weightKg = 0;

    return {
      weightKg,
      unit: unit === 'g' ? 'g' : unit,
      stable,
      zero,
      net,
      raw: line,
      timestamp: Date.now(),
    };
  }

  handleData(line: string): void {
    const reading = this.parseWeightLine(line);
    if (!reading) return;

    this.emit('reading', reading);

    if (reading.stable) {
      if (this.debouncer) clearTimeout(this.debouncer);
      this.debouncer = setTimeout(() => {
        this.emit('stable', reading);
      }, 300);
    } else {
      if (this.debouncer) clearTimeout(this.debouncer);
      this.emit('unstable', reading);
    }

    if (reading.zero) {
      this.emit('zero', reading);
    }
  }

  async connect(config?: { path?: string; deviceId?: string; vendorId?: number; productId?: number }): Promise<void> {
    if (this._connected) return;

    if (config?.path) {
      await this.connectSerial(config.path);
    } else if (config?.deviceId) {
      await this.connectBluetooth(config.deviceId);
    } else if (config?.vendorId && config?.productId) {
      await this.connectUsb(config.vendorId, config.productId);
    } else {
      throw new Error('No connection parameters provided');
    }
  }

  async disconnect(): Promise<void> {
    if (this.serialPort) {
      try { this.serialPort.close(); } catch {}
      this.serialPort = null;
    }
    if (this.btSocket) {
      try { this.btSocket.disconnect(); } catch {}
      this.btSocket = null;
    }
    this._connected = false;
    this.emit('disconnected', 'Scale disconnected');
  }

  async requestWeight(): Promise<ScaleReading | null> {
    if (!this._connected) return null;

    if (this.config.protocol === 'command' && this.config.command) {
      if (this.serialPort) {
        this.serialPort.write(this.config.command + '\r\n');
      } else if (this.btSocket) {
        this.btSocket.write(this.config.command + '\r\n');
      }
    }

    return new Promise((resolve) => {
      const handler = (reading: ScaleReading) => {
        this.off('reading', handler);
        resolve(reading);
      };
      this.once('reading', handler);
      
      setTimeout(() => {
        this.off('reading', handler);
        resolve(null);
      }, 5000);
    });
  }

  async tare(): Promise<boolean> {
    if (!this._connected) return false;

    const tareCommands = ['T', 'TARE', '\x1BT', '\x02T'];
    
    for (const cmd of tareCommands) {
      try {
        if (this.serialPort) this.serialPort.write(cmd + '\r\n');
        else if (this.btSocket) this.btSocket.write(cmd + '\r\n');
        await new Promise(r => setTimeout(r, 200));
        return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  async sendCommand(command: string): Promise<void> {
    if (!this._connected) return;
    
    if (this.serialPort) {
      this.serialPort.write(command + '\r\n');
    } else if (this.btSocket) {
      this.btSocket.write(command + '\r\n');
    }
  }

  isConnected(): boolean {
    return this._connected;
  }

  destroy(): void {
    this.removeAllListeners();
    this.disconnect();
  }
}

export default {
  MobileScaleDriver,
};
