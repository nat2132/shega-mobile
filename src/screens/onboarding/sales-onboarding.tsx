import React, { useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  MoveLeft,
  MoveRight,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  CheckCircle,
  ArrowUpRight,
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
import { getGlass, DIMENSIONS } from './glass-theme';

const { W: w } = DIMENSIONS;

interface OnboardingScreenProps {
  onNext?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
}

const TRANSACTIONS = [
  { type: 'Wholesale Order', amount: 'Br 48,200', status: 'completed' as const, icon: 'cart' as const },
  { type: 'Retail Sale', amount: 'Br 12,500', status: 'completed' as const, icon: 'card' as const },
  { type: 'Refund', amount: 'Br 2,300', status: 'pending' as const, icon: 'check' as const },
];

function TransactionRow({
  tx, index, G, t,
}: {
  tx: { type: string; amount: string; status: string; icon: string };
  index: number; G: ReturnType<typeof getGlass>; t: (key: string) => string;
}) {
  const translateX = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const d = 800 + index * 200;
    translateX.value = withDelay(d, withSpring(0, { damping: 16, stiffness: 140 }));
    opacity.value = withDelay(d, withTiming(1, { duration: 600 }));
  }, []);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const IconComponent = tx.icon === 'cart'
    ? ShoppingCart : tx.icon === 'card'
    ? CreditCard : CheckCircle;

  const isPending = tx.status === 'pending';

  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: G.glassCardMedium, borderRadius: 12 }, rowStyle]}>
      <View style={[styles.txIconWrap, { backgroundColor: G.glassCard, borderColor: 'transparent' }]}>
        <IconComponent size={13} color={G.textGlass} />
      </View>
      <View style={styles.txInfo}>
        <AppText
          variant="body-sm"
          weight="semibold"
          numberOfLines={1}
          style={{ color: G.textGlassStrong, letterSpacing: 0.2 }}
        >
          {tx.type}
        </AppText>
        <AppText
          variant="caption"
          weight="medium"
          numberOfLines={1}
          style={{ color: G.textGlassMedium }}
        >
          {tx.amount}
        </AppText>
      </View>
      {isPending && (
        <View style={[styles.pendingBadge, { backgroundColor: G.glassCard }]}>
          <AppText
            variant="micro"
            weight="bold"
            numberOfLines={1}
            style={{ color: G.textGlass, letterSpacing: 0.8, fontSize: 9 }}
          >
            {t('onboarding.pending_badge')}
          </AppText>
        </View>
      )}
    </Animated.View>
  );
}

function FloatingIcon({
  Icon, x, y, delay, size = 18, G,
}: {
  Icon: React.FC<{ size: number; color: string }>;
  x: number; y: number; delay: number; size?: number; G: ReturnType<typeof getGlass>;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.25, { duration: 1000 }));
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 3000 + Math.random() * 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(10, { duration: 3000 + Math.random() * 1500, easing: Easing.inOut(Easing.sin) }),
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

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x, top: y }, style]}
    >
      <Icon size={size} color={G.textGlass} />
    </Animated.View>
  );
}

function CardPreview({ G, t }: { G: ReturnType<typeof getGlass>; t: (key: string) => string }) {
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0, 0.6]),
    transform: [
      { scale: interpolate(glowPulse.value, [0, 1], [1, 1.04]) },
    ],
  }));

  return (
    <View style={[styles.cardPreview, { backgroundColor: G.glassCardMedium, borderColor: G.glassBorder }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.cardGlow,
          { backgroundColor: G.accentGlow },
          glowStyle,
        ]}
      />
      <View style={styles.cardPreviewInner}>
        <View style={styles.cardPreviewHeader}>
          <View style={styles.cardPreviewHeaderLeft}>
            <TrendingUp size={14} color={G.textGlass} />
            <AppText
              variant="caption"
              weight="semibold"
              numberOfLines={1}
              style={{ color: G.textGlass, letterSpacing: 0.3 }}
            >
              {t('onboarding.todays_sales')}
            </AppText>
          </View>
          <ArrowUpRight size={14} color={G.accentGlass} />
        </View>

        <AppText
          variant="heading-lg"
          weight="bold"
          numberOfLines={1}
          style={{ color: G.fg, letterSpacing: -0.5, marginBottom: 16 }}
        >
          Br 84,200
        </AppText>

        <View style={[styles.cardPreviewDivider, { backgroundColor: G.glassBorder }]} />

        <View style={styles.txList}>
          {TRANSACTIONS.map((tx, i) => (
            <TransactionRow key={i} tx={tx} index={i} G={G} t={t} />
          ))}
        </View>
      </View>
    </View>
  );
}

const SalesOnboardingScreen: React.FC<OnboardingScreenProps> = ({ onNext, onBack, onSkip }) => {
  const { colors, t } = useSettings();
  const G = getGlass(colors);

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <TouchableOpacity style={[styles.skipBtn, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]} onPress={onSkip}>
        <AppText
          variant="caption"
          weight="bold"
          numberOfLines={1}
          style={{ color: G.textGlass, letterSpacing: 1.2 }}
        >
          {t('onboarding.skip')}
        </AppText>
      </TouchableOpacity>

      <View style={styles.mainContent}>
        <FloatingIcon Icon={ShoppingCart} x={w * 0.04} y={w * 0.12} delay={300} size={16} G={G} />
        <FloatingIcon Icon={CreditCard} x={w * 0.78} y={w * 0.10} delay={700} size={14} G={G} />
        <FloatingIcon Icon={CheckCircle} x={w * 0.06} y={w * 0.58} delay={1100} size={12} G={G} />

        <Animated.View
          entering={FadeInDown.duration(900).springify().damping(18)}
          style={styles.mediaContainer}
        >
          <CardPreview G={G} t={t} />
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
            {t('onboarding.record_sales')}
          </AppText>
          <AppText
            variant="body-lg"
            weight="medium"
            numberOfLines={3}
            align="center"
            style={{ color: G.muted, textAlign: 'center', lineHeight: 24 }}
          >
            {t('onboarding.record_sales_desc')}
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(500).duration(500)} style={[styles.pagination, { gap: 10, flexDirection: 'row', marginBottom: 40, alignItems: 'center' }]}>
          <View style={[styles.dot, { backgroundColor: G.textGlassVeryFaint }]} />
          <View style={[styles.dot, styles.activeDot, { backgroundColor: G.textGlassMedium }]} />
          <View style={[styles.dot, { backgroundColor: G.textGlassVeryFaint }]} />
          <View style={[styles.dot, { backgroundColor: G.textGlassVeryFaint }]} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(700).duration(600)} style={[styles.actionRow, { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <MoveLeft size={18} color={G.textGlass} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: G.fg, flex: 1 }]}
            onPress={onNext}
            activeOpacity={0.85}
          >
            <AppText
              variant="body"
              weight="bold"
              numberOfLines={1}
              style={{ color: G.buttonFg, letterSpacing: 0.3 }}
            >
              {t('onboarding.next')}
            </AppText>
            <MoveRight size={18} color={G.buttonFg} />
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
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 20,
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
  cardPreview: {
    width: w * 0.75,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  cardGlow: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  cardPreviewInner: {
    padding: 22,
  },
  cardPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardPreviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardPreviewDivider: {
    height: 1,
    marginBottom: 12,
  },
  txList: {
    gap: 6,
  },
  txInfo: {
    flex: 1,
  },
  txIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
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
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  nextBtn: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
});

export default SalesOnboardingScreen;