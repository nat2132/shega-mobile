import { router } from 'expo-router';
import SecuritySetupScreen from '../src/screens/account creation/pin-setup';

export default function PinSetup() {
  return (
    <SecuritySetupScreen 
      onSetPin={() => router.push('/create-pin')}
      onSkip={() => router.replace('/message')}
    />
  );
}
