import { router } from 'expo-router';
import SuccessScreen from '../src/screens/account creation/message';

export default function Message() {
  return (
    <SuccessScreen 
      onGoToDashboard={() => router.replace('/(tabs)/dashboard')}
    />
  );
}
