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
    primary:   { bg: colors.tint,     fg: colors.background },
    secondary: { bg: 'transparent',   fg: colors.text, border: colors.border },
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
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
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
    minHeight: 44,
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
