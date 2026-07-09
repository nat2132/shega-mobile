import React, { useMemo } from 'react';
import { Platform, StyleProp, StyleSheet, TextStyle } from 'react-native';
import { useSettings } from '@/context/SettingsContext';
import { formatNumber, FormatNumberOptions } from '@/utils/formatNumber';
import { AppText, AppTextProps } from './AppText';

export type NumberSize =
  | 'hero'
  | 'display-lg'
  | 'display'
  | 'heading-lg'
  | 'heading'
  | 'title'
  | 'title-sm'
  | 'body-lg'
  | 'body'
  | 'body-sm'
  | 'caption'
  | 'micro';

export interface AppNumberProps
  extends Omit<AppTextProps, 'children' | 'weight' | 'variant'> {
  value: number | null | undefined;
  size?: NumberSize;
  weight?: AppTextProps['weight'];
  decimals?: FormatNumberOptions['decimals'];
  prefix?: FormatNumberOptions['prefix'];
  suffix?: FormatNumberOptions['suffix'];
  showSign?: FormatNumberOptions['showSign'];
  compact?: FormatNumberOptions['compact'];
  fallback?: FormatNumberOptions['fallback'];
  positive?: boolean;
  negative?: boolean;
  tabular?: boolean;
}

const SIZE_TO_VARIANT: Record<NumberSize, AppTextProps['variant']> = {
  hero: 'hero',
  'display-lg': 'display-lg',
  display: 'display',
  'heading-lg': 'heading-lg',
  heading: 'heading',
  title: 'title',
  'title-sm': 'title-sm',
  'body-lg': 'body-lg',
  body: 'body',
  'body-sm': 'body-sm',
  caption: 'caption',
  micro: 'micro',
};

const SIZE_TO_WEIGHT: Record<NumberSize, AppTextProps['weight']> = {
  hero: 'extrabold',
  'display-lg': 'extrabold',
  display: 'extrabold',
  'heading-lg': 'bold',
  heading: 'bold',
  title: 'semibold',
  'title-sm': 'semibold',
  body: 'semibold',
  'body-lg': 'semibold',
  'body-sm': 'medium',
  caption: 'medium',
  micro: 'medium',
};

export const AppNumber: React.FC<AppNumberProps> = React.memo(
  ({
    value,
    size = 'body',
    weight: weightProp,
    decimals,
    prefix = '',
    suffix = '',
    showSign = false,
    compact = false,
    fallback,
    positive,
    negative,
    color,
    tabular = true,
    style,
    numberOfLines = 1,
    ...rest
  }) => {
    const { colors } = useSettings();

    const formatted = useMemo(
      () => formatNumber(value, { decimals, prefix, suffix, showSign, compact, fallback }),
      [value, decimals, prefix, suffix, showSign, compact, fallback],
    );

    const autoColor = useMemo(() => {
      if (color) return color;
      if (positive === true || (positive === undefined && value !== null && value !== undefined && value > 0)) {
        return colors.success;
      }
      if (negative === true || (negative === undefined && value !== null && value !== undefined && value < 0)) {
        return colors.error;
      }
      if (prefix || suffix) {
        return colors.text;
      }
      return colors.text;
    }, [color, positive, negative, value, colors]);

    const variant = SIZE_TO_VARIANT[size];
    const weight = weightProp ?? SIZE_TO_WEIGHT[size];

    const numberFontFamily: string | null | undefined = Platform.select({
      ios: null,
      default: undefined,
    });

    const numberStyle: StyleProp<TextStyle> = useMemo(
      () => [
        tabular && { fontVariant: ['tabular-nums' as any] },
        size === 'hero' && { letterSpacing: -0.8 },
        size === 'display-lg' && { letterSpacing: -0.6 },
        size === 'display' && { letterSpacing: -0.5 },
        size === 'heading-lg' && { letterSpacing: -0.4 },
        StyleSheet.flatten(style),
      ].filter(Boolean),
      [tabular, size, style],
    );

    return (
      <AppText
        variant={variant}
        weight={weight}
        fontFamily={numberFontFamily}
        color={autoColor}
        numberOfLines={numberOfLines}
        ignoreLanguageScale
        lineHeightMultiplier={size === 'hero' || size === 'display-lg' || size === 'display' || size === 'heading-lg' ? 1.1 : 1.2}
        style={numberStyle}
        {...rest}
      >
        {formatted}
      </AppText>
    );
  },
);

AppNumber.displayName = 'AppNumber';

export default AppNumber;
