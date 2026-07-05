import SidebarOverlay from '@/components/SidebarOverlay';
import { SettingsProvider , useSettings } from '@/context/SettingsContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { NavigationIntentProvider } from '@/context/NavigationIntentContext';
import { WarehouseProvider } from '@/context/WarehouseContext';
import { initDB } from '@/database/db';
import { playStart } from '@/services/soundService';
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    useFonts
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';


import { ToastProvider } from '@/context/ToastContext';
import { DialogProvider } from '@/context/DialogContext';
import { InAppBannerProvider } from '@/components/InAppBanner';
import { NotificationProvider } from '@/context/NotificationContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNotificationTriggers } from '@/hooks/useNotificationTriggers';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Separate component so useSettings is called inside the provider tree,
// not as a sibling/child that Expo Router might render in isolation.
function AppShell() {
  const { theme, colors, soundEnabled } = useSettings();
  usePushNotifications();
  useNotificationTriggers();

  useEffect(() => {
    if (soundEnabled) {
      playStart();
    }
  }, [soundEnabled]);

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
        <Stack.Screen name="subscription/welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="subscription/plans" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="subscription/upgrade" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="subscription/payment" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="subscription/manage" options={{ animation: 'slide_from_right' }} />
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
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    if (loaded || error) {
      (async () => {
        for (let i = 0; i < 3; i++) {
          try {
            initDB();
            setDbReady(true);
            SplashScreen.hideAsync();
            return;
          } catch (e) {
            console.error(`DB init attempt ${i + 1} failed:`, e);
            await new Promise(r => setTimeout(r, 2000));
          }
        }
        SplashScreen.hideAsync();
      })();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {dbReady && (
          <SettingsProvider>
            <SubscriptionProvider>
              <WarehouseProvider>
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
              </WarehouseProvider>
            </SubscriptionProvider>
          </SettingsProvider>
      )}
    </GestureHandlerRootView>
  );
}
