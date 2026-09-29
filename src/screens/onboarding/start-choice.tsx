/**
 * The first screen a new install shows: pick how you want to start.
 *
 * Startup used to go straight to account creation, which made the app feel like
 * it had already decided for the user. A lot of installs are neither brand new
 * nor brand new devices — someone reinstalling the app, or signing back into a
 * business they already own — and every one of those was funnelled through
 * "create an account" first.
 *
 * Connecting this device to an existing business is deliberately NOT an option
 * here. A new install always creates or signs into its own local account first,
 * and the user links devices later from Settings → Connected Devices. That keeps
 * startup about the account on this device rather than about someone else's
 * business, and keeps a device link from being the thing that defines a user.
 *
 * This screen is the single decision point, and it offers two paths:
 *   • Create a business  → owner onboarding (/register)
 *   • Log in             → returning user (/login)
 *
 * Each option is a full-width card, and the screen is a plain centred column so
 * everything fits without scrolling on a small phone.
 */

import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronRight, LogIn, Store } from 'lucide-react-native';

import { AppText } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { getGlass } from './glass-theme';

type StartOption = {
  key: 'create' | 'login';
  title: string;
  subtitle: string;
  /** Secondary lines, for people who aren't sure which one they need. */
  hint: string;
  route: string;
  icon: React.ReactNode;
  primary?: boolean;
};

export default function StartChoiceScreen() {
  const { colors } = useSettings();
  const G = getGlass(colors);

  const go = useCallback((route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace(route as any);
  }, []);

  const options: StartOption[] = [
    {
      key: 'create',
      title: 'Create a business',
      subtitle: 'Set up a brand-new Shega business on this device.',
      hint: 'You become the owner. Connect other devices from Settings later.',
      route: '/register',
      icon: <Store size={20} color={G.fg} />,
      primary: true,
    },
    {
      key: 'login',
      title: 'Log in to your business',
      subtitle: 'Already set up? Sign in with your business account.',
      hint: 'Your business, products and sales are waiting for you.',
      route: '/login',
      icon: <LogIn size={20} color={G.fg} />,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
            Welcome to Shega
          </AppText>
          <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 8 }}>
            Choose how you&apos;d like to start.
          </AppText>
        </View>

        <View style={{ gap: 12 }}>
          {options.map((o) => (
            <TouchableOpacity
              key={o.key}
              testID={`start-${o.key}`}
              onPress={() => go(o.route)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={o.title}
              style={[
                styles.card,
                {
                  backgroundColor: o.primary ? G.fg : G.glassCard,
                  borderColor: o.primary ? G.fg : G.glassBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: o.primary ? G.bg : G.accentGlass },
                ]}
              >
                {o.icon}
              </View>

              <View style={styles.cardText}>
                <AppText
                  variant="body"
                  weight="bold"
                  style={{ color: o.primary ? G.bg : G.fg }}
                  numberOfLines={1}
                >
                  {o.title}
                </AppText>
                <AppText
                  variant="caption"
                  weight="medium"
                  style={{ color: o.primary ? G.bg : G.textGlassStrong, marginTop: 2 }}
                  numberOfLines={2}
                >
                  {o.subtitle}
                </AppText>
                <AppText
                  variant="micro"
                  weight="medium"
                  style={{ color: o.primary ? G.bg : G.muted, marginTop: 4, opacity: 0.85 }}
                  numberOfLines={2}
                >
                  {o.hint}
                </AppText>
              </View>

              <ChevronRight
                size={18}
                color={o.primary ? G.bg : G.muted}
                style={{ opacity: 0.6 }}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingVertical: 32, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  iconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 },
});
