import { TextStyle} from 'react-native';

export const Typography = {
  bold: {
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  } as TextStyle,
  medium: {
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  } as TextStyle,
  regular: {
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  } as TextStyle,
  light: {
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  } as TextStyle,
  semibold: {
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  } as TextStyle,
  extrabold: {
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
  } as TextStyle,
  black: {
    fontFamily: 'Inter_900Black',
    fontWeight: '900',
  } as TextStyle,
};

export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
  sans: 'Inter_400Regular',
};

// ────────────────────────────────────────────────────────────────
// Shega theme system — light + dark only.
// Token roles:
//   primary      — strongest text / inverted section filler
//   secondary    — secondary text (aliases textSecondary)
//   background   — page canvas
//   surface      — secondary surfaces: inputs, chips, cool-gray fill
//   card         — card / panel fill
//   text         — body text
//   textSecondary — muted text
//   border       — hairline border; alpha so it paints on any surface
//   tint         — the singular functional accent
//   tabBar/header — chrome surfaces
// ────────────────────────────────────────────────────────────────

export const LightTheme = {
  primary: '#0a0b0d',
  secondary: '#5b616e',
  background: '#ffffff',
  surface: '#eef0f3',
  card: '#ffffff',
  text: '#0a0b0d',
  textSecondary: '#5b616e',
  border: 'rgba(91, 97, 110, 0.2)',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  tint: '#0052ff',
  tabBar: '#ffffff',
  header: '#ffffff',
};

export const DarkTheme = {
  primary: '#ffffff',
  secondary: '#a0a4ab',
  background: '#0a0b0d',
  surface: '#131519',
  card: '#1b1e24',
  text: '#f4f5f7',
  textSecondary: '#a0a4ab',
  border: 'rgba(139, 146, 155, 0.18)',
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  tint: '#4C8CFF',
  tabBar: '#0a0b0d',
  header: '#0a0b0d',
};

export const Colors = LightTheme; // Legacy fallback

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 9999,
};
