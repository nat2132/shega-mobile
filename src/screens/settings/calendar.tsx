import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle2, Calendar } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { formatDate } from '@/utils/date-utils';
import { AppText} from '@/components/ui';
import { getSettingsGlass } from './glass-settings';
type CalendarId = 'ethiopian' | 'gregorian';

const CalendarSettings = () => {
  const { calendarType, setCalendarType, language, colors, t } = useSettings();
  const G = getSettingsGlass(colors);
  const handleSelect = (id: CalendarId) => {
    setCalendarType(id);
  };

  const getEthiopianDate = () => formatDate(new Date(), 'ethiopian', language);
  const getGregorianDate = () => formatDate(new Date(), 'gregorian', language);

  const CalendarOption = ({ id, title, dateDisplay }: { id: CalendarId; title: string; dateDisplay: string }) => {
    const isSelected = calendarType === id;
    return (
      <TouchableOpacity
        style={[styles.card, { borderColor: G.border }, isSelected && [styles.selectedCard, { borderColor: G.fg, backgroundColor: G.bgCard }]]}
        onPress={() => handleSelect(id)}
        activeOpacity={0.85}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.calIconBox, { backgroundColor: G.bg }]}>
            <Calendar size={22} color={isSelected ? G.fg : G.fgSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title-sm" weight="bold" style={[styles.cardTitle, { color: G.fg }]} numberOfLines={1}>{title}</AppText>
            <AppText variant="body-sm" weight="medium" style={[styles.cardDate, { color: G.fgSecondary }]} numberOfLines={2}>{dateDisplay}</AppText>
          </View>
        </View>
        {isSelected ? (
          <CheckCircle2 color={G.fg} size={24} />
        ) : (
          <View style={[styles.radioOutline, { borderColor: G.border }]} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: -80, left: -60, width: 200, height: 200, borderRadius: 100 }]} />
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, bottom: -40, right: -30, width: 160, height: 160, borderRadius: 80 }]} />
      </View>
      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('settings.calendar_settings')}</AppText>
      <AppText variant="display" weight="bold" style={[styles.mainTitle, { color: G.fg }]} numberOfLines={2}>{t('settings.date_format')}</AppText>
      <AppText variant="body-sm" weight="medium" style={[styles.subtitle, { color: G.fgSecondary }]} numberOfLines={3}>{t('settings.date_format_desc')}</AppText>

      <CalendarOption
        id="ethiopian"
        title={t('settings.ethiopian')}
        dateDisplay={getEthiopianDate()}
      />
      <CalendarOption
        id="gregorian"
        title={t('settings.gregorian')}
        dateDisplay={getGregorianDate()}
      />

      <View style={[styles.infoBox, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <AppText variant="body-sm" weight="medium" style={[styles.infoText, { color: G.fgSecondary }]} numberOfLines={3}>
          📅 {t('settings.currently_active')} <AppText variant="body-sm" weight="bold" style={[styles.infoHighlight, { color: G.fg }]} numberOfLines={1}>{calendarType === 'ethiopian' ? t('settings.ethiopian') : t('settings.gregorian')}</AppText>
        </AppText>
      </View>

      <AppText variant="caption" weight="medium" style={[styles.note, { color: G.fgSecondary, textAlign: 'center', marginTop: 10 }]} numberOfLines={2}>{t('settings.immediate_apply')}</AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', paddingBottom: 25 },
  headerLabel: { fontSize: 12, fontFamily: Fonts.bold, fontWeight: '700', letterSpacing: 1.5, marginTop: 20, color: '#888' },
  mainTitle: { fontSize: 26, fontFamily: Fonts.bold, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#8E8E93', fontFamily: Fonts.medium, marginBottom: 25 },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 18,
    borderRadius: 16, borderWidth: 1.5, marginBottom: 15, overflow: 'hidden',
  },
  selectedCard: { borderWidth: 2 },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  calIconBox: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center'
  },
  cardTitle: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: '700', marginBottom: 4 },
  cardDate: { color: '#8E8E93', fontSize: 13, fontFamily: Fonts.medium },
  radioOutline: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5 },
  infoBox: {
    borderRadius: 12, padding: 14,
    marginVertical: 20, borderWidth: 1, overflow: 'hidden',
  },
  infoText: { fontSize: 13, fontFamily: Fonts.medium },
  infoHighlight: { fontFamily: Fonts.bold, fontWeight: '700' },
  note: { fontSize: 12, fontFamily: Fonts.medium },
  glowWash: { position: 'absolute' },
});

export default CalendarSettings;