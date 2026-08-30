// Peripheral Device Management — shared types.
//
// This layer is deliberately offline-first and Expo-compatible. Native BLE/USB
// transports are NOT installed; the transport registry reports an honest
// "Requires Shega Development Build" state for them until a development build
// wires in react-native-ble-plx / USB. A connection is never faked.

export type DeviceRole = 'printer' | 'scanner' | 'drawer' | 'scale';

export type ConnectionType =
  | 'bluetooth_escpos'
  | 'usb_escpos'
  | 'network_escpos'
  | 'bluetooth_hid'
  | 'usb_hid'
  | 'keyboard_hid'
  | 'camera';

export type DeviceStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'error'
  | 'not_configured';

// What the transport layer is actually able to do on this build/device.
export type TransportState = 'available' | 'needs_dev_build' | 'unsupported';

export interface PeripheralConfig {
  id: string;
  role: DeviceRole;
  connectionType: ConnectionType;
  name: string;
  address?: string; // MAC address or LAN host/IP for network printers
  port?: number; // TCP port for network printers (default 9100)
  enabled: boolean;
  status: DeviceStatus;
  // Scanner options
  scanSuffix: 'enter' | 'none';
  beep: boolean;
  vibration: boolean;
  // Printer options
  paperWidth: 58 | 80;
  printCopies: number;
  // Drawer options
  pin: 2 | 5;
  allowCashOnly: boolean;
  // POS assignment
  registerName?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ScanResult {
  code: string;
  format: string;
  source: ConnectionType;
  at: number;
}

export interface PrintResult {
  ok: boolean;
  errorCode?: string;
  deviceName?: string;
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface DeviceLogEntry {
  id: string;
  deviceId: string | null;
  deviceName: string;
  ts: number;
  level: LogLevel;
  message: string;
  detail?: string;
}

export interface DiagnosticItem {
  key: string;
  status: 'ok' | 'error' | 'warn' | 'info';
  label: string;
  detail: string;
}

export interface DiagnosticReport {
  generatedAt: number;
  items: DiagnosticItem[];
  summary: { ok: number; error: number; warn: number; info: number };
}

export interface TransportCapability {
  state: TransportState;
  // i18n-free machine code used to look up translated detail text
  reasonCode: 'ok' | 'needs_dev_build' | 'unsupported';
}

export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  bluetooth_escpos: 'conn_bluetooth_escpos',
  usb_escpos: 'conn_usb_escpos',
  network_escpos: 'conn_network_escpos',
  bluetooth_hid: 'conn_bluetooth_hid',
  usb_hid: 'conn_usb_hid',
  keyboard_hid: 'conn_keyboard_hid',
  camera: 'conn_camera',
};

export const ROLE_LABELS: Record<DeviceRole, string> = {
  printer: 'role_printer',
  scanner: 'role_scanner',
  drawer: 'role_drawer',
  scale: 'role_scale',
};

// Default configuration template for a given device type + connection.
export const defaultConfig = (role: DeviceRole, connectionType: ConnectionType): PeripheralConfig => ({
  id: `${role}-${connectionType}-${Date.now().toString(36)}`,
  role,
  connectionType,
  name: `${role} (${connectionType})`,
  enabled: true,
  status: 'not_configured',
  scanSuffix: 'enter',
  beep: true,
  vibration: false,
  paperWidth: 58,
  printCopies: 1,
  pin: 2,
  allowCashOnly: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});