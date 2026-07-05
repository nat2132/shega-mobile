import React from 'react';
import { router } from 'expo-router';
import SubscriptionPlansScreen from '../../src/screens/subscription/subscription-plans';

export default function SubscriptionPlans() {
  return (
    <SubscriptionPlansScreen
      onSelectPlan={(plan, durationMonths, price) => {
        router.replace({
          pathname: '/subscription/payment',
          params: { plan, durationMonths: String(durationMonths), price: String(price) },
        });
      }}
      onBack={() => router.back()}
    />
  );
}
