import { useEffect, useRef } from 'react';
import {
  ensureOwnerBusiness, getDefaultBusiness, getOwnerOfBusiness, setCurrentUserId,
} from '@/services/businessService';

/**
 * Ensures the first-install "Create Business → Become Owner" seed has run and
 * that the current device is bound to the owner user. Call once from the
 * authenticated dashboard. No-ops after the first run.
 */
export function useEnsureOwnerBusiness(businessName?: string, ownerName?: string) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    try {
      const business = ensureOwnerBusiness(businessName || '', ownerName || '');
      if (business) {
        const owner = getOwnerOfBusiness(business.id);
        if (owner) setCurrentUserId(owner.id);
      }
    } catch (e) {
      console.warn('ensureOwnerBusiness failed', e);
    }
  }, [businessName, ownerName]);
}
