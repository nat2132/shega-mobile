import React, { useState, useCallback } from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  TextInput as RNTextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { 
  Search, 
  Calendar, 
  ArrowUpRight, 
  Wallet, 
  Zap, 
  ChevronLeft,
  Filter,
  History,
  TrendingUp,
  Package,
} from 'lucide-react-native';
import Animated, { 
  FadeInDown, 
  FadeIn,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { getActivityFeed, getSaleById, getExpenseById, getAdjustmentById } from '@/database/db';
import SaleDetailsScreen from '../sales/sales-details';
import ExpenseDetailsScreen from '../expense/expense-details';
import AdjustmentDetailsScreen from '../adjustement/adjustment-details';
import { useFocusEffect } from '@react-navigation/native';
import { useSettings } from '@/context/SettingsContext';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { formatDate } from '@/utils/date-utils';
import { Fonts } from '@/constants/theme';

const { width } = Dimensions.get('window');

interface ActivityLedgerProps {
  onClose?: () => void;
}

const ActivityLedgerScreen: React.FC<ActivityLedgerProps> = ({ onClose }) => {
  const { colors, calendarType, language, t, theme } = useSettings();
  const [dateModalVisible, setDateModalVisible] = useState(false);
  
  const [activities, setActivities] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [selectedAdjustment, setSelectedAdjustment] = useState<any>(null);

  const loadData = useCallback(() => {
    const data = getActivityFeed({
      search: searchQuery,
      date: selectedDate,
      limit: 100,
    });
    
    // Group by date
    const grouped: any[] = [];
    const dates: Record<string, any[]> = {};

    data.forEach(item => {
      const dateKey = item.createdAt.split(' ')[0];
      if (!dates[dateKey]) {
        dates[dateKey] = [];
      }
      dates[dateKey].push(item);
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

  const renderActivityItem = (item: any) => {
    if (item.type === 'header') {
      return (
        <View style={[styles.dateHeader, { backgroundColor: colors.background }]}>
          <RNText style={[styles.dateHeaderText, { color: colors.textSecondary }]}>
            {formatDate(new Date(item.date), calendarType, language)}
          </RNText>
        </View>
      );
    }

    const isSale = item.category === 'sale';
    const isExpense = item.category === 'expense';
    const isAdjustment = item.category === 'adjustment';
    
    let Icon = TrendingUp;
    let iconBg = colors.primary;
    let label = '';
    let amountColor = colors.text;
    let prefix = '';

    if (isSale) {
      Icon = ArrowUpRight;
      iconBg = colors.primary;
      label = `${item.quantity || 0} ${item.unitType || ''} ${t('dashboard.activity.sold')}`;
      amountColor = colors.success || '#34C759';
      prefix = '+';
    } else if (isExpense) {
      Icon = Wallet;
      iconBg = '#FF3B30';
      label = t('expense.header');
      amountColor = '#FF3B30';
      prefix = '-';
    } else if (isAdjustment) {
      Icon = Zap;
      iconBg = '#FF9500';
      label = item.type === 'price_up' ? t('adjustment.price_increased') : 
              item.type === 'price_down' ? t('adjustment.price_decreased') : t('dashboard.activity.damaged');
    }

    return (
      <TouchableOpacity 
        activeOpacity={0.7}
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
      >
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.iconCircle, { backgroundColor: iconBg + '15' }]}>
            <Icon size={20} color={iconBg} />
          </View>
          
          <View style={styles.itemMain}>
            <RNText style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
              {item.name || (isSale ? t('inventory.header') : (isExpense ? t('expense.header') : t('adjustment.header')))}
            </RNText>
            <RNText style={[styles.itemLabel, { color: colors.textSecondary }]}>{label}</RNText>
          </View>

          <View style={styles.itemEnd}>
            {item.amount && (
              <RNText style={[styles.amount, { color: amountColor }]}>
                {prefix}{item.amount.toLocaleString()} <RNText style={styles.currency}>{t('common.etb')}</RNText>
              </RNText>
            )}
            <RNText style={[styles.timeText, { color: colors.textSecondary }]}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </RNText>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={onClose} style={[styles.backBtn, { backgroundColor: colors.surface }]}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('dashboard.recent_activity')}</RNText>
            <View style={styles.liveIndicator}>
              <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
              <RNText style={[styles.liveText, { color: colors.textSecondary }]}>{t('common.live_audit')}</RNText>
            </View>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Search size={20} color={colors.textSecondary} />
            <RNTextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t('dashboard.search_activity') || "Search business events..."}
              placeholderTextColor={colors.textSecondary + '80'}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                loadData();
              }}
            />
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
        renderItem={({ item }) => renderActivityItem(item)}
        keyExtractor={(item, index) => `${item.category}-${item.id}-${index}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <History size={64} color={colors.border} />
            <RNText style={[styles.emptyText, { color: colors.textSecondary }]}>{t('dashboard.no_activity')}</RNText>
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
    fontSize: 22,
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
    fontSize: 10,
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
    fontSize: 15,
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
    fontSize: 12,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  itemMain: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  itemLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    opacity: 0.8,
  },
  itemEnd: {
    alignItems: 'end',
  },
  amount: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  currency: {
    fontSize: 10,
    opacity: 0.6,
  },
  timeText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 16,
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
});

export default ActivityLedgerScreen;
