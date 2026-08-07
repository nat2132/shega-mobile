import { router } from 'expo-router';
import RegisterScreen from '../src/screens/account/register';
import { safeBackOrFallback } from '../src/services/navigation';

export default function RegisterRoute() {
  return (
    <RegisterScreen
      onBack={() => safeBackOrFallback('/welcome-choice')}
      onSuccess={() => router.replace('/subscription/plans')}
    />
  );
}