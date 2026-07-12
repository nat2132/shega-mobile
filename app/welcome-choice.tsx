import { router } from 'expo-router';
import WelcomeChoiceScreen from '../src/screens/onboarding/welcome-choice';

export default function WelcomeChoice() {
  return (
    <WelcomeChoiceScreen
      onRegisterChoose={() => {
        router.push('/inventory-onboarding');
      }}
    />
  );
}
