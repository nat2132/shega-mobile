import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, 
  Inter_400Regular, 
  Inter_500Medium, 
  Inter_600SemiBold, 
  Inter_700Bold, 
  Inter_800ExtraBold 
} from '@expo-google-fonts/inter';
import { useEffect } from 'react';
import { SidebarProvider } from '@/context/SidebarContext';
import { SettingsProvider } from '@/context/SettingsContext';
import SidebarOverlay from '@/components/SidebarOverlay';
import { initDB } from '@/database/db';

import { useSettings } from '@/context/SettingsContext';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function InnerContent() {
  const { theme, colors } = useSettings();
  
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={theme !== 'light' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="inventory-onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="sales-onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="analytics-onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="user-setup" options={{ animation: 'fade' }} />
      </Stack>
      <SidebarOverlay />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) {
      initDB();
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <SidebarProvider>
          <InnerContent />
        </SidebarProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}