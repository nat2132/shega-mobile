import { useCallback, useMemo, useState } from 'react';
import { can, PermissionSet } from '@shega/shared';
import { useSubscription } from '@/context/SubscriptionContext';
import { getCurrentUserId, getUser, effectivePermissions } from '@/services/businessService';
import { useDataChangedRefresh } from '@/hooks/useDataChangedRefresh';

export type UserRole = 'cashier' | 'inventory' | 'manager' | 'owner';

export interface Permissions {
  /** raw stored role key (built-in key or a custom-role uuid) */
  roleKey: string;
  role: UserRole;
  isReadOnly: boolean;
  /** the effective permission set backing these flags */
  permissions: PermissionSet;
  canSell: boolean;
  canManageCatalog: boolean;
  canAdjustStock: boolean;
  canTakePhotos: boolean;
  canManageDevices: boolean;
  canViewTeam: boolean;
  canManageTeam: boolean;
  canAssignRoles: boolean;
  canManageSubscription: boolean;
  canManageBusiness: boolean;
}

/**
 * Legacy UI helper, now backed by the shared business model. Resolves the
 * current user (device session) and evaluates the same @shega/shared catalog
 * that gates the rest of the app, so product/adjust screens can never go out of
 * sync with the role.
 *
 * Deny-by-default: when no membership has been resolved yet (fresh install
 * before the owner row exists, or a device whose roster has not synced), every
 * capability is false. Showing a disabled action is always safer than letting a
 * user act with permissions they were never granted.
 */
export const usePermissions = (): Permissions => {
  const { isReadOnly } = useSubscription();
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((k) => k + 1), []);
  useDataChangedRefresh(reload);

  return useMemo(() => {
    void tick;
    const userId = getCurrentUserId();
    const user = userId ? getUser(userId) : undefined;
    const perms: PermissionSet = user ? effectivePermissions(user) : {};
    const canApprove = !!user && (user.isOwner || user.role === 'owner' || user.role === 'manager');
    const ctx = { permissions: perms, canApprove };

    const rawRole = user?.role || '';
    const role: UserRole = rawRole === 'owner' || user?.isOwner ? 'owner'
      : rawRole === 'manager' || rawRole === 'accountant' || rawRole === 'reports' ? 'manager'
      : rawRole === 'inventory' || rawRole === 'warehouse' ? 'inventory'
      : rawRole === 'cashier' ? 'cashier'
      // Custom roles are classified by what they can actually do.
      : can(ctx, 'sales.create') ? 'cashier'
      : can(ctx, 'products.edit') || can(ctx, 'inventory.adjust') ? 'inventory'
      : 'manager';

    return {
      roleKey: rawRole,
      role,
      isReadOnly,
      permissions: perms,
      canSell: can(ctx, 'sales.create') && !isReadOnly,
      canManageCatalog: (can(ctx, 'products.create') || can(ctx, 'products.edit')) && !isReadOnly,
      canAdjustStock: can(ctx, 'inventory.adjust') && !isReadOnly,
      canTakePhotos: can(ctx, 'products.edit') && !isReadOnly,
      // Hardware pairing is infrastructure, not business data, so it stays
      // available in view-only mode (it is also part of recovery).
      canManageDevices: can(ctx, 'devices.manage'),
      canViewTeam: can(ctx, 'team.view'),
      canManageTeam: can(ctx, 'team.manage') && !isReadOnly,
      canAssignRoles: can(ctx, 'team.assignRoles') && !isReadOnly,
      canManageSubscription: can(ctx, 'subscription.manage') && !isReadOnly,
      canManageBusiness: can(ctx, 'settings.manage') && !isReadOnly,
    };
  }, [isReadOnly, tick]);
};
