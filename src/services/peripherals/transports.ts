// Transport registry — the seam where future native transports plug in.
//
// Capabilities are reported HONESTLY: nothing here fakes a successful
// connection. In Expo Go the only real transports are the camera scanner and
// the keyboard/HID scanner. The virtual ESC/POS printer (see virtualTcp.ts)
// can probe its remote TCP endpoint in Expo Go, but sending byte streams needs
// `react-native-tcp-socket` in a dev build. Bluetooth and USB need
// `react-native-ble-plx` / native USB modules in a Shega Development Build.
// All of those report `needs_dev_build` until the development-build phase
// ships and is physically tested.
//
// NOTE: these states are compile-time constants on purpose. Metro Statically
// resolves `require(...)` calls, so probing for a module at runtime with a
// dynamic `require(name)` fails bundling. When the Shega Development Build
// adds `react-native-tcp-socket` / `react-native-ble-plx`, flip the matching
// case below to `available` and wire the real transport — that is the only
// change needed to activate native printers and scanners app-wide.

import type { ConnectionType, PeripheralConfig, PrintResult, TransportCapability } from './types';
import { hasVirtualTcpTransport, writeVirtualPrinterBytes } from './virtualTcp';

export function transportCapability(connectionType: ConnectionType): TransportCapability {
  switch (connectionType) {
    case 'keyboard_hid':
    case 'camera':
      // Real on this device/build — camera scanner and hardware HID capture.
      return { state: 'available', reasonCode: 'ok' };
    case 'virtual_tcp_escpos':
      // Virtual ESC/POS TCP printer. Byte delivery needs react-native-tcp-socket
      // in a dev build (hook installed via registerVirtualTcpTransport); with no
      // socket, reachability probing still works but sending is honest dev-build.
      return hasVirtualTcpTransport()
        ? { state: 'available', reasonCode: 'ok' }
        : { state: 'needs_dev_build', reasonCode: 'needs_dev_build' };
    case 'network_escpos':
      // Raw TCP 9100 printing needs a native socket module in a dev build.
      return { state: 'needs_dev_build', reasonCode: 'needs_dev_build' };
    case 'bluetooth_escpos':
    case 'bluetooth_hid':
      // BLE support is added in a development build via react-native-ble-plx.
      return { state: 'needs_dev_build', reasonCode: 'needs_dev_build' };
    case 'usb_escpos':
    case 'usb_hid':
      // USB Host/OTG needs a native module in a dev build.
      return { state: 'needs_dev_build', reasonCode: 'needs_dev_build' };
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
    case 'virtual_tcp_escpos':
      return writeVirtualPrinterBytes(device, bytes);
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

// TCP 9100 raw printing. `react-native-tcp-socket` is not installed in Expo
// Go, so this reports an honest dev-build requirement. A development build
// replaces this body with a real socket write and is the ONLY change needed
// to enable network printers throughout the app.
async function networkWrite(device: PeripheralConfig, _bytes: Uint8Array): Promise<PrintResult> {
  // Development build path (react-native-tcp-socket present):
  //   const socket = TcpSocket.createConnection({ port: device.port ?? 9100, host: device.address }, ...)
  //   socket.write(bytes) → resolve { ok: true } / reject → { ok: false, errorCode: 'network_error' }
  return { ok: false, errorCode: 'needs_dev_build', deviceName: device.name };
}