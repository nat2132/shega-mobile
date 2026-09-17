import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import SubscriptionPlansScreen from '../../src/screens/subscription/subscription-plans';
import { fetchPlans, Plan } from '../../src/services/api';
import { startFreeTrial } from '../../src/database/db';
import * as Haptics from 'expo-haptics';
import { safeBackOrFallback } from '../../src/services/navigation';

// Fallback plans if the backend is unreachable or empty — exactly 1 month and
// 3 months, single tier, device_limit 1 (no "N devices").
const FALLBACK_PLANS: Plan[] = [
  { id: 1, name: 'premium', display_name: 'Premium', price: 2499, duration_months: 1, features: [] },
  { id: 2, name: 'premium', display_name: 'Premium', price: 5499, duration_months: 3, features: [] },
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

  const handleStartTrial = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    startFreeTrial();
    router.replace('/(tabs)/dashboard' as any);
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