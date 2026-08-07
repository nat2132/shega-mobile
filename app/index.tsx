import React from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import StartupSplashScreen from '../src/screens/onboarding/startup-splash';
import { getStoredToken } from '../src/services/api';

export default function Index() {
  const onStartupFinish = async () => {
    let target: string;
    try {
      // 1. Is the user logged in (backend JWT)?
      const token = await getStoredToken();

      if (!token) {
        // Show login/register flow.
        target = '/welcome-choice';
      } else {
        // 2. Local device lock (PIN) still applies for in-app security.
        const pin = await SecureStore.getItemAsync('user_pin');
        const setupComplete = await SecureStore.getItemAsync('user_setupComplete');
        if (pin) {
          target = '/verify-pin';
        } else {
          // 3. Check subscription + license gate.
          const { resolvePostAuthRoute } = await import('../src/services/postAuthRouter');
          target = await resolvePostAuthRoute();
          if (!target) target = setupComplete === 'true' ? '/(tabs)/dashboard' : '/subscription/plans';
        }
      }
      console.log('[SHEGA-INDEX] startup routing →', target, { hasLogin: !!token });
    } catch (error) {
      // Never let startup die on this — fall back to login/register.
      console.error('[SHEGA-INDEX] startup check failed, routing to welcome:', error);
      target = '/welcome-choice';
    }

    // Defer navigation until after the splash has fully painted so the
    // router replaces don't race the first frame.
    setTimeout(() => {
      try {
        router.replace(target as any);
      } catch (e) {
        console.error('[SHEGA-INDEX] navigation failed, retrying with onboarding:', e);
        try {
          router.replace('/welcome-choice' as any);
        } catch (e2) {
          console.error('[SHEGA-INDEX] fallback navigation also failed:', e2);
        }
      }
    }, 0);
  };

  return <StartupSplashScreen onNext={onStartupFinish} />;
}