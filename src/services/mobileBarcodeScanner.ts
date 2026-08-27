import { EventEmitter } from 'events';
import { Platform } from 'react-native';

// ============================================
// Mobile Barcode Scanner (using Camera or External Scanner)
// ============================================

export interface BarcodeScannerConfig {
  // For external USB/Bluetooth HID scanner
  useExternalScanner?: boolean;
  vendorId?: number;
  productId?: number;
  keyIntervalThreshold?: number;
  minLength?: number;
  maxLength?: number;
  terminationChars?: string[];
  // For camera-based scanning
  cameraType?: 'front' | 'back';
  torchEnabled?: boolean;
  scanInterval?: number;
}

export interface BarcodeResult {
  barcode: string;
  type: string; // EAN-13, CODE128, QR_CODE, etc.
  timestamp: number;
  bounds?: { x: number; y: number; width: number; height: number };
}

type ScannerEventMap = {
  scan: [BarcodeResult];
  error: [Error];
  cameraPermission: [boolean];
  scannerConnected: [boolean];
};

export class MobileBarcodeScanner extends EventEmitter<ScannerEventMap> {
  private config: Required<any>;
  private isScanning = false;
  private cameraListener: any = null;
  private externalScannerBuffer = '';
  private lastKeyTime = 0;

  constructor(config: any = {}) {
    super();
    this.config = {
      useExternalScanner: config.useExternalScanner ?? false,
      vendorId: config.vendorId ?? 0,
      productId: config.productId ?? 0,
      keyIntervalThreshold: config.keyIntervalThreshold ?? 50,
      minLength: config.minLength ?? 4,
      maxLength: config.maxLength ?? 64,
      terminationChars: config.terminationChars ?? ['\n', '\r'],
      cameraType: config.cameraType ?? 'back',
      torchEnabled: config.torchEnabled ?? false,
      scanInterval: config.scanInterval ?? 100,
    };
  }

  // ============================================
  // Camera-based Scanning (using expo-camera or react-native-vision-camera)
  // ============================================

  async startCameraScanning(): Promise<void> {
    if (this.isScanning) return;

    try {
      // Check camera permissions
      const { Camera } = require('expo-camera');
      const { status } = await Camera.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        this.emit('cameraPermission', false);
        throw new Error('Camera permission not granted');
      }

      this.emit('cameraPermission', true);

      // In a real implementation, you'd use:
      // - expo-camera with onBarCodeScanned prop
      // - or react-native-vision-camera with frame processors
      // - or react-native-vision-camera with ML Kit barcode scanning

      // Placeholder implementation - in reality you'd use:
      /*
      const camera = useCamera();
      camera.startScanning({
        onBarCodeScanned: this.handleBarcodeScanned,
        barcodeTypes: ['ean13', 'code128', 'qr', 'pdf417'],
      });
      */

      this.isScanning = true;
      console.log('[Barcode] Camera scanning started (placeholder)');
      
      // Simulate scanning for demo
      this.simulateScanning();
    } catch (e: any) {
      this.emit('error', e);
    }
  }

  stopCameraScanning(): void {
    this.isScanning = false;
    console.log('[Barcode] Camera scanning stopped');
  }

  private simulateScanning(): void {
    // In real implementation, this would be handled by camera library
    // This is just for demo/testing
  }

  // ============================================
  // External USB/Bluetooth HID Scanner (Android USB Host / iOS External Accessory)
  // ============================================

  async startExternalScanner(config?: { vendorId?: number; productId?: number }): Promise<void> {
    if (Platform.OS === 'android') {
      await this.startAndroidUsbScanner(config);
    } else if (Platform.OS === 'ios') {
      await this.startIosExternalAccessory(config);
    }
  }

  private async startAndroidUsbScanner(config?: { vendorId?: number; productId?: number }): Promise<void> {
    // Android USB Host API via react-native-usb
    // Requires: react-native-usb, android USB host permission in manifest
    /*
    const Usb = require('react-native-usb');
    
    const devices = await Usb.getDevices();
    const device = devices.find(d => 
      (!config.vendorId || d.vendorId === config.vendorId) &&
      (!config.productId || d.productId === config.productId)
    );
    
    if (!device) throw new Error('Scanner not found');
    
    await Usb.requestPermission(device.vendorId, device.productId);
    await Usb.openDevice(device.vendorId, device.productId);
    
    // Find HID interface and interrupt IN endpoint
    // Start polling interrupt endpoint
    // Parse HID keyboard reports
    */
    console.log('[Barcode] Android USB scanner started (placeholder)');
    this.emit('scannerConnected', true);
  }

  private async startIosExternalAccessory(config?: { vendorId?: number; productId?: number }): Promise<void> {
    // iOS External Accessory Framework via react-native-ble-plx or native module
    /*
    // Requires:
    // - UISupportedExternalAccessoryProtocols in Info.plist
    // - EAAccessoryManager in native code
    // - EAAccessoryDelegate to handle data
    */
    console.log('[Barcode] iOS External Accessory scanner started (placeholder)');
    this.emit('scannerConnected', true);
  }

  stopExternalScanner(): void {
    console.log('[Barcode] External scanner stopped');
    this.emit('scannerConnected', false);
  }

  // ============================================
  // Keyboard Wedge Simulation (for external HID scanners on Mobile)
  // ============================================

  private externalBuffer = '';
  private lastKeyTime = 0;

  handleExternalKeyInput(key: string): void {
    const now = Date.now();
    if (now - this.lastKeyTime > 50) {
      this.externalBuffer = '';
    }

    this.externalBuffer += key;
    this.lastKeyTime = Date.now();

    if (this.externalBuffer.endsWith('\n') || this.externalBuffer.endsWith('\r')) {
      this.processExternalBarcode(this.externalBuffer.trim());
      this.externalBuffer = '';
    }

    if (this.externalBuffer.length >= 64) {
      this.processExternalBarcode(this.externalBuffer.trim());
      this.externalBuffer = '';
    }
  }

  private processExternalBarcode(barcode: string): void {
    if (barcode.length < 4 || barcode.length > 64) return;

    const result: any = {
      barcode,
      type: this.detectBarcodeType(barcode),
      timestamp: Date.now(),
    };

    this.emit('scan', result);
  }

  detectBarcodeType(barcode: string): string {
    if (/^\d{13}$/.test(barcode)) return 'EAN-13';
    if (/^\d{12}$/.test(barcode)) return 'UPC-A';
    if (/^\d{8}$/.test(barcode)) return 'EAN-8';
    if (/^[A-Z0-9]{1,48}$/.test(barcode)) return 'CODE128';
    if (/^[\d\w\s\-\.]{1,}$/.test(barcode) && barcode.includes('\n')) return 'QR_CODE';
    return 'UNKNOWN';
  }

  // ============================================
  // Camera-based Scanning Hook (React Native)
  // ============================================
}

// ============================================
// React Hook for Barcode Scanning
// ============================================

export function useBarcodeScanner(config: any = {}) {
  const [scanner] = useState(() => new MobileBarcodeScanner(config));
  const [lastScan, setLastScan] = useState<{ barcode: string; type: string; timestamp: number } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  useEffect(() => {
    scanner.on('scan', (result: any) => {
      setLastScan({ barcode: result.barcode, type: result.type, timestamp: result.timestamp });
    });

    scanner.on('cameraPermission', (granted: boolean) => {
      setPermission(granted ? 'granted' : 'denied');
    });

    scanner.on('scannerConnected', (connected: boolean) => {
      setIsScanning(connected);
    });

    return () => {
      scanner.removeAllListeners();
    };
  }, []);

  const startCamera = async () => {
    try {
      await scanner.startCameraScanning();
      setIsScanning(true);
    } catch (e: any) {
      console.error('Failed to start camera:', e);
    }
  };

  const stopCamera = () => {
    scanner.stopCameraScanning();
    setIsScanning(false);
  };

  const startExternal = async (config?: any) => {
    await scanner.startExternalScanner(config);
  };

  const stopExternal = () => {
    scanner.stopExternalScanner();
  };

  return {
    scanner,
    lastScan,
    isScanning,
    permission,
    startCamera,
    stopCamera,
    startExternal,
    stopExternal,
  };
}

// Need React for hooks
import { useState, useEffect } from 'react';

export default {
  MobileBarcodeScanner,
  useBarcodeScanner,
};