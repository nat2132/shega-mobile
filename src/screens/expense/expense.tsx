import { Fonts } from '@/constants/theme';
import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import {
  getCapitalSummary,
  getExpenseChartData,
  getRecentExpenses
} from '@/database/db';
import { useNotifications } from '@/hooks/useNotifications';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Bell,
  Eye,
  EyeOff,
  Layers,
  Plus,
  Receipt,
  Search,
  TrendingDown,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react-native';
import { formatDate, formatShortDate, getDayName, getFriendlyDate } from '@/utils/date-utils';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  Text as RNText,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import ExpenseDetailsScreen from './expense-details';
import ExpenseFormScreen from './expense-form';
import ExpenseListScreen from './expense-list';
import ExpenseLossScreen from './expense-loss';
import { CustomDatePicker } from '@/components/CustomDatePicker';

const SparklineChart = () => {
  const { colors } = useSettings();
  return (
    <Svg width="80" height="30" viewBox="0 0 100 40">
      <Path
        d="M0 35 C15 35, 25 5, 40 20 C55 35, 75 15, 100 5"
        stroke={colors.primary} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
};

const BudgetRing = ({ progress }: { progress: number }) => {
  const { colors } = useSettings();
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Svg width="100" height="100" viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r={radius} stroke={colors.border} strokeWidth="8" fill="none" opacity={0.3} />
      <Circle
        cx="50" cy="50" r={radius}
        stroke={colors.primary} strokeWidth="8" fill="none"
        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
        strokeLinecap="round" transform="rotate(-90 50 50)"
      />
      <View style={styles.ringLabelContainer}>
        <RNText style={[styles.ringPercent, { color: colors.text }]}>{Math.round(progress)}%</RNText>
      </View>
    </Svg>
  );
};

const ExpenseLedgerItem = ({ item, onPress }: { item: any, onPress: () => void }) => {
  const { colors, t } = useSettings();
  return (
    <TouchableOpacity
      style={[styles.ledgerItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.ledgerIconCircle, { backgroundColor: colors.surface }]}>
        <Receipt size={22} color={colors.textSecondary} />
      </View>
      <View style={styles.ledgerMain}>
        <RNText style={[styles.ledgerName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </RNText>
        <RNText style={[styles.ledgerCategory, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.category || t('common.general')} • {item.date}
        </RNText>
      </View>
      <View style={styles.ledgerEnd}>
        <RNText style={[styles.ledgerAmount, { color: colors.text }]}>
          - {item.amount.toLocaleString()}
        </RNText>
        <RNText style={[styles.ledgerCurrency, { color: colors.textSecondary }]}>{t('common.etb')}</RNText>
      </View>
    </TouchableOpacity>
  );
};

const CapitalHub = () => {
  const { openSidebar } = useSidebar();
  const { userProfile, colors, t, theme, calendarType, language } = useSettings();
  const { notifCount } = useNotifications();
  const router = useRouter();
  const [activePeriod, setActivePeriod] = useState('Y');
  const [showExpenseList, setShowExpenseList] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showExpenseLoss, setShowExpenseLoss] = useState(false);
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [hideMetrics, setHideMetrics] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [isBarExpanded, setIsBarExpanded] = useState(false);
  const [targetDate, setTargetDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { width } = Dimensions.get('window');
  const expandedWidth = useSharedValue(56);
  useEffect(() => {
    expandedWidth.value = withSpring(isBarExpanded ? width - 50 : 56, { damping: 15, stiffness: 100 });
  }, [isBarExpanded, width]);

  const expandStyle = useAnimatedStyle(() => ({
    width: expandedWidth.value,
  }));

  const loadAllData = useCallback(async () => {
    const capitalSummary = getCapitalSummary(targetDate);
    setSummary(capitalSummary);

    const transactions = await getRecentExpenses(5, targetDate);
    setRecentTransactions(transactions);

    const expenseChartData = getExpenseChartData(activePeriod as 'W' | 'M' | 'Y', targetDate);
    setChartData(expenseChartData && expenseChartData.length > 0
      ? expenseChartData
      : [{ label: 'No Data', value: 0 }]
    );
  }, [activePeriod, targetDate]);

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData])
  );

  const handlePrevPeriod = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const dateObj = new Date(targetDate.replace(/-/g, '/'));
    if (activePeriod === 'W') dateObj.setDate(dateObj.getDate() - 7);
    else if (activePeriod === 'M') dateObj.setMonth(dateObj.getMonth() - 1);
    else if (activePeriod === 'Y') dateObj.setFullYear(dateObj.getFullYear() - 1);
    setTargetDate(dateObj.toLocaleDateString('en-CA'));
  };

  const handleNextPeriod = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const dateObj = new Date(targetDate.replace(/-/g, '/'));
    if (activePeriod === 'W') dateObj.setDate(dateObj.getDate() + 7);
    else if (activePeriod === 'M') dateObj.setMonth(dateObj.getMonth() + 1);
    else if (activePeriod === 'Y') dateObj.setFullYear(dateObj.getFullYear() + 1);
    setTargetDate(dateObj.toLocaleDateString('en-CA'));
  };

  const toggleMetrics = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHideMetrics(!hideMetrics);
  };

  const currentChartWidth = activePeriod === 'W' ? 320 : activePeriod === 'M' ? 380 : Dimensions.get('window').width - 50;

  return (
    <View style={[styles.screenWrapper, { backgroundColor: colors.background }]}>
      {/* Background Decor */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgWash, { top: -100, right: -100, backgroundColor: colors.primary, opacity: 0.05 }]} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              style={[styles.headerAvatarBox, { borderColor: colors.border }]}
              onPress={openSidebar}
            >
              <Image source={PROFILE_IMAGES[userProfile.avatarIndex]} style={styles.headerAvatar} />
            </TouchableOpacity>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={() => setShowDatePicker(true)}
              style={[
                styles.headerDateBadge, 
                targetDate !== new Date().toLocaleDateString('en-CA') && { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }
              ]}
            >
              <Calendar size={14} color={targetDate !== new Date().toLocaleDateString('en-CA') ? colors.primary : colors.textSecondary} style={{ marginRight: 6 }} />
              <RNText style={[
                styles.headerDateText, 
                { color: targetDate !== new Date().toLocaleDateString('en-CA') ? colors.primary : colors.textSecondary }
              ]}>
                {targetDate 
                   ? formatDate(new Date(targetDate.replace(/-/g, '/')), calendarType, language) 
                   : formatDate(new Date(), calendarType, language)}
              </RNText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={[styles.headerIconBtn, { borderColor: colors.border }]}
            >
              <Bell size={22} color={colors.text} />
              {notifCount > 0 && (
                <View style={[styles.notifBadge, { backgroundColor: colors.primary }]}>
                  <RNText style={styles.notifBadgeText}>{notifCount}</RNText>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Page Header */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.screenHeader}>
          <RNText style={[styles.headerLabel, { color: colors.textSecondary }]}>{t('expense.financial_disbursement')}</RNText>
          <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('expense.capital_hub')}</RNText>
        </Animated.View>

        {/* Disbursement Hero */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.heroSection}>
          <View style={[styles.disbursementCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.heroTopRow}>
              <View>
                <RNText style={[styles.heroLabel, { color: colors.textSecondary }]}>{t('expense.monthly')}</RNText>
                <View style={styles.valueRow}>
                  <RNText style={[styles.heroValue, { color: colors.text }]}>
                    {hideMetrics ? '••••••' : `${summary?.monthlyDisbursement?.toLocaleString() || 0}`}
                  </RNText>
                  <RNText style={[styles.heroCurrency, { color: colors.textSecondary }]}>{t('common.etb')}</RNText>
                  <TouchableOpacity onPress={toggleMetrics} style={styles.eyeBtn}>
                    {hideMetrics ? <Eye size={18} color={colors.textSecondary} /> : <EyeOff size={18} color={colors.textSecondary} />}
                  </TouchableOpacity>
                </View>
              </View>
              <BudgetRing progress={summary?.budgetProgress || 0} />
            </View>
            <View style={[styles.heroFooter, { borderTopColor: colors.border }]}>
              <View style={styles.budgetStat}>
                <RNText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('expense.budget')}</RNText>
                <RNText style={[styles.statValue, { color: colors.text }]}>{summary?.budget?.toLocaleString()} {t('common.etb')}</RNText>
              </View>
              <View style={styles.budgetStat}>
                <RNText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('expense.status')}</RNText>
                <View style={[styles.statusBadge, { backgroundColor: (summary?.budgetProgress > 90 ? '#FF3B3015' : colors.success + '15') }]}>
                  <RNText style={[styles.statusText, { color: (summary?.budgetProgress > 90 ? '#FF3B30' : colors.success) }]}>
                    {summary?.budgetProgress > 90 ? t('expense.critical') : t('expense.healthy')}
                  </RNText>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Spending Intelligence Bento */}
        <View style={styles.bentoSection}>
          {/* Main Chart Card */}
          <Animated.View entering={FadeInDown.delay(400).duration(600)} style={[styles.chartBento, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.chartHeader}>
              <RNText style={[styles.bentoLabel, { color: colors.textSecondary }]}>{t('expense.spending_pulse')}</RNText>
              <View style={styles.periodTabs}>
                {['W', 'M', 'Y'].map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActivePeriod(p);
                    }}
                    style={[styles.periodBtn, activePeriod === p && { backgroundColor: colors.text }]}
                  >
                    <RNText style={[styles.periodText, { color: activePeriod === p ? colors.background : colors.textSecondary }]}>{p}</RNText>
                  </TouchableOpacity>
                ))}
                
                <View style={styles.periodDivider} />
                <TouchableOpacity onPress={handlePrevPeriod} style={styles.navBtn}>
                  <ChevronLeft size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleNextPeriod} disabled={targetDate === new Date().toLocaleDateString('en-CA')} style={[styles.navBtn, targetDate === new Date().toLocaleDateString('en-CA') && { opacity: 0.3 }]}>
                  <ChevronRight size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.chartWrapper}>
              <LineChart
                data={chartData}
                areaChart curved hideRules hideYAxisText hideAxesAndRules={true}
                color={colors.primary} startFillColor={colors.primary} endFillColor={colors.primary}
                startOpacity={0.2} endOpacity={0.0}
                height={130} thickness={3}
                spacing={activePeriod === 'W' ? 40 : activePeriod === 'M' ? 70 : 35}
                initialSpacing={10}
                endSpacing={10}
                hideDataPoints
                xAxisLabelTextStyle={{ 
                  color: colors.textSecondary, 
                  fontSize: 10, 
                  fontFamily: Fonts.medium,
                  width: 40,
                  textAlign: 'center'
                }}
                pointerConfig={{
                  pointerStripHeight: 130, pointerStripColor: colors.border, pointerStripWidth: 2,
                  pointerStripUptoDataPoint: true, strokeDashArray: [4, 4],
                  pointerColor: colors.primary, radius: 6, pointerLabelWidth: 80, pointerLabelHeight: 30,
                  activatePointersOnLongPress: false, autoAdjustPointerLabelPosition: true,
                  pointerLabelComponent: (items: any) => (
                    <View style={[styles.tooltipBox, { backgroundColor: colors.card, shadowColor: '#000', elevation: 5 }]}>
                      <RNText style={[styles.tooltipText, { color: colors.text }]}>{items[0].value.toLocaleString()} {t('common.etb')}</RNText>
                    </View>
                  ),
                }}
                width={width - 50}
                height={160}
                showValuesAsTopLabel={false}
              />
            </View>
          </Animated.View>

          {/* Sub Bento Rows */}
          <View style={styles.bentoRow}>
            <TouchableOpacity
              style={[styles.smallBento, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowExpenseLoss(true)}
            >
              <RNText style={[styles.bentoLabel, { color: colors.textSecondary }]}>{t('expense.loss_leakage')}</RNText>
              <RNText style={[styles.bentoVal, { color: colors.text }]}>{summary?.categoryDistribution?.find((c: any) => c.name === 'Loss')?.total?.toLocaleString() || 0}</RNText>
              <SparklineChart />
            </TouchableOpacity>

            <View style={[styles.categoryBento, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.bentoHeaderRow}>
                <RNText style={[styles.bentoLabel, { color: colors.textSecondary }]}>{t('expense.top_outflow')}</RNText>
                <TrendingDown size={16} color="#FF3B30" />
              </View>
              <RNText style={[styles.topCatName, { color: colors.text }]}>{summary?.topCategory?.name || t('common.loading')}</RNText>
              <RNText style={[styles.topCatVal, { color: colors.textSecondary }]}>
                {t('expense.of_total', { percent: ((summary?.topCategory?.total / summary?.monthlyDisbursement) * 100 || 0).toFixed(1) })}
              </RNText>
              <View style={styles.catProgressBack}>
                <View style={[styles.catProgressFill, { width: `${(summary?.topCategory?.total / summary?.monthlyDisbursement) * 100 || 0}%`, backgroundColor: colors.primary }]} />
              </View>
            </View>
          </View>
        </View>

        {/* The Expense Ledger */}
        <View style={styles.ledgerSection}>
          <View style={styles.sectionHeader}>
            <View>
              <RNText style={[styles.sectionTitle, { color: colors.text }]}>{t('expense.ledger_title')}</RNText>
              <RNText style={[styles.sectionSub, { color: colors.textSecondary }]}>{t('expense.ledger_subtitle')}</RNText>
            </View>
            <TouchableOpacity onPress={() => setShowExpenseList(true)}>
              <RNText style={[styles.viewAllBtn, { color: colors.primary }]}>{t('common.view_all')}</RNText>
            </TouchableOpacity>
          </View>

          <View style={styles.ledgerList}>
            {recentTransactions.map((item, index) => (
              <Animated.View key={item.id} entering={FadeInDown.delay(600 + index * 100).duration(400)}>
                <ExpenseLedgerItem
                  item={item}
                  onPress={() => {
                    setSelectedExpense(item);
                    setShowExpenseDetails(true);
                  }}
                />
              </Animated.View>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* Expanding Smart FAB */}
      <View style={styles.dockedBarWrapper}>
        <Animated.View style={[expandStyle, { height: 56, borderRadius: 28, overflow: 'hidden' }]}>
          <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint={theme === 'light' ? 'light' : 'dark'} style={[styles.dockedBar, { borderColor: colors.border, paddingHorizontal: isBarExpanded ? 10 : 0 }]}>
            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                <TouchableOpacity
                  style={styles.dockBtn}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsBarExpanded(false); }}
                >
                  <Search size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}

            <TouchableOpacity
              style={[styles.dockMainBtn, { backgroundColor: isBarExpanded ? colors.primary : colors.text }]}
              onPress={() => {
                if (isBarExpanded) {
                  setShowExpenseForm(true);
                  setIsBarExpanded(false);
                } else {
                  setIsBarExpanded(true);
                }
              }}
            >
              <Plus size={24} color={isBarExpanded ? colors.background : colors.background} strokeWidth={2.5} />
            </TouchableOpacity>

            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                <TouchableOpacity
                  style={styles.dockBtn}
                  onPress={() => { setShowExpenseList(true); setIsBarExpanded(false); }}
                >
                  <Layers size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}
          </BlurView>
        </Animated.View>
      </View>


      {/* Modals - Standard consistency */}
      <Modal visible={showExpenseList} transparent animationType="slide" onRequestClose={() => setShowExpenseList(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowExpenseList(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.88 }]}>
            <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
            <ExpenseListScreen />
          </View>
        </View>
      </Modal>

      <Modal visible={showExpenseForm} transparent animationType="slide" onRequestClose={() => setShowExpenseForm(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowExpenseForm(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.88 }]}>
            <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
            <ExpenseFormScreen onSaveSuccess={() => {
              setShowExpenseForm(false);
              loadAllData();
            }} />
          </View>
        </View>
      </Modal>

      <Modal visible={showExpenseLoss} transparent animationType="slide" onRequestClose={() => setShowExpenseLoss(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowExpenseLoss(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.88 }]}>
            <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
            <ExpenseLossScreen />
          </View>
        </View>
      </Modal>

      <Modal visible={showExpenseDetails} transparent animationType="slide" onRequestClose={() => setShowExpenseDetails(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowExpenseDetails(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.card, height: Dimensions.get('window').height * 0.88 }]}>
            <View style={[styles.modalHeader, { backgroundColor: colors.card }]}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ExpenseDetailsScreen expense={selectedExpense} onClose={() => setShowExpenseDetails(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      <CustomDatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        initialDate={targetDate}
        onSelectDate={(date) => {
          if (date) setTargetDate(date);
          setShowDatePicker(false);
          loadAllData();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 220,
    paddingTop: 10,
  },
  bgWash: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    transform: [{ scale: 1.5 }],
    filter: 'blur(80px)',
  },
  topBar: {
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenHeader: {
    paddingHorizontal: 25,
    paddingTop: 15,
    paddingBottom: 35,
  },
  headerLabel: { 
    fontSize: 13, 
    fontFamily: Fonts.bold, 
    textTransform: 'uppercase', 
    letterSpacing: 1.5, 
    marginBottom: 12,
    opacity: 0.7
  },
  headerTitle: { 
    fontSize: 34, 
    fontFamily: Fonts.bold, 
    letterSpacing: -1,
    lineHeight: 46,
  },
  headerDateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginRight: 2,
    maxWidth: 140,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  headerDateText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  headerIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  notifBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: Fonts.bold,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Fonts.bold,
  },
  headerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    paddingHorizontal: 25,
    marginBottom: 25,
  },
  disbursementCard: {
    borderRadius: 30,
    padding: 25,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  heroLabel: {
    fontSize: 13,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  heroValue: {
    fontSize: 32,
    fontFamily: Fonts.extrabold,
    letterSpacing: -0.5,
  },
  heroCurrency: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 6,
  },
  eyeBtn: {
    marginLeft: 10,
    marginBottom: 8,
  },
  ringLabelContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringPercent: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 20,
    borderTopWidth: 1,
  },
  budgetStat: {
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },
  bentoSection: {
    paddingHorizontal: 25,
    marginBottom: 30,
    gap: 12,
  },
  chartBento: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    overflow: 'visible',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  bentoLabel: {
    fontSize: 11,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 2,
    alignItems: 'center',
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  periodText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
  },
  periodDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 4,
  },
  navBtn: {
    padding: 4,
  },
  chartWrapper: {
    height: 160,
    marginLeft: -15,
    marginRight: -5,
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  smallBento: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    justifyContent: 'center',
  },
  categoryBento: {
    flex: 1.4,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  bentoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bentoVal: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginBottom: 10,
  },
  topCatName: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  topCatVal: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginBottom: 12,
  },
  catProgressBack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.05)',
    width: '100%',
    overflow: 'hidden',
  },
  catProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  ledgerSection: {
    paddingHorizontal: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: Fonts.bold,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    marginTop: 4,
  },
  viewAllBtn: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  ledgerList: {
    gap: 4,
  },
  ledgerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  ledgerIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  ledgerMain: {
    flex: 1,
  },
  ledgerName: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  ledgerCategory: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  ledgerEnd: {
    alignItems: 'flex-end',
    minWidth: 90,
    marginLeft: 10,
  },
  ledgerAmount: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  ledgerCurrency: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },
  dockedBarWrapper: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockedBar: {
    flex: 1,
    borderRadius: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 10,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  dockBtn: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dockMainBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
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
  tooltipBox: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  tooltipText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
  },
  headerAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
});

export default CapitalHub;