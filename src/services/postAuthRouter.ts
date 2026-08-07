import { fetchSubscriptionStatus, fetchLicenseStatus } from './api';

// Decides where to route a user right after a successful login/registration,
// based on their current backend subscription + license state.
//
// Returns a route path. Callers should router.replace() with it.
export async function resolvePostAuthRoute(): Promise<string> {
  try {
    const sub = await fetchSubscriptionStatus();
    if (sub.status === 'active') {
      try {
        const lic = await fetchLicenseStatus();
        if (lic.valid) {
          return '/(tabs)/dashboard';
        }
        return '/subscription/status';
      } catch {
        return '/subscription/status';
      }
    }
    if (sub.status === 'pending') {
      return '/subscription/status';
    }
    // 'none', 'rejected', 'expired' → send to plan selection.
    return '/subscription/plans';
  } catch {
    return '/subscription/plans';
  }
}