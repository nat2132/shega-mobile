import { Fonts } from '@/constants/theme';
import { NotificationBell } from '@/components/NotificationBell';
import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import {
  getCapitalSummary,
  getExpenseChartData,
  getFilteredExpenses,
  getTodaysExpenses,
  markRecurringAsPaid,
  getRecurringExpensesDueToday,
  getUpcomingRecurringExpenses,
  getRecurringTemplates,
  getMonthlyBudgetSummary,
  getBudgets,
  getBudgetWithCategoryProgress,
  getActiveBudgetForExpenses,
  checkBudgetPeriodEnd,
  getBudgetSpendingAlerts,
  insertBudget,
  insertBudgetCategory,
  duplicateBudget,
} from '@/database/db';
import { notifyRecurringMarkedPaid } from '@/services/notificationService';
import { useNotifications } from '@/hooks/useNotifications';
import { useDebounce } from '@/hooks/useDebounce';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Plus,
  Search,
  Calendar,
  ChevronRight,
  DollarSign,
  X,
  Receipt,
  Check,
  Wallet,
  Eye,
  EyeOff,
  AlertTriangle,
  Copy,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import Animated, { FadeIn, FadeInDown, FadeOut, useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import ExpenseDetailsScreen from './expense-details';
import ExpenseFormScreen from './expense-form';
import ExpenseListScreen from './expense-list';
import { getExpenseGlass } from './glass-expense';
import { LineChartSkeleton} from '@/components/ChartSkeleton';
import { ChartEmpty } from '@/components/ChartStateView';
import { AppNumber, AppText } from '@/components/ui';
import { useTutorial, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { expenseTutorial } from '@/tutorials/definitions';

const _tooltipCtx = { colors: null as any, t: null as any, G: null as any };
const PointerLabel = (items: any) => {
  const { t, G } = _tooltipCtx;
  const itemsArr = Array.isArray(items) ? items : [items];
  const value = Number(itemsArr?.[0]?.value) || 0;
  return (
    <View style={[styles.tooltipBox, { backgroundColor: G?.bgCard, borderColor: G?.border, borderWidth: 1, elevation: 10 }]}>
      <AppNumber value={value} size="body-sm" weight="bold" showCurrency />
    </View>
  );
};

  const CapitalHub = ({ filterCategory }: { filterCategory?: string }) => {
    const { openSidebar } = useSidebar();
    const { userProfile, colors, t, language, timeSystem } = useSettings();
    const G = getExpenseGlass(colors);
    const { notifCount } = useNotifications();
    _tooltipCtx.colors = colors;
    _tooltipCtx.t = t;
    _tooltipCtx.G = G;
    const router = useRouter();
    const tutorial = useTutorial({ tutorial: expenseTutorial });

    const [dateFilterMode, setDateFilterMode] = useState('this_month');
    const [summary, setSummary] = useState<any>(null);
    const [chartData, setChartData] = useState<any[]>([]);
    const [chartLoading, setChartLoading] = useState(true);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [overdueItems, setOverdueItems] = useState<any[]>([]);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [showExpenseList, setShowExpenseList] = useState(false);
    const [showExpenseDetails, setShowExpenseDetails] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<any>(null);
    const [recurringTemplates, setRecurringTemplates] = useState<any[]>([]);
    const [upcomingRecurring, setUpcomingRecurring] = useState<any[]>([]);
    const [hideMetrics, setHideMetrics] = useState(false);
    const [monthSummary, setMonthSummary] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [activeFilterCategory, setActiveFilterCategory] = useState<string | undefined>(filterCategory);
    const [allBudgets, setAllBudgets] = useState<any[]>([]);
    const [expenseBudgetId, setExpenseBudgetId] = useState<number | null>(null);
    const [activeBudget, setActiveBudget] = useState<any>(null);
    const [budgetAlerts, setBudgetAlerts] = useState<any[]>([]);
    const [showBudgetSetup, setShowBudgetSetup] = useState(false);
    const [budgetNameInput, setBudgetNameInput] = useState('');
    const [budgetAmountInput, setBudgetAmountInput] = useState('');
    const [budgetSetupLoading, setBudgetSetupLoading] = useState(false);
    const [showRenewal, setShowRenewal] = useState(false);

    const debouncedSearch = useDebounce(searchQuery, 250);
    const [searchResults, setSearchResults] = useState<any[] | null>(null);

    useEffect(() => {
      if (debouncedSearch.trim()) {
        const results = getFilteredExpenses({ search: debouncedSearch, limit: 100 });
        setSearchResults(results);
      } else {
        setSearchResults(null);
      }
    }, [debouncedSearch]);

  useEffect(() => {
    if (filterCategory) {
      setActiveFilterCategory(filterCategory);
      setShowExpenseList(true);
    }
  }, [filterCategory]);

  const loadAllData = useCallback(async () => {
    setChartLoading(true);
    setSummary(getCapitalSummary(dateFilterMode));
    setTransactions(getTodaysExpenses());
    const chart = getExpenseChartData(dateFilterMode, language, undefined, timeSystem);
    setChartData(chart || []);
    setChartLoading(false);
    setOverdueItems(getRecurringExpensesDueToday());
    setRecurringTemplates(getRecurringTemplates(true));
    setUpcomingRecurring(getUpcomingRecurringExpenses(10));

    setAllBudgets(getBudgets({ status: 'active' }));
    const now = new Date();
    const currentBudget = getActiveBudgetForExpenses();
    setActiveBudget(currentBudget);
    if (currentBudget) {
      const periodCheck = checkBudgetPeriodEnd(currentBudget.id);
      if (periodCheck?.needsRenewal) {
        setShowRenewal(true);
      }
      setBudgetAlerts(getBudgetSpendingAlerts(currentBudget.id));
    } else {
      setShowRenewal(false);
    }
    const baseSummary = getMonthlyBudgetSummary(now.getFullYear(), now.getMonth() + 1);
    if (expenseBudgetId) {
      const budgetDetail = getBudgetWithCategoryProgress(expenseBudgetId);
      if (budgetDetail) {
        setMonthSummary({
          hasBudget: true,
          budgetId: budgetDetail.id,
          budgetName: budgetDetail.name,
          totalPlanned: budgetDetail.totalPlanned,
          totalSpent: budgetDetail.totalSpent,
          remaining: budgetDetail.remaining,
          percentUsed: budgetDetail.percentUsed,
          projectedRemaining: 0,
          projectedPercent: 0,
          recurringMonthlyProjection: 0,
          recurringTemplateCount: 0,
          byCategory: [],
        });
      } else {
        setMonthSummary(baseSummary);
      }
    } else {
      setMonthSummary(baseSummary);
    }
  }, [dateFilterMode, language, expenseBudgetId, timeSystem]);

  useFocusEffect(useCallback(() => { loadAllData(); }, [loadAllData]));

  const { width } = Dimensions.get('window');

  const [isBarExpanded, setIsBarExpanded] = useState(false);
  const expandedWidth = useSharedValue(56);
  useEffect(() => {
    expandedWidth.value = withSpring(isBarExpanded ? width - 50 : 56, { damping: 15, stiffness: 100 });
  }, [isBarExpanded, width, expandedWidth]);
  const expandStyle = useAnimatedStyle(() => ({
    width: expandedWidth.value,
  }));

  const sanitizedChartData = useMemo(() => {
    return (chartData || [])
      .map((p: any) => ({
        ...p,
        value: Number.isFinite(Number(p?.value)) ? Math.max(0, Number(p.value)) : 0,
      }))
      .filter((p: any) => p.label !== t('common.no_data'));
  }, [chartData, t]);

  const chartPointCount = sanitizedChartData.length || 1;
  const chartWidth = useMemo(() => Math.max(width - 50, chartPointCount * 80 + 40), [width, chartPointCount]);

  const pointerConfig = useMemo(() => ({
    pointerStripHeight: 130,
    pointerStripColor: colors.border,
    pointerStripWidth: 2,
    pointerStripUptoDataPoint: true,
    strokeDashArray: [4, 4],
    pointerColor: colors.primary,
    radius: 6,
    pointerLabelWidth: 160,
    pointerLabelHeight: 40,
    activatePointersOnLongPress: false,
    autoAdjustPointerLabelPosition: true,
    pointerLabelComponent: PointerLabel,
  }), [colors.border, colors.primary]);

  const handleMarkPaid = async (id: number) => {
    const expense = (transactions as any[]).find((e: any) => e.id === id) || (overdueItems as any[]).find((e: any) => e.id === id);
    markRecurringAsPaid(id);
    if (expense) {
      notifyRecurringMarkedPaid({
        id: expense.id,
        name: expense.name,
        amount: expense.amount,
        nextBillingDate: expense.nextBillingDate,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadAllData();
  };

  const toggleMetrics = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHideMetrics(!hideMetrics);
  };

  const handleCreateBudget = async () => {
    if (!budgetNameInput.trim()) {
      await dialog.alert({ title: t('common.error'), message: t('budget.enter_name'), iconType: 'warning' });
      return;
    }
    const amount = parseFloat(budgetAmountInput.replace(/,/g, ''));
    if (!amount || amount <= 0) {
      await dialog.alert({ title: t('common.error'), message: t('form.error_amount_positive'), iconType: 'warning' });
      return;
    }
    setBudgetSetupLoading(true);
    const now = new Date();
    const budgetId = insertBudget({
      name: budgetNameInput.trim(),
      type: 'business',
      period: 'monthly',
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
    if (budgetId) {
      insertBudgetCategory(budgetId, { category: 'General', plannedAmount: amount });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setBudgetSetupLoading(false);
    setShowBudgetSetup(false);
    setBudgetNameInput('');
    setBudgetAmountInput('');
    loadAllData();
  };

  const handleCopyPrevBudget = () => {
    if (activeBudget?.id) {
      const now = new Date();
      duplicateBudget(activeBudget.id, now.getMonth() + 1, now.getFullYear());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowRenewal(false);
    loadAllData();
  };

  const handleSkipRenewal = () => {
    setShowRenewal(false);
  };

  const handleOpenBudgetSetup = () => {
    setShowBudgetSetup(true);
  };

  const budgetSummary = monthSummary;

  const displayTransactions = useMemo(() => {
    if (searchResults !== null) return searchResults ?? [];
    if (!searchQuery) return transactions;
    return transactions.filter((txn: any) =>
      (txn.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (txn.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(txn.amount || '').includes(searchQuery)
    );
  }, [searchResults, searchQuery, transactions]);

  const topItems = displayTransactions.slice(0, 5);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'over_budget': return colors.error;
      case 'warning': return colors.warning;
      default: return colors.success;
    }
  };
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'over_budget': return t('budget.over_budget') || 'Over Budget';
      case 'warning': return 'Warning';
      default: return t('budget.on_track') || 'On Track';
    }
  };

  if (!activeBudget && !showBudgetSetup) {
    return (
      <View style={[styles.screenWrapper, { backgroundColor: G.bg }]}>
        <View style={[styles.topBar, { paddingHorizontal: 24, paddingTop: 60 }]}>
          <TouchableOpacity onPress={openSidebar} activeOpacity={0.7} style={[styles.avatarBox, { borderColor: G.border, backgroundColor: G.bgCard }]}>
            <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.avatar} />
          </TouchableOpacity>
          <NotificationBell size={22} count={notifCount} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <View style={[styles.budgetGateCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={[styles.budgetGateIcon, { backgroundColor: colors.warning + '20' }]}>
              <DollarSign size={40} color={colors.warning} />
            </View>
            <AppText variant="title" weight="bold" style={{ color: G.fg, textAlign: 'center', marginTop: 20 }}>
              {t('budget.no_budget_title') || 'No Active Budget'}
            </AppText>
            <AppText variant="body" weight="medium" style={{ color: G.fgSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
              {t('budget.create_before_expense') || 'Create your monthly budget before recording expenses.'}
            </AppText>
            <AppText variant="body-sm" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 4, lineHeight: 20 }}>
              {t('budget.budget_helps_control') || 'Budgets help you control spending and track your business performance.'}
            </AppText>
            <TouchableOpacity
              style={[styles.budgetGateBtn, { backgroundColor: G.fg }]}
              onPress={() => setShowBudgetSetup(true)}
              activeOpacity={0.8}
            >
              <Plus size={20} color={G.bg} />
              <AppText variant="body" weight="bold" style={{ color: G.bg, marginLeft: 8 }}>
                {t('budget.create_budget') || 'Create Budget'}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (showBudgetSetup) {
    return (
      <View style={[styles.screenWrapper, { backgroundColor: G.bg }]}>
        <View style={[styles.topBar, { paddingHorizontal: 24, paddingTop: 60 }]}>
          <TouchableOpacity onPress={() => setShowBudgetSetup(false)} activeOpacity={0.7}>
            <X size={24} color={G.fg} />
          </TouchableOpacity>
          <AppText variant="body" weight="bold" style={{ color: G.fg }}>{t('budget.create_budget') || 'Create Budget'}</AppText>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
          <View style={[styles.budgetGateCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppText variant="title" weight="bold" style={{ color: G.fg, marginBottom: 4 }}>{t('budget.setup_budget') || 'Set Up Your Budget'}</AppText>
            <AppText variant="body-sm" style={{ color: G.fgSecondary, marginBottom: 24 }}>{t('budget.set_spending_plan') || 'Define your monthly spending plan'}</AppText>

            <AppText variant="caption" weight="bold" transform="uppercase" style={{ color: G.fgSecondary, marginBottom: 6 }}>{t('common.name') || 'Name'}</AppText>
            <TextInput
              style={[styles.budgetGateInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
              placeholder="e.g. Monthly Operations"
              placeholderTextColor={G.fgSecondary}
              value={budgetNameInput}
              onChangeText={setBudgetNameInput}
            />

            <AppText variant="caption" weight="bold" transform="uppercase" style={{ color: G.fgSecondary, marginTop: 16, marginBottom: 6 }}>{t('budget.total_amount') || 'Total Budget Amount'} (ETB)</AppText>
            <TextInput
              style={[styles.budgetGateInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
              placeholder="e.g. 50000"
              placeholderTextColor={G.fgSecondary}
              value={budgetAmountInput}
              onChangeText={setBudgetAmountInput}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[styles.budgetGateBtn, { backgroundColor: G.fg, marginTop: 24, opacity: budgetSetupLoading ? 0.6 : 1 }]}
              onPress={handleCreateBudget}
              disabled={budgetSetupLoading}
              activeOpacity={0.8}
            >
              {budgetSetupLoading ? (
                <ActivityIndicator color={G.bg} />
              ) : (
                <Check size={20} color={G.bg} />
              )}
              <AppText variant="body" weight="bold" style={{ color: G.bg, marginLeft: 8 }}>
                {budgetSetupLoading ? (t('common.creating') || 'Creating...') : (t('common.create') || 'Create')}
              </AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screenWrapper, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgWash, { top: -120, right: -80, backgroundColor: '#FFFFFF', opacity: 0.03 }]} />
        <View style={[styles.bgWash, { top: 200, left: -60, backgroundColor: '#FFFFFF', opacity: 0.02 }]} />
        <View style={[styles.bgWash, { top: 600, right: -40, backgroundColor: '#FFFFFF', opacity: 0.015 }]} />
      </View>

      <TutorialScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Top Bar */}
        <TutorialTarget id="exp-header">
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={openSidebar} activeOpacity={0.7} style={[styles.avatarBox, { borderColor: G.border, backgroundColor: G.bgCard }]}>
              <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.avatar} />
              <View style={[styles.onlineIndicator, { backgroundColor: G.fg, borderColor: G.bg }]} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerActions}>
            <TutorialButton tutorialId="expense" screenName={t('screen.expense')} />
            <TouchableOpacity style={[styles.iconBtn, { borderColor: G.border, backgroundColor: G.bgCard }]} onPress={() => router.push('/(tabs)/budget')}>
              <DollarSign size={22} color={G.fgSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { borderColor: G.border, backgroundColor: G.bgCard }]} onPress={() => setShowSearch(!showSearch)}>
              <Search size={22} color={G.fgSecondary} />
            </TouchableOpacity>
            <NotificationBell size={22} count={notifCount} />
          </View>
        </View>
        </TutorialTarget>

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.screenHeader}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: G.muted }]}>
            {t('expense.financial_disbursement')}
          </AppText>
          <AppText variant="title" weight="bold" style={[styles.headerTitle, { color: G.fg }]}>
            {t('expense.capital_hub')}
          </AppText>
        </Animated.View>

        {/* Date Filter */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.dateFilterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 24, paddingBottom: 8 }}>
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
                  style={[styles.dateChip, { backgroundColor: isActive ? G.fg : G.bgCard, borderColor: isActive ? G.borderLight : G.border }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDateFilterMode(period.value); }}
                >
                  <AppText variant="body-sm" weight="bold" style={[styles.dateChipText, { color: isActive ? G.bg : G.fg }]}>
                    {period.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Budget Selector */}
          {allBudgets.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}>
              <TouchableOpacity
                style={[styles.budgetChip, { backgroundColor: expenseBudgetId === null ? G.fg : G.bgCard, borderColor: G.border }]}
                onPress={() => setExpenseBudgetId(null)}
              >
                <AppText variant="body-sm" weight="bold" style={[styles.budgetChipText, { color: expenseBudgetId === null ? G.bg : G.fg }]} numberOfLines={1}>
                  All Budgets
                </AppText>
              </TouchableOpacity>
              {allBudgets.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.budgetChip, {
                    backgroundColor: expenseBudgetId === b.id ? G.fg : G.bgCard,
                    borderColor: expenseBudgetId === b.id ? G.fg : G.border,
                  }]}
                  onPress={() => setExpenseBudgetId(b.id)}
                >
                  <AppText variant="body-sm" weight="bold" style={[styles.budgetChipText, { color: expenseBudgetId === b.id ? G.bg : G.fg }]} numberOfLines={1}>
                    {b.name}
                  </AppText>
                  <AppText variant="micro" style={{ color: expenseBudgetId === b.id ? G.bg + 'CC' : G.muted }} numberOfLines={1}>
                    {b.type}
                  </AppText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Animated.View>

        {/* Disbursement Hero Card */}
        <TutorialTarget id="exp-summary">
        <Animated.View entering={FadeInDown.delay(200)} style={[styles.heroCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <View style={styles.heroTop}>
            <View>
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.heroLabel, { color: G.muted }]}>
                {t('expense.total_disbursement')}
              </AppText>
              <View style={styles.heroValueRow}>
                {hideMetrics ? (
                  <AppText variant="display" weight="bold" style={[styles.heroValue, { color: G.fg }]}>
                    {'••••••'}
                  </AppText>
                ) : (
                  <AppNumber value={summary?.monthlyDisbursement} size="display" prefix={t('common.etb') + ' '} fallback="0" />
                )}
                <TouchableOpacity onPress={toggleMetrics} style={{ marginLeft: 8 }}>
                  {hideMetrics ? <Eye size={18} color={G.muted} /> : <EyeOff size={18} color={G.muted} />}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Budget Summary Card */}
          {budgetSummary && budgetSummary.hasBudget && activeBudget && (
            <TutorialTarget id="exp-budget">
            <TouchableOpacity
              style={[styles.budgetSummaryRow, { borderTopColor: G.border }]}
              onPress={() => router.push('/(tabs)/budget')}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.budgetSummaryHeader}>
                  <DollarSign size={16} color={G.muted} />
                  <AppText variant="caption" weight="bold" style={{ color: G.fgSecondary, marginLeft: 6 }}>
                    {budgetSummary.budgetName || 'Budget'}
                  </AppText>
                  <View style={[styles.budgetStatusBadge, { backgroundColor: getStatusColor(activeBudget.budgetStatus) + '20' }]}>
                    <View style={[styles.budgetStatusDot, { backgroundColor: getStatusColor(activeBudget.budgetStatus) }]} />
                    <AppText variant="micro" weight="bold" style={{ color: getStatusColor(activeBudget.budgetStatus), marginLeft: 4 }}>
                      {getStatusLabel(activeBudget.budgetStatus)}
                    </AppText>
                  </View>
                </View>
                <View style={styles.budgetStatsGrid}>
                  <View style={styles.budgetStatItem}>
                    <AppText variant="micro" weight="medium" style={{ color: G.muted }}>{t('budget.total_budget') || 'Budget'}</AppText>
                    <AppNumber value={budgetSummary.totalPlanned} size="body-sm" weight="bold" prefix={t('common.etb') + ' '} />
                  </View>
                  <View style={styles.budgetStatItem}>
                    <AppText variant="micro" weight="medium" style={{ color: G.muted }}>{t('expense.spent') || 'Spent'}</AppText>
                    <AppNumber value={budgetSummary.totalSpent} size="body-sm" weight="bold" prefix={t('common.etb') + ' '} style={{ color: activeBudget.budgetStatus === 'over_budget' ? colors.error : G.fg }} />
                  </View>
                  <View style={styles.budgetStatItem}>
                    <AppText variant="micro" weight="medium" style={{ color: G.muted }}>{t('budget.remaining') || 'Remaining'}</AppText>
                    <AppNumber value={budgetSummary.remaining} size="body-sm" weight="bold" prefix={t('common.etb') + ' '} style={{ color: budgetSummary.remaining < 0 ? colors.error : colors.success }} />
                  </View>
                </View>
                <View style={styles.budgetBar}>
                  <View style={[styles.budgetBarBg, { backgroundColor: G.border }]}>
                    <View style={[styles.budgetBarFill, {
                      width: `${Math.min(budgetSummary.percentUsed, 100)}%`,
                      backgroundColor: activeBudget.budgetStatus === 'over_budget' ? colors.error : activeBudget.budgetStatus === 'warning' ? colors.warning : colors.success
                    }]} />
                  </View>
                </View>
                <View style={styles.budgetStatsRow}>
                  <AppNumber value={budgetSummary.totalSpent} size="caption" prefix={t('common.etb') + ' '} />
                  <AppText variant="caption" weight="bold" style={{ color: activeBudget.budgetStatus === 'over_budget' ? colors.error : activeBudget.budgetStatus === 'warning' ? colors.warning : colors.success }}>
                    {budgetSummary.percentUsed}%
                  </AppText>
                  <AppNumber value={budgetSummary.remaining} size="caption" prefix={t('common.etb') + ' '} suffix=" left" />
                </View>
              </View>
              <ChevronRight size={20} color={G.muted} />
            </TouchableOpacity>
            </TutorialTarget>
          )}

          {/* Budget Alerts */}
          {budgetAlerts.length > 0 && (
            <Animated.View entering={FadeInDown.delay(150)} style={{ paddingHorizontal: 24, marginBottom: 12 }}>
              {budgetAlerts.map((alert, idx) => (
                <View key={idx} style={[styles.budgetAlertItem, {
                  backgroundColor: alert.severity === 'danger' ? colors.error + '15' : alert.severity === 'warning' ? colors.warning + '15' : colors.success + '15',
                  borderColor: alert.severity === 'danger' ? colors.error + '40' : alert.severity === 'warning' ? colors.warning + '40' : colors.success + '40',
                }]}>
                  <AlertTriangle size={16} color={alert.severity === 'danger' ? colors.error : alert.severity === 'warning' ? colors.warning : colors.success} />
                  <AppText variant="caption" weight="bold" style={{ color: G.fg, flex: 1, marginLeft: 8 }} numberOfLines={2}>
                    {alert.message}
                  </AppText>
                </View>
              ))}
            </Animated.View>
          )}
        </Animated.View>
        </TutorialTarget>

        {/* Spending Pulse Chart */}
        {dateFilterMode !== 'today' && dateFilterMode !== 'yesterday' && (
          <Animated.View entering={FadeInDown.delay(300)} style={[styles.chartCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.chartHeader}>
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.chartLabel, { color: G.muted }]}>
                {t('expense.spending_pulse')}
              </AppText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
              {chartLoading ? (
                <LineChartSkeleton height={130} width={width - 50} />
              ) : sanitizedChartData.length === 0 ? (
                <ChartEmpty height={130} icon="chart" message={t('common.no_data')} />
              ) : (
                <LineChart
                  data={sanitizedChartData}
                  areaChart curved hideRules hideYAxisText hideAxesAndRules
                  color={G.fg}
                  startFillColor={G.fg} endFillColor={G.fg}
                  startOpacity={0.12} endOpacity={0.0}
                  height={130} thickness={3}
                  spacing={80}
                  initialSpacing={20}
                  endSpacing={20}
                  hideDataPoints
                  pointerConfig={pointerConfig}
                  width={chartWidth}
                />
              )}
            </ScrollView>
          </Animated.View>
        )}

        {/* Overdue / Due Today */}
        {overdueItems.length > 0 && (
          <TutorialTarget id="exp-health">
          <Animated.View entering={FadeInDown.delay(350)} style={styles.overdueSection}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.sectionLabel, { color: G.muted }]}>
              {t('expense.due_today')}
            </AppText>
            {overdueItems.slice(0, 3).map((item: any) => (
              <View key={item.id} style={[styles.overdueItem, { backgroundColor: G.bgCard, borderColor: colors.error + '40' }]}>
                <View style={{ flex: 1 }}>
                  <AppText variant="body-sm" weight="bold" style={{ color: G.fg }}>{item.name}</AppText>
                  <AppNumber value={item.amount} size="caption" prefix={t('common.etb') + ' '} />
                </View>
                <TouchableOpacity style={[styles.payBtn, { backgroundColor: G.fg }]} onPress={() => handleMarkPaid(item.id)}>
                  <Check size={16} color={G.bg} />
                   <AppText variant="caption" weight="bold" style={{ color: G.bg, marginLeft: 4 }}>{t('expense.paid')}</AppText>
                </TouchableOpacity>
              </View>
            ))}
          </Animated.View>
          </TutorialTarget>
        )}

        {/* Upcoming Recurring */}
        {upcomingRecurring.length > 0 && (
          <Animated.View entering={FadeInDown.delay(370)} style={styles.overdueSection}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.sectionLabel, { color: G.muted, marginBottom: 10 }]}>
              {t('expense.upcoming_recurring')}
            </AppText>
            {upcomingRecurring.filter((u: any) => !overdueItems.find((o: any) => o.id === u.id)).slice(0, 3).map((item: any) => (
              <View key={item.id} style={[styles.overdueItem, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <View style={{ flex: 1 }}>
                  <AppText variant="body-sm" weight="bold" style={{ color: G.fg }}>{item.name}</AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <AppNumber value={item.amount} size="caption" prefix={t('common.etb') + ' '} />
                    <AppText variant="caption" style={{ color: G.muted }}> · due {item.nextBillingDate}</AppText>
                  </View>
                </View>
                <Calendar size={16} color={G.muted} />
              </View>
            ))}
          </Animated.View>
        )}

        {/* Recurring Templates */}
        {recurringTemplates.length > 0 && (
          <Animated.View entering={FadeInDown.delay(380)} style={styles.overdueSection}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.sectionLabel, { color: G.muted, marginBottom: 10 }]}>
              {t('expense.recurring_expenses')}
            </AppText>
            {recurringTemplates.slice(0, 3).map((tmpl: any) => (
              <View key={tmpl.id} style={[styles.overdueItem, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Calendar size={16} color={G.muted} />
                  <View>
                    <AppText variant="body-sm" weight="bold" style={{ color: G.fg }}>{tmpl.name}</AppText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                      <AppText variant="caption" style={{ color: G.muted }}>{tmpl.category} · </AppText>
                      <AppNumber value={tmpl.amount} size="caption" prefix={t('common.etb') + ' '} />
                      <AppText variant="caption" style={{ color: G.muted }}> · {tmpl.frequency}</AppText>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Search (expandable) */}
        {showSearch && (
          <Animated.View entering={FadeIn} style={styles.searchSection}>
            <View style={[styles.searchBox, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <Search size={18} color={G.muted} />
              <TextInput
                style={[styles.searchInput, { color: G.fg }]}
                placeholder={t('expense.search_ph')}
                placeholderTextColor={G.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </Animated.View>
        )}

        {/* Recent Expenses Ledger */}
        <TutorialTarget id="exp-ledger">
        <View style={styles.ledgerSection}>
          <View style={styles.ledgerHeader}>
            <AppText variant="body" weight="bold" style={{ color: G.fg }}>{t('expense.recent')}</AppText>
            <TouchableOpacity onPress={() => setShowExpenseList(true)}>
              <AppText variant="body-sm" weight="bold" style={{ color: G.fgSecondary }}>{t('expense.view_all')}</AppText>
            </TouchableOpacity>
          </View>

          {topItems.length > 0 ? (
            topItems.map((item, index) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(400 + index * 80)}>
              <TouchableOpacity
                style={[styles.ledgerItem, { borderBottomColor: G.border }]}
                onPress={() => { setSelectedExpense(item); setShowExpenseDetails(true); }}
              >
                <View style={[styles.ledgerIcon, { backgroundColor: G.accentGlass }]}>
                  <Receipt size={20} color={G.muted} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                    {item.name || item.category}
                  </AppText>
                  <AppText variant="caption" style={{ color: G.muted }}>
                    {item.category} · {item.date}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppNumber value={-Math.abs(Number(item.amount))} size="body-sm" prefix={t('common.etb') + ' '} />
                </View>
              </TouchableOpacity>
            </Animated.View>
            ))
          ) : searchQuery || searchResults !== null ? (
            <AppText variant="body" weight="bold" style={{ color: G.muted, textAlign: 'center', paddingVertical: 40 }}>
              {t('common.no_results')}
            </AppText>
          ) : null}

          {!searchQuery && transactions.length === 0 && (
            <View style={styles.emptyState}>
              <View style={[styles.ledgerIcon, { backgroundColor: G.accentGlass, width: 56, height: 56, borderRadius: 20, marginBottom: 16 }]}>
                <Wallet size={28} color={G.muted} />
              </View>
              <AppText variant="body" weight="bold" style={{ color: G.muted, marginTop: 12 }}>
                {t('expense.no_expenses')}
              </AppText>
              <TouchableOpacity style={[styles.emptyAddBtn, { backgroundColor: G.fg, marginTop: 16 }]} onPress={() => setShowExpenseForm(true)}>
                <Plus size={20} color={G.bg} />
                <AppText variant="body" weight="bold" style={{ color: G.bg, marginLeft: 8 }}>
                  {t('expense.record_expense')}
                </AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
        </TutorialTarget>

        <View style={{ height: 140 }} />
      </TutorialScrollView>

      {/* Expanding Smart FAB */}
      <View style={styles.dockedBarWrapper}>
        <Animated.View style={[expandStyle, { height: 60, borderRadius: 30, overflow: 'hidden' }]}>
          <View style={[styles.dockedBar, { borderColor: G.borderLight, backgroundColor: G.bgCardStrong, paddingHorizontal: isBarExpanded ? 12 : 0 }]}>
            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                <TutorialTarget id="exp-add-btn">
                <TouchableOpacity style={styles.dockBtn} onPress={() => { setShowExpenseForm(true); setIsBarExpanded(false); }}>
                  <Plus size={22} color={G.muted} />
                </TouchableOpacity>
                </TutorialTarget>
              </Animated.View>
            )}
            
            <TouchableOpacity 
              style={[styles.dockMainBtn, { backgroundColor: G.fg }]} 
              activeOpacity={0.8}
              onPress={() => setIsBarExpanded(!isBarExpanded)}
            >
              {isBarExpanded ? <X size={24} color={G.bg} /> : <Plus size={24} color={G.bg} />}
            </TouchableOpacity>
            
            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                <TouchableOpacity style={styles.dockBtn} onPress={() => { setShowExpenseList(true); setIsBarExpanded(false); }}>
                  <Receipt size={22} color={G.muted} />
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </View>

      {/* Expense Form Modal */}
      <Modal visible={showExpenseForm} transparent animationType="slide" onRequestClose={() => setShowExpenseForm(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowExpenseForm(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: G.bg, borderTopWidth: 1, borderTopColor: G.border, height: Dimensions.get('window').height * 0.92 }]}>
            <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: G.mutedLight }]} /></View>
            <ExpenseFormScreen onSaveSuccess={() => { setShowExpenseForm(false); loadAllData(); }} />
          </View>
        </View>
      </Modal>

      {/* Expense List Modal */}
      <Modal visible={showExpenseList} transparent animationType="slide" onRequestClose={() => setShowExpenseList(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowExpenseList(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: G.bg, borderTopWidth: 1, borderTopColor: G.border, height: Dimensions.get('window').height * 0.92 }]}>
            <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: G.mutedLight }]} /></View>
            <ExpenseListScreen filterCategory={activeFilterCategory} />
          </View>
        </View>
      </Modal>

      {/* Expense Details Modal */}
      <Modal visible={showExpenseDetails} transparent animationType="slide" onRequestClose={() => setShowExpenseDetails(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowExpenseDetails(false)} />
          <View style={[styles.detailSheet, { backgroundColor: G.bgCard, borderTopWidth: 1, borderTopColor: G.border }]}>
            <ExpenseDetailsScreen expense={selectedExpense} onClose={() => { setShowExpenseDetails(false); loadAllData(); }} />
          </View>
        </View>
      </Modal>

      {/* Budget Renewal Modal */}
      <Modal visible={showRenewal} transparent animationType="fade" onRequestClose={() => setShowRenewal(false)}>
        <View style={styles.renewalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={handleSkipRenewal} />
          <View style={[styles.renewalSheet, { backgroundColor: G.bgCard, borderTopWidth: 1, borderTopColor: G.border }]}>
            <View style={{ padding: 32, alignItems: 'center' }}>
              <View style={[styles.budgetGateIcon, { backgroundColor: colors.warning + '20', width: 64, height: 64, borderRadius: 32 }]}>
                <Calendar size={32} color={colors.warning} />
              </View>
              <AppText variant="title" weight="bold" style={{ color: G.fg, textAlign: 'center', marginTop: 20 }}>
                {t('budget.period_ended') || 'Budget Period Ended'}
              </AppText>
              <AppText variant="body" weight="medium" style={{ color: G.fgSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
                {t('budget.create_new_period') || 'Your current budget period has ended. Create a new budget for this month.'}
              </AppText>
              {activeBudget && (
                <TouchableOpacity
                  style={[styles.renewalBtn, { backgroundColor: G.fg, marginTop: 24 }]}
                  onPress={handleCopyPrevBudget}
                  activeOpacity={0.8}
                >
                  <Copy size={20} color={G.bg} />
                  <AppText variant="body" weight="bold" style={{ color: G.bg, marginLeft: 8 }}>
                    {t('budget.copy_previous') || 'Copy Previous Budget'}
                  </AppText>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.renewalBtn, { backgroundColor: G.bg, borderColor: G.border, borderWidth: 1, marginTop: 8 }]}
                onPress={() => { setShowRenewal(false); setShowBudgetSetup(true); }}
                activeOpacity={0.8}
              >
                <Plus size={20} color={G.fg} />
                <AppText variant="body" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>
                  {t('budget.create_new') || 'Create New Budget'}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSkipRenewal} style={{ marginTop: 16 }}>
                <AppText variant="body-sm" weight="medium" style={{ color: G.muted }}>{t('common.later') || 'Later'}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: { flex: 1 },
  scrollContent: { paddingBottom: 220, paddingTop: 10 },
  bgWash: { position: 'absolute', width: 300, height: 300, borderRadius: 150, transform: [{ scale: 1.5 }] },
  topBar: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatarBox: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, padding: 2, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  avatar: { width: '100%', height: '100%', borderRadius: 18 },
  onlineIndicator: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  headerActions: { flexDirection: 'row', gap: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  screenHeader: { paddingHorizontal: 24, paddingTop: 15, paddingBottom: 20 },
  headerLabel: { fontSize: 12, letterSpacing: 1.5, marginBottom: 8 },
  headerTitle: { fontSize: 32, letterSpacing: -1 },
  dateFilterBar: { marginBottom: 5 },
  dateChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  dateChipText: { fontSize: 13 },
  budgetChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  budgetChipText: { fontSize: 13 },
  heroCard: { marginHorizontal: 24, borderRadius: 28, padding: 24, borderWidth: 1, marginBottom: 16 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  heroLabel: { fontSize: 10, letterSpacing: 0.5, marginBottom: 6 },
  heroValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  heroValue: { fontSize: 32, letterSpacing: -0.5 },
  heroCurrency: { fontSize: 16, marginBottom: 4 },
  budgetSummaryRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 16, borderTopWidth: 1 },
  budgetSummaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  budgetBar: { marginBottom: 8 },
  budgetBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  budgetBarFill: { height: '100%', borderRadius: 3 },
  budgetStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  chartCard: { marginHorizontal: 24, borderRadius: 24, padding: 24, borderWidth: 1, marginBottom: 16 },
  chartHeader: { marginBottom: 16 },
  chartLabel: { fontSize: 11, letterSpacing: 1 },
  chartScroll: { height: 160, marginLeft: -15, marginRight: -5 },
  overdueSection: { paddingHorizontal: 24, marginBottom: 16 },
  sectionLabel: { fontSize: 10, letterSpacing: 1.5, marginBottom: 10 },
  overdueItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
  payBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  searchSection: { paddingHorizontal: 24, marginBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14 },
  searchInput: { flex: 1, marginLeft: 10, fontFamily: Fonts.medium, fontSize: 15 },
  ledgerSection: { paddingHorizontal: 24 },
  ledgerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  ledgerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  ledgerIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyAddBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  dockedBarWrapper: { position: 'absolute', bottom: 120, alignSelf: 'center', zIndex: 1000, alignItems: 'center', justifyContent: 'center' },
  dockedBar: { flex: 1, borderRadius: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 10, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  dockBtn: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  dockMainBtn: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tooltipBox: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  tooltipText: { fontFamily: Fonts.bold },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.65)' },
  bottomSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40 },
  detailSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, height: Dimensions.get('window').height * 0.90 },
  modalHeader: { alignItems: 'center', paddingTop: 15, paddingBottom: 10 },
  modalHandle: { width: 40, height: 4, borderRadius: 2 },
  budgetGateCard: { borderRadius: 28, padding: 32, borderWidth: 1, alignItems: 'center', width: '100%' },
  budgetGateIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  budgetGateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, marginTop: 20, width: '100%' },
  budgetGateInput: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontFamily: Fonts.medium, fontSize: 15, width: '100%' },
  budgetStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  budgetStatusDot: { width: 6, height: 6, borderRadius: 3 },
  budgetStatsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 },
  budgetStatItem: { alignItems: 'center', flex: 1 },
  budgetAlertItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 6 },
  renewalOverlay: { flex: 1, justifyContent: 'flex-end' },
  renewalSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  renewalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, width: '100%' },
});

export default CapitalHub;