import SidebarOverlay from '@/components/SidebarOverlay';
import { AuthProvider } from '@/context/AuthContext';
import { AccountProvider } from '@/context/AccountContext';
import { SettingsProvider , useSettings } from '@/context/SettingsContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { NavigationIntentProvider } from '@/context/NavigationIntentContext';
import { WarehouseProvider } from '@/context/WarehouseContext';
import { UpdateProvider } from '@/context/UpdateContext';
import { TutorialProvider, TutorialOverlay } from '@/tutorials';
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
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNotificationTriggers } from '@/hooks/useNotificationTriggers';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Text, Pressable, View, DevSettings } from 'react-native';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// ---------------------------------------------------------------------------
// Global uncaught-error handler. Without this, a crash during the first few
// frames (Reanimated/worklets init, a provider's module-scope side effect,
// a native call that throws synchronously) kills the app with NO error shown
// in Metro. This makes every startup error visible in the Metro/LogCat output.
// ---------------------------------------------------------------------------
const GlobalErrorUtils = (globalThis as any).ErrorUtils as
  | { setGlobalHandler: (fn: (error: any, isFatal: boolean) => void) => void; getGlobalHandler: () => (error: any, isFatal: boolean) => void }
  | undefined;

if (GlobalErrorUtils && !(globalThis as any).__shegaErrorHandlerInstalled) {
  (globalThis as any).__shegaErrorHandlerInstalled = true;
  const original = GlobalErrorUtils.getGlobalHandler
    ? GlobalErrorUtils.getGlobalHandler()
    : null;
  GlobalErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    console.error(
      `[SHEGA-GLOBAL] ${isFatal ? 'FATAL' : 'non-fatal'} error:`,
      error?.message ?? error,
      error?.stack ?? '',
    );
    // Preserve React Native's default behaviour (RedBox in dev).
    if (original && original !== GlobalErrorUtils.getGlobalHandler()) {
      try {
        original(error, isFatal);
      } catch {}
    }
  });
}

// Fallback UI rendered if the provider tree fails to mount.
function StartupErrorScreen({ message }: { message?: string }) {
  return (
    <View style={styles.errorScreen}>
      <Text style={styles.errorTitle}>{"Shega couldn't start"}</Text>
      <Text style={styles.errorMessage}>{message || 'An unexpected error occurred'}</Text>
      <Pressable
        style={styles.errorButton}
        onPress={() => {
          try {
            DevSettings.reload();
          } catch {}
        }}
      >
        <Text style={styles.errorButtonText}>Reload app</Text>
      </Pressable>
    </View>
  );
}

// Separate component so useSettings is called inside the provider tree,
// not as a sibling/child that Expo Router might render in isolation.
function AppShell({ dbWarning }: { dbWarning?: string | null }) {
  const { theme, colors, soundEnabled } = useSettings();
  usePushNotifications();
  useNotificationTriggers();

  useEffect(() => {
    if (soundEnabled) {
      try {
        playStart();
      } catch (e) {
        console.warn('[SHEGA-SOUND] start sound failed:', e);
      }
    }
  }, [soundEnabled]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={theme !== 'light' ? 'light' : 'dark'} />
      <ErrorBoundary>
        <TutorialProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="language-select" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="inventory-onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="sales-onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="analytics-onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="user-setup" options={{ animation: 'fade' }} />
            <Stack.Screen name="subscription/welcome" options={{ animation: 'fade' }} />
            <Stack.Screen name="subscription/plans" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="subscription/upgrade" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="subscription/payment" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="subscription/manage" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="subscription/status" options={{ animation: 'fade' }} />
            <Stack.Screen name="login" options={{ animation: 'fade' }} />
            <Stack.Screen name="register" options={{ animation: 'fade' }} />
          </Stack>
          <TutorialOverlay />
          <SidebarOverlay />
        </TutorialProvider>
      </ErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  errorButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#d4d4d8',
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let lastError: unknown = null;
        for (let i = 0; i < 3; i++) {
          try {
            initDB();
            if (cancelled) return;
            setDbReady(true);
            setDbError(null);
            return;
          } catch (e) {
            lastError = e;
            console.error(`[SHEGA-DB] init attempt ${i + 1} failed:`, e);
            if (cancelled) return;
            await new Promise(r => setTimeout(r, 2000));
          }
        }
        // Give up on DB — render the app anyway; every db call is
        // try/catch-guarded and falls back to empty data.
        if (!cancelled) {
          setDbReady(true);
          setDbError(lastError instanceof Error ? lastError.message : 'Database failed to initialize');
        }
      } catch (e) {
        console.error('[SHEGA-DB] init error:', e);
        if (!cancelled) {
          setDbReady(true);
          setDbError(e instanceof Error ? e.message : 'Database failed to initialize');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide the native splash only once BOTH fonts and DB are ready, so we never
  // flash a blank frame between the two.
  useEffect(() => {
    if (loaded && dbReady) {
      try {
        SplashScreen.hideAsync();
      } catch {}
    }
  }, [loaded, dbReady]);

  // If fonts outright fail to load, unblock anyway.
  useEffect(() => {
    if (error) {
      try {
        SplashScreen.hideAsync();
      } catch {}
    }
  }, [error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ErrorBoundary
      fallback={(err) => <StartupErrorScreen message={err?.message} />}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        {dbReady && (
            <AuthProvider>
            <AccountProvider>
            <SettingsProvider>
              <SubscriptionProvider>
                <WarehouseProvider>
                  <ToastProvider>
                    <DialogProvider>
                      <InAppBannerProvider>
                        <NotificationProvider>
                          <NavigationIntentProvider>
                            <SidebarProvider>
                              <UpdateProvider>
                                <AppShell dbWarning={dbError} />
                              </UpdateProvider>
                            </SidebarProvider>
                          </NavigationIntentProvider>
                        </NotificationProvider>
                      </InAppBannerProvider>
                    </DialogProvider>
                  </ToastProvider>
                </WarehouseProvider>
              </SubscriptionProvider>
            </SettingsProvider>
            </AccountProvider>
            </AuthProvider>
        )}
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
