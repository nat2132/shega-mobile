import { router } from 'expo-router';
import WelcomeChoiceScreen from '../src/screens/onboarding/welcome-choice';

export default function WelcomeChoice() {
  return (
    <WelcomeChoiceScreen
      onCreateAccount={() => {
        router.replace('/register' as any);
      }}
      onLogin={() => {
        router.replace('/login' as any);
      }}
    />
  );
}