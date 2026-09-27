import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import SubscriptionPlansScreen from '../../src/screens/subscription/subscription-plans';
import { fetchPlans, startTrial, Plan } from '../../src/services/api';
import { startFreeTrial, applyServerSubscriptionStatus } from '../../src/database/db';
import * as Haptics from 'expo-haptics';
import { safeBackOrFallback } from '../../src/services/navigation';
import { isOfflineError } from '../../src/services/connectivity';
import { onboardingEditionFor, parsePlanEdition, plansForOnboarding } from '@shega/shared';

/** This build is Shega Mobile, so signup and trials are Mobile-scoped. */
const PLATFORM = 'mobile' as const;

// Fallback plans if the backend is unreachable or empty — the three canonical
// editions (Mobile / Desktop / Mobile + Desktop), one month each. Names match
// the `?plan=` values used by the manage screen so payment resolution works.
const FALLBACK_PLANS: Plan[] = [
  { id: 1, name: 'mobile', display_name: 'Mobile', edition: 'mobile', price: 4500, duration_months: 1, features: [] },
  { id: 2, name: 'desktop', display_name: 'Desktop', edition: 'desktop', price: 7500, duration_months: 1, features: [] },
  { id: 3, name: 'both', display_name: 'Mobile + Desktop', edition: 'both', price: 10000, duration_months: 1, features: [] },
];

export default function SubscriptionPlans() {
  // `scope=onboarding` is the first-time signup step: only this platform's plan
  // is offered. Everywhere else (the Subscription section) the full catalogue
  // stays visible so a customer can add the other platform later.
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const isOnboarding = scope === 'onboarding';

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

  const allPlans = useMemo(
    () => (plans && plans.length > 0 ? plans : FALLBACK_PLANS),
    [plans],
  );

  // A first-time Mobile signup sees the Mobile plan only — never Desktop, and
  // never the combined edition, which is an upgrade rather than a default.
  const visiblePlans = useMemo(
    () => (isOnboarding ? plansForOnboarding(allPlans, PLATFORM) : allPlans),
    [allPlans, isOnboarding],
  );

  /**
   * The plan this platform's trial is for. Resolved by edition rather than
   * position, so a reordering or a new plan in the catalogue can never hand a
   * Mobile customer a Desktop trial.
   */
  const trialPlan = useMemo(() => {
    const wanted = onboardingEditionFor(PLATFORM);
    return allPlans.find((p) => parsePlanEdition(p.edition ?? p.display_name ?? p.name) === wanted) ?? null;
  }, [allPlans]);

  /**
   * Where to go once the plan step is done. Onboarding continues to PIN setup
   * (Signup → Business Setup → Plan/Trial → PIN → App); the Subscription
   * section returns to the app.
   */
  const afterPlanStep = useCallback(
    () => router.replace((isOnboarding ? '/create-pin?from=onboarding' : '/(tabs)/dashboard') as any),
    [isOnboarding],
  );

  const handleSelectPlan = useCallback(
    (plan: Plan) => {
      router.replace({
        pathname: '/subscription/payment',
        params: { planId: String(plan.id), from: isOnboarding ? 'onboarding' : 'manage' },
      });
    },
    [isOnboarding],
  );

  /**
   * "Pay Now" during onboarding: subscribe immediately instead of trialling.
   * Goes to the same payment flow the trial alternative bypasses — confirm the
   * plan, pay, submit the transaction — and the backend holds it pending until
   * an admin approves it.
   */
  const handlePayNow = useCallback(
    (plan: Plan) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      handleSelectPlan(plan);
    },
    [handleSelectPlan],
  );

  const handleStartTrial = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const planId = Number(trialPlan?.id);
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
      afterPlanStep();
    } catch (error) {
      if (isOfflineError(error)) {
        // Offline: keep the legacy local 7-day trial so the app still works.
        startFreeTrial();
        afterPlanStep();
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const status = (error as { status?: number })?.status;
      if (status === 409) {
        // Trial already active or subscription exists — proceed to app dashboard!
        afterPlanStep();
        return;
      }
      Alert.alert('Could not start trial', 'Please check your connection and try again.');
    }
  };

  return (
    <SubscriptionPlansScreen
      plans={visiblePlans}
      onSelectPlan={handleSelectPlan}
      onStartTrial={handleStartTrial}
      onBack={isOnboarding ? undefined : () => safeBackOrFallback('/setup-wizard')}
      onSkip={isOnboarding ? afterPlanStep : undefined}
      onPayNow={isOnboarding ? handlePayNow : undefined}
    />
  );
}
