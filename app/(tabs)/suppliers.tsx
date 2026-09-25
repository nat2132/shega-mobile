import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import SupplierList from '../../src/screens/suppliers/supplier-list';
import PremiumFeatureGate from '@/components/PremiumFeatureGate';

export default function SuppliersScreen() {
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
    <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
      <PremiumFeatureGate feature="supplier_management">
        <SupplierList />
      </PremiumFeatureGate>
    </Animated.View>
  );
}
