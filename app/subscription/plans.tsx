import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import SubscriptionPlansScreen from '../../src/screens/subscription/subscription-plans';
import { fetchPlans, startTrial, Plan } from '../../src/services/api';
import { startFreeTrial, applyServerSubscriptionStatus } from '../../src/database/db';
import * as Haptics from 'expo-haptics';
import { safeBackOrFallback } from '../../src/services/navigation';
import { isOfflineError } from '../../src/services/connectivity';

// Fallback plans if the backend is unreachable or empty — the three canonical
// editions (Mobile / Desktop / Mobile + Desktop), one month each. Names match
// the `?plan=` values used by the manage screen so payment resolution works.
const FALLBACK_PLANS: Plan[] = [
  { id: 1, name: 'mobile', display_name: 'Mobile', price: 4500, duration_months: 1, features: [] },
  { id: 2, name: 'desktop', display_name: 'Desktop', price: 7500, duration_months: 1, features: [] },
  { id: 3, name: 'both', display_name: 'Mobile + Desktop', price: 10000, duration_months: 1, features: [] },
];

export default function SubscriptionPlans() {
  const [plans, setPlans] = useState<Plan[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await fetchPlans();
        if (!cancelled && fetched && fetched.length > 0) {
          setPlans(fetched);
        } else if (!cancelled) {
          setPlans(FALLBACK_PLANS);
        }
      } catch {
        if (!cancelled) setPlans(FALLBACK_PLANS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectPlan = (plan: Plan) => {
    router.replace({
      pathname: '/subscription/payment',
      params: { planId: String(plan.id) },
    });
  };

  const handleStartTrial = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const pool = plans && plans.length > 0 ? plans : FALLBACK_PLANS;
      const chosen = pool[0];
      const planId = Number(chosen?.id);
      if (!planId || Number.isNaN(planId)) throw new Error('no plan available for trial');
      const server = await startTrial({ plan_id: planId });
      // Backend is the source of truth: mirror the trial into the local row so
      // the premium gate opens immediately (before the next status refresh).
      applyServerSubscriptionStatus({
        status: 'trial',
        plan: server.plan || null,
        planName: server.plan_name || null,
        expiresAt: server.expires_at || null,
      });
      router.replace('/(tabs)/dashboard' as any);
    } catch (error) {
      if (isOfflineError(error)) {
        // Offline: keep the legacy local 7-day trial so the app still works.
        startFreeTrial();
        router.replace('/(tabs)/dashboard' as any);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const status = (error as { status?: number })?.status;
      if (status === 409) {
        // Trial already used or subscription exists — send them to payment.
        Alert.alert(
          'Trial not available',
          'A trial is only available once per account. Proceed with a paid plan, or check your subscription status.',
        );
        return;
      }
      Alert.alert('Could not start trial', 'Please check your connection and try again.');
    }
  };

  return (
    <SubscriptionPlansScreen
      plans={plans}
      onSelectPlan={handleSelectPlan}
      onStartTrial={handleStartTrial}
      onBack={() => safeBackOrFallback('/setup-wizard')}
    />
  );
}