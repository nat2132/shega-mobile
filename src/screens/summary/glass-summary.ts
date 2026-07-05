import { LightTheme } from '@/constants/theme';
import { createGlassTokens } from '@/utils/createGlassTokens';

export function getSummaryGlass(colors: typeof LightTheme) {
  return createGlassTokens(colors);
}
