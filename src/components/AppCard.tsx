import React from 'react';
import {
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';

export interface AppCardProps extends ViewProps {
  /** Optional extra padding. Defaults to `Spacing.md` (16). */
  padding?: number;
  /** Gap between child elements when `direction === 'row'`. */
  gap?: number;
  /** Border radius. Default `BorderRadius.lg` (16). */
  radius?: number;
  /** Override background colour. Defaults to `colors.card`. */
  background?: string;
  /** Override border colour. Defaults to `colors.border`. */
  border?: string;
  /** Render with a 1px border. Default `true`. */
  bordered?: boolean;
  /** Layout direction. Default `'column'`. */
  direction?: 'row' | 'column';
  /** Cross-axis alignment. Default `'flex-start'`. */
  align?: ViewStyle['alignItems'];
  /** Main-axis distribution. Default `'flex-start'`. */
  justify?: ViewStyle['justifyContent'];
  /** Allow children to wrap when content overflows. Default `true`. */
  wrap?: boolean;
  /** Style override. */
  style?: StyleProp<ViewStyle>;
}

export const AppCard: React.FC<AppCardProps> = React.memo(({
  padding = Spacing.md,
  gap = 0,
  radius = BorderRadius.lg,
  background,
  border,
  bordered = true,
  direction = 'column',
  align = 'flex-start',
  justify = 'flex-start',
  wrap = true,
  style,
  children,
  ...rest
}) => {
  const { colors } = useSettings();
  return (
    <View
      style={[
        styles.base,
        {
          padding,
          borderRadius: radius,
          backgroundColor: background ?? colors.card,
          borderColor: border ?? colors.border,
          borderWidth: bordered ? 1 : 0,
          flexDirection: direction,
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : 'nowrap',
          rowGap: gap,
          columnGap: gap,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
});

AppCard.displayName = 'AppCard';

const styles = StyleSheet.create({
  base: {
    minHeight: 0,
    minWidth: 0,
  },
});

export default AppCard;
