import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ExpenseTracker from '@/screens/expense/expense';

export default function ExpenseRoute() {
  const params = useLocalSearchParams<{ filterCategory?: string }>();
  return <ExpenseTracker filterCategory={params.filterCategory} />;
}
