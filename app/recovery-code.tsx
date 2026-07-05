import { router } from 'expo-router';
import RecoveryCodeConfirmScreen from '../src/screens/auth/recovery-code-confirm';

export default function RecoveryCode() {
  return (
    <RecoveryCodeConfirmScreen 
      onConfirm={() => router.replace('/message')}
    />
  );
}
