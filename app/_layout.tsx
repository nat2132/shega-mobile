import { ErrorBoundary } from '@/components/ErrorBoundary';
import SidebarOverlay from '@/components/SidebarOverlay';
import { SettingsProvider } from '@/context/SettingsContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { NavigationIntentProvider } from '@/context/NavigationIntentContext';
import { initDB } from '@/database/db';
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    useFonts
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useSettings } from '@/context/SettingsContext';
import { ToastProvider } from '@/context/ToastContext';
import { DialogProvider } from '@/context/DialogContext';
import { InAppBannerProvider } from '@/components/InAppBanner';
import { NotificationProvider } from '@/context/NotificationContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNotificationTriggers } from '@/hooks/useNotificationTriggers';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Separate component so useSettings is called inside the provider tree,
// not as a sibling/child that Expo Router might render in isolation.
function AppShell() {
  const { theme, colors } = useSettings();
  usePushNotifications();
  useNotificationTriggers();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={theme !== 'light' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="inventory-onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="sales-onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="analytics-onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="user-setup" options={{ animation: 'fade' }} />
        <Stack.Screen name="contacts" options={{ animation: 'slide_from_right' }} />
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
    Inter_900Black,
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
      <ErrorBoundary>
        <SettingsProvider>
          <ToastProvider>
            <DialogProvider>
              <InAppBannerProvider>
                <NotificationProvider>
                  <NavigationIntentProvider>
                    <SidebarProvider>
                      <AppShell />
                    </SidebarProvider>
                  </NavigationIntentProvider>
                </NotificationProvider>
              </InAppBannerProvider>
            </DialogProvider>
          </ToastProvider>
        </SettingsProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
