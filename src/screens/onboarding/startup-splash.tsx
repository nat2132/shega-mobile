import { Image } from 'expo-image';
import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useSettings } from '@/context/SettingsContext';
import { DIMENSIONS, getGlass } from './glass-theme';

const { W } = DIMENSIONS;
const LOGO_SIZE = 100;

interface StartupSplashScreenProps {
  onNext?: () => void;
}

export default function StartupSplashScreen({ onNext }: StartupSplashScreenProps) {
  const { colors, t } = useSettings();
  const G = getGlass(colors);

  const logoScale = useSharedValue(0.4);
  const logoOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const progressWidth = useSharedValue(0);

  const onNextCallback = useCallback(() => onNext?.(), [onNext]);

  useEffect(() => {
    // Total startup duration: 2500ms
    const DURATION = 2500;

    logoOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 100 });
    
    glowOpacity.value = withDelay(
      400,
      withTiming(0.8, { duration: 1000, easing: Easing.out(Easing.quad) })
    );

    progressWidth.value = withDelay(
      500,
      withTiming(1, { duration: DURATION - 500, easing: Easing.inOut(Easing.quad) })
    );

    const timer = setTimeout(onNextCallback, DURATION);
    return () => clearTimeout(timer);
  }, [onNextCallback]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(glowOpacity.value, [0, 0.8], [0.8, 1.2]) }],
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%` as any,
  }));

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientGlow,
          { backgroundColor: G.accentGlow },
          glowAnimatedStyle,
        ]}
      />

      <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
        <View style={[styles.logoGlassInner, { backgroundColor: G.bg, borderColor: G.glassBorderLight }]}>
          <Image
            source={require('../../assets/images/logo.svg')}
            style={styles.logoImage}
            contentFit="contain"
          />
        </View>
        <Animated.View entering={FadeInDown.delay(600).springify().damping(12)} style={styles.brandTextWrap}>
          <AppText variant="title" weight="bold" style={{ color: G.fg, letterSpacing: 3 }}>
            {t('common.shega')}
          </AppText>
        </Animated.View>
      </Animated.View>

      <View style={[styles.progressLayer, { backgroundColor: G.progressTrack }]} pointerEvents="none">
        <Animated.View style={[{ backgroundColor: G.progressFill, height: '100%', borderRadius: 1 }, progressAnimatedStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    width: W * 0.8,
    height: W * 0.8,
    borderRadius: W * 0.4,
    alignSelf: 'center',
    opacity: 0.5,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoGlassInner: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  logoImage: {
    width: '60%',
    height: '60%',
  },
  brandTextWrap: {
    marginTop: 24,
    alignItems: 'center',
  },
  progressLayer: {
    position: 'absolute',
    bottom: 80,
    left: W * 0.3,
    right: W * 0.3,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
});
