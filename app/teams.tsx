import React from 'react';
import { View } from 'react-native';
import TeamsScreen from '@/screens/teams/teams';
import { useSettings } from '@/context/SettingsContext';

export default function TeamsRoute() {
  const { colors } = useSettings();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TeamsScreen />
    </View>
  );
}
