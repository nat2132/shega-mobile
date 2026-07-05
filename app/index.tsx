import React from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import StartupSplashScreen from '../src/screens/onboarding/startup-splash';

export default function Index() {
  const onStartupFinish = async () => {
    try {
      const pin = await SecureStore.getItemAsync('user_pin');
      const setupComplete = await SecureStore.getItemAsync('user_setupComplete');

      if (pin) {
        // If PIN is set, verify security first
        router.replace('/verify-pin');
      } else if (setupComplete === 'true') {
        // If no PIN but setup is done, go to dashboard
        router.replace('/(tabs)/dashboard');
      } else {
        // New user or incomplete setup - show first onboarding experience
        router.replace('/first-onboarding');
      }
    } catch (error) {
      console.error('[AuthCheck] Initialization failed:', error);
      router.replace('/first-onboarding');
    }
  };

  return <StartupSplashScreen onNext={onStartupFinish} />;
}