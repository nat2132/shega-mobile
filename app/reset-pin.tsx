import { router } from 'expo-router';
import ResetPinScreen from '../src/screens/auth/reset-pin';

export default function ResetPin() {
  return (
    <ResetPinScreen
      onComplete={() => router.replace('/(tabs)/dashboard')}
    />
  );
}
