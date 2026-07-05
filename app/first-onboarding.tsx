import React from 'react';
import { router } from 'expo-router';
import OnboardingScreen from '../src/screens/onboarding/first-onboarding';

export default function FirstOnboardingRoute() {
  return (
    <OnboardingScreen
      onNext={() => {
        router.replace('/welcome-choice');
      }}
    />
  );
}
