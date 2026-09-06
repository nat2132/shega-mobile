import React from 'react';
import { View } from 'react-native';
import ProfileSettingsScreen from '@/screens/settings/profile-settings';
import { useSettings } from '@/context/SettingsContext';

export default function ProfileSettingsRoute() {
  const { colors } = useSettings();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: 24 }}>
      <ProfileSettingsScreen />
    </View>
  );
}
