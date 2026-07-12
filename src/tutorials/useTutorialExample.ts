import { useEffect, useRef } from 'react';
import { useTutorialContext } from './TutorialContext';

export function useTutorialExample(targetId: string, setter: (value: string) => void): void {
  const ctx = useTutorialContext();
  const filledRef = useRef(false);

  useEffect(() => {
    if (ctx.isActive && ctx.currentStep?.targetId === targetId && ctx.currentStep?.exampleValue && !filledRef.current) {
      setter(ctx.currentStep.exampleValue);
      filledRef.current = true;
    }
    if (!ctx.isActive) {
      filledRef.current = false;
    }
  }, [ctx.isActive, ctx.currentStep?.targetId, ctx.currentStep?.exampleValue, targetId, setter]);
}
