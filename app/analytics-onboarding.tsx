import { useRef } from 'react';
import { router } from 'expo-router';
import AnalyticsOnboardingScreen from '../src/screens/onboarding/analytics-onboarding';

export default function AnalyticsOnboarding() {
  const hasNavigated = useRef(false);

  return (
    <AnalyticsOnboardingScreen 
      onGetStarted={() => {
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          router.replace('/user-setup');
        }
      }} 
      onBack={() => {
        router.back();
      }}
      onSkip={() => {
         if (!hasNavigated.current) {
           hasNavigated.current = true;
           router.replace('/user-setup');
         }
      }}
    />
  );
}