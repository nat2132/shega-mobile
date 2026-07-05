import { LightTheme } from '@/constants/theme';
import { createGlassTokens } from '@/utils/createGlassTokens';

export function getExpenseGlass(colors: typeof LightTheme) {
  return createGlassTokens(colors);
}
