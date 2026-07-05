import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import SubscriptionPaymentScreen from '../../src/screens/subscription/subscription-payment';

export default function SubscriptionPayment() {
  const { plan, durationMonths, price } = useLocalSearchParams<{
    plan: string;
    durationMonths: string;
    price: string;
  }>();

  return (
    <SubscriptionPaymentScreen
      plan={plan || 'premium'}
      durationMonths={parseInt(durationMonths || '1', 10)}
      price={parseInt(price || '2499', 10)}
      onBack={() => router.back()}
      onSuccess={() => router.replace('/(tabs)/dashboard')}
    />
  );
}
