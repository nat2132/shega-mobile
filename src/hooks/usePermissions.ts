import { can, DEFAULT_ROLE_SETS } from '@shega/shared';
import { useSubscription } from '@/context/SubscriptionContext';
import { getCurrentUserId, getUser, effectivePermissions } from '@/services/businessService';

export type UserRole = 'cashier' | 'inventory' | 'manager' | 'owner';

export interface Permissions {
  role: UserRole;
  isReadOnly: boolean;
  canSell: boolean;
  canManageCatalog: boolean;
  canAdjustStock: boolean;
  canTakePhotos: boolean;
  canManageDevices: boolean;
}

/**
 * Legacy UI helper, now backed by the shared business model. Resolves the
 * current user (device session) and evaluates the same @shega/shared catalog
 * that gates the rest of the app, so product/adjust screens can never go out of
 * sync with the role. Falls back to owner permissions for a fresh single-device
 * install where no user has been resolved yet.
 */
export const usePermissions = (): Permissions => {
  const { isReadOnly } = useSubscription();
  const userId = getCurrentUserId();
  const user = userId ? getUser(userId) : undefined;
  const perms = user ? effectivePermissions(user) : DEFAULT_ROLE_SETS.owner;
  const canApprove = !!user && (user.isOwner || user.role === 'owner' || user.role === 'manager');
  const ctx = { permissions: perms, canApprove };

  const rawRole = user?.role || 'owner';
  const role: UserRole = rawRole === 'owner' ? 'owner'
    : rawRole === 'manager' || rawRole === 'accountant' || rawRole === 'reports' ? 'manager'
    : rawRole === 'inventory' || rawRole === 'warehouse' ? 'inventory'
    : 'cashier';

  return {
    role,
    isReadOnly,
    canSell: can(ctx, 'sales.create') && !isReadOnly,
    canManageCatalog: can(ctx, 'products.create') || can(ctx, 'products.edit'),
    canAdjustStock: can(ctx, 'inventory.adjust'),
    canTakePhotos: can(ctx, 'products.edit'),
    canManageDevices: can(ctx, 'devices.manage'),
  };
};