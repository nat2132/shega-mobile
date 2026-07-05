import { LightTheme } from '@/constants/theme';
import { createGlassTokens } from '@/utils/createGlassTokens';

export function getBarsGlass(colors: typeof LightTheme) {
  return createGlassTokens(colors);
}

export const BARS_SPRING = {
  press: { damping: 20, stiffness: 300, mass: 0.8 },
  enter: { damping: 18, stiffness: 200, mass: 1 },
  motion: { damping: 22, stiffness: 150, mass: 1 },
};

export const BARS_TIMING = {
  stagger: 100,
  fast: 300,
  medium: 600,
  slow: 800,
};
