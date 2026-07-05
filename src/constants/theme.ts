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
  light: 'Inter_400Regular',
  sans: 'Inter_400Regular',
};

export const LightTheme = {
  primary: '#000000',
  secondary: '#666666',
  background: '#ffffff',
  surface: '#ffffff',
  card: '#f9f9f9',
  text: '#000000',
  textSecondary: '#666666',
  border: '#e5e5e5',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  tint: '#000000',
  tabBar: '#ffffff',
  header: '#ffffff',
};

export const DarkTheme = {
  primary: '#ffffff',
  secondary: '#A0A0A0',
  background: '#000000',
  surface: '#121212',
  card: '#1C1C1C',
  text: '#ffffff',
  textSecondary: '#A0A0A0',
  border: '#2C2C2C',
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  tint: '#ffffff',
  tabBar: '#121212',
  header: '#000000',
};

export const MidnightTheme = {
  primary: '#FFFFFF',
  secondary: '#94A3B8',
  background: '#050B14',
  surface: '#0A1220',
  card: '#131F37',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  border: '#203152',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  tint: '#3B82F6',
  tabBar: '#050B14',
  header: '#050B14',
};

export const EmeraldTheme = {
  primary: '#FFFFFF',
  secondary: '#86EFAC',
  background: '#041009',
  surface: '#071A10',
  card: '#102B1D',
  text: '#F8FAFC',
  textSecondary: '#A7F3D0',
  border: '#1A402D',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  tint: '#10B981',
  tabBar: '#041009',
  header: '#041009',
};

export const CharcoalTheme = {
  primary: '#FFFFFF',
  secondary: '#A1A1AA',
  background: '#09090B',
  surface: '#121214',
  card: '#1C1C1F',
  text: '#FAFAFA',
  textSecondary: '#A1A1AA',
  border: '#27272A',
  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#F87171',
  tint: '#F59E0B',
  tabBar: '#09090B',
  header: '#09090B',
};

export const SlateTheme = {
  primary: '#FFFFFF',
  secondary: '#94A3B8',
  background: '#0F172A',
  surface: '#1E293B',
  card: '#293649',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  border: '#334155',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  tint: '#6366F1',
  tabBar: '#0F172A',
  header: '#0F172A',
};

export const CocoaTheme = {
  primary: '#FFFFFF',
  secondary: '#A8A29E',
  background: '#17100B',
  surface: '#231811',
  card: '#332319',
  text: '#FAFAF9',
  textSecondary: '#A8A29E',
  border: '#443428',
  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#F87171',
  tint: '#D97706',
  tabBar: '#1C130D',
  header: '#17100B',
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