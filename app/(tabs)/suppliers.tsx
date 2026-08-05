import React from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import SupplierList from '../../src/screens/suppliers/supplier-list';

export default function SuppliersScreen() {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
      <SupplierList />
    </Animated.View>
  );
}
