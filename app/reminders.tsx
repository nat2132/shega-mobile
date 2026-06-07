import React from 'react';
import { Stack } from 'expo-router';
import ReminderHistoryScreen from '@/screens/notifications/reminder-history';
import { useSettings } from '@/context/SettingsContext';
import { View, StyleSheet } from 'react-native';

export default function RemindersRoute() {
  const { colors } = useSettings();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ReminderHistoryScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
