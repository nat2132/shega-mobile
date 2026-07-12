import { router } from 'expo-router';
import SalesOnboardingScreen from '../src/screens/onboarding/sales-onboarding';

export default function SalesOnboarding() {
  return (
    <SalesOnboardingScreen
      onNext={() => {
        router.push('/analytics-onboarding');
      }}
      onBack={() => {
        router.back();
      }}
      onSkip={() => {
        router.replace('/user-setup');
      }}
    />
  );
}