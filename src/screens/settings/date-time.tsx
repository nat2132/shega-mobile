import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle2, Calendar, Clock } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { formatDate, formatTime } from '@/utils/date-utils';
import { AppText } from '@/components/ui';
import { getSettingsGlass } from './glass-settings';
import { useTutorial, TutorialTarget, TutorialButton } from '@/tutorials';
import { dateTimeTutorial } from '@/tutorials/definitions';

const DateTimeSettings = () => {
  const { calendarType, setCalendarType, timeSystem, setTimeSystem, language, colors, t } = useSettings();
  const G = getSettingsGlass(colors);

  const getEthiopianDate = () => formatDate(new Date(), 'ethiopian', language);
  const getGregorianDate = () => formatDate(new Date(), 'gregorian', language);

  const sample = new Date().toISOString();
  const devicePreview = formatTime(sample, 'device', language);
  const ethiopianPreview = formatTime(sample, 'ethiopian', language);
  const tutorial = useTutorial({ tutorial: dateTimeTutorial });

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: -80, left: -60, width: 200, height: 200, borderRadius: 100 }]} />
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, bottom: -40, right: -30, width: 160, height: 160, borderRadius: 80 }]} />
      </View>
      <TutorialTarget id="dt-header">
      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('settings.date_time')}</AppText>
      <AppText variant="display" weight="bold" style={[styles.mainTitle, { color: G.fg }]} numberOfLines={2}>{t('settings.date_time_format')}</AppText>
      <AppText variant="body-sm" weight="medium" style={[styles.subtitle, { color: G.fgSecondary }]} numberOfLines={3}>{t('settings.date_time_desc')}</AppText>
      </TutorialTarget>

      {/* Calendar Section */}
      <TutorialTarget id="dt-calendar">
      <AppText variant="body" weight="bold" style={[styles.sectionLabel, { color: G.fg }]} numberOfLines={1}>{t('settings.calendar')}</AppText>

      <TouchableOpacity
        style={[styles.card, { borderColor: G.border }, calendarType === 'ethiopian' && [styles.selectedCard, { borderColor: G.fg, backgroundColor: G.bgCard }]]}
        onPress={() => setCalendarType('ethiopian')}
        activeOpacity={0.85}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, { backgroundColor: G.bg }]}>
            <Calendar size={22} color={calendarType === 'ethiopian' ? G.fg : G.fgSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title-sm" weight="bold" style={[styles.cardTitle, { color: G.fg }]} numberOfLines={1}>{t('settings.ethiopian')}</AppText>
            <AppText variant="body-sm" weight="medium" style={[styles.previewText, { color: G.fgSecondary }]} numberOfLines={2}>{getEthiopianDate()}</AppText>
          </View>
        </View>
        {calendarType === 'ethiopian' ? <CheckCircle2 color={G.fg} size={24} /> : <View style={[styles.radioOutline, { borderColor: G.border }]} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, { borderColor: G.border }, calendarType === 'gregorian' && [styles.selectedCard, { borderColor: G.fg, backgroundColor: G.bgCard }]]}
        onPress={() => setCalendarType('gregorian')}
        activeOpacity={0.85}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, { backgroundColor: G.bg }]}>
            <Calendar size={22} color={calendarType === 'gregorian' ? G.fg : G.fgSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title-sm" weight="bold" style={[styles.cardTitle, { color: G.fg }]} numberOfLines={1}>{t('settings.gregorian')}</AppText>
            <AppText variant="body-sm" weight="medium" style={[styles.previewText, { color: G.fgSecondary }]} numberOfLines={2}>{getGregorianDate()}</AppText>
          </View>
        </View>
        {calendarType === 'gregorian' ? <CheckCircle2 color={G.fg} size={24} /> : <View style={[styles.radioOutline, { borderColor: G.border }]} />}
      </TouchableOpacity>
      </TutorialTarget>

      {/* Time Section */}
      <TutorialTarget id="dt-time">
      <AppText variant="body" weight="bold" style={[styles.sectionLabel, { color: G.fg, marginTop: 28 }]} numberOfLines={1}>{t('settings.time_system')}</AppText>

      <TouchableOpacity
        style={[styles.card, { borderColor: G.border }, timeSystem === 'device' && [styles.selectedCard, { borderColor: G.fg, backgroundColor: G.bgCard }]]}
        onPress={() => setTimeSystem('device')}
        activeOpacity={0.85}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, { backgroundColor: G.bg }]}>
            <Clock size={22} color={timeSystem === 'device' ? G.fg : G.fgSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title-sm" weight="bold" style={[styles.cardTitle, { color: G.fg }]} numberOfLines={1}>{t('settings.time_device')}</AppText>
            <AppText variant="body-sm" weight="medium" style={[styles.previewText, { color: G.fgSecondary }]} numberOfLines={2}>{devicePreview}</AppText>
          </View>
        </View>
        {timeSystem === 'device' ? <CheckCircle2 color={G.fg} size={24} /> : <View style={[styles.radioOutline, { borderColor: G.border }]} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, { borderColor: G.border }, timeSystem === 'ethiopian' && [styles.selectedCard, { borderColor: G.fg, backgroundColor: G.bgCard }]]}
        onPress={() => setTimeSystem('ethiopian')}
        activeOpacity={0.85}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, { backgroundColor: G.bg }]}>
            <Clock size={22} color={timeSystem === 'ethiopian' ? G.fg : G.fgSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title-sm" weight="bold" style={[styles.cardTitle, { color: G.fg }]} numberOfLines={1}>{t('settings.time_ethiopian')}</AppText>
            <AppText variant="body-sm" weight="medium" style={[styles.previewText, { color: G.fgSecondary }]} numberOfLines={2}>{ethiopianPreview}</AppText>
          </View>
        </View>
        {timeSystem === 'ethiopian' ? <CheckCircle2 color={G.fg} size={24} /> : <View style={[styles.radioOutline, { borderColor: G.border }]} />}
      </TouchableOpacity>
      </TutorialTarget>

      <TutorialTarget id="dt-save-btn">
      <View style={[styles.infoBox, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <AppText variant="body-sm" weight="medium" style={[styles.infoText, { color: G.fgSecondary }]} numberOfLines={3}>
          {t('settings.currently_active')}{' '}
          <AppText variant="body-sm" weight="bold" style={[styles.infoHighlight, { color: G.fg }]} numberOfLines={1}>
            {calendarType === 'ethiopian' ? t('settings.ethiopian') : t('settings.gregorian')} & {timeSystem === 'ethiopian' ? t('settings.time_ethiopian') : t('settings.time_device')}
          </AppText>
        </AppText>
      </View>
      </TutorialTarget>

      <AppText variant="caption" weight="medium" style={[styles.note, { color: G.fgSecondary, textAlign: 'center', marginTop: 10 }]} numberOfLines={2}>{t('settings.immediate_apply')}</AppText>
      <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 100 }}>
        <TutorialButton tutorialId="date-time-settings" screenName={t('settings.date_time')} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 25 },
  headerLabel: { fontSize: 12, fontFamily: Fonts.bold, fontWeight: '700', letterSpacing: 1.5, marginTop: 20, color: '#888' },
  mainTitle: { fontSize: 26, fontFamily: Fonts.bold, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#8E8E8E', fontFamily: Fonts.medium, marginBottom: 5 },
  sectionLabel: { fontSize: 14, fontFamily: Fonts.bold, marginBottom: 12, marginTop: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 18,
    borderRadius: 16, borderWidth: 1.5, marginBottom: 12, overflow: 'hidden',
  },
  selectedCard: { borderWidth: 2 },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  cardTitle: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: '700', marginBottom: 4 },
  previewText: { fontSize: 13, fontFamily: Fonts.medium },
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

export default DateTimeSettings;