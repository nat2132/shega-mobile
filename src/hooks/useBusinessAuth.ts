import { useMemo } from 'react';
import {
  can, requiresApproval, PermissionContext, BuiltinRoleKey,
  getBuiltinRole,
} from '@shega/shared';
import {
  getActiveBusiness, getDefaultBusiness, getUser, getCurrentUserId,
} from '@/services/businessService';
import { effectivePermissions } from '@/services/businessService';

/**
 * Role & permission view tied to the shared business model. Any UI that gates
 * on a permission must use this hook so the check also happens at the domain
 * layer (see src/services/businessService / the desktop service).
 */
export function useBusinessAuth() {
  return useMemo(() => {
    const business = getActiveBusiness() ?? getDefaultBusiness();
    const currentUserId = getCurrentUserId();
    const user = currentUserId ? getUser(currentUserId) : undefined;
    const permissions = user ? effectivePermissions(user) : {};
    const ctx: PermissionContext = {
      permissions,
      canApprove: !!user && (user.isOwner || user.role === 'manager' || user.role === 'owner'),
    };

    return {
      business,
      user,
      userId: currentUserId,
      isOwner: !!user?.isOwner,
      role: user?.role as BuiltinRoleKey | undefined,
      ctx,
      can: (key: string) => can(ctx, key),
      requiresApproval: (key: string) => requiresApproval(ctx, key),
      isReadOnly: false,
    };
  }, []);
}
