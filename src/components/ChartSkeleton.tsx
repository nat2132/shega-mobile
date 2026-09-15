// ChartSkeleton — skeleton loaders that exactly match the layout of the
// real charts in this app. Use these in place of an empty chart on first
// mount and during refreshes so the user sees the final UI shape
// immediately, with no flash of zeros or placeholder values.
//
// All variants support the 7 themes via useSettings(), use the shared
// shimmer animation from Skeleton.tsx, and use the same layout
// dimensions as the real charts so the swap from skeleton → real chart
// is seamless (no layout shift, no flicker).
//
// Usage:
//   <BarChartSkeleton barCount={7} height={150} />
//   <LineChartSkeleton pointCount={12} height={130} />
//   <SparklineSkeleton width={80} height={30} />
//   <RingSkeleton size={100} />
//   <CategoryBarSkeleton rows={3} />

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSettings } from '@/context/SettingsContext';

const SHIMMER_DURATION_MS = 1100;

interface ShimmerProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

const Shimmer: React.FC<ShimmerProps> = React.memo(({
  width,
  height,
  borderRadius = 6,
  style,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = progress.value * 200 - 100;
    return { transform: [{ translateX }] };
  });

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: highlightColor, opacity: 0.5 },
          animatedStyle,
        ]}
      />
    </View>
  );
});
Shimmer.displayName = 'Shimmer';

interface BarChartSkeletonProps {
  /** Number of vertical bars to show. */
  barCount?: number;
  /** Total chart height (matches the BarChart `height` prop). */
  height?: number;
  /** Container width in px (defaults to 100% via flex). */
  style?: ViewStyle;
}

/**
 * Skeleton that matches the BarChart layout in sales.tsx (150px tall
 * with a row of rounded-top bars).
 */
export const BarChartSkeleton: React.FC<BarChartSkeletonProps> = React.memo(({
  barCount = 7,
  height = 150,
  style,
}) => {
  // Stable random heights so the skeleton doesn't jitter between
  // renders. Use a deterministic hash from index so React.memo works.
  const heights = useMemo(
    () => Array.from({ length: barCount }, (_, i) => {
      const seed = (i * 9301 + 49297) % 233280;
      const ratio = (seed / 233280) * 0.55 + 0.3; // 0.3..0.85 of total
      return Math.round(height * ratio);
    }),
    [barCount, height],
  );
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height, width: '100%' }, style]}>
      {heights.map((h, i) => (
        <Shimmer
          key={`bar-skel-${i}`}
          width={28}
          height={h}
          borderRadius={6}
        />
      ))}
    </View>
  );
});
BarChartSkeleton.displayName = 'BarChartSkeleton';

interface LineChartSkeletonProps {
  pointCount?: number;
  height?: number;
  width?: number;
  style?: ViewStyle;
}

/**
 * Skeleton that matches the LineChart layout used across charts (130px
 * tall with a horizontal-curve placeholder).
 */
export const LineChartSkeleton: React.FC<LineChartSkeletonProps> = React.memo(({
  pointCount = 12,
  height = 130,
  width = 320,
  style,
}) => {
  const { theme } = useSettings();
  const isDark = theme !== 'light';
  const strokeColor = isDark ? '#5A5A5C80' : '#3A3A3C40';
  const points = useMemo(() => {
    const w = width;
    const h = height;
    const xs = Array.from({ length: pointCount }, (_, i) => (i * w) / (pointCount - 1));
    const ys = Array.from({ length: pointCount }, (_, i) => {
      const seed = (i * 9301 + 49297) % 233280;
      return h * 0.3 + ((seed / 233280) * h * 0.5);
    });
    return { xs, ys, w, h };
  }, [pointCount, height, width]);

  return (
    <View style={[{ height, width: points.w, justifyContent: 'center' }, style]}>
      <Svg width={points.w} height={points.h}>
        <Path
          d={points.xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${points.ys[i]}`).join(' ')}
          stroke={strokeColor}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
});
LineChartSkeleton.displayName = 'LineChartSkeleton';

interface SparklineSkeletonProps {
  width?: number;
  height?: number;
  style?: ViewStyle;
}

/**
 * Skeleton matching the small sparkline used across dashboard and
 * inventory hero cards.
 */
export const SparklineSkeleton: React.FC<SparklineSkeletonProps> = React.memo(({
  width = 100,
  height = 30,
  style,
}) => {
  const { theme } = useSettings();
  const isDark = theme !== 'light';
  const strokeColor = isDark ? '#5A5A5C80' : '#3A3A3C40';
  return (
    <View style={[{ width, height, justifyContent: 'center' }, style]}>
      <Svg width={width} height={height} viewBox={`0 0 100 30`}>
        <Path
          d="M0 22 C15 22, 25 4, 40 14 C55 22, 75 9, 100 3"
          stroke={strokeColor}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
});
SparklineSkeleton.displayName = 'SparklineSkeleton';

interface RingSkeletonProps {
  size?: number;
  strokeWidth?: number;
  style?: ViewStyle;
}

/**
 * Skeleton matching a circular ring chart.
 */
export const RingSkeleton: React.FC<RingSkeletonProps> = React.memo(({
  size = 100,
  strokeWidth = 8,
  style,
}) => {
  const { theme } = useSettings();
  const isDark = theme !== 'light';
  const baseColor = isDark ? '#2A2A2C' : '#E5E7EB';
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={baseColor}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.5}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={baseColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.65}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
});
RingSkeleton.displayName = 'RingSkeleton';

interface CategoryBarSkeletonProps {
  rows?: number;
  rowHeight?: number;
  style?: ViewStyle;
}

/**
 * Skeleton for the category distribution bars in inventory.tsx
 * (3 rows of horizontal shimmer bars + label placeholders).
 */
export const CategoryBarSkeleton: React.FC<CategoryBarSkeletonProps> = React.memo(({
  rows = 3,
  rowHeight = 6,
  style,
}) => {
  const widths = useMemo(
    () => Array.from({ length: rows }, (_, i) => {
      const seed = (i * 9301 + 49297) % 233280;
      return 0.45 + (seed / 233280) * 0.45; // 0.45..0.9 of full width
    }),
    [rows],
  );
  return (
    <View style={[{ gap: 12 }, style]}>
      {widths.map((w, i) => (
        <View key={`cat-skel-${i}`} style={{ gap: 6 }}>
          <Shimmer
            width={`${Math.round(w * 100)}%` as any}
            height={rowHeight}
            borderRadius={rowHeight / 2}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Shimmer width="40%" height={10} borderRadius={5} />
            <Shimmer width="20%" height={10} borderRadius={5} />
          </View>
        </View>
      ))}
    </View>
  );
});
CategoryBarSkeleton.displayName = 'CategoryBarSkeleton';
