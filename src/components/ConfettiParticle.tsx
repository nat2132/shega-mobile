import React, { useEffect, useMemo } from 'react';
import { Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

interface ConfettiParticleProps {
  index: number;
  colors: {
    success: string;
    primary: string;
    error: string;
  };
}

const PALETTE = ['#FFD700', '#AF52DE'];

const ConfettiParticle: React.FC<ConfettiParticleProps> = ({ index, colors }) => {
  const seed = useMemo(() => ({
    size: Math.random() * 8 + 4,
    xOffset: (Math.random() - 0.5) * width * 0.8,
    rotation: Math.random() * 360,
    delay: Math.random() * 1000,
    duration: 2500 + Math.random() * 1000,
  }), []);

  const basePalette = [colors.success, colors.primary, ...PALETTE, colors.error];
  const color = basePalette[index % basePalette.length];

  const progress = useSharedValue(0);
  const rotate = useSharedValue(seed.rotation);

  useEffect(() => {
    progress.value = withDelay(
      seed.delay,
      withTiming(1, { duration: seed.duration })
    );
  }, [progress, seed.delay, seed.duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: progress.value * (height * 0.8) - 100 },
      { translateX: seed.xOffset + Math.sin(progress.value * 10) * 20 },
      { rotate: `${rotate.value + progress.value * 500}deg` }
    ],
    opacity: 1 - progress.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: seed.size,
          height: seed.size,
          backgroundColor: color,
          borderRadius: seed.size / 2,
          top: -20,
        },
        animatedStyle
      ]}
    />
  );
};

export default React.memo(ConfettiParticle);
