import React from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import SettingsScreen from '../../src/screens/settings/settings';

export default function SettingsTabRoute() {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
      <SettingsScreen />
    </Animated.View>
  );
}
