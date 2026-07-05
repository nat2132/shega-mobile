import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ExpenseTracker from '@/screens/expense/expense';
import PremiumFeatureGate from '@/components/PremiumFeatureGate';

export default function ExpenseRoute() {
  const params = useLocalSearchParams<{ filterCategory?: string }>();
  return (
    <PremiumFeatureGate feature="expense">
      <ExpenseTracker filterCategory={params.filterCategory} />
    </PremiumFeatureGate>
  );
}
