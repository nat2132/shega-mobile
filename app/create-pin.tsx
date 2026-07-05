import { router } from 'expo-router';
import CreatePinScreen from '../src/screens/account creation/create-pin';

export default function CreatePin() {
  return (
    <CreatePinScreen
      onConfirm={() => router.replace('/recovery-code')}
      onSkip={() => router.replace('/message')}
    />
  );
}
