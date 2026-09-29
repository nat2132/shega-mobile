import React from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import InventoryDashboard from '../../src/screens/inventory/inventroy';

export default function InventoryScreen() {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
      <InventoryDashboard />
    </Animated.View>
  );
}
