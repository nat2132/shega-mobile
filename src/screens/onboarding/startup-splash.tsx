import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import { useSettings } from '@/context/SettingsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DIMENSIONS, getGlass } from './glass-theme';

const { W } = DIMENSIONS;
const LOGO_SIZE = 100;
const DURATION = 2500;
// Hard cap: if real startup work (PIN check, subscription/license network
// probe…) ever hangs, never leave the user stuck on the splash.
const SAFETY_TIMEOUT = 15000;

interface StartupSplashScreenProps {
  onNext?: () => void;
  loading?: boolean;
  loadingLabelKey?: string;
}

function StaticSplash({ colors, t, loadingLabel }: { colors: any; t: (k: string) => string; loadingLabel?: string }) {
  const G = getGlass(colors);
  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={[styles.logoContainer]}>
        <View style={[styles.logoGlassInner, { backgroundColor: G.bg, borderColor: G.glassBorderLight }]}>
          <Image
            source={require('../../assets/images/logo.svg')}
            style={styles.logoImage}
            contentFit="contain"
          />
        </View>
        <View style={styles.brandTextWrap}>
          <AppText variant="title" weight="bold" style={{ color: G.fg, letterSpacing: 3 }}>
            {t('common.shega')}
          </AppText>
        </View>
      </View>
      {loadingLabel ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={G.fgSecondary} />
          <AppText variant="caption" weight="medium" style={[styles.loadingText, { color: G.fgSecondary }]}>
            {loadingLabel}
          </AppText>
        </View>
      ) : null}
      <View style={[styles.progressLayer, { backgroundColor: G.progressTrack }]} pointerEvents="none">
        <View style={[{ backgroundColor: G.progressFill, height: '100%', borderRadius: 1 }]} />
      </View>
    </View>
  );
}

function AnimatedSplash({ colors, t, loadingLabel }: { colors: any; t: (k: string) => string; loadingLabel?: string }) {
  const G = getGlass(colors);

  const logoScale = useSharedValue(0.4);
  const logoOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    // If Reanimated / the worklets runtime is broken, fail soft: the parent
    // ErrorBoundary swaps this subtree for <StaticSplash /> and navigation
    // still runs on the parent's timer.
    try {
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
    } catch (e) {
      console.warn('[SHEGA-SPLASH] Reanimated unavailable, using static splash:', e);
    }
  }, [logoOpacity, logoScale, glowOpacity, progressWidth]);

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

      {loadingLabel ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={G.fgSecondary} />
          <AppText variant="caption" weight="medium" style={[styles.loadingText, { color: G.fgSecondary }]}>
            {loadingLabel}
          </AppText>
        </View>
      ) : null}

      <View style={[styles.progressLayer, { backgroundColor: G.progressTrack }]} pointerEvents="none">
        <Animated.View style={[{ backgroundColor: G.progressFill, height: '100%', borderRadius: 1 }, progressAnimatedStyle]} />
      </View>
    </View>
  );
}

export default function StartupSplashScreen({ onNext, loading = true, loadingLabelKey }: StartupSplashScreenProps) {
  const { colors, t } = useSettings();

  const onNextCallback = useCallback(() => onNext?.(), [onNext]);

  // Latest loading flag, readable inside callbacks without re-creating them.
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const minElapsed = useRef(false);
  const advanced = useRef(false);

  const maybeAdvance = useCallback(() => {
    if (advanced.current) return;
    // Stay until BOTH the minimum brand time has elapsed AND the startup work
    // (token/PIN/subscription checks) is done — the splash is a loading screen.
    if (!minElapsed.current || loadingRef.current) return;
    advanced.current = true;
    onNextCallback();
  }, [onNextCallback]);

  // Minimum brand time — keeps the logo animation visible long enough.
  useEffect(() => {
    const timer = setTimeout(() => {
      minElapsed.current = true;
      maybeAdvance();
    }, DURATION);
    return () => clearTimeout(timer);
  }, [maybeAdvance]);

  // Leave the instant real startup work finishes (after the minimum time).
  useEffect(() => {
    if (!loading) maybeAdvance();
  }, [loading, maybeAdvance]);

  // Hard cap: never strand the user on the splash if startup hangs.
  useEffect(() => {
    const timer = setTimeout(maybeAdvance, SAFETY_TIMEOUT);
    return () => clearTimeout(timer);
  }, [maybeAdvance]);

  const loadingLabel = loadingLabelKey ? t(loadingLabelKey) : t('startup.loading');

  return (
    <ErrorBoundary
      fallback={() => <StaticSplash colors={colors} t={t} loadingLabel={loadingLabel} />}
    >
      <AnimatedSplash colors={colors} t={t} loadingLabel={loadingLabel} />
    </ErrorBoundary>
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
  loadingWrap: {
    position: 'absolute',
    bottom: 105,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
  },
  loadingText: {
    maxWidth: '80%',
  },
});
