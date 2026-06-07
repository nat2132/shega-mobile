import { Fonts } from '@/constants/theme';
import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import { useDialog } from '@/context/DialogContext';
import {
  getCapitalSummary,
  getExpenseChartData,
  getTodaysExpenses,
  updateMonthlyBudget,
  getExpenseHealth,
  getOverdueExpenses,
  markRecurringAsPaid
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
  Pencil,
  Plus,
  Receipt,
  Search,
  TrendingDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  List,
  FileMinus,
  X,
  ShieldCheck
} from 'lucide-react-native';
import { formatDate, formatShortDate, getDayName, getFriendlyDate } from '@/utils/date-utils';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  FlatList
} from 'react-native';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
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
import { BarChartSkeleton, LineChartSkeleton, RingSkeleton } from '@/components/ChartSkeleton';
import { ChartEmpty } from '@/components/ChartStateView';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
const SparklineChart = React.memo(() => {
  const { colors } = useSettings();
  const d = "M0 35 C15 35, 25 5, 40 20 C55 35, 75 15, 100 5";
  return (
    <Svg width="80" height="30" viewBox="0 0 100 40">
      <Path
        d={d}
        stroke={colors.primary} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
});
SparklineChart.displayName = 'SparklineChart';

const BudgetRing = React.memo(({ progress }: { progress: number | undefined | null }) => {
  const { colors } = useSettings();
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference;

  if (progress == null || Number.isNaN(Number(progress))) {
    return <RingSkeleton size={100} />;
  }

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
        <AppText variant="heading" weight="bold" shrink={false} style={[styles.ringPercent, { color: colors.text }]} numberOfLines={1}>{Math.round(safeProgress)}%</AppText>
      </View>
    </Svg>
  );
});
BudgetRing.displayName = 'BudgetRing';

const ExpenseLedgerItem = React.memo(({ item, onPress }: { item: any, onPress: () => void }) => {
  const { colors, t } = useSettings();
  const safeName = item?.name || t('common.untitled');
  const safeAmount = Number(item?.amount) || 0;

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
        <AppText variant="body" weight="bold" style={[styles.ledgerName, { color: colors.text }]} numberOfLines={1}>
          {safeName}
        </AppText>
        <AppText variant="caption" weight="medium" style={[styles.ledgerCategory, { color: colors.textSecondary }]} numberOfLines={1}>
          {item?.category || t('common.general')} • {item?.date || t('common.na')}
        </AppText>
      </View>
      <View style={styles.ledgerEnd}>
        <AppText variant="body" weight="bold" shrink={false} style={[styles.ledgerAmount, { color: colors.text }]} numberOfLines={1}>
          - {safeAmount.toLocaleString()}
        </AppText>
        <AppText variant="caption" weight="bold" shrink={false} style={[styles.ledgerCurrency, { color: colors.textSecondary }]} numberOfLines={1}>{t('common.etb')}</AppText>
      </View>
    </TouchableOpacity>
  );
});
ExpenseLedgerItem.displayName = 'ExpenseLedgerItem';

/**
 * Stable tooltip renderer for the spending-pulse LineChart.
 * Defined at module scope (not inline in `pointerConfig`) so that
 * gifted-charts doesn't recreate the tooltip on every parent render
 * — which would briefly flash an empty tooltip box. We read theme
 * colours via context here so the component stays in sync with the
 * active theme.
 */
const PointerLabel = React.memo((items: any) => {
  const { colors } = useSettings();
  const { t } = useSettings();
  const itemsArr = Array.isArray(items) ? items : [items];
  const value = Number(itemsArr?.[0]?.value) || 0;
  return (
    <View style={[styles.tooltipBox, { backgroundColor: colors.card, shadowColor: '#000', elevation: 5 }]}>
      <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.tooltipText, { color: colors.text }]} numberOfLines={1}>
        {value.toLocaleString()} {t('common.etb')}
      </AppText>
    </View>
  );
});
PointerLabel.displayName = 'PointerLabel';

const CapitalHub = () => {
  const { openSidebar } = useSidebar();
  const { userProfile, colors, t, theme, calendarType, language, timeSystem } = useSettings();
  const { notifCount } = useNotifications();
  const router = useRouter();
  const dialog = useDialog();
  const [dateFilterMode, setDateFilterMode] = useState('this_month');
  const [dateFilterLabel, setDateFilterLabel] = useState(t('expense.this_month'));
  const [showExpenseList, setShowExpenseList] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showExpenseLoss, setShowExpenseLoss] = useState(false);
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [hideMetrics, setHideMetrics] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [isBarExpanded, setIsBarExpanded] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [overdueExpenses, setOverdueExpenses] = useState<any[]>([]);
  const [expenseHealthData, setExpenseHealthData] = useState<any>({ expenseHealth: 100, totalCount: 0, problemCount: 0 });

  const handleBudgetSave = async () => {
    const amount = parseFloat(budgetInput.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) {
      await dialog.alert({ title: t('expense.invalid_budget_title'), message: t('expense.invalid_budget_message'), iconType: 'warning' });
      return;
    }
    updateMonthlyBudget(amount);
    setShowBudgetModal(false);
    loadAllData();
  };

  const { width } = Dimensions.get('window');
  const expandedWidth = useSharedValue(56);
  useEffect(() => {
    expandedWidth.value = withSpring(isBarExpanded ? width - 50 : 56, { damping: 15, stiffness: 100 });
  }, [isBarExpanded, width]);

  const expandStyle = useAnimatedStyle(() => ({
    width: expandedWidth.value,
  }));

  const loadAllData = useCallback(async () => {
    setChartLoading(true);
    const capitalSummary = getCapitalSummary(dateFilterMode);
    setSummary(capitalSummary);

    const transactions = await getTodaysExpenses();
    setRecentTransactions(transactions);

    const expenseChartData = getExpenseChartData(dateFilterMode, language, undefined, timeSystem);
    if (expenseChartData && expenseChartData.length > 0) {
      setChartData(expenseChartData);
    } else {
      setChartData([]);
    }
    setChartLoading(false);

    const health = getExpenseHealth();
    setExpenseHealthData(health);

    const overdue = getOverdueExpenses();
    setOverdueExpenses(overdue);
  }, [dateFilterMode, language]);

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData])
  );

  // Sanitised chart data. Filters out placeholder `no_data` rows and
  // ensures `value` is a finite, non-negative number before we hand
  // it to react-native-gifted-charts. Without this, an empty
  // `expenseChartData` from SQLite could produce a 0-value point and
  // a line segment to it.
  const sanitizedChartData = useMemo(() => {
    return (chartData || [])
      .map((p: any) => ({
        ...p,
        value: Number.isFinite(Number(p?.value)) && !Number.isNaN(Number(p?.value))
          ? Math.max(0, Number(p.value))
          : 0,
      }))
      .filter((p: any) => p.label !== t('common.no_data'));
  }, [chartData, t]);

  const chartPointCount = sanitizedChartData.length || 1;
  const chartSpacing = useMemo(
    () => (chartPointCount > 10 ? 70 : chartPointCount > 6 ? 80 : 90),
    [chartPointCount],
  );
  const chartWidth = useMemo(
    () => Math.max(width - 50, chartPointCount * chartSpacing + 40),
    [width, chartPointCount, chartSpacing],
  );

  // Stable tooltip component. We previously defined this inline in
  // `pointerConfig`, which forced gifted-charts to remount the
  // tooltip on every render of the parent. Now the component lives
  // at module scope (below) and is passed by reference here.
  const pointerConfig = useMemo(
    () => ({
      pointerStripHeight: 130,
      pointerStripColor: colors.border,
      pointerStripWidth: 2,
      pointerStripUptoDataPoint: true,
      strokeDashArray: [4, 4],
      pointerColor: colors.primary,
      radius: 6,
      pointerLabelWidth: 80,
      pointerLabelHeight: 30,
      activatePointersOnLongPress: false,
      autoAdjustPointerLabelPosition: true,
      pointerLabelComponent: PointerLabel,
    }),
    [colors.border, colors.primary],
  );

  const toggleMetrics = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHideMetrics(!hideMetrics);
  };

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
              <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.headerAvatar} />
            </TouchableOpacity>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={[styles.headerIconBtn, { borderColor: colors.border }]}
            >
              <Bell size={22} color={colors.text} />
              {notifCount > 0 && (
                <View style={[styles.notifBadge, { backgroundColor: colors.primary }]}>
                  <AppText variant="micro" weight="bold" shrink={false} style={styles.notifBadgeText} numberOfLines={1}>{notifCount}</AppText>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Page Header */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.screenHeader}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('expense.financial_disbursement')}</AppText>
          <AppText variant="title" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('expense.capital_hub')}</AppText>
        </Animated.View>

        {/* Global Date Filter Bar */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.dateFilterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 25, paddingBottom: 15 }}>
            {[
              { label: t('expense.today'), value: 'today' },
              { label: t('expense.yesterday'), value: 'yesterday' },
              { label: t('expense.this_week'), value: 'this_week' },
              { label: t('expense.this_month'), value: 'this_month' },
              { label: t('expense.this_year'), value: 'this_year' },
            ].map(period => {
              const isActive = dateFilterMode === period.value;
              return (
                <TouchableOpacity
                  key={period.value}
                  style={[styles.dateChip, { backgroundColor: isActive ? colors.text : colors.card, borderColor: colors.border }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDateFilterMode(period.value);
                    setDateFilterLabel(period.label);
                  }}
                >
                  <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.dateChipText, { color: isActive ? colors.background : colors.text }]} numberOfLines={1}>{period.label}</AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Disbursement Hero */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.heroSection}>
          <View style={[styles.disbursementCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.heroTopRow}>
              <View>
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.heroLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('expense.total_disbursement')}</AppText>
                <View style={styles.valueRow}>
                  <AppText variant="display" weight="bold" style={[styles.heroValue, { color: colors.text }]} numberOfLines={1}>
                    {hideMetrics ? '••••••' : `${summary?.monthlyDisbursement?.toLocaleString() || 0}`}
                  </AppText>
                  <AppText variant="heading" weight="medium" shrink={false} style={[styles.heroCurrency, { color: colors.textSecondary }]} numberOfLines={1}>{t('common.etb')}</AppText>
                  <TouchableOpacity onPress={toggleMetrics} style={styles.eyeBtn}>
                    {hideMetrics ? <Eye size={18} color={colors.textSecondary} /> : <EyeOff size={18} color={colors.textSecondary} />}
                  </TouchableOpacity>
                </View>
              </View>
              <BudgetRing progress={summary?.budgetProgress || 0} />
            </View>
            <View style={[styles.heroFooter, { borderTopColor: colors.border }]}>
              <View style={styles.budgetStat}>
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('expense.budget')}</AppText>
                <View style={styles.budgetValueRow}>
                  <AppText variant="body-sm" weight="bold" style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>{summary?.budget?.toLocaleString()} {t('common.etb')}</AppText>
                  <TouchableOpacity
                    onPress={() => {
                      setBudgetInput(String(summary?.budget || 50000));
                      setShowBudgetModal(true);
                    }}
                    style={[styles.editBudgetBtn, { backgroundColor: colors.surface }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Pencil size={11} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => setShowHealthModal(true)}
                style={styles.budgetStat}
              >
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('expense.status')}</AppText>
                <View style={[styles.statusBadge, { backgroundColor: ((expenseHealthData?.expenseHealth || 100) < 100 ? '#FF3B3015' : colors.success + '15') }]}>
                  <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.statusText, { color: ((expenseHealthData?.expenseHealth || 100) < 100 ? '#FF3B30' : colors.success) }]} numberOfLines={1}>
                    {expenseHealthData?.expenseHealth || 100}%
                  </AppText>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Spending Intelligence Bento */}
        <View style={styles.bentoSection}>
          {/* Main Chart Card */}
          <Animated.View entering={FadeInDown.delay(400).duration(600)} style={[styles.chartBento, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.chartHeader}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.bentoLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('expense.spending_pulse')}</AppText>
              <AppText variant="caption" weight="medium" style={[styles.dateRangeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{dateFilterLabel}</AppText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScrollWrapper}>
              {chartLoading ? (
                <LineChartSkeleton height={130} width={width - 50} />
              ) : sanitizedChartData.length === 0 ? (
                <ChartEmpty height={130} icon="chart" message={t('common.no_data')} />
              ) : (
                <LineChart
                  data={sanitizedChartData}
                  areaChart curved hideRules hideYAxisText hideAxesAndRules={true}
                  color={colors.primary} startFillColor={colors.primary} endFillColor={colors.primary}
                  startOpacity={0.2} endOpacity={0.0}
                  height={130} thickness={3}
                  spacing={chartSpacing}
                  initialSpacing={20}
                  endSpacing={20}
                  hideDataPoints
                  xAxisLabelTextStyle={{
                    color: colors.textSecondary,
                    fontFamily: Fonts.medium,
                    width: 65,
                    textAlign: 'center'
                  }}
                  pointerConfig={pointerConfig}
                  width={chartWidth}
                />
              )}
            </ScrollView>
          </Animated.View>


          {/* No sub bento rows - removed loss/leakage and top outflow */}
        </View>

        {/* The Expense Ledger */}
        <View style={styles.ledgerSection}>
          <View style={styles.sectionHeader}>
            <View>
              <AppText variant="title" weight="bold" style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={2}>{t('expense.ledger_title')}</AppText>
              <AppText variant="body-sm" weight="medium" style={[styles.sectionSub, { color: colors.textSecondary }]} numberOfLines={2}>{t('expense.ledger_subtitle')}</AppText>
            </View>
            <TouchableOpacity onPress={() => setShowExpenseList(true)}>
              <AppText variant="body-sm" weight="bold" style={[styles.viewAllBtn, { color: colors.primary }]} numberOfLines={1}>{t('common.view_all')}</AppText>
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

      {/* Dashboard-style Expanding Smart FAB */}
      <View style={styles.dockedBarWrapper}>
        <Animated.View style={[expandStyle, { height: 56, borderRadius: 28, overflow: 'hidden' }]}>
          <BlurView intensity={80} tint={theme !== 'light' ? 'dark' : 'light'} style={[styles.dockedBar, { borderColor: colors.border, paddingHorizontal: isBarExpanded ? 10 : 0 }]}>
            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                <TouchableOpacity style={styles.dockBtn} onPress={() => { setShowExpenseForm(true); setIsBarExpanded(false); }}>
                  <Plus size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}
            
            <TouchableOpacity 
              style={[styles.dockMainBtn, { backgroundColor: isBarExpanded ? colors.text : colors.text }]} 
              activeOpacity={0.8}
              onPress={() => setIsBarExpanded(!isBarExpanded)}
            >
              <Plus size={24} color={colors.background} />
            </TouchableOpacity>
            
            {isBarExpanded && (
              <>
                <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                  <TouchableOpacity style={styles.dockBtn} onPress={() => { setShowExpenseList(true); setIsBarExpanded(false); }}>
                    <Search size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </Animated.View>
              </>
            )}

            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                <TouchableOpacity style={styles.dockBtn} onPress={() => { setShowExpenseLoss(true); setIsBarExpanded(false); }}>
                  <FileMinus size={22} color={colors.textSecondary} />
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

      {/* Expense Health Modal */}
      <Modal
        visible={showHealthModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHealthModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowHealthModal(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.8 }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            
            <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <AppText variant="title" weight="bold" style={{ color: colors.text }} numberOfLines={2}>{t('expense.health_title')}</AppText>
                <TouchableOpacity onPress={() => setShowHealthModal(false)}>
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={{ alignItems: 'center', marginVertical: 20, padding: 20, borderRadius: 16, backgroundColor: colors.surface }}>
                <AppText variant="display" weight="bold" shrink={false} style={{ color: (expenseHealthData?.expenseHealth || 100) === 100 ? colors.success : colors.primary }} numberOfLines={1}>
                  {expenseHealthData?.expenseHealth || 100}%
                </AppText>
                <AppText variant="body" weight="bold" style={{ color: colors.text, marginTop: 8 }} numberOfLines={2}>
                  {(expenseHealthData?.expenseHealth || 100) === 100 ? t('expense.health_all_good') : t('expense.health_action_needed')}
                </AppText>
                <AppText variant="body-sm" weight="medium" align="center" style={{ color: colors.textSecondary, marginTop: 8, paddingHorizontal: 10 }} numberOfLines={3}>
                  {t('expense.health_description')}
                </AppText>
              </View>

              <AppText variant="body" weight="bold" style={{ color: colors.text, marginBottom: 12 }} numberOfLines={1}>
                {t('expense.overdue_bills', { count: String(overdueExpenses.length) })}
              </AppText>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginBottom: 20 }}>
                {overdueExpenses.map((item) => (
                  <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, marginBottom: 8 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <AppText variant="body-sm" weight="bold" style={{ color: colors.text }} numberOfLines={1}>
                        {item.name}
                      </AppText>
                      <AppText variant="caption" weight="medium" style={{ color: colors.primary, marginTop: 2 }} numberOfLines={1}>
                        {item.amount?.toLocaleString()} {t('common.etb')} • {t('expense.overdue_days', { days: String(item.overdueDays || 0) })}
                      </AppText>
                    </View>
                    <TouchableOpacity
                      style={{ backgroundColor: colors.text, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
                      onPress={async () => {
                        markRecurringAsPaid(item.id);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        await loadAllData();
                      }}
                    >
                      <AppText variant="caption" weight="bold" shrink={false} style={{ color: colors.background }} numberOfLines={1}>{t('expense.pay_bill')}</AppText>
                    </TouchableOpacity>
                  </View>
                ))}
                {overdueExpenses.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <ShieldCheck size={48} color={colors.success} />
                    <AppText variant="body" weight="bold" align="center" style={{ color: colors.text, marginTop: 12 }} numberOfLines={1}>{t('expense.all_paid')}</AppText>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
      


      {/* Budget Edit Modal */}
      <Modal
        visible={showBudgetModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBudgetModal(false)}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => { Keyboard.dismiss(); setShowBudgetModal(false); }}
          />
          <View style={[styles.budgetSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>

            <AppText variant="title" weight="bold" style={[styles.budgetSheetTitle, { color: colors.text }]} numberOfLines={1}>{t('expense.set_budget')}</AppText>
            <AppText variant="body-sm" weight="medium" style={[styles.budgetSheetSub, { color: colors.textSecondary }]} numberOfLines={2}>
              {t('expense.budget_description')}
            </AppText>

            <View style={[styles.budgetInputBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <AppText variant="heading" weight="bold" shrink={false} style={[styles.budgetCurrencyPrefix, { color: colors.textSecondary }]} numberOfLines={1}>{t('common.etb')}</AppText>
              <TextInput
                style={[styles.budgetTextInput, { color: colors.text }]}
                value={budgetInput}
                onChangeText={setBudgetInput}
                keyboardType="numeric"
                placeholder={t('expense.budget_placeholder')}
                placeholderTextColor={colors.textSecondary}
                autoFocus
                selectTextOnFocus
              />
            </View>

            <View style={styles.budgetActions}>
              <TouchableOpacity
                style={[styles.budgetCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowBudgetModal(false)}
              >
                <AppText variant="body" weight="bold" style={[styles.budgetCancelText, { color: colors.textSecondary }]} numberOfLines={1}>{t('common.cancel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.budgetSaveBtn, { backgroundColor: colors.text }]}
                onPress={handleBudgetSave}
              >
                <AppText variant="body" weight="bold" style={[styles.budgetSaveText, { color: colors.background }]} numberOfLines={1}>{t('expense.save_budget')}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    opacity: 0.2,
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
    fontFamily: Fonts.bold, 
    textTransform: 'uppercase', 
    letterSpacing: 1.5, 
    marginBottom: 12,
    opacity: 0.7
  },
  headerTitle: { 
    fontFamily: Fonts.bold, 
    letterSpacing: -1,
    lineHeight: 46,
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
    fontFamily: Fonts.bold,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
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
    fontFamily: Fonts.extrabold,
    letterSpacing: -0.5,
  },
  heroCurrency: {
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
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: Fonts.bold,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
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
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  chartScrollWrapper: {
    height: 160,
    marginLeft: -15,
    marginRight: -5,
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
    fontFamily: Fonts.bold,
  },
  sectionSub: {
    fontFamily: Fonts.medium,
    marginTop: 4,
  },
  viewAllBtn: {
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
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  ledgerCategory: {
    fontFamily: Fonts.medium,
  },
  ledgerEnd: {
    alignItems: 'flex-end',
    minWidth: 90,
    marginLeft: 10,
  },
  ledgerAmount: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  ledgerCurrency: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },
  // ── Dashboard-style Expanding FAB ─────────────────────────
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

  // ── Budget edit ──────────────────────────────────────────────
  budgetValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  editBudgetBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Budget modal sheet ───────────────────────────────────────
  budgetSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  budgetSheetTitle: {
    fontFamily: Fonts.bold,
    marginBottom: 6,
  },
  budgetSheetSub: {
    fontFamily: Fonts.medium,
    marginBottom: 28,
    lineHeight: 20,
  },
  budgetInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 18,
    marginBottom: 24,
    gap: 10,
  },
  budgetCurrencyPrefix: {
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  budgetTextInput: {
    flex: 1,
    fontFamily: Fonts.bold,
    letterSpacing: -0.5,
  },
  budgetActions: {
    flexDirection: 'row',
    gap: 12,
  },
  budgetCancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetCancelText: {
    fontFamily: Fonts.semibold,
  },
  budgetSaveBtn: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  budgetSaveText: {
    fontFamily: Fonts.bold,
  },

  // ── Date filter bar ─────────────────────────────────────────
  dateFilterBar: {
    marginBottom: 5,
    paddingVertical: 5,
  },
  dateChip: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 16, 
    borderWidth: 1,
  },
  dateChipText: { 
    fontFamily: Fonts.bold,
  },
  dateRangeLabel: {
    fontFamily: Fonts.bold,
  },
});

export default CapitalHub;