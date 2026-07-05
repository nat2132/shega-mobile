import { LightTheme } from '@/constants/theme';
import { createGlassTokens } from '@/utils/createGlassTokens';

export function getSettingsGlass(colors: typeof LightTheme) {
  return createGlassTokens(colors);
}

export const SETTINGS_SPRING = {
  gentle: { damping: 22, stiffness: 120 },
  snappy: { damping: 16, stiffness: 200 },
  bouncy: { damping: 9, stiffness: 100 },
  soft: { damping: 18, stiffness: 150 },
  pressIn: { damping: 15, stiffness: 300, mass: 0.3 },
  pressOut: { damping: 12, stiffness: 180, mass: 0.5 },
};

export const SETTINGS_TIMING = {
  fast: 200,
  medium: 400,
  slow: 700,
  stagger: 80,
};
