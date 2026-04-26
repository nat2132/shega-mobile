import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import NotificationsListScreen from '@/screens/notifications/notifications-list';
import { Fonts } from '@/constants/theme';

export default function NotificationsRoute() {
  const { colors } = useSettings();
  const router = useRouter();

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
