import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import SummaryScreen from '@/screens/summary/summary';
import PremiumFeatureGate from '@/components/PremiumFeatureGate';

export default function SummaryRoute() {
  const router = useRouter();
  const auth = useBusinessAuth();
  const isCashier = auth.role === 'cashier' || (!auth.can('products.edit') && !auth.can('inventory.adjust') && !auth.can('reports.viewAll'));

  useEffect(() => {
    if (isCashier) {
      router.replace('/(tabs)/sales-hub');
    }
  }, [isCashier, router]);

  if (isCashier) return null;

  return (
    <PremiumFeatureGate feature="reports">
      <SummaryScreen />
    </PremiumFeatureGate>
  );
}
