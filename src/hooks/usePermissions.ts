import { useSubscription } from '@/context/SubscriptionContext';
import { getAppSetting } from '@/database/db';

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

// Role is stored in app_settings (`user_role`), defaulting to 'owner' so a
// single-device business keeps full control. Cashiers keep selling but cannot
// create/price products or adjust stock; inventory workers can register and
// restock; managers/owners can do everything.
export const usePermissions = (): Permissions => {
  const { isReadOnly } = useSubscription();
  const stored = (getAppSetting('user_role', 'owner') || 'owner').toLowerCase();
  const role: UserRole = ['cashier', 'inventory', 'manager', 'owner'].includes(stored) ? (stored as UserRole) : 'owner';

  return {
    role,
    isReadOnly,
    canSell: !isReadOnly,
    canManageCatalog: !isReadOnly && (role === 'manager' || role === 'owner'),
    canAdjustStock: !isReadOnly && (role === 'inventory' || role === 'manager' || role === 'owner'),
    canTakePhotos: !isReadOnly && (role === 'inventory' || role === 'manager' || role === 'owner'),
    canManageDevices: !isReadOnly && (role === 'manager' || role === 'owner'),
  };
};