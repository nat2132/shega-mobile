import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { useTutorialContext } from './TutorialContext';

interface ScrollViewRefValue {
  ref: React.RefObject<ScrollView | null>;
  scrollTo: (options: { y: number; animated?: boolean }) => void;
  scrollY: React.MutableRefObject<number>;
  viewportHeight: React.MutableRefObject<number>;
}

const ScrollViewRefContext = createContext<ScrollViewRefValue | null>(null);

export function useScrollViewRef(): ScrollViewRefValue | null {
  return useContext(ScrollViewRefContext);
}

interface TutorialScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
}

export const TutorialScrollView: React.FC<TutorialScrollViewProps> = ({ children, onScroll, onLayout, ...props }) => {
  const ref = useRef<ScrollView>(null);
  const ctx = useTutorialContext();
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);

  useEffect(() => {
    ctx.registerScrollViewRef(ref.current);
    ctx.updateScrollPosition(scrollY.current, viewportHeight.current);
    return () => ctx.registerScrollViewRef(null);
  }, [ctx.registerScrollViewRef, ctx.updateScrollPosition]);

  const scrollTo = useCallback(({ y, animated = true }: { y: number; animated?: boolean }) => {
    ref.current?.scrollTo({ y, animated });
  }, []);

  const handleScroll = useCallback((event: any) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
    ctx.updateScrollPosition(scrollY.current, viewportHeight.current);
    onScroll?.(event);
  }, [onScroll, ctx.updateScrollPosition]);

  const handleLayout = useCallback((event: any) => {
    viewportHeight.current = event.nativeEvent.layout.height;
    ctx.updateScrollPosition(scrollY.current, viewportHeight.current);
    onLayout?.(event);
  }, [onLayout, ctx.updateScrollPosition]);

  return (
    <ScrollViewRefContext.Provider value={{ ref, scrollTo, scrollY, viewportHeight }}>
      <ScrollView
        ref={ref}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onLayout={handleLayout}
        {...props}
      >
        {children}
      </ScrollView>
    </ScrollViewRefContext.Provider>
  );
};

export default TutorialScrollView;
