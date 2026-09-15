import { router } from 'expo-router';
import ProfileSetupScreen from '../src/screens/account creation/user-setup';

export default function UserSetup() {
  return (
    <ProfileSetupScreen onComplete={() => {
      router.replace('/feature-setup');
    }} />
  );
}