import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import SubscriptionPaymentScreen from '../../src/screens/subscription/subscription-payment';

const VALID_PLANS: Record<string, { months: number; price: number }[]> = {
  basic: [
    { months: 1, price: 1999 },
    { months: 3, price: 2499 },
  ],
  premium: [
    { months: 1, price: 2499 },
    { months: 3, price: 5499 },
  ],
};

export default function SubscriptionPayment() {
  const params = useLocalSearchParams<{
    plan: string;
    durationMonths: string;
    price: string;
  }>();

  const plan = params.plan || 'premium';
  const durationMonths = parseInt(params.durationMonths || '1', 10);
  const urlPrice = parseInt(params.price || '0', 10);

  const planPrices = VALID_PLANS[plan];
  const validPrice = planPrices?.find(p => p.months === durationMonths)?.price || 2499;

  return (
    <SubscriptionPaymentScreen
      plan={plan}
      durationMonths={durationMonths}
      price={validPrice}
      onBack={() => router.back()}
      onSuccess={() => router.replace('/(tabs)/dashboard')}
    />
  );
}
