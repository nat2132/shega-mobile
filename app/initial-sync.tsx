import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import InitialSyncScreen from '../src/screens/onboarding/initial-sync';

export default function InitialSync() {
  const params = useLocalSearchParams<{ business?: string; role?: string; device?: string }>();
  return (
    <InitialSyncScreen
      info={{
        businessName: params.business || 'Your Business',
        role: params.role || 'Cashier',
        deviceName: params.device || 'This Device',
      }}
    />
  );
}
