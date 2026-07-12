import { useCallback, useEffect } from 'react';
import { useTutorialContext } from './TutorialContext';
import type { TutorialDefinition } from './types';

interface UseTutorialOptions {
  tutorial: TutorialDefinition;
  enabled?: boolean;
}

export function useTutorial({ tutorial, enabled = true }: UseTutorialOptions) {
  const ctx = useTutorialContext();

  useEffect(() => {
    if (enabled) {
      ctx.registerTutorial(tutorial.screen, tutorial);
    }
  }, [tutorial.screen, enabled, ctx.registerTutorial]);

  const start = useCallback(() => {
    return ctx.startTutorial(tutorial.id);
  }, [ctx.startTutorial, tutorial.id]);

  return {
    isActive: ctx.isActive && ctx.activeTutorialId === tutorial.id,
    isPaused: ctx.isPaused,
    currentStep: ctx.currentStep,
    currentStepIndex: ctx.currentStepIndex,
    totalSteps: ctx.totalSteps,
    progress: ctx.progress,
    start,
    next: ctx.nextStep,
    prev: ctx.prevStep,
    skip: ctx.skipTutorial,
    restart: ctx.restartTutorial,
    end: ctx.endTutorial,
    pause: ctx.pauseTutorial,
    resume: ctx.resumeTutorial,
    performAction: ctx.performAction,
    isCompleted: ctx.isTutorialCompleted(tutorial.id),
    savedProgress: ctx.getTutorialProgress(tutorial.id),
    resetProgress: () => ctx.resetTutorialProgress(tutorial.id),
  };
}

export default useTutorial;
