import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceStatus } from '@shega/shared';
import { getSelfStatus, isBlocking, BLOCKING_STATUSES } from '@/services/deviceEnforcement';
import { wsSyncClient } from '@/services/wsSyncClient';

export interface DeviceEnforcementState {
  status: DeviceStatus | null;
  blocked: boolean;
  /** Human-fired reason for the lock screen, derived from the blocking status. */
  reason: string;
  refresh: () => void;
}

function reasonFor(status: DeviceStatus): string {
  switch (status) {
    case 'locked':
      return 'This device has been locked by the business owner or manager. Contact them to unlock it.';
    case 'disabled':
      return 'This device has been disabled by the business owner. Contact them to reactivate it.';
    case 'removed':
      return 'This device has been removed from the business. Contact the owner to restore access.';
    default:
      return 'This device is not authorized for use with this business.';
  }
}

/**
 * Self-enforcement for remote device control (spec §17/§18). Reads THIS
 * install's status from the synced `devices` table and re-checks whenever a
 * sync completes, so an admin's remote lock/disable is applied promptly on the
 * receiving device. When the device is otherwise blocked it becomes
 * read-only/locked via the rendered overlay.
 */
export function useDeviceEnforcement(): DeviceEnforcementState {
  const [status, setStatus] = useState<DeviceStatus | null>(() => getSelfStatus());
  const statusRef = useRef<DeviceStatus | null>(status);

  const refresh = useCallback(() => {
    const next = getSelfStatus();
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    refresh();
    wsSyncClient.on('syncCompleted', refresh);
    return () => {
      wsSyncClient.off('syncCompleted', refresh);
    };
  }, [refresh]);

  const blocked = isBlocking(status);
  return {
    status,
    blocked,
    reason: status && BLOCKING_STATUSES.includes(status) ? reasonFor(status) : '',
    refresh,
  };
}
