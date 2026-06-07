import { CustomDatePicker } from '@/components/CustomDatePicker';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { getActivityFeed, getAdjustmentById, getExpenseById, getSaleById } from '@/database/db';
import { formatDate, formatEthiopianTime, formatTime } from '@/utils/date-utils';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
    Calendar,
    ChevronLeft,
    History,
    RefreshCw,
    Search,
    ShoppingBag,
    TrendingDown,
    TrendingUp
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Modal,
    Platform,
    TextInput as RNTextInput,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { AppText, AppListItem, AppRow, AppCard, AppButton } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import Animated, {
    FadeInDown
} from 'react-native-reanimated';
import AdjustmentDetailsScreen from '../adjustement/adjustment-details';
import ExpenseDetailsScreen from '../expense/expense-details';
import SaleDetailsScreen from '../sales/sales-details';
const { width } = Dimensions.get('window');

interface ActivityLedgerProps {
  onClose?: () => void;
}

const ActivityLedgerScreen: React.FC<ActivityLedgerProps> = ({ onClose }) => {
  const { colors, calendarType, language, timeSystem, t, theme } = useSettings();
  const [dateModalVisible, setDateModalVisible] = useState(false);
  
  const [activities, setActivities] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [selectedAdjustment, setSelectedAdjustment] = useState<any>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const sanitizeSearchQuery = (query: string) => {
    // Limit query length and remove potentially dangerous characters
    return query.trim().substring(0, 100);
  };

  const validateDate = (date: string) => {
    if (!date) return true; // Empty is ok (means no filter)
    // Validate ISO date format YYYY-MM-DD or DD/MM/YYYY
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    const displayRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    return isoRegex.test(date) || displayRegex.test(date);
  };

  const loadData = useCallback(() => {
    const sanitizedQuery = sanitizeSearchQuery(searchQuery);
    
    if (!validateDate(selectedDate)) {
      setSearchError(t('dashboard.invalid_date_format'));
      return;
    }
    setSearchError(null);
    
    const data = getActivityFeed({
      search: sanitizedQuery,
      date: selectedDate,
      limit: 100,
    });
    
    // Group by date
    const grouped: any[] = [];
    const dates: Record<string, any[]> = {};

data.forEach((item: any) => {
       const dateKey = item?.createdAt ? String(item.createdAt).split(' ')[0] : '';
       if (dateKey && !dates[dateKey]) {
         dates[dateKey] = [];
       }
       if (dateKey) dates[dateKey].push(item);
     });

    Object.keys(dates).sort((a, b) => b.localeCompare(a)).forEach(date => {
      grouped.push({ type: 'header', date });
      dates[date].forEach(item => grouped.push({ type: 'item', ...item }));
    });

    setActivities(grouped);
  }, [searchQuery, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const activityKeyExtractor = React.useCallback(
    (item: any, index: number) => `${item.category}-${item.id}-${index}`,
    [],
  );

  const renderActivityItem = React.useCallback(({ item }: { item: any }) => {
    if (item.type === 'header') {
      return (
        <View style={[styles.dateHeader, { backgroundColor: colors.background }]}>
          <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.dateHeaderText, { color: colors.textSecondary }]} numberOfLines={1}>
            {formatDate(new Date(item.date), calendarType, language)}
          </AppText>
        </View>
      );
    }

    const isSale = item.category === 'sale' || item.type === 'sale';
    const isExpense = item.category === 'expense' || item.type === 'expense';
    const isAdjustment = item.category === 'adjustment' || item.type === 'adjustment';
    
    let Icon = TrendingUp;
    let iconBg = colors.primary;
    let label = '';
    let amountColor = colors.text;
    let prefix = '';

    if (isSale) {
      Icon = ShoppingBag;
      iconBg = colors.primary;
      label = `${item.quantity || 0} ${item.unitType || ''} ${t('dashboard.activity.sold')}`;
      amountColor = colors.success || '#34C759';
      prefix = '+';
    } else if (isExpense) {
      Icon = TrendingDown;
      iconBg = '#FF3B30';
      if (item.isRecurring && item.nextBillingDate) {
        const nextDate = new Date(item.nextBillingDate);
        label = `${t('expense.recurring_next')}: ${nextDate.toLocaleDateString()}`;
      } else {
        label = t('expense.not_recurring');
      }
      amountColor = '#FF3B30';
      prefix = '-';
    } else if (isAdjustment) {
      Icon = RefreshCw;
      iconBg = '#FF9500';
      label = item.type === 'price_up' ? t('adjustment.price_increased') : 
              item.type === 'price_down' ? t('adjustment.price_decreased') : t('dashboard.activity.damaged');
    }
    
    // Item name: try name, label, then fallback
    const itemName = item.name || item.label || (isSale ? t('inventory.header') : (isExpense ? t('expense.header') : t('adjustment.header')));
    // Amount: try amount, value
    const displayAmount = typeof item.amount === 'number' ? item.amount : (typeof item.value === 'number' ? item.value : null);
    
    // Safely format time. Respects the user's selected time
    // system: in Ethiopian mode we use the 12-hour ETH clock with
    // day/night period; in device mode we use a 12-hour AM/PM
    // string in the active language.
    let timeDisplay = '';
    if (item.createdAt) {
      timeDisplay = timeSystem === 'ethiopian'
        ? formatEthiopianTime(item.createdAt, language)
        : formatTime(item.createdAt, 'device', language);
    }

    return (
      <AppListItem
        left={
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: iconBg + '15',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Icon size={20} color={iconBg} />
          </View>
        }
        title={itemName}
        subtitle={label}
        titleMaxLines={1}
        subtitleMaxLines={1}
        right={
          <View style={{ alignItems: 'flex-end' }}>
            {displayAmount !== null && !isNaN(displayAmount) ? (
              <AppText variant="body" weight="bold" color={amountColor} numberOfLines={1}>
                {prefix}{displayAmount.toLocaleString()} <AppText variant="caption" weight="medium" color={amountColor}> {t('common.etb')}</AppText>
              </AppText>
            ) : null}
            {timeDisplay ? (
              <AppText variant="caption" weight="medium" color={colors.textSecondary} numberOfLines={1}>
                {timeDisplay}
              </AppText>
            ) : null}
          </View>
        }
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (isSale) {
            const sale = getSaleById(item.id);
            if (sale) setSelectedSale(sale);
          } else if (isExpense) {
            const expense = getExpenseById(item.id);
            if (expense) setSelectedExpense(expense);
          } else if (isAdjustment) {
            const adj = getAdjustmentById(item.id);
            if (adj) setSelectedAdjustment(adj);
          }
        }}
        padding={Spacing.md}
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: BorderRadius.lg,
          marginBottom: Spacing.sm,
        }}
      />
    );
  }, [colors, calendarType, language, t, setSelectedSale, setSelectedExpense, setSelectedAdjustment]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={onClose} style={[styles.backBtn, { backgroundColor: colors.surface }]}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <AppText variant="heading" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('dashboard.recent_activity')}</AppText>
            <View style={styles.liveIndicator}>
              <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.liveText, { color: colors.textSecondary }]} numberOfLines={1}>{t('common.live_audit')}</AppText>
            </View>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Search size={20} color={colors.textSecondary} />
<RNTextInput
               style={[styles.searchInput, { color: colors.text }]}
               placeholder={t('dashboard.search_activity')}
               placeholderTextColor={colors.textSecondary + '80'}
               value={searchQuery}
               onChangeText={(text) => {
                 const sanitized = sanitizeSearchQuery(text);
                 setSearchQuery(sanitized);
                 loadData();
               }}
               maxLength={100}
             />
            {searchError && (
              <AppText variant="caption" weight="medium" style={styles.searchErrorText} numberOfLines={2}>{searchError}</AppText>
            )}
          </View>
          <TouchableOpacity 
            onPress={() => setDateModalVisible(true)}
            style={[styles.filterBtn, { backgroundColor: colors.card, borderColor: colors.border }, selectedDate && { borderColor: colors.primary }]}
          >
            <Calendar size={20} color={selectedDate ? colors.primary : colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={activities}
        renderItem={renderActivityItem}
        keyExtractor={activityKeyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <History size={64} color={colors.border} />
            <AppText variant="body" weight="medium" style={[styles.emptyText, { color: colors.textSecondary }]} numberOfLines={2}>{t('dashboard.no_activity')}</AppText>
          </View>
        }
      />

      <CustomDatePicker
        visible={dateModalVisible}
        onClose={() => setDateModalVisible(false)}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setDateModalVisible(false);
          loadData();
        }}
        initialDate={selectedDate}
      />

      <Modal visible={!!selectedSale} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedSale(null)} />
          <Animated.View entering={FadeInDown} style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.85 }]}>
             <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
             {selectedSale && <SaleDetailsScreen sale={selectedSale} onClose={() => { setSelectedSale(null); loadData(); }} />}
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={!!selectedExpense} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedExpense(null)} />
          <Animated.View entering={FadeInDown} style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.85 }]}>
             <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
             {selectedExpense && <ExpenseDetailsScreen expense={selectedExpense} onClose={() => { setSelectedExpense(null); loadData(); }} />}
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={!!selectedAdjustment} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedAdjustment(null)} />
          <Animated.View entering={FadeInDown} style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.85 }]}>
             <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
             {selectedAdjustment && <AdjustmentDetailsScreen adjustment={selectedAdjustment} onClose={() => setSelectedAdjustment(null)} onRefresh={() => { setSelectedAdjustment(null); loadData(); }} />}
          </Animated.View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    letterSpacing: -0.5,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  searchBar: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: Fonts.medium,
  },
  filterBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  dateHeader: {
    paddingVertical: 15,
    marginTop: 10,
  },
  dateHeaderText: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Activity row uses AppListItem; layout is expressed via the
  // primitive's `padding`/`style` props inline.
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 20,
    fontFamily: Fonts.medium,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  searchErrorText: {
    color: '#FF3B30',
    marginTop: 4,
    marginLeft: 35,
  },
});

export default ActivityLedgerScreen;
