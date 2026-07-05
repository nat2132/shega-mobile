import React, { useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  MoveLeft,
  MoveRight,
  BarChart3,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react-native';
import { AppText } from '@/components/ui';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  interpolate,
  FadeInDown,
  FadeInUp,
  FadeIn,
} from 'react-native-reanimated';
import { useSettings } from '@/context/SettingsContext';
import { DIMENSIONS, getGlass } from './glass-theme';

const { W: w } = DIMENSIONS;

interface OnboardingScreenProps {
  onGetStarted?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
}

const BAR_DATA = [
  { day: 'Mon', value: 0.6 },
  { day: 'Tue', value: 0.8 },
  { day: 'Wed', value: 0.45 },
  { day: 'Thu', value: 0.9 },
  { day: 'Fri', value: 0.7 },
  { day: 'Sat', value: 0.55 },
  { day: 'Sun', value: 0.35 },
];

const STATS = [
  { label: 'Revenue', value: 'Br 125.4k', change: '+12.5%', positive: true },
  { label: 'Profit', value: 'Br 38.2k', change: '+8.3%', positive: true },
  { label: 'Expenses', value: 'Br 24.1k', change: '-3.1%', positive: false },
];

function AnimatedBar({
  height, index, total, G,
}: {
  height: number; index: number; total: number; G: ReturnType<typeof getGlass>;
}) {
  const scaleY = useSharedValue(0);
  const maxH = 80;

  useEffect(() => {
    scaleY.value = withDelay(
      800 + index * 60,
      withSpring(1, { damping: 14, stiffness: 120 }),
    );
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    height: height * maxH,
    transform: [{ scaleY: scaleY.value }],
  }));

  const isActive = index === 3 || index === 1;

  return (
    <View style={styles.barColumn}>
      <Animated.View
        style={[
          styles.bar,
          {
            height: height * maxH,
            backgroundColor: isActive ? G.barAccent : G.barInactive,
          },
          barStyle,
        ]}
      />
      <AppText
        variant="micro"
        weight="medium"
        numberOfLines={1}
        align="center"
        style={{ color: G.textGlassFaint, letterSpacing: 0.2 }}
      >
        {BAR_DATA[index].day}
      </AppText>
    </View>
  );
}

function StatCard({
  stat, index, G,
}: {
  stat: { label: string; value: string; change: string; positive: boolean };
  index: number; G: ReturnType<typeof getGlass>;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    opacity.value = withDelay(1200 + index * 180, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(1200 + index * 180, withSpring(0, { damping: 16, stiffness: 140 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const ChangeIcon = stat.positive ? ArrowUpRight : ArrowDownRight;

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: G.statCardBg, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: G.statCardBorder }, style]}>
      <AppText
        variant="caption"
        weight="medium"
        numberOfLines={1}
        style={{ color: G.textGlass, marginBottom: 4, letterSpacing: 0.2 }}
      >
        {stat.label}
      </AppText>
      <AppText
        variant="title-sm"
        weight="bold"
        numberOfLines={1}
        style={{ color: G.fg, letterSpacing: -0.3, marginBottom: 2 }}
      >
        {stat.value}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <ChangeIcon
          size={9}
          color={stat.positive ? G.textGlassMedium : G.textGlass}
        />
        <AppText
          variant="micro"
          weight="bold"
          numberOfLines={1}
          style={{ color: stat.positive ? G.textGlassMedium : G.textGlass, letterSpacing: 0.2 }}
        >
          {stat.change}
        </AppText>
      </View>
    </Animated.View>
  );
}

function AnalyticsCard({ G }: { G: ReturnType<typeof getGlass> }) {
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0, 0.4]),
    transform: [
      { scale: interpolate(glowPulse.value, [0, 1], [1, 1.05]) },
    ],
  }));

  return (
    <View style={[styles.analyticsCard, { backgroundColor: G.glassCardMedium, borderColor: G.glassBorder }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.analyticsGlow,
          { backgroundColor: G.accentGlow },
          glowStyle,
        ]}
      />
      <View style={styles.analyticsInner}>
        <View style={styles.analyticsHeader}>
          <View style={styles.analyticsHeaderLeft}>
            <BarChart3 size={13} color={G.textGlass} />
            <AppText
              variant="caption"
              weight="semibold"
              numberOfLines={1}
              style={{ color: G.textGlass, letterSpacing: 0.3 }}
            >
              Revenue Overview
            </AppText>
          </View>
          <AppText
            variant="micro"
            weight="medium"
            numberOfLines={1}
            style={{ color: G.textGlassFaint }}
          >
            This Week
          </AppText>
        </View>

        <View style={styles.chartArea}>
          <View style={styles.chartRow}>
            {BAR_DATA.map((b, i) => (
              <AnimatedBar key={i} height={b.value} index={i} total={BAR_DATA.length} G={G} />
            ))}
          </View>
        </View>

        <View style={styles.statsRow}>
          {STATS.map((s, i) => (
            <StatCard key={i} stat={s} index={i} G={G} />
          ))}
        </View>
      </View>
    </View>
  );
}

const AnalyticsOnboardingScreen: React.FC<OnboardingScreenProps> = ({ onGetStarted, onBack, onSkip }) => {
  const { colors } = useSettings();
  const G = getGlass(colors);

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={[styles.topBarBtn, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]} onPress={onBack}>
          <MoveLeft size={18} color={G.textGlass} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.topBarBtn, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]} onPress={onSkip}>
          <AppText
            variant="caption"
            weight="bold"
            numberOfLines={1}
            style={{ color: G.textGlass, letterSpacing: 1.2 }}
          >
            SKIP
          </AppText>
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        <Animated.View
          entering={FadeInDown.duration(900).springify().damping(18)}
          style={styles.mediaContainer}
        >
          <AnalyticsCard G={G} />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(350).duration(700).springify().damping(16)}
          style={styles.textNode}
        >
          <AppText
            variant="heading-lg"
            weight="bold"
            numberOfLines={2}
            align="center"
            style={{ color: G.fg, textAlign: 'center', marginBottom: 12 }}
          >
            Get Insights
          </AppText>
          <AppText
            variant="body-lg"
            weight="medium"
            numberOfLines={3}
            align="center"
            style={{ color: G.muted, textAlign: 'center', lineHeight: 24 }}
          >
            Understand profits, losses, and trends{'\n'}at a glance
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(500).duration(500)} style={[styles.pagination, { gap: 10, flexDirection: 'row', marginBottom: 40, alignItems: 'center' }]}>
          <View style={[styles.dot, { backgroundColor: G.textGlassVeryFaint }]} />
          <View style={[styles.dot, { backgroundColor: G.textGlassVeryFaint }]} />
          <View style={[styles.dot, { backgroundColor: G.textGlassVeryFaint }]} />
          <View style={[styles.dot, styles.activeDot, { backgroundColor: G.textGlassMedium }]} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(700).duration(600)} style={styles.actionNode}>
          <TouchableOpacity
            style={[styles.getStartedBtn, { backgroundColor: G.accent }]}
            onPress={onGetStarted}
            activeOpacity={0.85}
          >
            <DollarSign size={18} color={G.fg} />
            <AppText
              variant="body"
              weight="bold"
              numberOfLines={1}
              style={{ color: G.fg, letterSpacing: 0.3 }}
            >
              Get Started
            </AppText>
            <MoveRight size={18} color={G.fg} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  topBarBtn: {
    padding: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
  },
  mediaContainer: {
    marginBottom: 48,
    alignItems: 'center',
  },
  analyticsCard: {
    width: w * 0.85,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  analyticsGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  analyticsInner: {
    padding: 22,
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  analyticsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartArea: {
    marginBottom: 16,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 90,
    paddingTop: 10,
  },
  barColumn: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  bar: {
    width: '55%',
    borderRadius: 4,
    minHeight: 4,
    transformOrigin: 'bottom',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textNode: {
    alignItems: 'center',
    marginBottom: 32,
  },
  pagination: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 40,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 28,
    borderRadius: 3,
    height: 6,
  },
  actionNode: {
    width: '100%',
  },
  getStartedBtn: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
});

export default AnalyticsOnboardingScreen;