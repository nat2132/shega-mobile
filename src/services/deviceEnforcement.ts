import { Device, DeviceStatus } from '@shega/shared';
import { getThisDeviceId, getDevice } from '@/services/businessService';

/** Statuses that must hard-block all app use (spec §17 remote device control). */
export const BLOCKING_STATUSES: readonly DeviceStatus[] = ['locked', 'disabled', 'removed'];

/**
 * The status of THIS physical install, read from the synced `devices` row that
 * carries this device's own identity (sync_meta.device_id). An admin remote-
 * controls the device by flipping that row's status (BusinessManagement →
 * setDeviceStatus), which relay-based roster sync then delivers here; this
 * reading of the local table is how the device self-enforces (spec §17/§18).
 */
export function getSelfStatus(): DeviceStatus | null {
  const deviceId = getThisDeviceId();
  if (!deviceId) return null;
  const device: Device | undefined = getDevice(deviceId);
  if (!device) return null;
  return device.status;
}

export function isBlocking(status: DeviceStatus | null | undefined): boolean {
  return !!status && BLOCKING_STATUSES.includes(status);
}

/** Convenience: whether THIS install is blocked right now. */
export function isSelfBlocked(): boolean {
  return isBlocking(getSelfStatus());
}
