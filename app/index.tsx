import React from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import StartupSplashScreen from '../src/screens/onboarding/startup-splash';

export default function Index() {
  const onStartupFinish = async () => {
    try {
      const pin = await SecureStore.getItemAsync('user_pin');
      const setupComplete = await SecureStore.getItemAsync('user_setupComplete');

      const target = pin ? '/verify-pin' : setupComplete === 'true' ? '/(tabs)/dashboard' : '/first-onboarding';
      setTimeout(() => router.replace(target), 0);
    } catch (error) {
      console.error('[AuthCheck] Initialization failed:', error);
      setTimeout(() => router.replace('/first-onboarding'), 0);
    }
  };

  return <StartupSplashScreen onNext={onStartupFinish} />;
}