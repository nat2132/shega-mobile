import { useSettings } from '@/context/SettingsContext';
import {
  ArrowRightLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Hand,
  Pause,
  Play,
  RefreshCw,
  Type,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Dimensions,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  Keyboard,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { AppText } from '../components/ui';
import { useTutorialContext } from './TutorialContext';
import type { TargetLayout } from './types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const TOOLTIP_MAX_W = Math.min(340, SCREEN_W - 48);

const AnimatedRect = Animated.createAnimatedComponent(Rect);

function computePos(
  t: TargetLayout,
  pref: 'top' | 'bottom' | 'left' | 'right' | 'center',
  tw: number,
  th: number,
) {
  'worklet';
  const gap = 14;
  const pad = 16;
  const arSize = 8;

  let top: number;
  let arrowDir: 'up' | 'down';

  const fitsBelow = t.y + t.height + gap + th < SCREEN_H - pad;
  const fitsAbove = t.y - gap - th > pad;
  const preferBelow = pref === 'bottom' || pref === 'center';
  const preferAbove = pref === 'top';

  if ((preferBelow && fitsBelow) || (!preferAbove && fitsBelow)) {
    top = t.y + t.height + gap;
    arrowDir = 'up';
  } else if ((preferAbove && fitsAbove) || (!preferBelow && fitsAbove)) {
    top = t.y - gap - th;
    arrowDir = 'down';
  } else if (fitsBelow) {
    top = t.y + t.height + gap;
    arrowDir = 'up';
  } else {
    top = Math.max(pad, SCREEN_H - th - pad);
    arrowDir = 'up';
  }

  let left = t.x + t.width / 2 - tw / 2;
  if (left < pad) left = pad;
  if (left + tw > SCREEN_W - pad) left = SCREEN_W - pad - tw;

  const targetCenter = t.x + t.width / 2;
  const arrowCenter = Math.max(arSize, Math.min(tw - arSize, targetCenter - left));

  return { top, left, arrowDir, arrowCenter };
}

function getActionHint(actionType?: string, completed?: boolean, t?: (key: string) => string): string {
  if (completed) return t ? t('tutorial.action_done') : '✓ Done!';
  switch (actionType) {
    case 'tap':
      return t ? t('tutorial.action_tap') : 'Tap the highlighted element';
    case 'swipe':
      return t ? t('tutorial.action_swipe') : 'Swipe the highlighted area';
    case 'input':
      return t ? t('tutorial.action_type') : 'Type in the highlighted field';
    case 'scroll':
      return t ? t('tutorial.action_scroll') : 'Scroll the highlighted area';
    default:
      return '';
  }
}

function SpotlightSVG({
  x, y, w, h, actionType, actionCompleted, tint, padding = 12,
}: {
  x: SharedValue<number>;
  y: SharedValue<number>;
  w: SharedValue<number>;
  h: SharedValue<number>;
  actionType?: string;
  actionCompleted?: boolean;
  tint: string;
  padding?: number;
}) {
  const pulse = useSharedValue(0);
  const pulse2 = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    pulse2.value = withRepeat(
      withSequence(
        withDelay(500, withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) })),
        withDelay(500, withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.sin) })),
      ),
      -1,
      true,
    );
  }, [pulse, pulse2]);

  const cutoutProps = useAnimatedProps(() => ({
    x: x.value - padding,
    y: y.value - padding,
    width: Math.max(0, w.value + padding * 2),
    height: Math.max(0, h.value + padding * 2),
  }));

  const ringPad = Math.min(padding * 0.66, 12);
  const innerPad = Math.min(padding * 0.33, 6);
  const glowPad = padding * 1.5;

  const outerRingStyle = useAnimatedStyle(() => ({
    left: x.value - ringPad,
    top: y.value - ringPad,
    width: w.value + ringPad * 2,
    height: h.value + ringPad * 2,
    opacity: 0.5 - pulse.value * 0.25,
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  const innerRingStyle = useAnimatedStyle(() => ({
    left: x.value - innerPad,
    top: y.value - innerPad,
    width: w.value + innerPad * 2,
    height: h.value + innerPad * 2,
    opacity: 0.3 + pulse2.value * 0.4,
    borderColor: tint,
    borderWidth: 2,
    transform: [{ scale: 1 + pulse2.value * 0.03 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    left: x.value - glowPad,
    top: y.value - glowPad,
    width: w.value + glowPad * 2,
    height: h.value + glowPad * 2,
    opacity: 0.08 + pulse.value * 0.08,
    borderRadius: 24 + pulse.value * 4,
    backgroundColor: tint,
  }));

  const successGlow = useAnimatedStyle(() => ({
    left: x.value - glowPad,
    top: y.value - glowPad,
    width: w.value + glowPad * 2,
    height: h.value + glowPad * 2,
    opacity: actionCompleted ? withTiming(0.3, { duration: 400 }) : 0,
    borderRadius: 28,
    backgroundColor: '#22C55E',
  }));

  return (
    <>
      <Svg
        width={SCREEN_W}
        height={SCREEN_H}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <Mask id="tutorialHole">
            <Rect width={SCREEN_W} height={SCREEN_H} fill="white" />
            <AnimatedRect animatedProps={cutoutProps} fill="black" rx={16} />
          </Mask>
        </Defs>
        <Rect
          width={SCREEN_W}
          height={SCREEN_H}
          fill="rgba(0,0,0,0.65)"
          mask="url(#tutorialHole)"
        />
      </Svg>

      <Animated.View pointerEvents="none" style={[styles.glowBg, glowStyle]} />
      <Animated.View pointerEvents="none" style={[styles.spotlightRing, outerRingStyle]} />
      <Animated.View pointerEvents="none" style={[styles.accentRing, innerRingStyle]} />
      <Animated.View pointerEvents="none" style={[styles.successGlow, successGlow]} />

      {(actionType === 'tap' || !actionType) && !actionCompleted && (
        <TapActionCue x={x} y={y} w={w} h={h} tint={tint} />
      )}
      {actionType === 'swipe' && !actionCompleted && (
        <SwipeActionCue x={x} y={y} w={w} h={h} tint={tint} />
      )}
      {actionType === 'input' && !actionCompleted && (
        <InputActionCue x={x} y={y} w={w} h={h} tint={tint} />
      )}
      {actionType === 'scroll' && !actionCompleted && (
        <ScrollActionCue x={x} y={y} w={w} h={h} tint={tint} />
      )}
    </>
  );
}

function TapActionCue({
  x, y, w, h, tint,
}: {
  x: SharedValue<number>;
  y: SharedValue<number>;
  w: SharedValue<number>;
  h: SharedValue<number>;
  tint: string;
}) {
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);

  useEffect(() => {
    ripple1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
    ripple2.value = withRepeat(
      withSequence(
        withDelay(700, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) })),
        withDelay(700, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [ripple1, ripple2]);

  const centerX = useDerivedValue(() => x.value + w.value / 2);
  const centerY = useDerivedValue(() => y.value + h.value / 2);

  const rippleStyle1 = useAnimatedStyle(() => {
    const size = 16 + ripple1.value * 80;
    return {
      position: 'absolute',
      left: centerX.value - size / 2,
      top: centerY.value - size / 2,
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 2.5,
      borderColor: tint,
      opacity: (1 - ripple1.value) * 0.7,
    };
  });

  const rippleStyle2 = useAnimatedStyle(() => {
    const size = 16 + ripple2.value * 80;
    return {
      position: 'absolute',
      left: centerX.value - size / 2,
      top: centerY.value - size / 2,
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 2.5,
      borderColor: tint,
      opacity: (1 - ripple2.value) * 0.7,
    };
  });

  return (
    <>
      <Animated.View pointerEvents="none" style={rippleStyle1} />
      <Animated.View pointerEvents="none" style={rippleStyle2} />
    </>
  );
}

function SwipeActionCue({
  x, y, w, h, tint,
}: {
  x: SharedValue<number>;
  y: SharedValue<number>;
  w: SharedValue<number>;
  h: SharedValue<number>;
  tint: string;
}) {
  const slide = useSharedValue(0);

  useEffect(() => {
    slide.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [slide]);

  const arrowStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: x.value + w.value / 2 - 12 + (slide.value - 0.5) * w.value * 0.6,
    top: y.value + h.value / 2 - 12,
    opacity: 0.3 + slide.value * 0.5,
  }));

  return (
    <Animated.View pointerEvents="none" style={arrowStyle}>
      <View style={[styles.swipeArrow, { borderLeftColor: tint, borderBottomColor: tint }]} />
    </Animated.View>
  );
}

function InputActionCue({
  x, y, w, h, tint,
}: {
  x: SharedValue<number>;
  y: SharedValue<number>;
  w: SharedValue<number>;
  h: SharedValue<number>;
  tint: string;
}) {
  const blink = useSharedValue(0);

  useEffect(() => {
    blink.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [blink]);

  const cursorStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: x.value + w.value - 4,
    top: y.value + 6,
    width: 2.5,
    height: h.value - 12,
    borderRadius: 1,
    backgroundColor: tint,
    opacity: 0.4 + blink.value * 0.6,
  }));

  return (
    <Animated.View pointerEvents="none" style={cursorStyle} />
  );
}

function ScrollActionCue({
  x, y, w, h, tint,
}: {
  x: SharedValue<number>;
  y: SharedValue<number>;
  w: SharedValue<number>;
  h: SharedValue<number>;
  tint: string;
}) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [bob]);

  const upStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: x.value + w.value / 2 - 8,
    top: y.value + h.value / 2 - 20 + (bob.value - 0.5) * 12,
    opacity: 0.4 + bob.value * 0.4,
  }));

  const downStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: x.value + w.value / 2 - 8,
    top: y.value + h.value / 2 + 4 + (0.5 - bob.value) * 12,
    opacity: 0.4 + (1 - bob.value) * 0.4,
  }));

  return (
    <>
      <Animated.View pointerEvents="none" style={upStyle}>
        <View style={[styles.scrollChevron, { borderLeftColor: tint, borderTopColor: tint }]} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={downStyle}>
        <View style={[styles.scrollChevron, { borderRightColor: tint, borderBottomColor: tint, transform: [{ rotate: '45deg' }] }]} />
      </Animated.View>
    </>
  );
}

export const TutorialOverlay: React.FC = () => {
  const { colors, t } = useSettings();
  const insets = useSafeAreaInsets();
  const ctx = useTutorialContext();

  const svX = useSharedValue(0);
  const svY = useSharedValue(0);
  const svW = useSharedValue(0);
  const svH = useSharedValue(0);
  const svOpacity = useSharedValue(0);
  const svTooltipW = useSharedValue(TOOLTIP_MAX_W);
  const svTooltipH = useSharedValue(160);
  const svPosition = useSharedValue<'top' | 'bottom' | 'left' | 'right' | 'center'>('center');
  const svShake = useSharedValue(0);

  const fadeAnim = useSharedValue(0);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTriggeredRef = useRef(false);

  const step = ctx.currentStep;

  useEffect(() => {
    if (step) {
      svPosition.value = step.tooltipPosition;
    }
  }, [step?.tooltipPosition, svPosition]);

  useEffect(() => {
    if (!ctx.isActive || !step || ctx.isPaused) {
      svOpacity.value = withTiming(0, { duration: 150 });
      return;
    }

    const targetId = step.targetId;

    svOpacity.value = withSequence(
      withTiming(0, { duration: 80 }),
      withDelay(120, withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) })),
    );
    let running = true;
    scrollTriggeredRef.current = false;

    const runMeasureWithScroll = () => {
      if (!running) return;

      if (step.fullContainer) {
        const pad = 20;
        svX.value = withSpring(pad, { damping: 25, stiffness: 180 });
        svY.value = withSpring(pad, { damping: 25, stiffness: 180 });
        svW.value = withSpring(SCREEN_W - pad * 2, { damping: 30, stiffness: 200 });
        svH.value = withSpring(SCREEN_H - pad * 2, { damping: 30, stiffness: 200 });
        return;
      }

      ctx.measureTarget(targetId).then((layout) => {
        if (!running || !layout) return;
        svX.value = withSpring(layout.x, { damping: 25, stiffness: 180 });
        svY.value = withSpring(layout.y, { damping: 25, stiffness: 180 });
        svW.value = withSpring(Math.max(layout.width, 1), { damping: 30, stiffness: 200 });
        svH.value = withSpring(Math.max(layout.height, 1), { damping: 30, stiffness: 200 });
        if (!scrollTriggeredRef.current) {
          const isOffScreen = layout.y < 0 || layout.y + layout.height > SCREEN_H;
          if (isOffScreen) {
            scrollTriggeredRef.current = true;
            ctx.scrollToTarget(targetId);
          }
        }
      });
    };

    runMeasureWithScroll();
    const interval = setInterval(runMeasureWithScroll, 100);

    const kbShowSub = Keyboard.addListener('keyboardDidShow', runMeasureWithScroll);
    const kbHideSub = Keyboard.addListener('keyboardDidHide', runMeasureWithScroll);

    return () => {
      running = false;
      clearInterval(interval);
      kbShowSub.remove();
      kbHideSub.remove();
    };
  }, [ctx.isActive, step, ctx.isPaused, ctx.measureTarget, svX, svY, svW, svH, svOpacity]);

  useEffect(() => {
    fadeAnim.value = withTiming(ctx.isActive ? 1 : 0, { duration: 280 });
  }, [ctx.isActive, fadeAnim]);

  useEffect(() => {
    if (ctx.actionCompleted && ctx.isActionRequired && step) {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = setTimeout(() => {
        ctx.nextStep();
      }, 700);
    }
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = null;
      }
    };
  }, [ctx.actionCompleted, ctx.isActionRequired, step, ctx.nextStep]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  const handleContentLayout = useCallback(
    (e: any) => {
      const { width, height } = e.nativeEvent.layout;
      svTooltipW.value = Math.max(width + 32, 240);
      svTooltipH.value = Math.max(height + 32, 160);
    },
    [svTooltipW, svTooltipH],
  );

  const derivedPos = useDerivedValue(() =>
    computePos(
      { x: svX.value, y: svY.value, width: svW.value, height: svH.value },
      svPosition.value,
      svTooltipW.value,
      svTooltipH.value,
    ),
  );

  const tooltipStyle = useAnimatedStyle(() => {
    const pos = derivedPos.value;
    return {
      position: 'absolute',
      left: pos.left,
      top: pos.top,
      maxWidth: TOOLTIP_MAX_W,
      opacity: svOpacity.value,
      transform: [
        { scale: svOpacity.value * 0.88 + 0.12 },
        { translateX: svShake.value },
      ],
    };
  });

  const animatedProgressWidth = useDerivedValue(() => {
    return withSpring(ctx.progress, { damping: 20, stiffness: 120 });
  });

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: `${animatedProgressWidth.value * 100}%` as any,
    };
  });

  const arrowStyle = useAnimatedStyle(() => {
    const pos = derivedPos.value;
    return {
      position: 'absolute',
      width: 16,
      height: 8,
      zIndex: 2,
      ...(pos.arrowDir === 'up'
        ? { top: -8, left: pos.arrowCenter - 8 }
        : { bottom: -8, left: pos.arrowCenter - 8, transform: [{ rotate: '180deg' }] }),
    };
  });

  const overlayAnim = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));

  if (!ctx.isActive) return null;

  const isFirst = ctx.currentStepIndex === 0;
  const isLast = ctx.currentStepIndex === ctx.totalSteps - 1;
  const completedTop = SCREEN_H * 0.35 + insets.top;
  const isActionPending = ctx.isActionRequired && !ctx.actionCompleted;
  const actionHint = getActionHint(step?.actionType, ctx.actionCompleted, t);

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent>
    <Animated.View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }, overlayAnim]}
    >
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
      />

      <SpotlightSVG
        x={svX}
        y={svY}
        w={svW}
        h={svH}
        actionType={step?.actionType}
        actionCompleted={ctx.actionCompleted}
        tint={colors.tint}
        padding={step?.spotlightPadding}
      />

      {step && !ctx.isPaused && (
        <Animated.View onLayout={handleContentLayout} style={tooltipStyle}>
          <Animated.View style={arrowStyle}>
            <View style={[styles.arrowInner, { borderBottomColor: colors.card }]} />
            <View style={[styles.arrowBorder, { borderBottomColor: colors.border }]} />
          </Animated.View>

          <View
            style={[
              styles.tooltipBody,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.stepRow}>
              <View style={[styles.dot, { backgroundColor: colors.tint }]}>
                <AppText variant="micro" weight="bold" color={colors.background}>
                  {ctx.currentStepIndex + 1}
                </AppText>
              </View>
              <View style={[styles.track, { backgroundColor: colors.border }]}>
                <Animated.View
                  style={[
                    styles.fill,
                    { backgroundColor: colors.tint },
                    progressStyle,
                  ]}
                />
              </View>
              <AppText variant="micro" weight="medium" color={colors.textSecondary}>
                {ctx.currentStepIndex + 1}/{ctx.totalSteps}
              </AppText>
            </View>

            <AppText variant="body" weight="bold" color={colors.text} style={styles.title}>
              {t(`tutorial.${ctx.activeTutorialId}.steps.${step.id}.title`) || step.title}
            </AppText>
            <AppText variant="caption" weight="regular" color={colors.textSecondary} style={styles.desc}>
              {t(`tutorial.${ctx.activeTutorialId}.steps.${step.id}.desc`) || step.description}
            </AppText>

            {actionHint ? (
              <View style={[styles.actionHintRow, { backgroundColor: ctx.actionCompleted ? colors.success + '20' : colors.tint + '15' }]}>
                {ctx.actionCompleted ? (
                  <View style={[styles.actionIconWrap, { backgroundColor: colors.success }]}>
                    <BookOpen size={12} color="#FFF" />
                  </View>
                ) : step?.actionType === 'tap' ? (
                  <Hand size={14} color={colors.tint} />
                ) : step?.actionType === 'swipe' ? (
                  <ArrowRightLeft size={14} color={colors.tint} />
                ) : (
                  <Type size={14} color={colors.tint} />
                )}
                <AppText
                  variant="micro"
                  weight="semibold"
                  color={ctx.actionCompleted ? colors.success : colors.tint}
                  style={{ marginLeft: 6 }}
                >
                  {actionHint}
                </AppText>
              </View>
            ) : null}

            <View style={styles.bar}>
              <View style={styles.barLeft}>
                {!isFirst && (
                  <TouchableOpacity onPress={ctx.prevStep} style={[styles.btnIcon, { backgroundColor: colors.border }]}>
                    <ChevronLeft size={18} color={colors.text} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={ctx.restartTutorial} style={[styles.btnIcon, { backgroundColor: colors.border }]}>
                  <RefreshCw size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.barRight}>
                {ctx.isPaused ? (
                  <TouchableOpacity onPress={ctx.resumeTutorial} style={[styles.pauseBtn, { backgroundColor: colors.success }]}>
                    <Play size={16} color={colors.background} />
                    <AppText variant="label" weight="semibold" color={colors.background} style={{ marginLeft: 6 }}>
                      {t('tutorial.resume')}
                    </AppText>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={ctx.pauseTutorial} style={[styles.pauseBtn, { backgroundColor: colors.border }]}>
                    <Pause size={16} color={colors.text} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={ctx.skipTutorial} style={styles.skipBtn}>
                  <AppText variant="micro" weight="medium" color={colors.textSecondary}>{t('tutorial.skip')}</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={isActionPending ? undefined : ctx.nextStep}
                  style={[
                    styles.nextBtn,
                    {
                      backgroundColor: isActionPending ? colors.border : ctx.actionCompleted ? colors.success : colors.tint,
                      opacity: isActionPending ? 0.5 : 1,
                    },
                  ]}
                >
                  <AppText variant="label" weight="semibold" color={isActionPending ? colors.textSecondary : colors.background}>
                    {isLast ? t('tutorial.done') : t('tutorial.next')}
                  </AppText>
                  {!isLast && (
                    <ChevronRight
                      size={16}
                      color={isActionPending ? colors.textSecondary : colors.background}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>
      )}

      {step && ctx.isPaused && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.pausedOverlay,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.pausedIconWrap, { backgroundColor: colors.tint + '20' }]}>
            <Pause size={28} color={colors.tint} />
          </View>
          <AppText variant="heading" weight="bold" color={colors.text} style={{ marginTop: 12 }}>
            {t('tutorial.paused_title')}
          </AppText>
          <AppText variant="caption" weight="regular" color={colors.textSecondary} style={{ marginTop: 4, textAlign: 'center', lineHeight: 18 }}>
            {t('tutorial.paused_desc')}
          </AppText>
          <TouchableOpacity
            onPress={ctx.resumeTutorial}
            style={[styles.resumeBtn, { backgroundColor: colors.tint }]}
          >
            <Play size={18} color={colors.background} />
            <AppText variant="label" weight="semibold" color={colors.background} style={{ marginLeft: 8 }}>
              {t('tutorial.resume')}
            </AppText>
          </TouchableOpacity>
        </Animated.View>
      )}

      {!step && ctx.isActive && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={[
            styles.completedBox,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              top: completedTop,
            },
          ]}
        >
          <View style={[styles.completedIcon, { backgroundColor: colors.success }]}>
            <BookOpen size={24} color="#FFF" />
          </View>
            <AppText variant="body" weight="bold" color={colors.text} style={{ marginTop: 12 }}>
              {t('tutorial.complete_title')}
            </AppText>
            <AppText
              variant="caption"
              weight="regular"
              color={colors.textSecondary}
              style={{ marginTop: 4, textAlign: 'center', lineHeight: 18 }}
            >
              {t('tutorial.complete_desc', { name: ctx.activeTutorialTitle })}
            </AppText>
            <View style={styles.completedRow}>
              <TouchableOpacity onPress={ctx.restartTutorial} style={[styles.completedBtn, { backgroundColor: colors.tint }]}>
                <RefreshCw size={16} color={colors.background} />
                <AppText variant="label" weight="semibold" color={colors.background} style={{ marginLeft: 8 }}>
                  {t('tutorial.restart')}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={ctx.endTutorial} style={[styles.completedBtn, { borderColor: colors.border, borderWidth: 1 }]}>
                <AppText variant="label" weight="semibold" color={colors.text}>{t('tutorial.close')}</AppText>
              </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </Animated.View>
    </Modal>
  );
};

export default TutorialOverlay;

const styles = StyleSheet.create({
  glowBg: {
    position: 'absolute',
    borderRadius: 24,
  },
  spotlightRing: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
  },
  accentRing: {
    position: 'absolute',
    borderRadius: 14,
  },
  successGlow: {
    position: 'absolute',
    borderRadius: 28,
  },
  swipeArrow: {
    width: 20,
    height: 20,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
  },
  scrollChevron: {
    width: 14,
    height: 14,
    borderLeftWidth: 2.5,
    borderTopWidth: 2.5,
    borderRadius: 2,
  },
  arrowInner: {
    position: 'absolute',
    top: 2,
    left: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowBorder: {
    position: 'absolute',
    top: 0,
    left: -1,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tooltipBody: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginRight: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  title: {
    marginBottom: 6,
  },
  desc: {
    lineHeight: 18,
    marginBottom: 16,
  },
  actionHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
  },
  actionIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barLeft: {
    flexDirection: 'row',
    gap: 6,
  },
  barRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  pausedOverlay: {
    position: 'absolute',
    top: '30%',
    left: 48,
    right: 48,
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  pausedIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 16,
  },
  completedBox: {
    position: 'absolute',
    left: 36,
    right: 36,
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  completedIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  completedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
});
