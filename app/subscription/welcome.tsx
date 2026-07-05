import React from 'react';
import { router } from 'expo-router';
import SubscriptionWelcomeScreen from '../../src/screens/subscription/subscription-welcome';

export default function SubscriptionWelcome() {
  return (
    <SubscriptionWelcomeScreen
      onContinue={() => router.replace('/(tabs)/dashboard')}
    />
  );
}
