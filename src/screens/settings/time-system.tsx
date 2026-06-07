import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle2, Clock } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { formatTime } from '@/utils/date-utils';
import { AppText, AppCard, AppButton, AppListItem, AppRow } from '@/components/ui';
type TimeSystemId = 'device' | 'ethiopian';

const TimeSystemSettings = () => {
  const { timeSystem, setTimeSystem, language, colors, t } = useSettings();

  const handleSelect = (id: TimeSystemId) => {
    setTimeSystem(id);
  };

  // Live preview strings: today's time in the chosen format. We feed
  // the current ISO timestamp into `formatTime` so the user can see
  // exactly how their selection will look before confirming.
  const sample = new Date().toISOString();
  const devicePreview = formatTime(sample, 'device', language);
  const ethiopianPreview = formatTime(sample, 'ethiopian', language);

  const TimeOption = ({
    id,
    title,
    preview,
  }: {
    id: TimeSystemId;
    title: string;
    preview: string;
  }) => {
    const isSelected = timeSystem === id;
    return (
      <TouchableOpacity
        style={[
          styles.card,
          { borderColor: colors.border },
          isSelected && [styles.selectedCard, { borderColor: colors.text, backgroundColor: colors.card }],
        ]}
        onPress={() => handleSelect(id)}
        activeOpacity={0.85}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, { backgroundColor: colors.background }]}>
            <Clock size={22} color={isSelected ? colors.text : colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title-sm" weight="bold" style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{title}</AppText>
            <AppText variant="body-sm" weight="medium" style={[styles.previewText, { color: colors.textSecondary }]} numberOfLines={2}>{preview}</AppText>
          </View>
        </View>
        {isSelected ? (
          <CheckCircle2 color={colors.text} size={24} />
        ) : (
          <View style={[styles.radioOutline, { borderColor: colors.border }]} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: colors.textSecondary }]} numberOfLines={2}>{t('settings.time_system_settings')}</AppText>
      <AppText variant="display" weight="bold" style={[styles.mainTitle, { color: colors.text }]} numberOfLines={2}>{t('settings.time_format')}</AppText>
      <AppText variant="body-sm" weight="medium" style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={3}>{t('settings.time_format_desc')}</AppText>

      <TimeOption
        id="device"
        title={t('settings.time_device')}
        preview={`${t('settings.time_device_preview')}: ${devicePreview}`}
      />
      <TimeOption
        id="ethiopian"
        title={t('settings.time_ethiopian')}
        preview={`${t('settings.time_ethiopian_preview')}: ${ethiopianPreview}`}
      />

      <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <AppText variant="body-sm" weight="medium" style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={3}>
          ⏰ {t('settings.currently_active')}{' '}
          <AppText variant="body-sm" weight="bold" style={[styles.infoHighlight, { color: colors.text }]} numberOfLines={1}>
            {timeSystem === 'ethiopian' ? t('settings.time_ethiopian') : t('settings.time_device')}
          </AppText>
        </AppText>
      </View>

      <AppText variant="caption" weight="medium" style={[styles.note, { color: colors.textSecondary, textAlign: 'center', marginTop: 10 }]} numberOfLines={2}>
        {t('settings.immediate_apply')}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 25 },
  headerLabel: { fontSize: 12, fontFamily: Fonts.bold, fontWeight: '700', letterSpacing: 1.5, marginTop: 20, color: '#888' },
  mainTitle: { fontSize: 26, fontFamily: Fonts.bold, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#8E8E93', fontFamily: Fonts.medium, marginBottom: 25 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    marginBottom: 15,
  },
  selectedCard: { borderColor: '#000', borderWidth: 2, backgroundColor: '#FAFAFA' },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: '700', marginBottom: 4 },
  previewText: { color: '#8E8E93', fontSize: 13, fontFamily: Fonts.medium },
  radioOutline: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#C0C0C0' },
  infoBox: {
    backgroundColor: '#F8F8FA',
    borderRadius: 12,
    padding: 14,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#EAEAF0',
  },
  infoText: { fontSize: 13, fontFamily: Fonts.medium, color: '#555' },
  infoHighlight: { fontFamily: Fonts.bold, fontWeight: '700', color: '#000' },
  note: { fontSize: 12, fontFamily: Fonts.medium, color: '#8E8E93' },
});

export default TimeSystemSettings;
