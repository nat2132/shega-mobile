// Type declarations for missing modules
declare module 'react-native-zeroconf' {
  export class Zeroconf {
    on(event: 'resolved', listener: (service: any) => void): this;
    on(event: 'remove', listener: (service: any) => void);
    on(event: 'error', listener: (err: Error) => void): this;
    scan(type: string, protocol: string): void;
    stop(): void;
  }
}

declare module 'react-native-websocket' {
  export class WebSocket {
    constructor(url: string);
    binaryType: string;
    readyState: number;
    onopen: (event: any) => void;
    onmessage: (event: { data: string | ArrayBuffer }) => void;
    onclose: (event: { code: number; reason: string }) => void;
    onerror: (event: Error) => void;
    send(data: string): void;
    close(): void;
  }
}

declare module 'react-native-tcp-socket' {
  export const TcpSocket: {
    createConnection(options: { host: string; port: number; tls: boolean }, callback: () => void): any;
  };
}

declare module 'react-native-bluetooth-classic' {
  export const BluetoothManager: {
    connect(deviceId: string): Promise<any>;
    disconnect(deviceId: string): Promise<void>;
  };
}

declare module 'react-native-serialport' {
  export class SerialPort {
    constructor(options: { path: string; baudRate: number; dataBits: number; stopBits: number; parity: string });
    on(event: 'data', listener: (data: string) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'close', listener: () => void): this;
    write(data: string, callback?: () => void): void;
    close(): void;
  }
}

declare module 'react-native-usb' {
  export const Usb: {
    getDevices(): Promise<any[]>;
    requestPermission(vendorId: number, productId: number): Promise<void>;
    openDevice(vendorId: number, productId: number): Promise<any>;
    closeDevice(vendorId: number, productId: number): Promise<void>;
    bulkTransfer(deviceId: number, endpoint: number, data: string, length: number, timeout: number): Promise<any>;
  };
}

declare module 'react-native-ble-plx' {
  export const BleManager: {
    connect(deviceId: string): Promise<void>;
    disconnect(deviceId: string): Promise<void>;
    discoverServices(deviceId: string): Promise<any>;
    readCharacteristic(deviceId: string, serviceUuid: string, characteristicUuid: string): Promise<any>;
    writeCharacteristicWithResponseForDevice(deviceId: string, serviceUuid: string, characteristicUuid: string, base64Data: string): Promise<void>;
    monitorCharacteristicForDevice(deviceId: string, serviceUuid: string, characteristicUuid: string): Promise<void>;
    startNotification(deviceId: string, serviceUuid: string, characteristicUuid: string): Promise<void>;
    stopNotification(deviceId: string, serviceUuid: string, characteristicUuid: string): Promise<void>;
  };
}

declare module 'react-native-usb' {
  export const Usb: {
    getDevices(): Promise<Array<{ vendorId: number; productId: number; deviceId: string }>>;
    requestPermission(vendorId: number, productId: number): Promise<void>;
    openDevice(vendorId: number, productId: number): Promise<any>;
    closeDevice(vendorId: number, productId: number): Promise<void>;
    bulkTransfer(deviceId: number, endpoint: number, data: string, length: number, timeout: number): Promise<any>;
  };
}

declare module 'react-native-serialport' {
  export class SerialPort {
    constructor(options: { path: string; baudRate: number; dataBits: number; stopBits: number; parity: string });
    on(event: 'data', listener: (data: string) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'close', listener: () => void): this;
    write(data: string, callback?: () => void): void;
    close(): void;
  }
}

declare global {
  interface NodeJS {
    Timeout: ReturnType<typeof setTimeout>;
  }
}