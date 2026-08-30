// Transport registry — the seam where future native transports plug in.
//
// Capabilities are reported HONESTLY: nothing here fakes a successful
// connection. In Expo Go the only real transports are the camera scanner and
// the keyboard/HID scanner. Bluetooth and USB need `react-native-ble-plx` /
// native USB modules in a Shega Development Build; raw TCP network printing
// needs `react-native-tcp-socket`. All of those report `needs_dev_build`
// until the development-build phase ships and is physically tested.

import type { ConnectionType, PeripheralConfig, PrintResult, TransportCapability } from './types';

// Metro resolves a module only if it is installed. Missing modules mean the
// transport exists only in a future development build.
function isModuleAvailable(name: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(name);
    return !!mod;
  } catch {
    return false;
  }
}

function moduleState(name: string): TransportCapability {
  return isModuleAvailable(name)
    ? { state: 'available', reasonCode: 'ok' }
    : { state: 'needs_dev_build', reasonCode: 'needs_dev_build' };
}

export function transportCapability(connectionType: ConnectionType): TransportCapability {
  switch (connectionType) {
    case 'keyboard_hid':
    case 'camera':
      // Real on this device/build — camera scanner and hardware HID capture.
      return { state: 'available', reasonCode: 'ok' };
    case 'network_escpos':
      // Raw TCP 9100 printing needs a native socket module.
      return moduleState('react-native-tcp-socket');
    case 'bluetooth_escpos':
    case 'bluetooth_hid':
      // BLE support is added in a development build via react-native-ble-plx.
      return moduleState('react-native-ble-plx');
    case 'usb_escpos':
    case 'usb_hid':
      // USB Host/OTG needs a native module (react-native-usb or CATableUart).
      return moduleState('react-native-usb');
    default:
      return { state: 'unsupported', reasonCode: 'unsupported' };
  }
}

// Printer byte delivery. Implementations must never lie about success.
export async function writePrinterBytes(device: PeripheralConfig, bytes: Uint8Array): Promise<PrintResult> {
  const cap = transportCapability(device.connectionType);
  if (cap.state !== 'available') {
    return { ok: false, errorCode: cap.reasonCode === 'needs_dev_build' ? 'needs_dev_build' : 'unsupported', deviceName: device.name };
  }
  switch (device.connectionType) {
    case 'network_escpos':
      return networkWrite(device, bytes);
    case 'bluetooth_escpos':
    case 'usb_escpos':
    default:
      // Reached only when a native transport was injected in a dev build;
      // the default path reports honestly that delivery is not wired yet.
      return { ok: false, errorCode: 'needs_dev_build', deviceName: device.name };
  }
}

// TCP 9100 raw printing. `react-native-tcp-socket` is not installed, so this
// reports an honest dev-build requirement. A development build replaces this
// body with a real socket write and is the ONLY change needed to enable
// network printers throughout the app.
async function networkWrite(device: PeripheralConfig, _bytes: Uint8Array): Promise<PrintResult> {
  if (!isModuleAvailable('react-native-tcp-socket')) {
    return { ok: false, errorCode: 'needs_dev_build', deviceName: device.name };
  }
  // Development build path (react-native-tcp-socket present):
  //   const socket = TcpSocket.createConnection({ port: device.port ?? 9100, host: device.address }, ...)
  //   socket.write(bytes) → resolve { ok: true } / reject → { ok: false, errorCode: 'network_error' }
  return { ok: false, errorCode: 'network_error', deviceName: device.name };
}