// AppRow — a language-safe label/value pair row.
//
// The most common breakage pattern in the existing codebase is
// `label: value` rows where the label sits on the left with a fixed
// width and the value on the right. When the value text gets
// longer (e.g. "Negotiated Discount Amount" in English becomes
// "የተደራጀ ቅናሽ መጠን" in Amharic) the value overflows or pushes
// the label out of view.
//
// AppRow uses flex distribution instead:
//   * The label and value both have `flexShrink: 1` so they can
//     give way to each other.
//   * The label has `flex: 1` and a configurable `maxWidth` (default
//     55%) so the value column always has room.
//   * The value column is `flex: 0` with `maxWidth: 45%` and
//     ellipsizes at the tail.
//   * `gap` between label and value is configurable (default 8).
//   * `align` controls vertical alignment (default 'center').

import React from 'react';
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from './AppText';

export interface AppRowProps {
  /** Left-side label text. Pass as a child to render ReactNode instead. */
  label: string;
  /** Right-side value text. Pass as `children` to render ReactNode. */
  value?: string;
  /** Variant of the value text. Default `'body'`. */
  valueVariant?: 'body-sm' | 'body' | 'body-lg' | 'title-sm' | 'title';
  /** Weight of the value text. Default `'semibold'`. */
  valueWeight?: 'regular' | 'medium' | 'semibold' | 'bold';
  /** Color of the value text. Default `colors.text`. */
  valueColor?: string;
  /** Color of the label. Default `colors.textSecondary`. */
  labelColor?: string;
  /** Maximum lines for the value. Default `2`. */
  valueMaxLines?: number;
  /** Maximum lines for the label. Default `1`. */
  labelMaxLines?: number;
  /** Vertical alignment. Default `'center'`. */
  align?: ViewStyle['alignItems'];
  /** Gap between label and value. Default `12`. */
  gap?: number;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
  /** Optional children rendered to the right of the label, before the value. */
  children?: React.ReactNode;
  /** If the row should wrap when content overflows. Default `true`. */
  wrap?: boolean;
}

export const AppRow: React.FC<AppRowProps> = React.memo(({
  label,
  value,
  valueVariant = 'body',
  valueWeight = 'semibold',
  valueColor,
  labelColor,
  valueMaxLines = 2,
  labelMaxLines = 1,
  align = 'center',
  gap = 12,
  style,
  children,
  wrap = true,
}) => {
  const { colors } = useSettings();
  return (
    <View
      style={[
        styles.row,
        { alignItems: align, rowGap: gap, columnGap: gap, flexWrap: wrap ? 'wrap' : 'nowrap' },
        style,
      ]}
    >
      <AppText
        variant="body"
        color={labelColor ?? colors.textSecondary}
        numberOfLines={labelMaxLines}
        style={styles.label}
      >
        {label}
      </AppText>
      {children}
      {value ? (
        <AppText
          variant={valueVariant}
          weight={valueWeight}
          color={valueColor ?? colors.text}
          numberOfLines={valueMaxLines}
          align="right"
          style={styles.value}
        >
          {value}
        </AppText>
      ) : null}
    </View>
  );
});

AppRow.displayName = 'AppRow';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    width: '100%',
    minWidth: 0,
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  value: {
    flexShrink: 1,
    maxWidth: '60%',
  },
});

export default AppRow;
