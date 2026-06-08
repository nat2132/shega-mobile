import { TextStyle, StyleSheet } from 'react-native';

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
  border: '#e5e5ea',
  success: '#4CAF50',
  warning: '#FFC107',
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
  card: '#1C1C1E',
  text: '#ffffff',
  textSecondary: '#A0A0A0',
  border: '#2C2C2E',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF453A',
  tint: '#ffffff',
  tabBar: '#121212',
  header: '#000000',
};

export const MidnightTheme = {
  primary: '#2F6FED',
  secondary: '#8AA4D7',
  background: '#0B1220',
  surface: '#172033',
  card: '#172033',
  text: '#EAF1FF',
  textSecondary: '#8AA4D7',
  border: '#24314D',
  success: '#34C759',
  warning: '#E6B85C',
  error: '#FF453A',
  tint: '#2F6FED',
  tabBar: '#172033',
  header: '#0B1220',
};

export const EmeraldTheme = {
  primary: '#1F8A70',
  secondary: '#91C8B4',
  background: '#0E1A16',
  surface: '#16241F',
  card: '#16241F',
  text: '#F3F7F6',
  textSecondary: '#91C8B4',
  border: '#253B32',
  success: '#34C759',
  warning: '#EAD2A6',
  error: '#FF453A',
  tint: '#1F8A70',
  tabBar: '#16241F',
  header: '#0E1A16',
};

export const CharcoalTheme = {
  primary: '#B23A48',
  secondary: '#A1A1A1',
  background: '#121212',
  surface: '#1E1E1E',
  card: '#1E1E1E',
  text: '#F1F1F1',
  textSecondary: '#A1A1A1',
  border: '#333333',
  success: '#34C759',
  warning: '#F4A261',
  error: '#FF453A',
  tint: '#B23A48',
  tabBar: '#1E1E1E',
  header: '#121212',
};

export const SlateTheme = {
  primary: '#7C5CFF',
  secondary: '#A8A8C0',
  background: '#0F0F14',
  surface: '#1A1A22',
  card: '#1A1A22',
  text: '#EAEAF0',
  textSecondary: '#A8A8C0',
  border: '#2A2A35',
  success: '#34C759',
  warning: '#F2C14E',
  error: '#FF453A',
  tint: '#7C5CFF',
  tabBar: '#1A1A22',
  header: '#0F0F14',
};

export const CocoaTheme = {
  primary: '#C97C5D',
  secondary: '#D8BBAF',
  background: '#14110F',
  surface: '#201A17',
  card: '#201A17',
  text: '#F8F5F2',
  textSecondary: '#D8BBAF',
  border: '#362A26',
  success: '#34C759',
  warning: '#F1E3D3',
  error: '#FF453A',
  tint: '#C97C5D',
  tabBar: '#201A17',
  header: '#14110F',
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