import React, { useCallback, useEffect, useRef } from 'react';
import { findNodeHandle, Platform, UIManager, View, type ViewProps } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTutorialContext } from './TutorialContext';
import { useScrollViewRef } from './TutorialScrollView';

interface TutorialTargetProps extends ViewProps {
  id: string;
  children: React.ReactNode;
}

export const TutorialTarget: React.FC<TutorialTargetProps> = ({ id, children, style, ...props }) => {
  const ref = useRef<View>(null);
  const ctx = useTutorialContext();
  const scrollViewCtx = useScrollViewRef();
  const isHighlighted = ctx.currentStep?.targetId === id;
  const pulse = useSharedValue(0);
  const innerPulse = useSharedValue(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    if (ref.current) {
      ctx.registerTarget(id, ref.current);
    }
    return () => ctx.unregisterTarget(id);
  }, [id, ctx.registerTarget, ctx.unregisterTarget]);

  useEffect(() => {
    if (!isHighlighted || !scrollViewCtx?.ref.current) return;

    let retries = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const tryMeasure = () => {
      const target = findNodeHandle(ref.current);
      const scrollView = findNodeHandle(scrollViewCtx.ref.current);

      if (!target || !scrollView) {
        if (retries < 10) {
          retries++;
          timeoutId = setTimeout(tryMeasure, 100);
        }
        return;
      }

      UIManager.measureLayout(
        target,
        scrollView,
        () => {
          if (retries < 10) {
            retries++;
            timeoutId = setTimeout(tryMeasure, 100);
          }
        },
        (x, y, width, height) => {
          if (y === 0 && height === 0 && retries < 10) {
            retries++;
            timeoutId = setTimeout(tryMeasure, 100);
            return;
          }

          const currentScrollY = scrollViewCtx.scrollY.current;
          const viewportH = scrollViewCtx.viewportHeight.current || 500;

          const targetTop = y;
          const targetBottom = y + height;
          
          const viewportTop = currentScrollY + 40;
          const viewportBottom = currentScrollY + viewportH - 40;

          const isVisible = targetTop >= viewportTop && targetBottom <= viewportBottom;

          if (!isVisible) {
            const idealScrollY = Math.max(0, y - (viewportH / 2) + (height / 2));
            scrollViewCtx.scrollTo({ y: idealScrollY, animated: true });
          }
        },
      );
    };

    timeoutId = setTimeout(tryMeasure, 100);
    return () => clearTimeout(timeoutId);
  }, [isHighlighted, scrollViewCtx]);

  useEffect(() => {
    if (isHighlighted) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
      innerPulse.value = withRepeat(
        withSequence(
          withDelay(400, withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) })),
          withDelay(400, withTiming(0, { duration: 800, easing: Easing.inOut(Easing.sin) })),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = 0;
      innerPulse.value = 0;
    }
  }, [isHighlighted, pulse, innerPulse]);

  const handleTouchStart = useCallback((e: any) => {
    const { pageX, pageY } = e.nativeEvent;
    touchStartRef.current = { x: pageX, y: pageY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e: any) => {
    if (!isHighlighted || !ctx.currentStep?.waitForAction || !touchStartRef.current) return;
    const { pageX, pageY } = e.nativeEvent;
    const start = touchStartRef.current;
    touchStartRef.current = null;

    const dx = pageX - start.x;
    const dy = pageY - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - start.time;

    if (dist < 15 && duration < 300) {
      ctx.performAction(id);
    }
  }, [isHighlighted, ctx, id]);

  const animStyle = useAnimatedStyle(() => {
    if (!isHighlighted) return {};

    const glowOpacity = 0.35 + pulse.value * 0.4;
    const innerGlow = 0.15 + innerPulse.value * 0.25;

    return {
      borderColor: `rgba(255,255,255,${glowOpacity})`,
      borderWidth: 2.5,
      borderRadius: 10,
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: innerGlow,
      shadowRadius: 8 + pulse.value * 6,
      elevation: Platform.OS === 'android' ? 8 + pulse.value * 4 : undefined,
      zIndex: 1,
    };
  }, [isHighlighted]);

  return (
    <Animated.View
      ref={ref}
      collapsable={false}
      style={[style, animStyle]}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      {...props}
    >
      {children}
    </Animated.View>
  );
};

export default TutorialTarget;
