// Reusable skeleton placeholder with shimmer animation.
// Used while data is loading so users see the final UI shape immediately.
//
// All variants accept `colors` from useSettings() so they work in both
// light and dark themes (and the seven theme variants the app supports).
//
// Usage:
//   <Skeleton width={120} height={16} />
//   <SkeletonText lines={3} />
//   <SkeletonCard style={...} />

import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSettings } from '@/context/SettingsContext';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
  /** When true the element is a perfect circle (for avatars). */
  circle?: boolean;
}

const SHIMMER_DURATION_MS = 1200;

export const Skeleton: React.FC<SkeletonProps> = React.memo(({
  width = '100%',
  height = 14,
  borderRadius = 6,
  style,
  circle = false,
}) => {
  const { theme } = useSettings();
  const isDark = theme !== 'light';

  const baseColor = isDark ? '#2A2A2C' : '#E5E7EB';
  const highlightColor = isDark ? '#3A3A3C' : '#F3F4F6';

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: SHIMMER_DURATION_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    // We intentionally only run this once on mount — the shimmer loops
    // via withRepeat and we don't want to restart on every theme change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = progress.value * 200 - 100;
    return { transform: [{ translateX }] };
  });

  const dim: number = circle
    ? (typeof width === 'number' ? width : 48)
    : 0;

  const containerStyle: ViewStyle = circle
    ? {
        width: dim,
        height: dim,
        borderRadius: dim / 2,
        backgroundColor: baseColor,
        overflow: 'hidden',
      }
    : {
        width: width as any,
        height,
        borderRadius,
        backgroundColor: baseColor,
        overflow: 'hidden',
      };

  return (
    <View
      style={[styles.container, containerStyle, style]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          { backgroundColor: highlightColor },
          animatedStyle,
        ]}
      />
    </View>
  );
});

Skeleton.displayName = 'Skeleton';

interface SkeletonTextProps {
  lines?: number;
  lastLineWidth?: number | string;
  lineHeight?: number;
  gap?: number;
  style?: ViewStyle;
}

export const SkeletonText: React.FC<SkeletonTextProps> = React.memo(({
  lines = 2,
  lastLineWidth = '60%',
  lineHeight = 12,
  gap = 8,
  style,
}) => {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? lastLineWidth : '100%'}
          height={lineHeight}
        />
      ))}
    </View>
  );
});

SkeletonText.displayName = 'SkeletonText';

interface SkeletonCardProps {
  rows?: number;
  style?: ViewStyle;
  showAvatar?: boolean;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = React.memo(({
  rows = 2,
  style,
  showAvatar = false,
}) => {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 14,
          gap: 12,
        },
        style,
      ]}
    >
      {showAvatar && <Skeleton circle width={44} />}
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonText lines={rows} lineHeight={12} gap={6} />
      </View>
      <Skeleton width={60} height={14} />
    </View>
  );
});

SkeletonCard.displayName = 'SkeletonCard';

interface SkeletonListProps {
  count?: number;
  style?: ViewStyle;
  itemStyle?: ViewStyle;
  showAvatar?: boolean;
  /** Vertical spacing between skeleton rows. */
  gap?: number;
  /** Hint for callers — the per-card vertical height. Currently only
   * affects the visual padding/look; reserved for future per-row
   * height tuning. */
  cardHeight?: number;
}

/**
 * Render a list-shaped skeleton (count rows stacked). Use inside a
 * ScrollView/FlatList placeholder while the real data is loading.
 */
export const SkeletonList: React.FC<SkeletonListProps> = React.memo(({
  count = 6,
  style,
  itemStyle,
  showAvatar = false,
  gap = 8,
}) => {
  return (
    <View style={[{ padding: 16, gap }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard
          key={i}
          showAvatar={showAvatar}
          style={itemStyle}
        />
      ))}
    </View>
  );
});

SkeletonList.displayName = 'SkeletonList';

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '50%',
    opacity: 0.5,
  },
});