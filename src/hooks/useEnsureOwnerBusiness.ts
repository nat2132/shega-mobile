import { useEffect, useRef } from 'react';
import {
  ensureOwnerBusiness, ensureRemoteBusinessSeeded, getDefaultBusiness, getOwnerOfBusiness,
  reconcileBusinessName, setCurrentUserId, resolveMembershipForBusiness,
  ensureBusinessOwnerRole, setMembershipUserId,
} from '@/services/businessService';
import { fetchMyMemberships } from '@/services/api';
import type { Business } from '@shega/shared';

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
 *
 * Name rule: the account's `business_name` is authoritative. On re-entry we do
 * not stop at "a business already exists" — we reconcile a local row that never
 * received a real name (blank, a placeholder, or the account email). A name the
 * user actually chose is always preserved.
 */
export function useEnsureOwnerBusiness(
  businessName?: string,
  ownerName?: string,
  accountEmail?: string
) {
  const ran = useRef(false);

  // Declared inside the effect so the deps are exactly the values it reads.
  useEffect(() => {
    const bindOwner = (businessId: string) => {
      try {
        // A migrated/seeded business may never have stamped its recorded owner
        // with the Owner role; repair that first (only when no owner exists).
        ensureBusinessOwnerRole(businessId);
        // Bind this device to the account's OWN membership, never blindly to
        // the business owner (which would be wrong for a joined business).
        const memberId = resolveMembershipForBusiness(businessId);
        if (memberId) {
          setMembershipUserId(businessId, memberId);
          setCurrentUserId(memberId);
          return;
        }
        const owner = getOwnerOfBusiness(businessId);
        if (owner) setCurrentUserId(owner.id);
      } catch (e) {
        console.warn('[EnsureBusiness] Could not resolve business owner', e);
      }
    };

    const repairName = (business: Business) => {
      try {
        reconcileBusinessName(business, [businessName, ownerName], accountEmail);
      } catch (e) {
        console.warn('[EnsureBusiness] Could not reconcile business name', e);
      }
    };

    if (ran.current) return;
    ran.current = true;

    // Re-entry: the local business already exists. Bind the device, then
    // repair the name if this row never got a real one.
    const local = getDefaultBusiness();
    if (local) {
      bindOwner(local.id);
      repairName(local);
      return;
    }

    (async () => {
      try {
        const memberships = await fetchMyMemberships();
        const seeded = ensureRemoteBusinessSeeded(memberships);
        if (seeded) {
          bindOwner(seeded.id);
          // A remote business may still be unnamed/email on the account.
          repairName(seeded);
          return;
        }
      } catch (e) {
        // Offline or the endpoint is unavailable — fall back to local creation.
        console.warn('[EnsureBusiness] Could not fetch remote memberships, falling back to local create', e);
      }
      const business = ensureOwnerBusiness(businessName || '', ownerName || '', accountEmail);
      if (business) bindOwner(business.id);
    })();
  }, [businessName, ownerName, accountEmail]);
}
