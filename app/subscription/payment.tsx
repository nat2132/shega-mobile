import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import SubscriptionPaymentScreen from '../../src/screens/subscription/subscription-payment';

export default function SubscriptionPayment() {
  const params = useLocalSearchParams<{
    planId: string;
  }>();

  const planId = parseInt(params.planId || '0', 10);

  return (
    <SubscriptionPaymentScreen
      planId={planId}
      onBack={() => router.back()}
      onSuccess={() => router.replace('/subscription/status' as any)}
    />
  );
}