import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSettings } from '@/context/SettingsContext';
import {
  getActiveBusiness,
  getBusinesses,
  getDefaultBusiness,
  setActiveBusiness,
  setCurrentUserId,
  getUser,
  getCurrentUserId,
  resolveMembershipForBusiness,
} from '@/services/businessService';

/**
 * Business selection scope.
 *  - id of a business  -> single-business mode (the normal case)
 *  - ALL_BUSINESSES     -> cross-business aggregate for owners with several
 *                          businesses. Read screens show combined data;
 *                          writes stay on the underlying active business.
 */
export const ALL_BUSINESSES = '__all__';

export interface BusinessSummary {
  id: string;
  name: string;
  isDefault?: boolean;
  role?: string;
}

interface BusinessScopeContextType {
  /** selected scope id, or ALL_BUSINESSES */
  scope: string;
  /** the concrete active business (never ALL); used for writes */
  activeBusinessId: string | null;
  activeBusinessName: string;
  businesses: BusinessSummary[];
  /** true when the user may choose more than one scope */
  canSwitch: boolean;
  /** true while scope === ALL_BUSINESSES */
  isAllMode: boolean;
  /** display label for the current selection */
  scopeLabel: string;
  switchTo: (scope: string) => void;
  refresh: () => void;
  /** current user's role in the given business (or active business) */
  roleIn: (businessId?: string) => string | undefined;
}

const BusinessScopeContext = createContext<BusinessScopeContextType | undefined>(undefined);

export const BusinessScopeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useSettings();
  const [scope, setScope] = useState<string>(() => getActiveBusiness()?.id ?? '');
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((k) => k + 1), []);

  // Keep local state aligned when another screen changes the active business
  // (e.g. Settings → Business management).
  useEffect(() => {
    setScope(getActiveBusiness()?.id ?? '');
  }, [tick]);

  const businesses = useMemo<BusinessSummary[]>(() => {
    void tick;
    try {
      return getBusinesses().map((b) => {
        // Each business shows the account's OWN role in it — never another
        // business's role borrowed through the active session.
        const memberId = resolveMembershipForBusiness(b.id);
        const role = memberId ? getUser(memberId)?.role : undefined;
        return {
          id: b.id,
          name: (b as any).name ?? (b as any).businessName ?? b.id,
          isDefault: (b as any).isDefault,
          role,
        };
      });
    } catch {
      return [];
    }
  }, [tick]);

  const activeBusiness = useMemo(() => {
    void tick;
    return getActiveBusiness() ?? getDefaultBusiness();
  }, [tick]);

  const canSwitch = businesses.length > 1;

  const switchTo = useCallback(
    (next: string) => {
      if (next !== ALL_BUSINESSES) {
        const target = businesses.find((b) => b.id === next);
        if (!target) return;
        // Resolve the account's OWN membership in the target business. If the
        // account has no membership there we refuse the switch instead of
        // inheriting the target business owner's identity and permissions.
        const memberId = resolveMembershipForBusiness(next);
        if (!memberId) return;
        setActiveBusiness(next);
        setCurrentUserId(memberId);
      }
      setScope(next);
      refresh();
    },
    [businesses, refresh],
  );

  const isAllMode = scope === ALL_BUSINESSES;

  const scopeLabel = isAllMode
    ? t('business_scope.all')
    : (businesses.find((b) => b.id === scope)?.name ?? activeBusiness?.name ?? '');

  const roleIn = useCallback(
    (businessId?: string) => {
      void tick;
      if (!businessId) {
        const uid = getCurrentUserId();
        return uid ? getUser(uid)?.role : undefined;
      }
      const memberId = resolveMembershipForBusiness(businessId);
      return memberId ? getUser(memberId)?.role : undefined;
    },
    [tick],
  );

  const value: BusinessScopeContextType = {
    scope,
    activeBusinessId: activeBusiness?.id ?? null,
    activeBusinessName: activeBusiness?.name ?? '',
    businesses,
    canSwitch,
    isAllMode,
    scopeLabel,
    switchTo,
    refresh,
    roleIn,
  };

  return <BusinessScopeContext.Provider value={value}>{children}</BusinessScopeContext.Provider>;
};

export function useBusinessScope(): BusinessScopeContextType {
  const ctx = useContext(BusinessScopeContext);
  if (!ctx) throw new Error('useBusinessScope must be used inside BusinessScopeProvider');
  return ctx;
}
