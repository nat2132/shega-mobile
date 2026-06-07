import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import {
  fromEthiopianToDate,
  getEthiopianDaysInMonth,
  getEthiopianMonthNames,
  toEthiopianDate
} from '@/utils/date-utils';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from '@/components/ui';
interface CustomDatePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (date: string) => void;
  initialDate?: string;
  minDate?: string;
  maxDate?: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  visible,
  onClose,
  onSelectDate,
  initialDate,
  minDate,
  maxDate,
}) => {
  const { colors, calendarType, language, t } = useSettings();
  const isEth = calendarType === 'ethiopian';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewState, setViewState] = useState({ month: 1, year: 2024 });

  // State for navigational view (Month/Year)
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [showYearSelector, setShowYearSelector] = useState(false);

  // Parse min/max dates for constraint checking
  const minDateObj = minDate ? (() => {
    const parts = minDate.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return null;
  })() : null;

  const maxDateObj = maxDate ? (() => {
    const parts = maxDate.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setHours(23, 59, 59, 999);
      return d;
    }
    return null;
  })() : null;

  useEffect(() => {
    if (visible) {
      let initDate: Date;
      if (initialDate) {
        // Parse "YYYY-MM-DD" safely using local time to avoid timezone shifts
        const parts = initialDate.split('-');
        if (parts.length === 3) {
          const [y, m, d] = parts.map(Number);
          initDate = new Date(y, m - 1, d);
        } else {
          initDate = new Date(initialDate.replace(/-/g, '/'));
        }
      } else {
        initDate = new Date();
      }

      if (isNaN(initDate.getTime())) {
        initDate = new Date();
      }
      
      // Normalize time to midnight for consistent comparisons
      initDate.setHours(0, 0, 0, 0);
      setSelectedDate(initDate);
      
      const eth = toEthiopianDate(initDate);
      if (isEth) {
        setViewState({ month: eth.month, year: eth.year });
      } else {
        setViewState({ month: initDate.getMonth() + 1, year: initDate.getFullYear() });
      }
    }
  }, [visible, initialDate, isEth, calendarType]);

  // Derived properties for rendering
  const monthNames = isEth 
    ? getEthiopianMonthNames(language) 
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const daysInMonth = isEth 
    ? getEthiopianDaysInMonth(viewState.year, viewState.month) 
    : new Date(viewState.year, viewState.month, 0).getDate();

  const firstDayOfMonth = isEth 
    ? fromEthiopianToDate(viewState.year, viewState.month, 1).getDay()
    : new Date(viewState.year, viewState.month - 1, 1).getDay();

  const prevMonth = () => {
    if (isEth) {
      let m = viewState.month - 1;
      let y = viewState.year;
      if (m < 1) { m = 13; y--; }
      setViewState({ month: m, year: y });
    } else {
      let m = viewState.month - 1;
      let y = viewState.year;
      if (m < 1) { m = 12; y--; }
      setViewState({ month: m, year: y });
    }
  };

  const nextMonth = () => {
    if (isEth) {
      let m = viewState.month + 1;
      let y = viewState.year;
      if (m > 13) { m = 1; y++; }
      setViewState({ month: m, year: y });
    } else {
      let m = viewState.month + 1;
      let y = viewState.year;
      if (m > 12) { m = 1; y++; }
      setViewState({ month: m, year: y });
    }
  };

  const handleSelectDay = (day: number) => {
    const newDate = isEth 
      ? fromEthiopianToDate(viewState.year, viewState.month, day)
      : new Date(viewState.year, viewState.month - 1, day);
    
    // Enforce min/max date constraints
    if (minDateObj && newDate < minDateObj) return;
    if (maxDateObj && newDate > maxDateObj) return;
    
    setSelectedDate(newDate);
    // Do NOT update viewState here, let the user stay in the current month view
  };

  const handleConfirm = () => {
    if (selectedDate) {
      // Return YYYY-MM-DD in local time
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      onSelectDate(`${year}-${month}-${day}`);
    }
    onClose();
  };

  const renderDays = () => {
    const days = [];
    // Empty slots for days before the 1st
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCircle} />);
    }

    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
        let isSelected = false;
        let isToday = false;

        // Today check
        const now = new Date();
        if (isEth) {
          const ethToday = toEthiopianDate(now);
          isToday = ethToday.day === i && ethToday.month === viewState.month && ethToday.year === viewState.year;
        } else {
          isToday = now.getDate() === i && now.getMonth() === viewState.month - 1 && now.getFullYear() === viewState.year;
        }

        // Check if this day is within min/max bounds
        const dayDate = isEth 
          ? fromEthiopianToDate(viewState.year, viewState.month, i)
          : new Date(viewState.year, viewState.month - 1, i);
        const isDisabled = (minDateObj && dayDate < minDateObj) || (maxDateObj && dayDate > maxDateObj);

        if (selectedDate) {
          if (isEth) {
            const eth = toEthiopianDate(selectedDate);
            isSelected = eth.day === i && eth.month === viewState.month && eth.year === viewState.year;
          } else {
            isSelected = selectedDate.getDate() === i &&
                         selectedDate.getMonth() === viewState.month - 1 &&
                         selectedDate.getFullYear() === viewState.year;
          }
        }

        days.push(
            <TouchableOpacity
                key={`day-${i}`}
                onPress={() => !isDisabled && handleSelectDay(i)}
                activeOpacity={isDisabled ? 0.5 : 0.7}
                style={[
                    styles.dayCircle,
                    isSelected && { 
                      backgroundColor: colors.text, 
                      elevation: 4, 
                      shadowColor: colors.text, 
                      shadowOpacity: 0.3, 
                      shadowRadius: 5, 
                      shadowOffset: {width: 0, height: 2} 
                    },
                    isToday && !isSelected && !isDisabled && { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primary + '10' }
                ]}
            >
                <AppText variant="body" weight={(isSelected || isToday) ? 'bold' : 'medium'} style={[{ 
                    color: isDisabled ? colors.textSecondary + '60' : (isSelected ? colors.background : isToday ? colors.primary : colors.text), 
                }]} numberOfLines={1}>
                    {i}
                </AppText>
            </TouchableOpacity>
        );
    }
    return days;
  };

  const selectedFormatted = selectedDate ? (isEth ? toEthiopianDate(selectedDate) : { day: selectedDate.getDate(), month: selectedDate.getMonth() + 1, year: selectedDate.getFullYear() }) : null;
  const selectedLabel = selectedFormatted ? `${monthNames[selectedFormatted.month - 1]} ${selectedFormatted.day}, ${selectedFormatted.year}` : '';

  const currentYear = isEth ? toEthiopianDate(new Date()).year : new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 30; i <= currentYear + 10; i++) years.push(i);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.calendarContainer, { backgroundColor: colors.card }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
            
            <View style={styles.headerTitleContainer}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity 
                    style={[styles.headerSubBox, showMonthSelector && { backgroundColor: colors.primary + '15' }]} 
                    onPress={() => { setShowMonthSelector(!showMonthSelector); setShowYearSelector(false); }}
                  >
                    <AppText variant="title-sm" weight="bold" style={[styles.calendarHeader, { color: colors.text }]} numberOfLines={1}>
                      {monthNames[viewState.month - 1]}
                    </AppText>
                    <ChevronRight size={16} color={colors.textSecondary} style={{ transform: [{ rotate: showMonthSelector ? '90deg' : '0deg' }] }} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.headerSubBox, showYearSelector && { backgroundColor: colors.primary + '15' }, { marginLeft: 10 }]} 
                    onPress={() => { setShowYearSelector(!showYearSelector); setShowMonthSelector(false); }}
                  >
                    <AppText variant="title-sm" weight="bold" style={[styles.calendarHeader, { color: colors.text }]} numberOfLines={1}>
                      {viewState.year}
                    </AppText>
                    <ChevronRight size={16} color={colors.textSecondary} style={{ transform: [{ rotate: showYearSelector ? '90deg' : '0deg' }] }} />
                  </TouchableOpacity>
                </View>
                <AppText variant="body-sm" weight="bold" style={{ fontSize: 13, color: colors.primary, fontFamily: Fonts.bold, marginTop: 4, letterSpacing: 0.5 }} numberOfLines={1}>
                  {selectedLabel}
                </AppText>
              </View>
            </View>

            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <ChevronRight size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {showMonthSelector && (
            <View style={styles.selectorGrid}>
              {monthNames.map((m, idx) => (
                <TouchableOpacity 
                  key={m} 
                  style={[styles.selectorItem, viewState.month === idx + 1 && { backgroundColor: colors.text }]}
                  onPress={() => { setViewState({ ...viewState, month: idx + 1 }); setShowMonthSelector(false); }}
                >
                  <AppText variant="body" weight="semibold" style={[styles.selectorText, { color: viewState.month === idx + 1 ? colors.background : colors.text }]} numberOfLines={1}>{m.substring(0, 3)}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {showYearSelector && (
            <ScrollView style={styles.yearList} showsVerticalScrollIndicator={false}>
              <View style={styles.yearGrid}>
                {years.map(y => (
                  <TouchableOpacity 
                    key={y} 
                    style={[styles.selectorItem, viewState.year === y && { backgroundColor: colors.text }]}
                    onPress={() => { setViewState({ ...viewState, year: y }); setShowYearSelector(false); }}
                  >
                    <AppText variant="body" weight="semibold" style={[styles.selectorText, { color: viewState.year === y ? colors.background : colors.text }]} numberOfLines={1}>{y}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
          
          {!showMonthSelector && !showYearSelector && (
            <>
              <View style={styles.weekDaysRow}>
                {['S','M','T','W','T','F','S'].map((day, idx) => (
                   <AppText key={`wd-${idx}`} variant="caption" weight="bold" style={[styles.weekDayText, { color: colors.textSecondary }]} numberOfLines={1}>{day}</AppText>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {renderDays()}
              </View>
            </>
          )}

          <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => { onSelectDate(''); onClose(); }} style={[styles.clearBtn, { borderColor: colors.border }]}>
                 <AppText variant="body" weight="bold" style={[styles.cancelBtnText, { color: colors.textSecondary }]} numberOfLines={1}>{t('common.clear')}</AppText>
              </TouchableOpacity>
              <View style={{flexDirection: 'row', gap: 10, flex: 1, justifyContent: 'flex-end'}}>
                <TouchableOpacity onPress={onClose} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                   <AppText variant="body" weight="bold" style={[{ color: colors.text }, styles.cancelBtnText]} numberOfLines={1}>{t('common.cancel')}</AppText>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirm} style={[styles.selectBtn, { backgroundColor: colors.text }]}>
                  <AppText variant="body" weight="bold" style={{ color: colors.background, fontFamily: Fonts.bold }} numberOfLines={1}>{t('common.select')}</AppText>
                </TouchableOpacity>
             </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    width: '90%',
    borderRadius: 20,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  navBtn: {
    padding: 5,
  },
  calendarHeader: {
    fontFamily: Fonts.bold,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  headerSubBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  weekDayText: {
    fontFamily: Fonts.medium,
    width: 35,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 20,
  },
  dayCircle: {
    width: '14.2%', // roughly 100/7
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginVertical: 2,
  },
  selectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  yearList: {
    maxHeight: 250,
    marginVertical: 10,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  selectorItem: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  selectorText: {
    fontFamily: Fonts.semibold,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearBtn: {
    padding: 10,
    borderRadius: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontFamily: Fonts.semibold,
  },
  selectBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
});
