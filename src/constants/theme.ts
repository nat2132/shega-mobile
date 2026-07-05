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
  primary: '#B8C9E8',
  secondary: '#7A8BA8',
  background: '#0D1B2A',
  surface: '#152438',
  card: '#1B2E48',
  text: '#D6E4F0',
  textSecondary: '#7A8BA8',
  border: '#2A3F5A',
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  tint: '#4A80D6',
  tabBar: '#111E30',
  header: '#0D1B2A',
};

export const EmeraldTheme = {
  primary: '#C8E6C9',
  secondary: '#7CB880',
  background: '#0D1F12',
  surface: '#152B1A',
  card: '#1A3722',
  text: '#E8F5E9',
  textSecondary: '#7CB880',
  border: '#2D5A3A',
  success: '#2ECC71',
  warning: '#F39C12',
  error: '#E74C3C',
  tint: '#4CAF50',
  tabBar: '#102816',
  header: '#0D1F12',
};

export const CharcoalTheme = {
  primary: '#E0D8D0',
  secondary: '#9E9488',
  background: '#1A1614',
  surface: '#28231E',
  card: '#332E28',
  text: '#F0EAE4',
  textSecondary: '#9E9488',
  border: '#423C36',
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  tint: '#D4A574',
  tabBar: '#221E1A',
  header: '#1A1614',
};

export const SlateTheme = {
  primary: '#C8D4E0',
  secondary: '#8898A8',
  background: '#121820',
  surface: '#1C2430',
  card: '#263040',
  text: '#E0E8F0',
  textSecondary: '#8898A8',
  border: '#354558',
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  tint: '#7899C0',
  tabBar: '#161E28',
  header: '#121820',
};

export const CocoaTheme = {
  primary: '#D4C4B4',
  secondary: '#A89480',
  background: '#1C1510',
  surface: '#2A2018',
  card: '#362A20',
  text: '#EDE0D4',
  textSecondary: '#A89480',
  border: '#443628',
  success: '#2ECC71',
  warning: '#F39C12',
  error: '#E74C3C',
  tint: '#C69C6D',
  tabBar: '#241C15',
  header: '#1C1510',
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