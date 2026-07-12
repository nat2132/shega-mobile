import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dimensions, findNodeHandle, ScrollView, UIManager, View } from 'react-native';
import type {
  TargetLayout,
  TutorialContextType,
  TutorialDefinition,
  TutorialProgressEntry,
  TutorialStep,
} from './types';
import * as definitions from './definitions';

const STORAGE_KEY = 'shega_tutorial_progress';

interface RegisteredTarget {
  ref: View;
}

interface RegisteredTutorial {
  definition: TutorialDefinition;
}

const TutorialContext = createContext<TutorialContextType | null>(null);

const cachedProgress: Record<string, TutorialProgressEntry> = {};
let progressLoaded = false;

async function loadProgress(): Promise<void> {
  if (progressLoaded) return;
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.assign(cachedProgress, parsed);
    }
  } catch {}
  progressLoaded = true;
}

async function saveProgress(): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(cachedProgress));
  } catch {}
}

export function useTutorialContext(): TutorialContextType {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorialContext must be used within TutorialProvider');
  }
  return ctx;
}

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [activeTutorialId, setActiveTutorialId] = useState<string | null>(null);
  const [activeDefinition, setActiveDefinition] = useState<TutorialDefinition | null>(null);
  const [actionCompleted, setActionCompleted] = useState(false);

  const currentStep: TutorialStep | null = activeDefinition
    ? activeDefinition.steps[currentStepIndex] ?? null
    : null;

  const isActionRequired = currentStep?.waitForAction ?? false;

  useEffect(() => {
    setActionCompleted(false);
  }, [currentStepIndex]);

  const targetsRef = useRef<Map<string, RegisteredTarget>>(new Map());
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollRetryRef = useRef(false);
  const tutorialsRef = useRef<Map<string, RegisteredTutorial>>(
    new Map(
      Object.values(definitions).map((def: any) => [
        def.screen,
        { definition: def },
      ])
    )
  );

  useEffect(() => {
    loadProgress();
  }, []);

  const measureTarget = useCallback(async (id: string): Promise<TargetLayout | null> => {
    const entry = targetsRef.current.get(id);
    if (!entry?.ref) return null;
    return new Promise((resolve) => {
      entry.ref.measureInWindow((x: number, y: number, width: number, height: number) => {
        resolve({ x, y, width, height });
      });
    });
  }, []);

  const registerTarget = useCallback((id: string, ref: View) => {
    targetsRef.current.set(id, { ref });
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    targetsRef.current.delete(id);
  }, []);

  const registerTutorial = useCallback((screen: string, definition: TutorialDefinition) => {
    tutorialsRef.current.set(screen, { definition });
  }, []);

  const updateProgress = useCallback((tutorialId: string, stepIndex: number, completed: boolean) => {
    const def = tutorialsRef.current.get(tutorialId)?.definition;
    if (!def) return;
    const completedSteps = def.steps.slice(0, stepIndex).map((s) => s.id);
    cachedProgress[tutorialId] = {
      currentStepIndex: stepIndex,
      completedSteps,
      completed,
      lastUpdated: Date.now(),
    };
    saveProgress();
  }, []);

  const startTutorial = useCallback((tutorialId: string): boolean => {
    const registered = Array.from(tutorialsRef.current.values()).find(
      (t) => t.definition.id === tutorialId
    );
    if (!registered) return false;
    const def = registered.definition;
    const saved = cachedProgress[tutorialId];
    const startIndex = saved && !saved.completed ? saved.currentStepIndex : 0;
    setActiveDefinition(def);
    setActiveTutorialId(tutorialId);
    setCurrentStepIndex(startIndex);
    setIsActive(true);
    return true;
  }, []);

  const endTutorial = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);
    setActiveDefinition(null);
    setActiveTutorialId(null);
    setCurrentStepIndex(0);
  }, []);

  const skipTutorial = useCallback(() => {
    if (activeTutorialId) {
      updateProgress(activeTutorialId, 0, true);
    }
    endTutorial();
  }, [activeTutorialId, endTutorial, updateProgress]);

  const pauseTutorial = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeTutorial = useCallback(() => {
    setIsPaused(false);
  }, []);

  const nextStep = useCallback(() => {
    if (!activeDefinition) return;
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= activeDefinition.steps.length) {
      if (activeTutorialId) {
        updateProgress(activeTutorialId, activeDefinition.steps.length, true);
      }
      endTutorial();
      return;
    }
    setCurrentStepIndex(nextIndex);
    if (activeTutorialId) {
      updateProgress(activeTutorialId, nextIndex, false);
    }
  }, [activeDefinition, currentStepIndex, activeTutorialId, endTutorial, updateProgress]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback(
    (index: number) => {
      if (!activeDefinition) return;
      const clamped = Math.max(0, Math.min(index, activeDefinition.steps.length - 1));
      setCurrentStepIndex(clamped);
    },
    [activeDefinition]
  );

  const restartTutorial = useCallback(() => {
    setCurrentStepIndex(0);
    if (activeTutorialId) {
      updateProgress(activeTutorialId, 0, false);
    }
  }, [activeTutorialId, updateProgress]);

  const replayStep = useCallback(
    (stepIndex: number) => {
      goToStep(stepIndex);
    },
    [goToStep]
  );

  const performAction = useCallback(
    (targetId: string) => {
      if (!isActive || !activeDefinition) return;
      const step = activeDefinition.steps[currentStepIndex];
      if (step?.targetId === targetId && step.waitForAction) {
        setActionCompleted(true);
      }
    },
    [isActive, activeDefinition, currentStepIndex]
  );

  const markActionComplete = useCallback(() => {
    setActionCompleted(true);
  }, []);

  const getTutorialProgress = useCallback(
    (tutorialId: string): TutorialProgressEntry | null => {
      return cachedProgress[tutorialId] ?? null;
    },
    []
  );

  const isTutorialCompleted = useCallback(
    (tutorialId: string): boolean => {
      return cachedProgress[tutorialId]?.completed ?? false;
    },
    []
  );

  const resetTutorialProgress = useCallback((tutorialId: string) => {
    delete cachedProgress[tutorialId];
    saveProgress();
  }, []);

  const getTutorialStepsCount = useCallback(
    (tutorialId: string): number => {
      const registered = Array.from(tutorialsRef.current.values()).find(
        (t) => t.definition.id === tutorialId
      );
      return registered?.definition.steps.length ?? 0;
    },
    []
  );

  const registerScrollViewRef = useCallback((ref: ScrollView | null) => {
    scrollViewRef.current = ref;
  }, []);

  const scrollToTarget = useCallback((targetId: string) => {
    const sv = scrollViewRef.current;
    const target = targetsRef.current.get(targetId);
    if (!sv || !target?.ref) return;

    const targetHandle = findNodeHandle(target.ref);
    const svHandle = findNodeHandle(sv);
    if (!targetHandle || !svHandle) return;

    if (scrollRetryRef.current) return;
    scrollRetryRef.current = true;

    let retries = 0;
    const MAX_RETRIES = 10;

    const measure = () => {
      UIManager.measureLayout(
        targetHandle,
        svHandle,
        () => {
          if (retries < MAX_RETRIES) {
            retries++;
            setTimeout(measure, 100);
          } else {
            scrollRetryRef.current = false;
          }
        },
        (x, y, width, height) => {
          scrollRetryRef.current = false;
          if (width === 0 && height === 0 && retries < MAX_RETRIES) {
            retries++;
            setTimeout(measure, 100);
            return;
          }
          const { height: SCREEN_H } = Dimensions.get('window');
          const targetCenter = y + height / 2;
          const scrollToY = Math.max(0, targetCenter - SCREEN_H / 2 + 80);
          sv.scrollTo({ y: scrollToY, animated: true });
        },
      );
    };

    measure();
  }, []);

  const value = useMemo<TutorialContextType>(
    () => ({
      isActive,
      isPaused,
      currentStep,
      currentStepIndex,
      totalSteps: activeDefinition?.steps.length ?? 0,
      activeTutorialId,
      activeTutorialTitle: activeDefinition?.title ?? '',
      progress: activeDefinition ? (currentStepIndex + 1) / activeDefinition.steps.length : 0,
      actionCompleted,
      isActionRequired,
      registerTarget,
      unregisterTarget,
      measureTarget,
      registerTutorial,
      startTutorial,
      nextStep,
      prevStep,
      goToStep,
      skipTutorial,
      endTutorial,
      restartTutorial,
      replayStep,
      performAction,
      markActionComplete,
      getTutorialProgress,
      isTutorialCompleted,
      resetTutorialProgress,
      getTutorialStepsCount,
      registerScrollViewRef,
      scrollToTarget,
      pauseTutorial,
      resumeTutorial,
    }),
    [
      isActive,
      isPaused,
      currentStep,
      currentStepIndex,
      activeDefinition,
      activeTutorialId,
      actionCompleted,
      isActionRequired,
      registerTarget,
      unregisterTarget,
      measureTarget,
      registerTutorial,
      startTutorial,
      nextStep,
      prevStep,
      goToStep,
      skipTutorial,
      endTutorial,
      restartTutorial,
      replayStep,
      performAction,
      markActionComplete,
      getTutorialProgress,
      isTutorialCompleted,
      resetTutorialProgress,
      getTutorialStepsCount,
      registerScrollViewRef,
      scrollToTarget,
      pauseTutorial,
      resumeTutorial,
    ]
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
};
