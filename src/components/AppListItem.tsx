// AppListItem — a language-safe list row.
//
// Lists are the most breakage-prone component for multilingual UI:
// they almost always have an icon + title + subtitle + trailing
// value, and once the title grows, the trailing value is pushed
// off the screen, or the row height becomes inconsistent.
//
// AppListItem is a flexible row that:
//   * Reserves a fixed `iconSize` column for the leading icon
//     (sized for the largest icon, not the largest text).
//   * Lets the title wrap to `titleMaxLines` (default 2) without
//     breaking the row height.
//   * Lets the trailing `rightLabel` (or `rightText`) ellipsize at
//     the end with `rightMaxLines={1}`.
//   * Uses `minHeight: 56` rather than a fixed `height` so the row
//     can grow when the title wraps to a second line.
//   * `gap` between elements is configurable.
//   * `onPress` and `onLongPress` are optional — pass either or
//     both. If both are absent, the row is non-interactive.

import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from './AppText';

export interface AppListItemProps {
  /** Optional leading element (e.g. an icon wrapped in a coloured circle). */
  left?: React.ReactNode;
  /** Primary label. */
  title: string;
  /** Secondary label below the title. */
  subtitle?: string;
  /** Right-side value. Pass a number to render with locale formatting. */
  rightText?: string;
  /** Color of the right-side value. Default `colors.text`. */
  rightColor?: string;
  /** Right-side custom node (e.g. chevron, badge). */
  right?: React.ReactNode;
  /** Max lines for the title. Default 2. */
  titleMaxLines?: number;
  /** Max lines for the subtitle. Default 1. */
  subtitleMaxLines?: number;
  /** Max lines for the right text. Default 1. */
  rightMaxLines?: number;
  /** Tap handler. */
  onPress?: () => void;
  /** Long-press handler. */
  onLongPress?: () => void;
  /** Disabled state — applies 0.5 opacity and ignores press. */
  disabled?: boolean;
  /** Background colour. Default `colors.card`. */
  background?: string;
  /** Border colour (top divider). Default `colors.border`. */
  border?: string;
  /** Hide the bottom border. Default `false` (border visible). */
  noBorder?: boolean;
  /** Padding override. */
  padding?: number;
  /** Gap between the title column and the right column. */
  gap?: number;
  /** Override row style. */
  style?: StyleProp<ViewStyle>;
  /** Show ripple press feedback. Default `true` when onPress is set. */
  pressable?: boolean;
}

export const AppListItem: React.FC<AppListItemProps> = React.memo(({
  left,
  title,
  subtitle,
  rightText,
  right,
  rightColor,
  titleMaxLines = 2,
  subtitleMaxLines = 1,
  rightMaxLines = 1,
  onPress,
  onLongPress,
  disabled = false,
  background,
  border,
  noBorder = false,
  padding = Spacing.md,
  gap = Spacing.md,
  style,
  pressable,
}) => {
  const { colors } = useSettings();
  const isPressable = !!(onPress || onLongPress) && !disabled;
  const showRipple = pressable ?? isPressable;

  const content = (
    <View
      style={[
        styles.row,
        {
          padding,
          backgroundColor: background ?? colors.card,
          borderBottomColor: border ?? colors.border,
          borderBottomWidth: noBorder ? 0 : StyleSheet.hairlineWidth,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {left ? <View style={[styles.left, { marginRight: gap }]}>{left}</View> : null}

      <View style={styles.middle}>
        <AppText
          variant="title-sm"
          weight="bold"
          numberOfLines={titleMaxLines}
          color={colors.text}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            variant="body-sm"
            color={colors.textSecondary}
            numberOfLines={subtitleMaxLines}
            style={{ marginTop: 2 }}
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {(rightText || right) ? (
        <View style={[styles.right, { marginLeft: gap }]}>
          {rightText ? (
            <AppText
              variant="body"
              weight="semibold"
              color={rightColor ?? colors.text}
              numberOfLines={rightMaxLines}
              align="right"
            >
              {rightText}
            </AppText>
          ) : null}
          {right}
        </View>
      ) : null}
    </View>
  );

  if (!showRipple) return content;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      {content}
    </Pressable>
  );
});

AppListItem.displayName = 'AppListItem';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: BorderRadius.md,
    // Wrap children if everything gets too wide (rare, but
    // protects against absurdly long titles on small phones).
    flexWrap: 'wrap',
  },
  left: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    maxWidth: '45%',
  },
});

export default AppListItem;
