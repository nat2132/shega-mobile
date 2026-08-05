export type ScrollDirection = 'up' | 'down';

type ScrollVisibilityListener = (direction: ScrollDirection) => void;

const listeners = new Set<ScrollVisibilityListener>();

export const addScrollVisibilityListener = (fn: ScrollVisibilityListener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const reportScrollDirection = (direction: ScrollDirection) => {
  listeners.forEach((fn) => fn(direction));
};

export const forceScrollVisibility = (direction: ScrollDirection) => {
  listeners.forEach((fn) => fn(direction));
};
