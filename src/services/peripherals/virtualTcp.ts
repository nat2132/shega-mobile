// Virtual ESC/POS TCP printer transport — development & testing only.
//
// The virtual printer is a REMOTE TCP service (host/port, ESC/POS emulation),
// so it needs an internet connection — nothing else in the POS system does.
// This module has two layers:
//
//  1. Reachability probe (`probeVirtualTcp`) — genuinely reaches the endpoint.
//     In Expo Go this uses a timed HTTP request to `host:port`, which opens a
//     real TCP connection: a response means the endpoint is reachable, a fast
//     network error means unreachable, and our own timeout means "no response".
//     None of those results are ever faked.
//
//  2. Byte delivery (`writeVirtualPrinterBytes`) — sends the ESC/POS byte
//     stream. Raw TCP sockets are NOT available in Expo Go, so delivery is
//     honest: it requires the Shega development build, where
//     `registerVirtualTcpTransport(...)` installs a real socket implementation
//     (same seam a future physical network-9100 transport uses).
//
// The virtual printer runs the exact same ESC/POS generator and
// PeripheralManager path as production printers, so a receipt can be dev-tested
// here and then printed on Bluetooth/USB/network hardware unchanged.

import type { PeripheralConfig, PrintResult, VirtualProbeResult } from './types';

export interface VirtualTcpOptions {
  host: string;
  port: number;
  timeoutMs?: number;
}

// Implemented by the Shega development build when `react-native-tcp-socket`
// is installed. `testConnection` reports `rejected` when the socket connected
// but the service closed/reset it (typical TCP-whitelist behavior).
export interface VirtualTcpHooks {
  testConnection(opts: VirtualTcpOptions): Promise<VirtualProbeResult>;
  write(opts: VirtualTcpOptions, bytes: Uint8Array): Promise<PrintResult & { bytesSent?: number; confirmed?: boolean }>;
  disconnect?(): void;
}

let activeHooks: VirtualTcpHooks | null = null;

// Development-build entry point — registers the native socket transport.
export const registerVirtualTcpTransport = (hooks: VirtualTcpHooks): void => {
  activeHooks = hooks;
};

export const hasVirtualTcpTransport = (): boolean => activeHooks !== null;

export const disconnectVirtualTcp = (): void => {
  activeHooks?.disconnect?.();
};

// Reachability probe. Never reports success unless the endpoint answered.
export async function probeVirtualTcp(opts: VirtualTcpOptions): Promise<VirtualProbeResult> {
  if (activeHooks?.testConnection) return activeHooks.testConnection(opts);

  const host = (opts.host || '').trim();
  const port = Number(opts.port) || 0;
  if (!host || !port) {
    return { outcome: 'unreachable', ok: false, rejected: false, errorCode: 'missing_host' };
  }

  const timeoutMs = opts.timeoutMs ?? 6000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    await fetch(`http://${host}:${port}/`, {
      method: 'GET',
      headers: { Accept: '*/*' },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    return { outcome: 'reachable', ok: true, rejected: false, latencyMs };
  } catch (e) {
    const latencyMs = Date.now() - started;
    if (controller.signal.aborted) {
      // Socket opened but never answered within the window — or a silent
      // firewall drop. Reported as "no response", never as connected.
      return { outcome: 'timeout', ok: false, rejected: false, latencyMs, errorCode: 'timeout' };
    }
    return {
      outcome: 'unreachable',
      ok: false,
      rejected: false,
      latencyMs,
      errorCode: 'unreachable',
      detail: String((e as Error)?.message ?? e),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ESC/POS byte delivery to the virtual printer. Expo Go has no raw TCP socket,
// so this reports an honest development-build requirement; a development build
// (hooks installed) sends the real byte stream and reports the socket result.
export async function writeVirtualPrinterBytes(
  device: PeripheralConfig,
  bytes: Uint8Array,
): Promise<PrintResult & { bytesSent?: number; confirmed?: boolean }> {
  if (activeHooks?.write) {
    return activeHooks.write({ host: device.address || '', port: device.port || 9397 }, bytes);
  }
  return { ok: false, errorCode: 'needs_dev_build', deviceName: device.name };
}