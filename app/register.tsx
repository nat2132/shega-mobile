import { router } from 'expo-router';
import RegisterScreen from '../src/screens/account/register';

export default function RegisterRoute() {
  return (
    <RegisterScreen
      onBack={() => router.back()}
      onSuccess={() => router.replace('/subscription/plans')}
    />
  );
}