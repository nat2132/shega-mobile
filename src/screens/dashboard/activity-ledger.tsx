import { CustomDatePicker } from '@/components/CustomDatePicker';
import { Fonts , BorderRadius, Spacing } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { getActivityFeed, getAdjustmentById, getExpenseById, getSaleWithItemsById } from '@/database/db';
import { formatDate, formatEthiopianTime, formatTime } from '@/utils/date-utils';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
    AlertTriangle,
    Banknote,
    Calendar,
    ChevronLeft,
    History,
    RefreshCw,
    Search,
    ShoppingBag,
    TrendingDown,
    TrendingUp
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
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
import { AppNumber, AppText, AppListItem} from '@/components/ui';

import Animated, {
    FadeInDown
} from 'react-native-reanimated';
import AdjustmentDetailsScreen from '../adjustement/adjustment-details';
import ExpenseDetailsScreen from '../expense/expense-details';
import SaleDetailsScreen from '../sales/sales-details';
import { getDashGlass } from './glass-dashboard';
import { useTutorial, TutorialTarget, TutorialButton } from '@/tutorials';
import { activityLedgerTutorial } from '@/tutorials/definitions';

interface ActivityLedgerProps {
  onClose?: () => void;
}

const ActivityLedgerScreen: React.FC<ActivityLedgerProps> = ({ onClose }) => {
  const { colors, calendarType, language, timeSystem, t } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const tutorial = useTutorial({ tutorial: activityLedgerTutorial });
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
  }, [searchQuery, selectedDate, t]);

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
        <View style={[styles.dateHeader, { backgroundColor: G.bg }]}>
          <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.dateHeaderText, { color: G.fgSecondary }]} numberOfLines={1}>
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
    let amountColor = G.fg;
    let prefix = '';

    if (isSale) {
      const paymentStatus = item.paymentStatus || 'Paid';
      const isOrder = paymentStatus === 'Order';
      const isDebt = paymentStatus === 'Debt';
      const isCancelled = paymentStatus === 'Cancelled';
      const isPayment = (typeof item.value === 'number' && item.value < 0) || (item.batchId && String(item.batchId).startsWith('PAY_'));
      if (isPayment) {
        Icon = Banknote;
        iconBg = colors.success;
        label = t('dashboard.activity.debt_collected');
        amountColor = colors.success;
        prefix = '+';
      } else {
        Icon = isCancelled ? AlertTriangle : ShoppingBag;
        iconBg = isCancelled ? colors.error : (isOrder ? colors.primary : (isDebt ? colors.warning : colors.success));
        const statusLabel = isCancelled ? t('sale.cancelled') : (isOrder ? 'Order' : (isDebt ? t('sale.credit') : t('dashboard.activity.sold')));
        label = `${item.quantity || 0} ${item.unitType || ''} ${statusLabel}`;
        amountColor = isCancelled ? colors.error : (isOrder ? colors.primary : (isDebt ? colors.warning : colors.success));
        prefix = isCancelled ? '' : '+';
      }
    } else if (isExpense) {
      Icon = TrendingDown;
      iconBg = colors.error;
      if (item.isRecurring && item.nextBillingDate) {
        const nextDate = new Date(item.nextBillingDate);
        label = `${t('expense.recurring_next')}: ${nextDate.toLocaleDateString()}`;
      } else {
        label = t('expense.not_recurring');
      }
      amountColor = colors.error;
      prefix = '-';
    } else if (isAdjustment) {
      Icon = RefreshCw;
      iconBg = colors.warning;
      label = item.type === 'price_up' ? t('adjustment.price_increased') : 
              item.type === 'price_down' ? t('adjustment.price_decreased') : t('dashboard.activity.damaged');
    }
    
    // Item name: use customerName for sales, fallback to item label
    const itemName = isSale
      ? (item.customerName || t('sales.walk_in_customer'))
      : (item.name || item.label || (isExpense ? t('expense.header') : t('adjustment.header')));
    // Amount: try amount, value
    let displayAmount = typeof item.amount === 'number' ? item.amount : (typeof item.value === 'number' ? item.value : null);
    // Payment records have negative value — show as positive
    if (isSale && displayAmount !== null && displayAmount < 0) {
      displayAmount = Math.abs(displayAmount);
    }
    
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
              <AppNumber
                value={prefix === '-' ? -displayAmount : displayAmount}
                size="body"
                suffix={" " + t('common.etb')}
                showSign={prefix === '+'}
                color={amountColor}
                numberOfLines={1}
              />
            ) : null}
            {timeDisplay ? (
              <AppText variant="caption" weight="medium" color={G.fgSecondary} numberOfLines={1}>
                {timeDisplay}
              </AppText>
            ) : null}
          </View>
        }
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (isSale) {
            const sale = getSaleWithItemsById(item.id);
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
          backgroundColor: G.bgCard,
          borderWidth: 1,
          borderColor: G.border,
          borderRadius: BorderRadius.lg,
          marginBottom: Spacing.sm,
          overflow: 'hidden',
        }}
      />
    );
  }, [colors, calendarType, language, timeSystem, t, G, styles, setSelectedSale, setSelectedExpense, setSelectedAdjustment]);

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={{ position: 'absolute', top: -80, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: G.mutedLight, opacity: 0.3 }} />
      <View style={{ position: 'absolute', bottom: -60, right: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: G.mutedLight, opacity: 0.2 }} />
      <TutorialTarget id="al-header">
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={onClose} style={[styles.backBtn, { backgroundColor: G.bgCard }]}>
            <ChevronLeft size={24} color={G.fg} />
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <AppText variant="heading" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{t('dashboard.recent_activity')}</AppText>
            <View style={styles.liveIndicator}>
              <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.liveText, { color: G.fgSecondary }]} numberOfLines={1}>{t('common.live_audit')}</AppText>
            </View>
          </View>
          <TutorialButton tutorialId="activity-ledger" screenName="Activity Ledger" />
        </View>

        <TutorialTarget id="al-filter">
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <Search size={20} color={G.fgSecondary} />
<RNTextInput
               style={[styles.searchInput, { color: G.fg }]}
               placeholder={t('dashboard.search_activity')}
               placeholderTextColor={G.fgSecondary + '80'}
               value={searchQuery}
               onChangeText={(text) => {
                 const sanitized = sanitizeSearchQuery(text);
                 setSearchQuery(sanitized);
                 loadData();
               }}
               maxLength={100}
             />
            {searchError && (
              <AppText variant="caption" weight="medium" style={[styles.searchErrorText, { color: colors.error }]} numberOfLines={2}>{searchError}</AppText>
            )}
          </View>
          <TouchableOpacity 
            onPress={() => setDateModalVisible(true)}
            style={[styles.filterBtn, { backgroundColor: G.bgCard, borderColor: G.border }, selectedDate && { borderColor: colors.primary }]}
          >
            <Calendar size={20} color={selectedDate ? colors.primary : G.fgSecondary} />
          </TouchableOpacity>
        </View>
        </TutorialTarget>
      </View>
      </TutorialTarget>

      <TutorialTarget id="al-feed">
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
            <History size={64} color={G.border} />
            <AppText variant="body" weight="medium" style={[styles.emptyText, { color: G.fgSecondary }]} numberOfLines={2}>{t('dashboard.no_activity')}</AppText>
          </View>
        }
      />
      </TutorialTarget>

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
          <Animated.View entering={FadeInDown} style={[styles.bottomSheetContainer, { backgroundColor: G.bg, height: Dimensions.get('window').height * 0.90 }]}>
             <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: G.border }]} /></View>
             {selectedSale && <SaleDetailsScreen sale={selectedSale} onClose={() => { setSelectedSale(null); loadData(); }} />}
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={!!selectedExpense} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedExpense(null)} />
          <Animated.View entering={FadeInDown} style={[styles.bottomSheetContainer, { backgroundColor: G.bg, height: Dimensions.get('window').height * 0.90 }]}>
             <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: G.border }]} /></View>
             {selectedExpense && <ExpenseDetailsScreen expense={selectedExpense} onClose={() => { setSelectedExpense(null); loadData(); }} />}
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={!!selectedAdjustment} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedAdjustment(null)} />
          <Animated.View entering={FadeInDown} style={[styles.bottomSheetContainer, { backgroundColor: G.bg, height: Dimensions.get('window').height * 0.90 }]}>
             <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: G.border }]} /></View>
             {selectedAdjustment && <AdjustmentDetailsScreen adjustment={selectedAdjustment} onClose={() => setSelectedAdjustment(null)} onRefresh={() => { setSelectedAdjustment(null); loadData(); }} />}
          </Animated.View>
        </View>
      </Modal>

    </View>
  );
};

const createStyles = (G: any) => StyleSheet.create({
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
    marginTop: 4,
    marginLeft: 35,
  },
});

export default ActivityLedgerScreen;