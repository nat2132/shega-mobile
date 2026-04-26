import { router } from 'expo-router';
import InventoryOnboardingScreen from '../src/screens/onboarding/inventory-onboarding';

export default function InventoryOnboarding() {
  return (
    <InventoryOnboardingScreen 
      onNext={() => {
        router.replace('/sales-onboarding');
      }} 
      onSkip={() => {
        router.replace('/user-setup');
      }}
    />
  );
}