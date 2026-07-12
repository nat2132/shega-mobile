import type { ScrollView, View } from 'react-native';

export interface TargetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TutorialStep {
  id: string;
  targetId: string;
  title: string;
  description: string;
  tooltipPosition: 'top' | 'bottom' | 'left' | 'right' | 'center';
  actionType?: 'tap' | 'input' | 'swipe' | 'scroll' | 'none';
  waitForAction?: boolean;
  spotlightPadding?: number;
  exampleValue?: string;
  fullContainer?: boolean;
}

export interface TutorialDefinition {
  id: string;
  screen: string;
  title: string;
  subtitle?: string;
  steps: TutorialStep[];
}

export interface TutorialProgressEntry {
  currentStepIndex: number;
  completedSteps: string[];
  completed: boolean;
  lastUpdated: number;
}

export interface TutorialContextType {
  isActive: boolean;
  isPaused: boolean;
  currentStep: TutorialStep | null;
  currentStepIndex: number;
  totalSteps: number;
  activeTutorialId: string | null;
  activeTutorialTitle: string;
  progress: number;
  actionCompleted: boolean;
  isActionRequired: boolean;

  registerTarget: (id: string, ref: View) => void;
  unregisterTarget: (id: string) => void;
  measureTarget: (id: string) => Promise<TargetLayout | null>;
  registerTutorial: (screen: string, definition: TutorialDefinition) => void;

  startTutorial: (tutorialId: string) => boolean;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  skipTutorial: () => void;
  endTutorial: () => void;
  restartTutorial: () => void;
  replayStep: (stepIndex: number) => void;
  performAction: (targetId: string) => void;
  markActionComplete: () => void;
  pauseTutorial: () => void;
  resumeTutorial: () => void;

  getTutorialProgress: (tutorialId: string) => TutorialProgressEntry | null;
  isTutorialCompleted: (tutorialId: string) => boolean;
  resetTutorialProgress: (tutorialId: string) => void;
  getTutorialStepsCount: (tutorialId: string) => number;
  registerScrollViewRef: (ref: ScrollView | null) => void;
  scrollToTarget: (targetId: string) => void;
  updateScrollPosition: (offset: number, viewportHeight: number) => void;
}
