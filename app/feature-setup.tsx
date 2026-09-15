import { router } from 'expo-router';
import FeatureSetupScreen from '../src/screens/account creation/feature-setup';

export default function FeatureSetup() {
  return <FeatureSetupScreen onComplete={() => router.replace('/pin-setup')} />;
}
