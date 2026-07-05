import { LightTheme } from '@/constants/theme';
import { createGlassTokens } from '@/utils/createGlassTokens';

export function getAuthGlass(colors: typeof LightTheme) {
  return createGlassTokens(colors);
}

export const AUTH_SPRING = {
  press: { damping: 20, stiffness: 300, mass: 0.8 },
  enter: { damping: 18, stiffness: 200, mass: 1 },
  motion: { damping: 22, stiffness: 150, mass: 1 },
};

export const AUTH_TIMING = {
  stagger: 100,
  fast: 300,
  medium: 600,
  slow: 800,
};
