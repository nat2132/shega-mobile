// AppButton — a language-safe button primitive.
//
// The original buttons had a single-line label that overflowed the
// visible button width when the translation grew. This wrapper
// applies the following structural fixes:
//   * Label is `<AppText variant="label" weight="semibold" />` with
//     `numberOfLines={2}` — the label is allowed to wrap to two
//     lines if necessary, and the button grows vertically to fit.
//   * No fixed `height` — `minHeight` is set, and the label can
//     grow the button vertically.
//   * `flexWrap: 'wrap'` on the content row so the icon + label
//     never overlap when the label expands.
//   * Horizontal padding scales with the longest expected text
//     length (24 by default).
//
// Variants: `primary` (filled), `secondary` (outline), `ghost`
// (text-only), `danger` (destructive). All themed by default.

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
  /** Optional leading icon (Lucide or any React component). */
  leftIcon?: React.ReactNode;
  /** Optional trailing icon. */
  rightIcon?: React.ReactNode;
  /** Loading state — shows a spinner and disables press. */
  loading?: boolean;
  /** Disabled state. */
  disabled?: boolean;
  /** Stretch to fill parent width. Default `false`. */
  fullWidth?: boolean;
  /** Override background colour (primary/danger variants). */
  backgroundColor?: string;
  /** Override text colour. */
  textColor?: string;
  /** Override border colour (secondary variant). */
  borderColor?: string;
  /** Padding override. */
  padding?: number;
  /** Style override. */
  style?: StyleProp<ViewStyle>;
  /** Hit slop override. */
  hitSlop?: { top: number; right: number; bottom: number; left: number };
  /** Test ID. */
  testID?: string;
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

  // Theme-derived defaults per variant. Callers can override.
  const variantStyles: Record<AppButtonVariant, {
    bg: string;
    fg: string;
    border?: string;
  }> = {
    primary:   { bg: colors.primary,     fg: colors.background },
    secondary: { bg: 'transparent',      fg: colors.text, border: colors.border },
    ghost:     { bg: 'transparent',      fg: colors.primary },
    danger:    { bg: colors.error,       fg: '#FFFFFF' },
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
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
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
          weight="bold"
          color={fg}
          align="center"
          numberOfLines={2}
          style={[
            styles.label,
            // Reserve at least the icon's horizontal space even when
            // the label is empty (loading state with no left icon).
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
    minHeight: 44, // Apple HIG minimum tap target.
    borderRadius: BorderRadius.md,
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
  },
});

export default AppButton;
