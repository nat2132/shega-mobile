import { router } from 'expo-router';
import VerifyPinScreen from '../src/screens/auth/verify-pin';

export default function VerifyPin() {
  return (
    <VerifyPinScreen 
      onSuccess={() => router.replace('/(tabs)/dashboard')}
    />
  );
}
