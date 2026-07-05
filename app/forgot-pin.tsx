import { router } from 'expo-router';
import ForgotPinScreen from '../src/screens/auth/forgot-pin';

export default function ForgotPin() {
  return (
    <ForgotPinScreen
      onBack={() => router.back()}
      onVerified={() => router.replace('/reset-pin')}
    />
  );
}
