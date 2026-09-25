import { router } from 'expo-router';
import LoginScreen from '../src/screens/account/login';

export default function LoginRoute() {
  return (
    <LoginScreen
      onCreateAccount={() => router.replace('/register?from=onboarding' as any)}
      onSuccess={handlePostAuth}
    />
  );
}

// After a successful login, route based on subscription + license status.
// A server-backed pairing request that needs resuming takes priority, so a
// joiner who restarted mid-request drops straight back into the wait/approval
// screen instead of the dashboard.
async function handlePostAuth() {
  const { resolvePostAuthRoute, resolveJoinResume } = await import('../src/services/postAuthRouter');
  const resumeRoute = await resolveJoinResume();
  const target = resumeRoute ?? (await resolvePostAuthRoute());
  router.replace(target as never);
}