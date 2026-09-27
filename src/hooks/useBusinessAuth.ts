import { useCallback, useMemo, useState } from 'react';
import {
  can, requiresApproval, PermissionContext, PermissionSet, BuiltinRoleKey,
} from '@shega/shared';
import {
  getActiveBusiness, getDefaultBusiness, getUser, getCurrentUserId,
  effectivePermissions, businessIdVariants,
} from '@/services/businessService';
import { useDataChangedRefresh } from '@/hooks/useDataChangedRefresh';

export interface BusinessAuth {
  business: ReturnType<typeof getActiveBusiness>;
  user: ReturnType<typeof getUser>;
  userId: string | null;
  /** true only when the resolved membership is flagged as an owner. */
  isOwner: boolean;
  /** raw role key (built-in key or custom-role uuid) */
  role?: string;
  permissions: PermissionSet;
  ctx: PermissionContext;
  can: (key: string) => boolean;
  requiresApproval: (key: string) => boolean;
  /** true when the resolved role may approve sensitive actions */
  canApprove: boolean;
  isReadOnly: boolean;
}

/**
 * Role & permission view tied to the shared business model. Any UI that gates
 * on a permission must use this hook so the check also happens at the domain
 * layer (see src/services/businessService / the desktop service).
 *
 * The hook is REACTIVE: switching business, syncing a roster/permission change
 * from another device, or editing a member locally all bump the shared data
 * version, which re-resolves the active business, the signed-in membership and
 * its effective permissions. Without this the Business Center would keep
 * showing the previous business's role and permissions.
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
    // The signed-in membership must belong to the business it is being read
    // for. A stale/foreign current user (e.g. left over from another business)
    // resolves to NO permissions rather than silently inheriting a role.
    const belongs = !!user && !!business &&
      businessIdVariants(business.id).includes(String(user.businessId));
    const scoped = belongs ? user : undefined;
    const permissions = scoped ? effectivePermissions(scoped) : {};
    const ctx: PermissionContext = {
      permissions,
      canApprove: !!scoped && (scoped.isOwner || scoped.role === 'manager' || scoped.role === 'owner'),
    };

    return {
      business,
      user: scoped,
      userId: scoped?.id ?? null,
      isOwner: !!scoped?.isOwner || scoped?.role === 'owner',
      role: scoped?.role as BuiltinRoleKey | undefined,
      permissions,
      ctx,
      can: (key: string) => can(ctx, key),
      requiresApproval: (key: string) => requiresApproval(ctx, key),
      canApprove: ctx.canApprove,
      isReadOnly: false,
    } as BusinessAuth;
  }, [tick]);
}
