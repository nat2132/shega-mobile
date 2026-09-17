import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from './AppText';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface AppButtonProps {
  label: string;
  onPress?: () => void;
  variant?: AppButtonVariant;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  hitSlop?: { top: number; right: number; bottom: number; left: number };
  testID?: string;
}

// WCAG-relative-luminance contrast picker: near-white surfaces get near-black
// labels, saturated/dark surfaces get white. Keeps the single blue accent
// legible on both the light (`#0052ff`) and dark (`#4C8CFF`) themes.
// Crossover is L ≈ 0.179 (where contrast against black equals white).
function readableOn(hex: string): string {
  const h = hex.replace('#', '');
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = channel(parseInt(h.slice(0, 2), 16));
  const g = channel(parseInt(h.slice(2, 4), 16));
  const b = channel(parseInt(h.slice(4, 6), 16));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.179 ? '#0a0b0d' : '#ffffff';
}

export const AppButton: React.FC<AppButtonProps> = React.memo(({
  label,
  onPress,
  variant = 'primary',
  leftIcon,
  rightIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  backgroundColor,
  textColor,
  borderColor,
  padding = Spacing.md,
  style,
  hitSlop = { top: 8, right: 8, bottom: 8, left: 8 },
  testID,
}) => {
  const { colors } = useSettings();

  const variantStyles: Record<AppButtonVariant, {
    bg: string;
    fg: string;
    border?: string;
  }> = {
    primary:   { bg: colors.tint,     fg: readableOn(colors.tint) },
    secondary: { bg: 'transparent',   fg: colors.primary, border: colors.border },
    ghost:     { bg: 'transparent',   fg: colors.tint },
    danger:    { bg: colors.error,    fg: '#FFFFFF' },
  };
  const v = variantStyles[variant];
  const bg = backgroundColor ?? v.bg;
  const fg = textColor ?? v.fg;
  const brd = borderColor ?? v.border ?? 'transparent';

  const isInteractive = !disabled && !loading;

  return (
    <Pressable
      onPress={isInteractive ? onPress : undefined}
      disabled={!isInteractive}
      hitSlop={hitSlop}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: brd,
          borderWidth: variant === 'secondary' ? 1 : 0,
          paddingHorizontal: padding,
          paddingVertical: Math.max(10, padding - 6),
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          transform: pressed ? [{ scale: 0.985 }] : undefined,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : leftIcon ? (
          <View style={styles.icon}>{leftIcon}</View>
        ) : null}
        <AppText
          variant="label"
          weight="semibold"
          color={fg}
          align="center"
          numberOfLines={2}
          style={[
            styles.label,
            (leftIcon || loading) ? { marginLeft: leftIcon || loading ? 8 : 0 } : null,
          ]}
        >
          {label}
        </AppText>
        {rightIcon ? <View style={[styles.icon, { marginLeft: 8 }]}>{rightIcon}</View> : null}
      </View>
    </Pressable>
  );
});

AppButton.displayName = 'AppButton';

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    minWidth: 0,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: {
    flexShrink: 1,
    letterSpacing: 0.2,
  },
});

export default AppButton;
