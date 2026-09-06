import { AppText } from '@/components/ui';
import { Image } from 'expo-image';
import { ArrowRight, ScanLine, Store } from 'lucide-react-native';
import React, { useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
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
  onCreateAccount: () => void;
  onLogin: () => void;
  onJoin: () => void;
  onScanJoin: () => void;
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

const WelcomeChoiceScreen: React.FC<WelcomeChoiceProps> = ({ onCreateAccount, onLogin, onJoin, onScanJoin }) => {
  const { colors, t } = useSettings();
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
          {t('onboarding.welcome_title')}
        </AppText>
        <AppText
          variant="body-lg"
          weight="medium"
          numberOfLines={2}
          align="center"
          style={{ color: G.muted, lineHeight: 22 }}
        >
          {t('onboarding.welcome_subtitle')}
        </AppText>
      </Animated.View>

      <View style={styles.cardsContainer}>
        <Animated.View
          entering={FadeInDown.delay(250).duration(700).springify().damping(18)}
          style={styles.cardWrapper}
        >
          <View style={[styles.card, styles.cardHighlight, { backgroundColor: G.glassCard, borderColor: G.accentGlass }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
                <Store size={28} color={G.textGlassStrong} />
              </View>
            </View>
            <AppText
              variant="heading-lg"
              weight="bold"
              numberOfLines={2}
              style={{ color: G.fg, marginBottom: 8 }}
            >
              {t('onboarding.welcome_cta_title')}
            </AppText>
            <AppText
              variant="body"
              weight="medium"
              numberOfLines={3}
              style={{ color: G.muted, lineHeight: 22, marginBottom: 28 }}
            >
              {t('onboarding.welcome_cta_desc')}
            </AppText>
            <TouchableOpacity
              style={[styles.cardAction, { backgroundColor: G.fg, marginBottom: 12 }]}
              onPress={onCreateAccount}
              activeOpacity={0.85}
            >
              <AppText variant="body" weight="bold" numberOfLines={1} style={{ color: G.bg }}>
                {t('onboarding.create_account')}
              </AppText>
              <ArrowRight size={16} color={G.bg} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardActionSecondary, { borderColor: G.border, backgroundColor: G.glassCard }]}
              onPress={onLogin}
              activeOpacity={0.85}
            >
              <AppText variant="body" weight="bold" numberOfLines={1} style={{ color: G.fg }}>
                {t('onboarding.login')}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardActionSecondary}
              onPress={onJoin}
              activeOpacity={0.85}
            >
              <AppText variant="body" weight="bold" numberOfLines={1} style={{ color: G.fg }}>
                Join Existing Business
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardActionSecondary, { marginTop: 10, backgroundColor: G.accentGlass }]}
              onPress={onScanJoin}
              activeOpacity={0.85}
            >
              <ScanLine size={16} color={G.fg} />
              <AppText variant="body" weight="bold" numberOfLines={1} style={{ color: G.fg }}>
                Scan QR & Join
              </AppText>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

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
    justifyContent: 'center',
  },
  cardWrapper: {
    borderRadius: 28,
  },
  card: {
    borderRadius: 28,
    padding: 32,
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
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 999,
  },
  cardActionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
});

export default WelcomeChoiceScreen;