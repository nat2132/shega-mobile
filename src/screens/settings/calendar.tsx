import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CheckCircle2, Calendar } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { formatDate } from '@/utils/date-utils';

type CalendarId = 'ethiopian' | 'gregorian';

const CalendarSettings = () => {
  const { calendarType, setCalendarType, language, colors, t } = useSettings();
  const handleSelect = (id: CalendarId) => {
    setCalendarType(id);
  };

  const getEthiopianDate = () => formatDate(new Date(), 'ethiopian', language);
  const getGregorianDate = () => formatDate(new Date(), 'gregorian', language);

  const CalendarOption = ({ id, title, dateDisplay }: { id: CalendarId; title: string; dateDisplay: string }) => {
    const isSelected = calendarType === id;
    return (
      <TouchableOpacity
        style={[styles.card, { borderColor: colors.border }, isSelected && [styles.selectedCard, { borderColor: colors.text, backgroundColor: colors.card }]]}
        onPress={() => handleSelect(id)}
        activeOpacity={0.85}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.calIconBox, { backgroundColor: colors.background }]}>
            <Calendar size={22} color={isSelected ? colors.text : colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.cardDate, { color: colors.textSecondary }]}>{dateDisplay}</Text>
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
      <Text style={[styles.headerLabel, { color: colors.textSecondary }]}>{t('settings.calendar_settings')}</Text>
      <Text style={[styles.mainTitle, { color: colors.text }]}>{t('settings.date_format')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('settings.date_format_desc')}</Text>

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

      <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          📅 {t('settings.currently_active')} <Text style={[styles.infoHighlight, { color: colors.text }]}>{calendarType === 'ethiopian' ? t('settings.ethiopian') : t('settings.gregorian')}</Text>
        </Text>
      </View>

      <Text style={[styles.note, { color: colors.textSecondary, textAlign: 'center', marginTop: 10 }]}>{t('settings.immediate_apply')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 25 },
  headerLabel: { fontSize: 12, fontFamily: Fonts.bold, fontWeight: '700', letterSpacing: 1.5, marginTop: 20, color: '#888' },
  mainTitle: { fontSize: 26, fontFamily: Fonts.bold, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#8E8E93', fontFamily: Fonts.medium, marginBottom: 25 },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 18,
    borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E5EA', marginBottom: 15
  },
  selectedCard: { borderColor: '#000', borderWidth: 2, backgroundColor: '#FAFAFA' },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  calIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center'
  },
  cardTitle: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: '700', marginBottom: 4 },
  cardDate: { color: '#8E8E93', fontSize: 13, fontFamily: Fonts.medium },
  radioOutline: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#C0C0C0' },
  infoBox: {
    backgroundColor: '#F8F8FA', borderRadius: 12, padding: 14,
    marginVertical: 20, borderWidth: 1, borderColor: '#EAEAF0'
  },
  infoText: { fontSize: 13, fontFamily: Fonts.medium, color: '#555' },
  infoHighlight: { fontFamily: Fonts.bold, fontWeight: '700', color: '#000' },
  saveButton: { backgroundColor: '#000', padding: 18, borderRadius: 30, alignItems: 'center', marginTop: 'auto', marginBottom: 30 },
  saveButtonText: { color: '#FFF', fontSize: 16, fontFamily: Fonts.bold, fontWeight: '700' },
});

export default CalendarSettings;