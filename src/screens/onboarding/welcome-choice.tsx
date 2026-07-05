import { AppText } from '@/components/ui';
import { Image } from 'expo-image';
import { ArrowRight, Sparkles, Store, Wifi } from 'lucide-react-native';
import React, { useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSettings } from '@/context/SettingsContext';
import { getGlass, DIMENSIONS } from './glass-theme';

const { W: w } = DIMENSIONS;

interface WelcomeChoiceProps {
  onSyncChoose: () => void;
  onRegisterChoose: () => void;
}

function FloatingOrb({
  size, x, y, delay, duration, accent, g,
}: {
  size: number; x: number; y: number; delay: number; duration: number; accent?: boolean; g: string;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.4, { duration: 1000 }));
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-y * 0.35, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(y * 0.35, { duration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const baseAlpha = 0.05;
  const borderColor = accent ? `rgba(0,113,227,${baseAlpha * 2})` : `rgba(${g},${baseAlpha})`;
  const bgColor = accent ? `rgba(0,113,227,${baseAlpha * 0.6})` : `rgba(${g},${baseAlpha * 0.6})`;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: x,
          top: w * y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          borderWidth: 1,
          borderColor,
        },
        style,
      ]}
    />
  );
}

const WelcomeChoiceScreen: React.FC<WelcomeChoiceProps> = ({ onSyncChoose, onRegisterChoose }) => {
  const { colors } = useSettings();
  const G = getGlass(colors);

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <FloatingOrb
          key={i}
          size={50 + i * 50}
          x={w * (-0.05 + i * 0.25)}
          y={0.35 + i * 0.10}
          delay={i * 300}
          duration={6000 + i * 2000}
          accent={i === 1 || i === 3}
          g={G.g}
        />
      ))}

      <Animated.View entering={FadeInDown.duration(800).springify().damping(20)} style={styles.header}>
        <View style={styles.logoRow}>
          <View style={[styles.logoOuter, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
            <View style={[styles.logoInner, { backgroundColor: G.bg, borderColor: G.glassBorderLight }]}>
              <Image
                source={require('../../assets/images/logo.svg')}
                style={styles.logo}
                contentFit="contain"
              />
            </View>
          </View>
        </View>
        <AppText
          variant="display"
          weight="bold"
          numberOfLines={1}
          align="center"
          style={{ color: G.fg, letterSpacing: -0.5, marginBottom: 8 }}
        >
          Welcome to Shega
        </AppText>
        <AppText
          variant="body-lg"
          weight="medium"
          numberOfLines={2}
          align="center"
          style={{ color: G.muted, lineHeight: 22 }}
        >
          Choose how you&apos;d like to get started
        </AppText>
      </Animated.View>

      <View style={styles.cardsContainer}>
        <Animated.View
          entering={FadeInDown.delay(250).duration(700).springify().damping(18)}
          style={styles.cardWrapper}
        >
          <TouchableOpacity
            style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}
            onPress={onSyncChoose}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
                <Wifi size={22} color={G.textGlassStrong} />
              </View>
              <View style={[styles.badge, { backgroundColor: G.glassCard }]}>
                <Sparkles size={9} color={G.textGlass} />
                <AppText
                  variant="micro"
                  weight="bold"
                  numberOfLines={1}
                  style={{ color: G.textGlass, letterSpacing: 0.5 }}
                >
                  INSTANT
                </AppText>
              </View>
            </View>
            <AppText
              variant="title"
              weight="bold"
              numberOfLines={2}
              style={{ color: G.fg, marginBottom: 6 }}
            >
              Sync from Desktop
            </AppText>
            <AppText
              variant="body-sm"
              weight="medium"
              numberOfLines={3}
              style={{ color: G.muted, lineHeight: 19, marginBottom: 20 }}
            >
              Connect to your Shega Desktop app via WiFi and import all your existing business data instantly.
            </AppText>
            <View style={[styles.cardAction, { backgroundColor: G.fg }]}>
              <AppText
                variant="body"
                weight="bold"
                numberOfLines={1}
                style={{ color: G.buttonFg }}
              >
                Connect via WiFi
              </AppText>
              <ArrowRight size={16} color={G.buttonFg} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(450).duration(700).springify().damping(18)}
          style={styles.cardWrapper}
        >
          <TouchableOpacity
            style={[styles.card, styles.cardHighlight, { backgroundColor: G.glassCard, borderColor: G.accentGlass }]}
            onPress={onRegisterChoose}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
                <Store size={22} color={G.textGlassStrong} />
              </View>
              <View style={[styles.badge, { backgroundColor: G.accentGlass }]}>
                <AppText
                  variant="micro"
                  weight="bold"
                  numberOfLines={1}
                  style={{ color: G.accent, letterSpacing: 0.5 }}
                >
                  NEW
                </AppText>
              </View>
            </View>
            <AppText
              variant="title"
              weight="bold"
              numberOfLines={2}
              style={{ color: G.fg, marginBottom: 6 }}
            >
              Register New Business
            </AppText>
            <AppText
              variant="body-sm"
              weight="medium"
              numberOfLines={3}
              style={{ color: G.muted, lineHeight: 19, marginBottom: 20 }}
            >
              Start fresh — set up your store, add inventory, and begin tracking sales from scratch.
            </AppText>
            <View style={[styles.cardAction, { backgroundColor: G.accent }]}>
              <AppText
                variant="body"
                weight="bold"
                numberOfLines={1}
                style={{ color: G.fg }}
              >
                Get Started
              </AppText>
              <ArrowRight size={16} color={G.fg} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Animated.View
        entering={FadeIn.delay(700).duration(600)}
        style={styles.footer}
      >
        <AppText
          variant="caption"
          weight="medium"
          numberOfLines={2}
          align="center"
          style={{ color: G.textGlassFaint, textAlign: 'center' }}
        >
          You can always set up sync later from Settings
        </AppText>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoRow: {
    marginBottom: 24,
  },
  logoOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logoInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logo: {
    width: '60%',
    height: '60%',
  },
  cardsContainer: {
    flex: 1,
    gap: 16,
    justifyContent: 'center',
  },
  cardWrapper: {
    borderRadius: 28,
  },
  card: {
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
  },
  cardHighlight: {
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
  },
});

export default WelcomeChoiceScreen;