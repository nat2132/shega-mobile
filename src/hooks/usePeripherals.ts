// React bindings for the PeripheralManager — a reactive store snapshot and a
// hook to receive decoded barcodes wherever a sale screen is mounted.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getPeripheralManager } from '@/services/peripherals/peripheralManager';
import type { ConnectionType, PeripheralConfig, ScanResult } from '@/services/peripherals/types';

export interface PeripheralScanHandlers {
  onProduct?: (item: unknown, result: ScanResult) => void;
  onUnknown?: (result: ScanResult) => void;
}

export interface PeripheralStore {
  devices: PeripheralConfig[];
  isAvailable: (connectionType: import('@/services/peripherals/types').ConnectionType, role: import('@/services/peripherals/types').DeviceRole) => boolean;
}

const manager = () => getPeripheralManager();

// Reactive snapshot: re-renders whenever devices/logs/status change.
export function usePeripheralStore(): PeripheralStore {
  const version = useSyncExternalStore(manager().subscribe, manager().getVersion, manager().getVersion);
  void version;
  const devices = manager().getDevices();
  return {
    devices,
    isAvailable: (connectionType, role) => manager().capability(connectionType) === 'available',
  };
}

// Subscribe to keyboard/camera scans. Barcode lookup happens in the manager,
// so `onProduct` receives the full item object when one was found.
export function usePeripheralScan(handlers?: PeripheralScanHandlers | null): {
  scan: (code: string, source?: ConnectionType) => void;
} {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    return manager().subscribeScan((result: ScanResult, item: unknown | null) => {
      if (item) ref.current?.onProduct?.(item, result);
      else ref.current?.onUnknown?.(result);
    });
  }, []);

  return {
    scan: (code: string, source: ConnectionType = 'keyboard_hid') => manager().handleScan(code, source),
  };
}