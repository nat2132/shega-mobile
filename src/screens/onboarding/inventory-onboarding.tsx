import React, { useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { MoveRight, Package, AlertCircle } from 'lucide-react-native';
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
  onSkip?: () => void;
}

const INVENTORY_ITEMS = [
  { name: 'Tomatoes', qty: '240 kg', status: 'ok' as const },
  { name: 'Cooking Oil', qty: '48 L', status: 'ok' as const },
  { name: 'Sugar', qty: '12 kg', status: 'low' as const },
  { name: 'Rice', qty: '85 kg', status: 'ok' as const },
];

function StockRow({
  item, index, G,
}: {
  item: { name: string; qty: string; status: 'ok' | 'low' | 'critical' };
  index: number; G: ReturnType<typeof getGlass>;
}) {
  const translateX = useSharedValue(50);
  const opacity = useSharedValue(0);
  const pulseGlow = useSharedValue(0);

  const statusColor = item.status === 'ok'
    ? G.textGlass
    : item.status === 'low'
    ? G.accent
    : G.textGlassMedium;

  const isLow = item.status === 'low';

  useEffect(() => {
    const d = 800 + index * 180;
    translateX.value = withDelay(d, withSpring(0, { damping: 16, stiffness: 140 }));
    opacity.value = withDelay(d, withTiming(1, { duration: 600 }));

    if (isLow) {
      pulseGlow.value = withDelay(
        d + 1000,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
    }
  }, []);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseGlow.value, [0, 1], [0, 0.25]),
  }));

  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: G.glassCard, borderRadius: 12 }, rowStyle]}>
      <View style={[styles.stockDot, { backgroundColor: statusColor }]} />
      <View style={styles.stockInfo}>
        <AppText variant="body" weight="semibold" numberOfLines={1} style={{ color: G.textGlassStrong, letterSpacing: 0.2 }}>
          {item.name}
        </AppText>
        <AppText variant="caption" weight="medium" numberOfLines={1} style={{ color: G.textGlassMedium }}>
          {item.qty}
        </AppText>
      </View>
      {isLow && (
        <View style={[styles.lowBadge, { backgroundColor: G.accentGlass }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: G.accentGlow, borderRadius: 999 }, glowStyle]} />
          <AlertCircle size={8} color={G.accent} />
          <AppText variant="micro" weight="bold" numberOfLines={1} style={{ color: G.accent, letterSpacing: 0.8, fontSize: 9 }}>
            LOW
          </AppText>
        </View>
      )}
    </Animated.View>
  );
}

function PhoneFrame({ children, G }: { children: React.ReactNode; G: ReturnType<typeof getGlass> }) {
  return (
    <View style={[styles.phoneOuter, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
      <View style={[styles.phoneNotch, { backgroundColor: G.glassBorder }]} />
      <View style={[styles.phoneScreen, { backgroundColor: G.glassCard }]}>
        {children}
      </View>
      <View style={[styles.phoneHomeBar, { backgroundColor: G.glassBorderLight }]} />
    </View>
  );
}

const InventoryOnboardingScreen: React.FC<OnboardingScreenProps> = ({ onNext, onSkip }) => {
  const { colors } = useSettings();
  const G = getGlass(colors);
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0, 1]),
    transform: [
      { scale: interpolate(glowPulse.value, [0, 1], [0.95, 1.05]) },
    ],
  }));

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <TouchableOpacity style={[styles.skipContainer, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]} onPress={onSkip}>
        <AppText
          variant="caption"
          weight="bold"
          numberOfLines={1}
          style={{ color: G.textGlass, letterSpacing: 1.2 }}
        >
          SKIP
        </AppText>
      </TouchableOpacity>

      <View style={styles.mainContent}>
        <Animated.View entering={FadeInDown.duration(900).springify().damping(18)} style={styles.mediaContainer}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glowOuter,
              { backgroundColor: G.accentGlow },
              glowStyle,
            ]}
          />
          <PhoneFrame G={G}>
            <View style={[styles.phoneHeader, { borderBottomColor: G.glassBorder }]}>
              <Package size={14} color={G.textGlass} />
              <AppText
                variant="caption"
                weight="semibold"
                numberOfLines={1}
                style={{ color: G.textGlass, letterSpacing: 0.3 }}
              >
                Inventory
              </AppText>
            </View>
            <View style={styles.stockList}>
              {INVENTORY_ITEMS.map((item, i) => (
                <StockRow key={item.name} item={item} index={i} G={G} />
              ))}
            </View>
            <View style={[styles.phoneFooter, { borderTopColor: G.glassBorder }]}>
              <AppText
                variant="micro"
                weight="medium"
                numberOfLines={1}
                style={{ color: G.textGlassFaint, letterSpacing: 0.3 }}
              >
                4 items tracked
              </AppText>
            </View>
          </PhoneFrame>
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
            Track Inventory
          </AppText>
          <AppText
            variant="body-lg"
            weight="medium"
            numberOfLines={3}
            align="center"
            style={{ color: G.muted, textAlign: 'center', lineHeight: 24 }}
          >
            Manage your stock in real-time{'\n'}with ease and precision
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(500).duration(500)} style={[styles.pagination, { gap: 10, flexDirection: 'row', marginBottom: 40, alignItems: 'center' }]}>
          <View style={[styles.dot, { backgroundColor: G.textGlassVeryFaint }]} />
          <View style={[styles.dot, styles.activeDot, { backgroundColor: G.textGlassMedium }]} />
          <View style={[styles.dot, { backgroundColor: G.textGlassVeryFaint }]} />
          <View style={[styles.dot, { backgroundColor: G.textGlassVeryFaint }]} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(700).duration(600)} style={styles.actionNode}>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: G.fg }]}
            onPress={onNext}
            activeOpacity={0.85}
          >
            <AppText
              variant="body"
              weight="bold"
              numberOfLines={1}
              style={{ color: G.buttonFg, letterSpacing: 0.3 }}
            >
              Next
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
  skipContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
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
    paddingTop: 60,
  },
  mediaContainer: {
    marginBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glowOuter: {
    position: 'absolute',
    width: w * 0.55,
    height: w * 0.55,
    borderRadius: w * 0.275,
  },
  phoneOuter: {
    width: w * 0.50,
    aspectRatio: 0.48,
    borderRadius: 32,
    borderWidth: 1,
    padding: 8,
    overflow: 'hidden',
    alignItems: 'center',
  },
  phoneNotch: {
    width: 56,
    height: 6,
    borderRadius: 3,
    marginTop: 10,
    marginBottom: 6,
  },
  phoneScreen: {
    flex: 1,
    width: '100%',
    borderRadius: 18,
    padding: 10,
  },
  phoneHomeBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
    marginTop: 4,
  },
  phoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  stockList: {
    gap: 8,
  },
  stockDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  stockInfo: {
    flex: 1,
  },
  lowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    position: 'relative',
    overflow: 'hidden',
  },
  phoneFooter: {
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 8,
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
  nextBtn: {
    flexDirection: 'row',
    height: 58,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
});

export default InventoryOnboardingScreen;