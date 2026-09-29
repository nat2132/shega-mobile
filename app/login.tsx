import { router } from 'expo-router';
import LoginScreen from '../src/screens/account/login';

export default function LoginRoute() {
  return (
    <LoginScreen
      onCreateAccount={() => router.replace('/start-choice' as any)}
      onSuccess={handlePostAuth}
    />
  );
}

// After a successful login, route based on subscription + license status.
async function handlePostAuth() {
  const { resolvePostAuthRoute } = await import('../src/services/postAuthRouter');
  router.replace((await resolvePostAuthRoute()) as never);
}
