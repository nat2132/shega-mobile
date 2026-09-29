import { fetchSubscriptionStatusCached } from './api';
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
    if (sub.status === 'active' || sub.status === 'trial' || sub.status === 'pending' || sub.status === 'pending_payment' || sub.status === 'pending_verification') {
      return '/(tabs)/dashboard';
    }
    // 'none', 'payment_rejected', 'rejected', 'expired' → plan selection
    return '/subscription/plans';
  } catch {
    return '/(tabs)/dashboard';
  }
}
