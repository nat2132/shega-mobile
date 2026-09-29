import { router, useLocalSearchParams } from 'expo-router';
import RegisterScreen from '../src/screens/account/register';
import { safeBackOrFallback } from '../src/services/navigation';

export default function RegisterRoute() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return (
    <RegisterScreen
      // Back only makes sense when signup was reached from inside the wizard.
      // Otherwise the start screen is behind us — go straight back to it rather
      // than through "/" (which would re-run the splash and re-decide the route).
      onBack={() =>
        from === 'onboarding'
          ? safeBackOrFallback('/setup-wizard')
          : router.replace('/start-choice' as any)
      }
      onSuccess={handlePostRegister}
    />
  );
}

async function handlePostRegister() {
  // Signup-first onboarding: account creation is the FIRST step, so a fresh
  // account continues into the business setup wizard, which pre-fills the
  // owner identity from the account and skips its welcome/choose-path stage.
  router.replace('/setup-wizard?from=register' as never);
}
