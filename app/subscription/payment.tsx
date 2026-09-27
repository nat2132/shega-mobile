import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import SubscriptionPaymentScreen from '../../src/screens/subscription/subscription-payment';
import { fetchPlans } from '../../src/services/api';
import { safeBackOrFallback } from '../../src/services/navigation';
import { parsePlanEdition } from '@shega/shared';

export default function SubscriptionPayment() {
  const params = useLocalSearchParams<{
    planId?: string;
    plan_id?: string;
    plan?: string;
    durationMonths?: string;
    from?: string;
  }>();

  const rawId = params.planId || params.plan_id || '';
  const initialPlanId = parseInt(rawId, 10);

  const [resolvedPlanId, setResolvedPlanId] = useState<number>(
    initialPlanId > 0 ? initialPlanId : 1,
  );

  // The manage screen navigates here as ?plan=mobile|desktop|both&durationMonths=1
  // instead of carrying a backend planId. Resolve it from the live /api/plans
  // list so the correct edition + duration is submitted to the backend.
  useEffect(() => {
    const rawId = params.planId || params.plan_id || '';
    const explicitPlanId = parseInt(rawId, 10);
    if (explicitPlanId > 0) {
      setResolvedPlanId(explicitPlanId);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const plans = await fetchPlans();
        if (cancelled || !plans?.length) return;
        // Match on the canonical edition rather than the plan name, so a
        // backend rename ("Mobile + Desktop (Monthly)") still resolves.
        const target = parsePlanEdition(params.plan) || 'mobile';
        const months = parseInt(params.durationMonths || '0', 10);
        const match = plans.find(
          (p) =>
            parsePlanEdition(p.edition ?? p.display_name ?? p.name) === target &&
            (months ? p.duration_months === months : true),
        );
        if (match) setResolvedPlanId(match.id);
      } catch {
        /* fall through; default is Plan ID 1 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.plan, params.planId, params.plan_id, params.durationMonths]);

  // Coming from the onboarding plan step, going back must land on that same
  // step (Mobile-only) rather than the full catalogue.
  const isOnboarding = params.from === 'onboarding';

  return (
    <SubscriptionPaymentScreen
      planId={resolvedPlanId}
      onBack={() => safeBackOrFallback(isOnboarding ? '/subscription/plans?scope=onboarding' : '/subscription/plans')}
      // Onboarding always ends with PIN Setup, whether the customer took the
      // trial or paid. A payment made here stays pending, so they land in
      // view-only until an admin approves — but the PIN is still theirs to set.
      onSuccess={() =>
        router.replace((isOnboarding ? '/create-pin?from=onboarding' : '/subscription/status') as any)
      }
    />
  );
}