import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { addScrollVisibilityListener } from '@/utils/scroll-visibility';

const SPRING_CFG = { damping: 20, stiffness: 260, mass: 0.8 };
const DEFAULT_HIDE_OFFSET = 220;

export const useAutoHideScroll = (hideDistance: number = DEFAULT_HIDE_OFFSET) => {
  const translateY = useSharedValue(0);

  useEffect(() => {
    return addScrollVisibilityListener((direction) => {
      translateY.value = direction === 'down' ? withSpring(hideDistance, SPRING_CFG) : withSpring(0, SPRING_CFG);
    });
  }, [translateY, hideDistance]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return animatedStyle;
};
