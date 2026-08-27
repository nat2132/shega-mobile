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
  // Serial (RS-232 / USB CDC)
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';
  // USB
  vendorId?: number;
  productId?: number;
  // Bluetooth SPP
  deviceId?: string;
  serviceUuid?: string;
  characteristicUuid?: string;
  // Protocol
  protocol?: 'continuous' | 'poll' | 'command';
  pollInterval?: number;
  command?: string;
  // Stability
  stableThreshold?: number;
  stableSamples?: number;
}

export interface ScaleReading {
  weightKg: number | null;
  unit: string;
  stable: boolean;
  zero: boolean;
  net: boolean;
  raw: string;
  timestamp: number;
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

export class MobileScaleDriver extends EventEmitter<ScaleEventMap> {
  private config: Required<any>;
  private serialPort: any = null;
  private btSocket: any = null;
  private isConnected = false;
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

  // ============================================
  // Serial Port Connection (RS-232 / USB CDC/ACM)
  // ============================================

  async connectSerial(path?: string): Promise<void> {
    if (this.isConnected) return;

    if (Platform.OS === 'android') {
      await this.connectAndroidSerial(path);
    } else if (Platform.OS === 'ios') {
      await this.connectIosSerial(path);
    }
  }

  private async connectAndroidSerial(path?: string): Promise<void> {
    // Using react-native-serialport or react-native-usb
    // react-native-serialport for USB CDC/ACM devices
    // react-native-usb for USB HID/bulk devices
    /*
    const SerialPort = require('react-native-serialport');
    
    this.serialPort = new SerialPort({
      path: path || '/dev/ttyUSB0',
      baudRate: this.config.baudRate,
      dataBits: this.config.dataBits,
      stopBits: this.config.stopBits,
      parity: this.config.parity,
    });

    this.serialPort.on('data', (data: string) => {
      const line = data.trim();
      if (line) {
        const reading = this.parseWeightLine(line);
        if (reading) this.emit('reading', reading);
      });
    */

    console.log('[Scale] Android serial connected (placeholder)');
    this.isConnected = true;
    this.emit('connected', 'serial');
  }

  private async connectIosSerial(path?: string): Promise<void> {
    // iOS: External Accessory Framework or USB CDC via react-native-ble-plx
    // For MFi devices, use External Accessory framework
    /*
    const { ExternalAccessory } = NativeModules;
    
    const accessories = await ExternalAccessory.getAccessories();
    const scale = accessories.find(a => 
      a.manufacturer?.toLowerCase().includes('scale') ||
      a.modelNumber?.toLowerCase().includes('scale')
    );
    
    if (!scale) throw new Error('Scale accessory not found');
    
    const session = await ExternalAccessory.openSession(scale.protocolStrings[0]);
    session.on('data', (data: string) => {
      const reading = this.parseWeightLine(data);
      if (reading) this.emit('reading', reading);
    });
    */

    console.log('[Scale] iOS serial connected (placeholder)');
    this.isConnected = true;
    this.emit('connected', 'serial');
  }

  // ============================================
  // Bluetooth SPP Connection
  // ============================================

  async connectBluetooth(deviceId: string): Promise<void> {
    if (this.isConnected) return;

    if (Platform.OS === 'android') {
      await this.connectAndroidBluetooth(deviceId);
    } else if (Platform.OS === 'ios') {
      await this.connectIosBluetooth(deviceId);
    }
  }

  private async connectAndroidBluetooth(deviceId: string): Promise<void> {
    // Using react-native-bluetooth-classic for SPP
    /*
    const { BluetoothManager } = require('react-native-bluetooth-classic');
    
    const socket = await BluetoothManager.connect(deviceId);
    
    this.btSocket = socket;
    
    socket.on('data', (data: string) => {
      const reading = this.parseWeightLine(data);
      if (reading) this.emit('reading', reading);
    });
    
    socket.on('closed', () => this.handleDisconnect());
    socket.on('error', (err: Error) => this.emit('error', err));
    */

    console.log('[Scale] Android Bluetooth connected (placeholder)');
    this.isConnected = true;
    this.emit('connected', 'bluetooth');
  }

  private async connectIosBluetooth(deviceId: string): Promise<void> {
    // iOS: External Accessory Framework or BLE
    // For SPP, need MFi certification
    // For BLE, use CoreBluetooth via react-native-ble-plx
    /*
    const { BleManager } = NativeModules;
    
    await BleManager.connect(deviceId);
    await BleManager.discoverServices(deviceId);
    
    const characteristic = await BleManager.readCharacteristic(
      deviceId, serviceUuid, characteristicUuid
    );
    
    BleManager.monitorCharacteristicForDevice(deviceId, serviceUuid, characteristicUuid)
      .then(() => {
        // Handle notifications
      });
    */

    console.log('[Scale] iOS Bluetooth connected (placeholder)');
    this.isConnected = true;
    this.emit('connected', 'bluetooth');
  }

  // ============================================
  // USB Connection (Android USB Host / iOS External Accessory)
  // ============================================

  async connectUsb(vendorId: number, productId: number): Promise<void> {
    if (Platform.OS === 'android') {
      await this.connectAndroidUsb(vendorId, productId);
    } else {
      throw new Error('USB not supported on iOS without MFi');
    }
  }

  private async connectAndroidUsb(vendorId: number, productId: number): Promise<void> {
    // Using react-native-usb
    /*
    const Usb = require('react-native-usb');
    
    await Usb.requestPermission(vendorId, productId);
    const device = await Usb.openDevice(vendorId, productId);
    
    // Find HID or bulk endpoint
    // Start polling interrupt IN endpoint
    */
    console.log('[Scale] Android USB connected (placeholder)');
    this.isConnected = true;
    this.emit('connected', 'usb');
  }

  // ============================================
  // Data Parsing
  // ============================================

  private parseWeightLine(line: string): any | null {
    const raw = line.trim();
    if (!raw) return null;

    let stable = true;
    let zero = false;
    let net = false;
    let body = raw;
    const upper = raw.toUpperCase();

    // Protocol headers
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
      net: net,
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

  private handleDisconnect(): void {
    this.emit('disconnected', 'Scale disconnected');
  }

  // ============================================
  // Public API
  // ============================================

  async connect(config?: { path?: string; deviceId?: string; vendorId?: number; productId?: number }): Promise<void> {
    if (this.isConnected) return;

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
    this.emit('disconnected', 'Scale disconnected');
  }

  async requestWeight(): Promise<any | null> {
    if (!this.isConnected) return null;

    // Send command if in command mode
    if (this.config.protocol === 'command' && this.config.command) {
      if (this.serialPort) {
        this.serialPort.write(this.config.command + '\r\n');
      } else if (this.btSocket) {
        this.btSocket.write(this.config.command + '\r\n');
      }
    }

    return new Promise((resolve) => {
      const handler = (reading: any) => {
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
    if (!this.isConnected) return false;

    const tareCommands = ['T', 'TARE', '\x1BT', '\x02T'];
    
    for (const cmd of tareCommands) {
      try {
        if (this.serialPort) this.serialPort.write(cmd + '\r\n');
        else if (this.btSocket) this.btSocket.write(cmd + '\r\n');
        await new Promise(r => setTimeout(r, 200));
        return true;
      } catch (e) {
        continue;
      }
    }
    return false;
  }

  async sendCommand(command: string): Promise<void> {
    if (!this.isConnected) return;
    
    if (this.serialPort) {
      this.serialPort.write(command + '\r\n');
    } else if (this.btSocket) {
      this.btSocket.write(command + '\r\n');
    }
  }

  isConnected(): boolean {
    return this.isConnected;
  }

  // Cleanup
  destroy(): void {
    this.removeAllListeners();
    this.disconnect();
  }
}

export default {
  MobileScaleDriver,
};