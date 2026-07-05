import React from 'react';
import { View, StyleSheet} from 'react-native';
import { Stack } from 'expo-router';
import { useSettings } from '@/context/SettingsContext';
import NotificationsListScreen from '@/screens/notifications/notifications-list';

export default function NotificationsRoute() {
  const { colors } = useSettings();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }} 
      />
      <NotificationsListScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});