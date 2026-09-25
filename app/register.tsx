import { router, useLocalSearchParams } from 'expo-router';
import RegisterScreen from '../src/screens/account/register';
import { safeBackOrFallback } from '../src/services/navigation';

export default function RegisterRoute() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return (
    <RegisterScreen
      // Back only makes sense when signup was reached from inside the wizard;
      // in the signup-first flow there is no wizard behind us, so back exits
      // safely to the start route instead.
      onBack={() =>
        from === 'onboarding'
          ? safeBackOrFallback('/setup-wizard')
          : router.replace('/' as never)
      }
      onSuccess={handlePostRegister}
    />
  );
}

async function handlePostRegister() {
  const { resolveJoinResume } = await import('../src/services/postAuthRouter');
  const resumeRoute = await resolveJoinResume();
  // Signup-first onboarding: account creation is the FIRST step, so a fresh
  // account continues into the business setup wizard, which pre-fills the
  // owner identity from the account and skips its welcome/choose-path stage.
  router.replace((resumeRoute ?? '/setup-wizard?from=register') as never);
}