import { LightTheme } from '@/constants/theme';
import { createGlassTokens } from '@/utils/createGlassTokens';

export function getAdjustmentGlass(colors: typeof LightTheme) {
  return createGlassTokens(colors);
}
