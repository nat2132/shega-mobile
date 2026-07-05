import { useSettings } from '@/context/SettingsContext';
import { createGlassTokens } from '@/utils/createGlassTokens';

export function useThemeGlass() {
  const { colors } = useSettings();
  return createGlassTokens(colors);
}
