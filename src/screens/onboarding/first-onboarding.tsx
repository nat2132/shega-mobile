import { Fonts } from '@/constants/theme';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

// ─── Accent palette ───────────────────────────────────────────────────────────
const GREEN = '#22C55E';
const BLUE = '#3B82F6';
const LIGHT_GREEN = '#DCFCE7';
const LIGHT_BLUE = '#DBEAFE';

// ─── Timing constants (ms) ────────────────────────────────────────────────────
const CHAOS_DURATION = 1200;   // 0 → 1.2 s  floating chaos
const SNAP_DURATION  = 600;    // 1.2 → 1.8 s  snap-to-grid
const CARDS_START    = 1800;   // 1.8 s  cards appear
const CARDS_DURATION = 1200;   // 1.8 → 3.0 s
const LOGO_START     = 3200;   // 3.2 s  logo reveal
const LOGO_DURATION  = 800;    // 3.2 → 4.0 s
const TAGLINE_START  = 3800;   // 3.8 s  tagline
const TOTAL          = 5000;   // hand-off at 5 s

// ─── Floating chaos icons ─────────────────────────────────────────────────────
const CHAOS_ICONS: {
  emoji: string;
  startX: number;
  startY: number;
  rotation: number;
  color: string;
}[] = [
  { emoji: '📦', startX: -W * 0.3,  startY: -H * 0.25, rotation: -25, color: LIGHT_BLUE },
  { emoji: '🧾', startX:  W * 0.28, startY: -H * 0.30, rotation:  18, color: LIGHT_GREEN },
  { emoji: '🛒', startX: -W * 0.25, startY:  H * 0.20, rotation: -15, color: LIGHT_BLUE },
  { emoji: '💰', startX:  W * 0.30, startY:  H * 0.22, rotation:  22, color: LIGHT_GREEN },
  { emoji: '📊', startX: -W * 0.10, startY: -H * 0.35, rotation: -10, color: LIGHT_BLUE },
  { emoji: '🏷️', startX:  W * 0.15, startY:  H * 0.32, rotation:  30, color: LIGHT_GREEN },
];

// ─── Grid snap targets (3-column, 2-row) ──────────────────────────────────────
const GRID_POSITIONS = [
  { x: -W * 0.22, y: -60 },
  { x:  0,        y: -60 },
  { x:  W * 0.22, y: -60 },
  { x: -W * 0.22, y:  60 },
  { x:  0,        y:  60 },
  { x:  W * 0.22, y:  60 },
];

// ─── Stat cards ───────────────────────────────────────────────────────────────
const STAT_CARDS = [
  { label: 'Sales Today',  value: '₦ 84,200', delta: '+12%', color: GREEN,  bg: LIGHT_GREEN },
  { label: 'Stock Items',  value: '1,340',     delta: '+8',   color: BLUE,   bg: LIGHT_BLUE  },
  { label: 'Low Stock',    value: '3 items',   delta: 'Alert',color: '#F59E0B', bg: '#FEF3C7' },
];

// ─── Chaos icon component ─────────────────────────────────────────────────────
const ChaosIcon: React.FC<{
  emoji: string;
  startX: number;
  startY: number;
  startRotation: number;
  snapX: number;
  snapY: number;
  bg: string;
  delay: number;
}> = ({ emoji, startX, startY, startRotation, snapX, snapY, bg, delay }) => {
  const tx = useSharedValue(startX);
  const ty = useSharedValue(startY);
  const rot = useSharedValue(startRotation);
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Appear
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    scale.value   = withDelay(delay, withSpring(1, { damping: 12, stiffness: 120 }));

    // Gentle float during chaos phase
    tx.value = withDelay(
      delay,
      withSequence(
        withTiming(startX * 0.85, { duration: CHAOS_DURATION * 0.5, easing: Easing.inOut(Easing.sin) }),
        withTiming(startX * 1.05, { duration: CHAOS_DURATION * 0.5, easing: Easing.inOut(Easing.sin) }),
      ),
    );
    ty.value = withDelay(
      delay,
      withSequence(
        withTiming(startY * 0.9,  { duration: CHAOS_DURATION * 0.5, easing: Easing.inOut(Easing.sin) }),
        withTiming(startY * 1.1,  { duration: CHAOS_DURATION * 0.5, easing: Easing.inOut(Easing.sin) }),
      ),
    );

    // Snap to grid
    const snapDelay = delay + CHAOS_DURATION;
    tx.value  = withDelay(snapDelay, withSpring(snapX, { damping: 18, stiffness: 200 }));
    ty.value  = withDelay(snapDelay, withSpring(snapY, { damping: 18, stiffness: 200 }));
    rot.value = withDelay(snapDelay, withSpring(0,    { damping: 20, stiffness: 220 }));
    scale.value = withDelay(snapDelay, withSpring(0.85, { damping: 14, stiffness: 180 }));

    // Fade out before logo
    opacity.value = withDelay(
      LOGO_START - 300,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rot.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.iconBubble, { backgroundColor: bg }, style]}>
      <AppText style={styles.iconEmoji} variant="title" weight="regular" numberOfLines={1}>{emoji}</AppText>
    </Animated.View>
  );
};

// ─── Stat card component ──────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: string;
  delta: string;
  color: string;
  bg: string;
  delay: number;
}> = ({ label, value, delta, color, bg, delay }) => {
  const opacity = useSharedValue(0);
  const ty      = useSharedValue(24);
  const scale   = useSharedValue(0.92);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1,    { duration: 500, easing: Easing.out(Easing.quad) }));
    ty.value      = withDelay(delay, withSpring(0,    { damping: 16, stiffness: 160 }));
    scale.value   = withDelay(delay, withSpring(1,    { damping: 14, stiffness: 150 }));

    // Fade out before logo
    opacity.value = withDelay(
      LOGO_START - 300,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.statCard, style]}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <View style={styles.statBody}>
        <AppText style={styles.statLabel} variant="caption" weight="bold" numberOfLines={1}>{label}</AppText>
        <AppText style={[styles.statValue, { color }]} variant="body-lg" weight="bold" numberOfLines={1}>{value}</AppText>
      </View>
      <View style={[styles.statBadge, { backgroundColor: bg }]}>
        <AppText style={[styles.statDelta, { color }]} variant="micro" weight="bold" numberOfLines={1}>{delta}</AppText>
      </View>
    </Animated.View>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const FirstOnboardingScreen: React.FC<{ onNext?: () => void }> = ({ onNext }) => {
  // Logo
  const logoOpacity = useSharedValue(0);
  const logoScale   = useSharedValue(0.6);
  const logoGlow    = useSharedValue(0);

  // Tagline
  const tagOpacity = useSharedValue(0);
  const tagTy      = useSharedValue(16);

  // Grid lines
  const gridOpacity = useSharedValue(0);

  useEffect(() => {
    // Grid lines appear at snap moment
    gridOpacity.value = withDelay(
      CHAOS_DURATION + 200,
      withSequence(
        withTiming(0.35, { duration: 400 }),
        withDelay(600, withTiming(0, { duration: 400 })),
      ),
    );

    // Logo entrance
    logoOpacity.value = withDelay(LOGO_START, withTiming(1, { duration: LOGO_DURATION, easing: Easing.out(Easing.quad) }));
    logoScale.value   = withDelay(LOGO_START, withSpring(1, { damping: 14, stiffness: 120 }));
    logoGlow.value    = withDelay(LOGO_START + 400, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }));

    // Tagline
    tagOpacity.value = withDelay(TAGLINE_START, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));
    tagTy.value      = withDelay(TAGLINE_START, withSpring(0, { damping: 18, stiffness: 140 }));

    // Hand-off
    const timer = setTimeout(() => onNext?.(), TOTAL);
    return () => clearTimeout(timer);
  }, [onNext]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(logoGlow.value, [0, 1], [0, 0.55]),
    transform: [{ scale: interpolate(logoGlow.value, [0, 1], [0.8, 1.4]) }],
  }));

  const tagStyle = useAnimatedStyle(() => ({
    opacity: tagOpacity.value,
    transform: [{ translateY: tagTy.value }],
  }));

  const gridStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.value,
  }));

  return (
    <View style={styles.container}>

      {/* ── Subtle grid lines (snap moment) ── */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.gridOverlay, gridStyle]} pointerEvents="none">
        {[0.25, 0.5, 0.75].map((f) => (
          <View key={`v${f}`} style={[styles.gridLineV, { left: `${f * 100}%` as any }]} />
        ))}
        {[0.33, 0.66].map((f) => (
          <View key={`h${f}`} style={[styles.gridLineH, { top: `${f * 100}%` as any }]} />
        ))}
      </Animated.View>

      {/* ── Chaos + grid icons ── */}
      <View style={styles.iconLayer} pointerEvents="none">
        {CHAOS_ICONS.map((ic, i) => (
          <ChaosIcon
            key={i}
            emoji={ic.emoji}
            startX={ic.startX}
            startY={ic.startY}
            startRotation={ic.rotation}
            snapX={GRID_POSITIONS[i].x}
            snapY={GRID_POSITIONS[i].y}
            bg={ic.color}
            delay={i * 60}
          />
        ))}
      </View>

      {/* ── Stat cards ── */}
      <View style={styles.cardsLayer} pointerEvents="none">
        {STAT_CARDS.map((c, i) => (
          <StatCard
            key={i}
            label={c.label}
            value={c.value}
            delta={c.delta}
            color={c.color}
            bg={c.bg}
            delay={CARDS_START + i * 180}
          />
        ))}
      </View>

      {/* ── Logo + glow ── */}
      <View style={styles.logoLayer} pointerEvents="none">
        {/* Glow ring */}
        <Animated.View style={[styles.glowRing, glowStyle]} />

        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <View style={styles.logoCircle}>
            <Image
              source={require('../../assets/images/logo.svg')}
              style={styles.logoImage}
              contentFit="contain"
            />
          </View>
        </Animated.View>

        <Animated.View style={[styles.taglineWrap, tagStyle]}>
          <AppText style={styles.tagline} variant="title" weight="bold" numberOfLines={2}>Manage Your Shop Smartly</AppText>
          <View style={styles.taglineDivider} />
        </Animated.View>
      </View>

    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Grid overlay
  gridOverlay: {
    position: 'absolute',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: BLUE,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: GREEN,
  },

  // Icon layer (chaos → grid)
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubble: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  iconEmoji: {
  },

  // Stat cards
  cardsLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  statCard: {
    width: W * 0.78,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  statDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statBody: {
    flex: 1,
  },
  statLabel: {
    fontFamily: Fonts.medium,
    color: '#9CA3AF',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  statValue: {
    fontFamily: Fonts.extrabold,
    letterSpacing: -0.3,
  },
  statBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statDelta: {
    fontFamily: Fonts.bold,
    letterSpacing: 0.2,
  },

  // Logo layer
  logoLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
    borderWidth: 40,
    borderColor: 'rgba(34,197,94,0.12)',
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  logoImage: {
    width: '68%',
    height: '68%',
  },
  taglineWrap: {
    alignItems: 'center',
    gap: 10,
  },
  tagline: {
    fontFamily: Fonts.semibold,
    color: '#111827',
    letterSpacing: 0.2,
  },
  taglineDivider: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: GREEN,
  },
});

export default FirstOnboardingScreen;
