import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import SubscriptionPaymentScreen from '../../src/screens/subscription/subscription-payment';
import { fetchPlans } from '../../src/services/api';
import { safeBackOrFallback } from '../../src/services/navigation';

export default function SubscriptionPayment() {
  const params = useLocalSearchParams<{
    planId?: string;
    plan?: string;
    durationMonths?: string;
  }>();

  const [resolvedPlanId, setResolvedPlanId] = useState<number>(
    parseInt(params.planId || '0', 10),
  );

  // The manage screen navigates here as ?plan=premium&durationMonths=1 instead
  // of carrying a backend planId. Resolve it from the live /api/plans list so
  // the correct tier (Basic vs Premium) + duration is submitted to the backend.
  useEffect(() => {
    const explicitPlanId = parseInt(params.planId || '', 10);
    if (explicitPlanId) {
      setResolvedPlanId(explicitPlanId);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const plans = await fetchPlans();
        if (cancelled || !plans?.length) return;
        const target = (params.plan || '').toLowerCase();
        const months = parseInt(params.durationMonths || '0', 10);
        const match = plans.find(
          (p) =>
            p.name.toLowerCase() === target &&
            (months ? p.duration_months === months : true),
        );
        if (match) setResolvedPlanId(match.id);
      } catch {
        /* fall through; backend will validate plan_id */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.plan, params.planId, params.durationMonths]);

  return (
    <SubscriptionPaymentScreen
      planId={resolvedPlanId}
      onBack={() => safeBackOrFallback('/subscription/plans')}
      onSuccess={() => router.replace('/subscription/status' as any)}
    />
  );
}