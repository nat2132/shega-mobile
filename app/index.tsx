import React from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import StartupSplashScreen from '../src/screens/onboarding/startup-splash';

export default function Index() {
  const onStartupFinish = async () => {
    let target: string;
    try {
      const pin = await SecureStore.getItemAsync('user_pin');
      const setupComplete = await SecureStore.getItemAsync('user_setupComplete');

      target = pin ? '/verify-pin' : setupComplete === 'true' ? '/(tabs)/dashboard' : '/first-onboarding';
      console.log('[SHEGA-INDEX] startup routing →', target, { hasPin: !!pin, setupComplete });
    } catch (error) {
      // SecureStore can throw (e.g. keychain unavailable on a fresh install).
      // Never let startup die on this — fall back to onboarding.
      console.error('[SHEGA-INDEX] SecureStore check failed, routing to onboarding:', error);
      target = '/first-onboarding';
    }

    // Defer navigation until after the splash has fully painted so the
    // router replaces don't race the first frame.
    setTimeout(() => {
      try {
        router.replace(target as any);
      } catch (e) {
        console.error('[SHEGA-INDEX] navigation failed, retrying with onboarding:', e);
        try {
          router.replace('/first-onboarding' as any);
        } catch (e2) {
          console.error('[SHEGA-INDEX] fallback navigation also failed:', e2);
        }
      }
    }, 0);
  };

  return <StartupSplashScreen onNext={onStartupFinish} />;
}
