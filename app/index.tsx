import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import StartupSplashScreen from '../src/screens/onboarding/startup-splash';
import { getStoredToken } from '../src/services/api';

type StartupPhase = 'loading' | 'account' | 'security' | 'subscription';

export default function Index() {
  const [phase, setPhase] = useState<StartupPhase>('loading');
  const [ready, setReady] = useState(false);
  const targetRef = useRef<string>('');

  // Resolve the startup route up-front. The splash stays visible (with a
  // spinner + phase label) until this finishes, instead of blindly navigating
  // after a fixed timer and leaving the user staring at a completed bar while
  // the (network) checks still run invisibly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let target: string;
      try {
        // 1. Is the user logged in (backend JWT)?
        setPhase('account');
        const token = await getStoredToken();

        if (!token) {
          // First launch: let the user pick their app language before any
          // onboarding or login UX appears. settings_language is only written
          // by the settings provider once a language is chosen.
          let fromFirstRun = true;
          try {
            const saved = await SecureStore.getItemAsync('settings_language');
            if (saved) fromFirstRun = false;
          } catch {
            fromFirstRun = true;
          }
          // Route straight to the setup wizard whose welcome stage offers
          // Create / Join / Sign in — no separate welcome screen.
          target = fromFirstRun ? '/language-select' : '/setup-wizard';
        } else {
          // 2. Resume a mid-join pairing request BEFORE the sign-in/subscription
          // gates: the pairing request lives on the backend, so after a restart
          // the joiner drops back into Waiting for Approval (or completes an
          // approval that landed while the app was closed). Nothing here
          // re-issues the one-time code.
          const { resolveJoinResume } = await import('../src/services/postAuthRouter');
          const resumeRoute = await resolveJoinResume();
          if (resumeRoute) {
            target = resumeRoute;
          } else {
            // Business-user sign-in gate (username+PIN). Once a business exists,
            // a team member signs in with their business credentials instead of
            // the old device-wide PIN. First-time users set username+PIN inside
            // the screen itself, so this is always the gate for an onboarding
            // business. Owners fresh from the setup wizard also pass here.
            const { getBusinesses } = await import('../src/services/businessService');
            if (getBusinesses().length > 0) {
              target = '/user-signin';
            } else {
              // 3. Check subscription + license gate.
              setPhase('subscription');
              const { resolvePostAuthRoute } = await import('../src/services/postAuthRouter');
              target = await resolvePostAuthRoute();
              if (!target) target = '/(tabs)/dashboard';
            }
          }
        }
        if (cancelled) return;
        targetRef.current = target;
        console.log('[SHEGA-INDEX] startup routing →', target, { hasLogin: !!token });
      } catch (error) {
        // Never let startup die on this — fall back to the setup wizard.
        console.error('[SHEGA-INDEX] startup check failed, routing to setup wizard:', error);
        if (cancelled) return;
        targetRef.current = '/setup-wizard';
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onStartupFinish = () => {
    const target = targetRef.current;
    setTimeout(() => {
      try {
        router.replace(target as any);
      } catch (e) {
        console.error('[SHEGA-INDEX] navigation failed, retrying with setup wizard:', e);
        try {
          router.replace('/setup-wizard' as any);
        } catch (e2) {
          console.error('[SHEGA-INDEX] fallback navigation also failed:', e2);
        }
      }
    }, 0);
  };

  const loadingLabelKey = phase === 'loading' ? undefined : `startup.${phase}`;

  return <StartupSplashScreen loading={!ready} loadingLabelKey={loadingLabelKey} onNext={onStartupFinish} />;
}