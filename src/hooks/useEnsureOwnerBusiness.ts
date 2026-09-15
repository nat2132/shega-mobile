import { useEffect, useRef } from 'react';
import {
  ensureOwnerBusiness, ensureRemoteBusinessSeeded, getOwnerOfBusiness,
  setCurrentUserId, getDefaultBusiness,
} from '@/services/businessService';
import { fetchMyMemberships } from '@/services/api';

/**
 * Ensures the first-install business seed has run and the current device is
 * bound to the owner user. Call once from the authenticated dashboard.
 *
 * Identity rule: a person is independent from their device/platform. When the
 * same account signs in on a fresh install, we FIRST look up their existing
 * backend businesses (owned + memberships) and adopt/attach to one — so this
 * device becomes another device of the SAME person/business, never a new
 * per-device owner business. Only a genuinely-new account (no remote business)
 * creates a new owner business locally.
 */
export function useEnsureOwnerBusiness(businessName?: string, ownerName?: string) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // Fast path: this device already has a local business (re-entry, already
    // seeded or joined). Bind the current device to its owner and stop.
    const local = getDefaultBusiness();
    if (local) {
      const owner = getOwnerOfBusiness(local.id);
      if (owner) setCurrentUserId(owner.id);
      return;
    }

    (async () => {
      try {
        const memberships = await fetchMyMemberships();
        const seeded = ensureRemoteBusinessSeeded(memberships);
        if (seeded) {
          const owner = getOwnerOfBusiness(seeded.id);
          if (owner) setCurrentUserId(owner.id);
          return;
        }
      } catch (e) {
        // Offline or the endpoint is unavailable — fall back to local creation.
        console.warn('[EnsureBusiness] Could not fetch remote memberships, falling back to local create', e);
      }
      const business = ensureOwnerBusiness(businessName || '', ownerName || '');
      if (business) {
        const owner = getOwnerOfBusiness(business.id);
        if (owner) setCurrentUserId(owner.id);
      }
    })();
  }, [businessName, ownerName]);
}
