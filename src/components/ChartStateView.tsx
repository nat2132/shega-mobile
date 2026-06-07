// ChartStateView — empty / error placeholders for charts. Replaces
// the old "show a single icon + 'no data' text" inline pattern with a
// consistent, theme-aware component that matches the dimensions of
// the real chart (so swapping in a chart later doesn't shift layout).

import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { AlertCircle, BarChart3, Inbox } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { Fonts } from '@/constants/theme';
import { AppText } from '@/components/ui';
interface ChartEmptyProps {
  height?: number;
  message?: string;
  icon?: 'inbox' | 'chart';
  style?: ViewStyle;
}

export const ChartEmpty: React.FC<ChartEmptyProps> = React.memo(({
  height = 150,
  message,
  icon = 'chart',
  style,
}) => {
  const { colors, t } = useSettings();
  const Icon = icon === 'inbox' ? Inbox : BarChart3;
  return (
    <View
      style={[
        {
          height,
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          opacity: 0.8,
        },
        style,
      ]}
    >
      <Icon size={28} color={colors.border} strokeWidth={1.5} />
      <AppText variant="body-sm" weight="medium" style={[styles.text, { color: colors.textSecondary }]} numberOfLines={3}>
        {message ?? t('common.no_data')}
      </AppText>
    </View>
  );
});
ChartEmpty.displayName = 'ChartEmpty';

interface ChartErrorProps {
  height?: number;
  message?: string;
  style?: ViewStyle;
}

export const ChartError: React.FC<ChartErrorProps> = React.memo(({
  height = 150,
  message,
  style,
}) => {
  const { colors, t } = useSettings();
  return (
    <View
      style={[
        {
          height,
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
        },
        style,
      ]}
    >
      <AlertCircle size={26} color="#FF3B30" strokeWidth={1.5} />
      <AppText variant="body-sm" weight="medium" style={[styles.text, { color: colors.textSecondary }]} numberOfLines={3}>
        {message ?? t('common.error')}
      </AppText>
    </View>
  );
});
ChartError.displayName = 'ChartError';

const styles = StyleSheet.create({
  text: {

    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
});
