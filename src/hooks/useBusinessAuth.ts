import { useCallback, useMemo, useState } from 'react';
import {
  getActiveBusiness, getDefaultBusiness, getUser, getCurrentUserId, businessIdVariants,
} from '@/services/businessService';
import { useDataChangedRefresh } from '@/hooks/useDataChangedRefresh';

export interface BusinessAuth {
  business: ReturnType<typeof getActiveBusiness>;
  user: ReturnType<typeof getUser>;
  userId: string | null;
  /** The local account that owns this device's business. */
  isOwner: boolean;
  /**
   * Capability check.
   *
   * Shega Mobile has no roles: each device keeps its own local users and every
   * one of them is a full local account, so the check is a constant. The method
   * survives so the screens that used to gate on a role keep reading naturally;
   * it never consults a role or a permission set, because there is none to read.
   */
  can: (key: string) => boolean;
  canApprove: boolean;
  isReadOnly: boolean;
}

/**
 * The current business + signed-in local user for the device.
 *
 * REACTIVE: switching business, or data changing underneath (a sync, a local
 * edit), bumps the shared data version and re-resolves what is active.
 */
export function useBusinessAuth(): BusinessAuth {
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((k) => k + 1), []);
  useDataChangedRefresh(reload);

  return useMemo(() => {
    void tick;
    const business = getActiveBusiness() ?? getDefaultBusiness();
    const currentUserId = getCurrentUserId();
    const user = currentUserId ? getUser(currentUserId) : undefined;
    // The signed-in user must belong to the business it is being read for. A
    // stale/foreign current user (left over from another business) resolves to
    // nothing rather than silently showing another business's identity.
    const belongs = !!user && !!business &&
      businessIdVariants(business.id).includes(String(user.businessId));
    const scoped = belongs ? user : undefined;

    return {
      business,
      user: scoped,
      userId: scoped?.id ?? null,
      isOwner: true,
      can: () => true,
      canApprove: true,
      isReadOnly: false,
    } as BusinessAuth;
  }, [tick]);
}
