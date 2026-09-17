import { router } from 'expo-router';
import RegisterScreen from '../src/screens/account/register';
import { safeBackOrFallback } from '../src/services/navigation';

export default function RegisterRoute() {
  return (
    <RegisterScreen
      onBack={() => safeBackOrFallback('/setup-wizard')}
      // Route new owners through the setup wizard, which asks whether they
      // want to CREATE a business or JOIN an existing one — registration used
      // to jump straight to subscription plans, skipping that choice.
      onSuccess={handlePostRegister}
    />
  );
}

async function handlePostRegister() {
  const { resolveJoinResume } = await import('../src/services/postAuthRouter');
  const resumeRoute = await resolveJoinResume();
  // A brand-new account has no businesses yet → the setup wizard's welcome
  // stage offers Create business / Join existing / Scan QR.
  router.replace((resumeRoute ?? '/setup-wizard') as never);
}