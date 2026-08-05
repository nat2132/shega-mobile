import React from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import SupplierList from '../../src/screens/suppliers/supplier-list';
import PremiumFeatureGate from '@/components/PremiumFeatureGate';

export default function SuppliersScreen() {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
      <PremiumFeatureGate feature="supplier_management">
        <SupplierList />
      </PremiumFeatureGate>
    </Animated.View>
  );
}
