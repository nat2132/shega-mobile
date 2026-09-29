import { useCallback, useMemo, useState } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { useDataChangedRefresh } from '@/hooks/useDataChangedRefresh';

/**
 * Screen-level capability flags.
 *
 * Mobile has no roles and no permission catalog, so every flag is granted and
 * only the subscription's view-only state can take write actions away. The
 * flags are kept (rather than deleted) because they express *subscription*
 * entitlements — can I sell / adjust stock right now — which is a real check.
 */
export interface Permissions {
  isReadOnly: boolean;
  canSell: boolean;
  canManageCatalog: boolean;
  canAdjustStock: boolean;
  canTakePhotos: boolean;
  canManageDevices: boolean;
  canViewTeam: boolean;
  canManageTeam: boolean;
  canManageSubscription: boolean;
  canManageBusiness: boolean;
}

export const usePermissions = (): Permissions => {
  const { isReadOnly } = useSubscription();
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((k) => k + 1), []);
  useDataChangedRefresh(reload);

  return useMemo(() => {
    void tick;
    return {
      isReadOnly,
      canSell: !isReadOnly,
      canManageCatalog: !isReadOnly,
      canAdjustStock: !isReadOnly,
      canTakePhotos: !isReadOnly,
      // Hardware/device pairing is infrastructure, not business data, so it
      // stays available in view-only mode (it is also part of recovery).
      canManageDevices: true,
      canViewTeam: !isReadOnly,
      canManageTeam: !isReadOnly,
      canManageSubscription: !isReadOnly,
      canManageBusiness: !isReadOnly,
    };
  }, [isReadOnly, tick]);
};
