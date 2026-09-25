import { fetchSubscriptionStatusCached, fetchLicenseStatusCached } from './api';
import { myPairingRequests } from './pairingService';
import * as SecureStore from 'expo-secure-store';
import { getBusinesses } from './businessService';

// Decides where to route a user right after a successful login/registration,
// based on their current backend subscription + license state.
//
// Uses the persistent status cache so cold starts skip the network entirely
// within the cache TTLs. Returns a route path. Callers should router.replace()
// with it.
export async function resolvePostAuthRoute(): Promise<string> {
  // Progressive setup: owners who haven't finished first-run onboarding go
  // through the setup wizard (Create Business → optional team/business steps).
  try {
    const setupDone = await SecureStore.getItemAsync('setup_wizard_done');
    const bizCount = getBusinesses().length;
    if (setupDone !== 'true' && bizCount === 0) return '/setup-wizard';
  } catch { /* fall through to the normal gates */ }
  try {
    const sub = await fetchSubscriptionStatusCached();
    if (sub.status === 'active' || sub.status === 'trial') {
      try {
        const lic = await fetchLicenseStatusCached();
        if (lic.valid) {
          return '/(tabs)/dashboard';
        }
        return '/subscription/status';
      } catch {
        return '/subscription/status';
      }
    }
    if (sub.status === 'pending' || sub.status === 'pending_payment') {
      return '/subscription/status';
    }
    // 'none', 'payment_rejected', 'rejected', 'expired' → plan selection so the
    // user can start a trial or resubmit their payment.
    return '/subscription/plans';
  } catch {
    return '/subscription/plans';
  }
}

const RESUME_STATES = ['pending', 'used', 'approved', 'rejected', 'cancelled'] as const;

async function joinResumeDone(id: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(`join_resume_done_${id}`)) === 'true';
  } catch {
    return false;
  }
}

export async function setJoinResumeDone(id: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(`join_resume_done_${id}`, 'true');
  } catch {
    /* best-effort: worst case an extra resume screen visit */
  }
}

/**
 * Finds a server-backed pairing request the freshly authenticated user should
 * resume after an app restart. Returns a `/join-existing?resume=<id>` route or
 * null when there is nothing to resume (or the request was already handled).
 */
export async function resolveJoinResume(): Promise<string | null> {
  try {
    const requests = await myPairingRequests();
    for (const r of requests) {
      if (
        !r.expired &&
        (RESUME_STATES as readonly string[]).includes(r.status) &&
        !(await joinResumeDone(r.id))
      ) {
        return `/join-existing?resume=${r.id}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}