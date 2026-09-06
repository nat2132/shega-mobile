import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import TranslationSettingsScreen from '@/screens/settings/translation';
import { Fonts } from '@/constants/theme';

export default function TranslationRoute() {
  const { colors } = useSettings();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerBackVisible: false,
          headerTitle: 'Translation & Language',
          headerTitleStyle: { fontFamily: Fonts.bold, color: colors.text },
          headerStyle: { backgroundColor: colors.background },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
              <ChevronLeft color={colors.text} size={28} />
            </TouchableOpacity>
          ),
          headerShadowVisible: false,
        }} 
      />
      <TranslationSettingsScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
});
