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
          // A completed local setup is marked in SecureStore (setup_wizard_done
          // / user_setupComplete) and/or has created a business in the local DB.
          // Skip the wizard and go straight to the business sign-in gate; on a
          // genuinely fresh install (or an interrupted setup) fall through to
          // the language picker / setup wizard as before.
          let onboardingDone = false;
          try {
            const { getBusinesses: getLocalBusinesses } = await import('../src/services/businessService');
            onboardingDone =
              (await SecureStore.getItemAsync('setup_wizard_done')) === 'true' ||
              (await SecureStore.getItemAsync('user_setupComplete')) === 'true' ||
              getLocalBusinesses().length > 0;
          } catch {
            onboardingDone = false;
          }
          if (onboardingDone) {
            target = '/user-signin';
          } else {
            // Fresh install: pick a language first, then the start screen.
            // An interrupted run already has a language, so it skips straight
            // to the choice (and no longer has to guess "register").
            //
            // The start screen offers create-a-business / log-in. Going straight
            // to /register made the app look like it had already decided the
            // user was opening a brand new business, even on a reinstall.
            // Connecting to another device happens later from Settings.
            target = fromFirstRun ? '/language-select' : '/start-choice';
          }
        } else {
          // 2. Local business-user sign-in gate (username+PIN). This is the
          // account on THIS device: each device keeps its own users, and
          // connecting devices never creates or imports one.
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