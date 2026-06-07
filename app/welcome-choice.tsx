import { router } from 'expo-router';
import WelcomeChoiceScreen from '../src/screens/onboarding/welcome-choice';

export default function WelcomeChoice() {
  return (
    <WelcomeChoiceScreen
      onSyncChoose={() => {
        router.replace('/analytics-onboarding');
      }}
      onRegisterChoose={() => {
        router.replace('/inventory-onboarding');
      }}
    />
  );
}
