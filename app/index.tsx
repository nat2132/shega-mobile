import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import OnboardingScreen from '../src/screens/onboarding/first-onboarding';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Just a small delay to simulate system check/loading if needed
    // but we don't redirect here anymore as per request.
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  const onComplete = async () => {
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
        // New user or incomplete setup
        router.replace('/inventory-onboarding');
      }
    } catch (error) {
      console.error('[AuthCheck] Initialization failed:', error);
      router.replace('/inventory-onboarding');
    }
  };

  return <OnboardingScreen onNext={onComplete} />;
}