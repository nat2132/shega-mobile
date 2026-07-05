import { LightTheme } from '@/constants/theme';
import { createGlassTokens } from '@/utils/createGlassTokens';

export function getReportsGlass(colors: typeof LightTheme) {
  return createGlassTokens(colors);
}
