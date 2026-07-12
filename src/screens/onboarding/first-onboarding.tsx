import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSettings } from '@/context/SettingsContext';
import {
  DIMENSIONS,
  getGlass,
} from './glass-theme';
import { TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';

const { W, H } = DIMENSIONS;

const LOGO_SIZE = 120;
const RING_COUNT = 5;
const PARTICLE_COUNT = W > 390 ? 16 : 10;

const PARTICLES: ParticleData[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  x: Math.random() * W,
  y: Math.random() * H,
  size: 4 + Math.random() * 8,
  delay: i * 120,
  duration: 2500 + Math.random() * 2000,
  opacity: 0.15 + Math.random() * 0.2,
}));

interface ParticleData {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

function ExpandingRing({ index, total, delay: ringDelay, g }: { index: number; total: number; delay: number; g: string }) {
  const scale = useSharedValue(0.4 - index * 0.05);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const baseDuration = 5000 - index * 400;
    const maxScale = 1.4 - index * 0.12;

    scale.value = withDelay(
      ringDelay + index * 250,
      withRepeat(
        withSequence(
          withTiming(maxScale, {
            duration: baseDuration,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.4 - index * 0.05, {
            duration: baseDuration,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        true,
      ),
    );

    opacity.value = withDelay(
      ringDelay + index * 250,
      withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }),
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: index === 0
      ? `rgba(${g},${interpolate(opacity.value, [0, 1], [0, 0.12])})`
      : `rgba(${g},${interpolate(opacity.value, [0, 1], [0, 0.06 - index * 0.008])})`,
    transform: [{ scale: scale.value }],
    opacity: interpolate(opacity.value, [0, 1], [0, 0.75 - index * 0.1]),
  }));

  return <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" />;
}

function GlassParticle({ particle, g }: { particle: ParticleData; g: string }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    const driftX = (Math.random() - 0.5) * 60;

    opacity.value = withDelay(
      particle.delay,
      withSequence(
        withTiming(particle.opacity, { duration: 1000, easing: Easing.out(Easing.quad) }),
        withDelay(particle.duration * 0.5, withTiming(0, { duration: 1000 })),
      ),
    );

    scale.value = withDelay(
      particle.delay,
      withSpring(1, { damping: 12, stiffness: 80 }),
    );

    translateY.value = withDelay(
      particle.delay,
      withRepeat(
        withSequence(
          withTiming(-H * 0.35, {
            duration: particle.duration,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(H * 0.05, {
            duration: particle.duration,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        true,
      ),
    );

    translateX.value = withDelay(
      particle.delay,
      withRepeat(
        withSequence(
          withTiming(driftX, {
            duration: particle.duration * 1.3,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-driftX, {
            duration: particle.duration * 1.3,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left: particle.x,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: `rgba(${g},0.3)`,
        },
        style,
      ]}
    />
  );
}

interface FirstOnboardingScreenProps {
  onNext?: () => void;
}

const FirstOnboardingScreen: React.FC<FirstOnboardingScreenProps> = ({ onNext }) => {
  const { colors, language, setLanguage, t } = useSettings();
  const G = getGlass(colors);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoRotate = useSharedValue(0);
  const reflectionOpacity = useSharedValue(0);
  const reflectionRotate = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const taglineY = useSharedValue(30);
  const taglineScale = useSharedValue(0.9);
  const dividerScale = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const subtitleY = useSharedValue(20);
  const progressWidth = useSharedValue(0);
  const progressOpacity = useSharedValue(0);
  const shimmerX = useSharedValue(-1.5);
  const glassGlow = useSharedValue(0);

  const onNextCallback = useCallback(() => onNext?.(), [onNext]);

  useEffect(() => {
    const INTRO_DURATION = 6500;

    logoScale.value = withDelay(
      400,
      withSpring(1, { damping: 12, stiffness: 100 }),
    );
    logoOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.quad) }),
    );
    logoRotate.value = withDelay(
      400,
      withSpring(0, { damping: 14, stiffness: 80 }),
    );

    reflectionOpacity.value = withDelay(
      1000,
      withTiming(0.8, { duration: 1200, easing: Easing.out(Easing.quad) }),
    );
    reflectionRotate.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(8, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
          withTiming(-8, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );

    taglineOpacity.value = withDelay(
      2000,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }),
    );
    taglineY.value = withDelay(
      2000,
      withSpring(0, { damping: 14, stiffness: 120 }),
    );
    taglineScale.value = withDelay(
      2000,
      withSpring(1, { damping: 14, stiffness: 120 }),
    );

    dividerScale.value = withDelay(
      2800,
      withSpring(1, { damping: 12, stiffness: 100 }),
    );

    subtitleOpacity.value = withDelay(
      3200,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }),
    );
    subtitleY.value = withDelay(
      3200,
      withSpring(0, { damping: 16, stiffness: 130 }),
    );

    progressOpacity.value = withDelay(
      1400,
      withTiming(1, { duration: 400 }),
    );
    progressWidth.value = withDelay(
      1400,
      withTiming(1, {
        duration: INTRO_DURATION - 1400,
        easing: Easing.in(Easing.quad),
      }),
    );

    glassGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    shimmerX.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(2.5, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
          withTiming(-1.5, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );

    const timer = setTimeout(() => setShowLanguagePicker(true), INTRO_DURATION);
    return () => clearTimeout(timer);
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value },
      { rotate: `${interpolate(logoRotate.value, [0, 1], [0, 360])}deg` },
    ],
  }));

  const reflectionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: reflectionOpacity.value,
    transform: [{ rotate: `${reflectionRotate.value}deg` }],
  }));

  const taglineAnimatedStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [
      { translateY: taglineY.value },
      { scale: taglineScale.value },
    ],
  }));

  const dividerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: dividerScale.value }],
    opacity: dividerScale.value,
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleY.value }],
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%` as any,
    opacity: progressOpacity.value,
  }));

  const shimmerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shimmerX.value,
          [-1.5, 2.5],
          [-LOGO_SIZE * 1.5, LOGO_SIZE * 2.5],
        ),
      },
    ],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glassGlow.value, [0, 1], [0, 1]),
    transform: [
      { scale: interpolate(glassGlow.value, [0, 1], [1, 1.06]) },
    ],
  }));

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={styles.particleLayer} pointerEvents="none">
        {PARTICLES.map((p, i) => (
          <GlassParticle key={i} particle={p} g={G.g} />
        ))}
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientGlow,
          { backgroundColor: G.accentGlow },
          glowAnimatedStyle,
        ]}
      />

      <View style={styles.ringLayer} pointerEvents="none">
        {Array.from({ length: RING_COUNT }, (_, i) => (
          <ExpandingRing key={i} index={i} total={RING_COUNT} delay={600} g={G.g} />
        ))}
      </View>

      <View style={styles.contentLayer}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <View style={[styles.logoGlassOuter, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.logoGlowRing,
                { backgroundColor: G.accentGlow },
                glowAnimatedStyle,
              ]}
            />
            <View style={[styles.logoGlassInner, { backgroundColor: G.bg, borderColor: G.glassBorderLight }]}>
              <Animated.View
                pointerEvents="none"
                style={[styles.shimmerBar, { backgroundColor: G.glassCardMedium }, shimmerAnimatedStyle]}
              />
              <Image
                source={require('../../assets/images/logo.svg')}
                style={styles.logoImage}
                contentFit="contain"
              />
            </View>
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.reflectionArc,
              {
                borderColor: G.glassBorder,
                borderTopColor: G.textGlassMedium,
                borderRightColor: G.textGlass,
                borderLeftColor: 'transparent',
                borderBottomColor: 'transparent',
              },
              reflectionAnimatedStyle,
            ]}
          />
        </Animated.View>

        <Animated.View style={[styles.taglineWrap, taglineAnimatedStyle]}>
          <AppText
            variant="display-lg"
            weight="bold"
            numberOfLines={2}
            align="center"
            style={{ color: G.fg, letterSpacing: -0.5, lineHeight: 44 }}
          >
            Manage Your Shop{'\n'}Smartly
          </AppText>
        </Animated.View>

        <Animated.View style={[styles.dividerWrap, dividerAnimatedStyle]} pointerEvents="none">
          <View style={[styles.dividerInner, { backgroundColor: G.textGlass }]} />
        </Animated.View>

        <Animated.View style={[styles.subtitleWrap, subtitleAnimatedStyle]}>
          <AppText
            variant="body"
            weight="medium"
            numberOfLines={2}
            align="center"
            style={{ color: G.muted, lineHeight: 22 }}
          >
            Real-time inventory, sales tracking,{'\n'}and insights at your fingertips
          </AppText>
        </Animated.View>
      </View>

      <View style={[styles.progressLayer, { backgroundColor: G.progressTrack }]} pointerEvents="none">
        <Animated.View style={[{ backgroundColor: G.progressFill, height: '100%', borderRadius: 1 }, progressAnimatedStyle]} />
      </View>

      <View style={styles.footerLayer} pointerEvents="none">
        <Animated.View entering={undefined}>
          <AppText
            variant="micro"
            weight="semibold"
            style={{ color: G.textGlassFaint, letterSpacing: 5 }}
            numberOfLines={1}
            align="center"
          >
            SHEGA
          </AppText>
        </Animated.View>
      </View>

      {/* Language Picker Overlay */}
      {showLanguagePicker && (
        <View style={styles.langOverlay}>
          <View style={[styles.langCard, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
            <AppText variant="heading-lg" weight="bold" align="center" style={{ color: G.fg, marginBottom: 8 }}>
              {t('onboarding.welcome_title')}
            </AppText>
            <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginBottom: 28 }}>
              {t('onboarding.choose_language')}
            </AppText>

            {[
              { id: 'en', label: 'English', sub: 'System Default' },
              { id: 'am', label: '\u1200\u1273\u1275\u122d\u129b', sub: 'Amharic' },
              { id: 'om', label: 'Afaan Oromo', sub: 'Oromo' },
              { id: 'ti', label: '\u1275\u130d\u1295\u1295\u1293', sub: 'Tigrinya' },
            ].map((lang) => (
              <TouchableOpacity
                key={lang.id}
                onPress={() => setLanguage(lang.id as any)}
                style={[
                  styles.langOption,
                  { backgroundColor: G.bgCard, borderColor: G.border },
                  language === lang.id && { borderColor: G.fg, borderWidth: 2 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="bold" style={{ color: G.fg }}>{lang.label}</AppText>
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }}>{lang.sub}</AppText>
                </View>
                {language === lang.id && (
                  <View style={[styles.langCheck, { backgroundColor: G.fg }]}>
                    <Check size={14} color={G.bg} />
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={onNext}
              style={[styles.langContinueBtn, { backgroundColor: G.fg }]}
              activeOpacity={0.85}
            >
              <AppText variant="body" weight="bold" style={{ color: G.bg }}>{t('onboarding.continue')}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particleLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: 'absolute',
  },
  ambientGlow: {
    position: 'absolute',
    width: W * 0.7,
    height: W * 0.7,
    borderRadius: W * 0.35,
    top: '30%',
    alignSelf: 'center',
  },
  ringLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  contentLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
    position: 'relative',
  },
  logoGlassOuter: {
    width: LOGO_SIZE + 16,
    height: LOGO_SIZE + 16,
    borderRadius: (LOGO_SIZE + 16) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logoGlowRing: {
    position: 'absolute',
    width: LOGO_SIZE + 40,
    height: LOGO_SIZE + 40,
    borderRadius: (LOGO_SIZE + 40) / 2,
  },
  logoGlassInner: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  logoImage: {
    width: '60%',
    height: '60%',
  },
  shimmerBar: {
    position: 'absolute',
    width: 44,
    height: '200%',
    transform: [{ rotate: '22deg' }],
    top: '-50%',
  },
  reflectionArc: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: (LOGO_SIZE + 24) / 2,
    borderWidth: 1,
  },
  taglineWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerWrap: {
    alignItems: 'center',
    marginBottom: 20,
    height: 1,
    overflow: 'hidden',
    width: 50,
  },
  dividerInner: {
    width: '100%',
    height: '100%',
    borderRadius: 0.5,
  },
  subtitleWrap: {
    paddingHorizontal: 24,
  },
  progressLayer: {
    position: 'absolute',
    bottom: 100,
    left: 40,
    right: 40,
    height: 2,
    borderRadius: 1,
  },
  footerLayer: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
  },
  langOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  langCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    borderWidth: 1,
    padding: 28,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  langCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langContinueBtn: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
});

export default FirstOnboardingScreen;