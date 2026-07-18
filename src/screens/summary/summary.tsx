import { CustomDatePicker } from '@/components/CustomDatePicker';
import { NotificationBell } from '@/components/NotificationBell';
import { Fonts } from '@/constants/theme';
import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import { getSummaryMetricsByDateRange, getEarliestRecordDate } from '@/database/db';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDate } from '@/utils/date-utils';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Calendar,
  CreditCard,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Star,
  ThumbsUp,
  Meh,
  Frown,
  ChevronDown,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Modal, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppNumber, AppText} from '@/components/ui';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { getSummaryGlass } from './glass-summary';
import { useTutorial, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { summaryTutorial } from '@/tutorials/definitions';

type DateRangeOption = 
  | 'today' | 'yesterday' | 'this_week' | 'last_week' 
  | 'this_month' | 'this_year' 
  | 'custom_date' | 'custom_week' | 'custom_month' | 'custom_year';

interface DateRange {
  start: string;
  end: string;
  label: string;
}

const MetricCard = React.memo(({ label, value, icon: Icon, subtitle }: { label: string; value: React.ReactNode; icon: any; subtitle?: string }) => {
  const { colors } = useSettings();
  const G = getSummaryGlass(colors);
  return (
    <View style={[styles.metricCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
      <View style={[styles.metricIconBox, { backgroundColor: G.accentGlass }]}>
        <Icon size={18} color={G.muted} />
      </View>
      {typeof value === 'string' ? (
        <AppText variant="title" weight="bold" style={[styles.metricValue, { color: G.fg }]} numberOfLines={1}>{value}</AppText>
      ) : value}
      <AppText variant="caption" weight="medium" style={[styles.metricLabel, { color: G.muted }]} numberOfLines={2}>{label}</AppText>
      {subtitle && <AppText variant="caption" weight="regular" style={[styles.metricSub, { color: G.muted }]} numberOfLines={2}>{subtitle}</AppText>}
    </View>
  );
});
MetricCard.displayName = 'MetricCard';

const PerformanceBadge = React.memo(({ rating }: { rating: 'Excellent' | 'Good' | 'Average' | 'Poor' }) => {
  const { colors, t } = useSettings();

  const config = React.useMemo(() => ({
    Excellent: { icon: Star, color: colors.success, bg: colors.success + '20', label: t('summary.excellent') },
    Good: { icon: ThumbsUp, color: colors.primary, bg: colors.primary + '20', label: t('summary.good') },
    Average: { icon: Meh, color: colors.warning, bg: colors.warning + '20', label: t('summary.average') },
    Poor: { icon: Frown, color: colors.error, bg: colors.error + '20', label: t('summary.poor') },
  }), [t, colors.success, colors.primary, colors.warning, colors.error]);

  const { icon: Icon, color, bg, label } = config[rating];

  return (
    <View style={[styles.perfBadge, { backgroundColor: bg, borderColor: color + '30' }]}>
      <Icon size={18} color={color} />
      <AppText variant="caption" weight="bold" style={[styles.perfLabel, { color }]} numberOfLines={1}>{label}</AppText>
    </View>
  );
});
PerformanceBadge.displayName = 'PerformanceBadge';

const getDateRangeForOption = (option: DateRangeOption, customDate?: string): DateRange => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  switch (option) {
    case 'today':
      return { start: today, end: today, label: today };
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const ys = yesterday.toISOString().split('T')[0];
      return { start: ys, end: ys, label: ys };
    }
    case 'this_week': {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      const ws = weekStart.toISOString().split('T')[0];
      // label set dynamically via getPeriodLabel
      return { start: ws, end: today, label: '' };
    }
    case 'last_week': {
      const lastWeekStart = new Date(now);
      lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay() - 6);
      const lastWeekEnd = new Date(now);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay());
      return { 
        start: lastWeekStart.toISOString().split('T')[0], 
        end: lastWeekEnd.toISOString().split('T')[0], 
        label: '' 
      };
    }
    case 'this_month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { 
        start: monthStart.toISOString().split('T')[0], 
        end: today, 
        label: now.toLocaleString('default', { month: 'long', year: 'numeric' }) 
      };
    }
    case 'this_year': {
      return { 
        start: `${now.getFullYear()}-01-01`, 
        end: today, 
        label: `${now.getFullYear()}` 
      };
    }
    case 'custom_date': {
      const d = customDate || today;
      return { start: d, end: d, label: d };
    }
    case 'custom_week': {
      const cd = customDate ? new Date(customDate) : now;
      const cwStart = new Date(cd);
      cwStart.setDate(cwStart.getDate() - cwStart.getDay() + 1);
      const cwEnd = new Date(cwStart);
      cwEnd.setDate(cwStart.getDate() + 6);
      return { 
        start: cwStart.toISOString().split('T')[0], 
        end: cwEnd.toISOString().split('T')[0], 
        label: `${cwStart.toISOString().split('T')[0]} – ${cwEnd.toISOString().split('T')[0]}` 
      };
    }
    case 'custom_month': {
      const cm = customDate ? new Date(customDate + 'T00:00:00') : now;
      const cmStart = new Date(cm.getFullYear(), cm.getMonth(), 1);
      const cmEnd = new Date(cm.getFullYear(), cm.getMonth() + 1, 0);
      return { 
        start: cmStart.toISOString().split('T')[0], 
        end: cmEnd.toISOString().split('T')[0], 
        label: cm.toLocaleString('default', { month: 'long', year: 'numeric' }) 
      };
    }
    case 'custom_year': {
      const cy = customDate ? new Date(customDate) : now;
      return { 
        start: `${cy.getFullYear()}-01-01`, 
        end: `${cy.getFullYear()}-12-31`, 
        label: `${cy.getFullYear()}` 
      };
    }
    default:
      return { start: today, end: today, label: today };
  }
};

const SummaryScreen = () => {
  const { openSidebar } = useSidebar();
  const { colors, calendarType, language, t, userProfile } = useSettings();
  const G = getSummaryGlass(colors);
  const { notifCount } = useNotifications();
  const router = useRouter();
  const tutorial = useTutorial({ tutorial: summaryTutorial });
  const [metrics, setMetrics] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [activeOption, setActiveOption] = useState<DateRangeOption>('today');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [earliestDate, setEarliestDate] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangeForOption('today'));

  const loadData = useCallback((option: DateRangeOption, date?: string) => {
    const range = getDateRangeForOption(option, date);
    setDateRange(range);
    const data = getSummaryMetricsByDateRange(range.start, range.end);
    if (data) setMetrics(data);
  }, []);

  useEffect(() => {
    loadData(activeOption, customDate);
    setEarliestDate(getEarliestRecordDate());
  }, [activeOption, customDate, loadData]);

  const onRefresh = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRefreshing(true);
    loadData(activeOption, customDate);
    setTimeout(() => setRefreshing(false), 800);
  }, [loadData, activeOption, customDate]);

  const handleOptionSelect = (option: DateRangeOption) => {
    Haptics.selectionAsync();
    if (['custom_date', 'custom_week', 'custom_month', 'custom_year'].includes(option)) {
      setShowDateSelector(false);
      setTimeout(() => setShowCustomDatePicker(true), 300);
    }
    setActiveOption(option);
    setShowDateSelector(false);
  };

  const handleCustomDateSelect = (date: string) => {
    if (date) {
      setCustomDate(date);
      loadData(activeOption, date);
    }
    setShowCustomDatePicker(false);
  };

  const getPeriodLabel = () => {
    const option = activeOption;
    switch (option) {
      case 'today': return formatDate(new Date(dateRange.start.replace(/-/g, '/')), calendarType, language);
      case 'yesterday': return t('summary.yesterday');
      case 'this_week': return t('summary.this_week');
      case 'last_week': return t('summary.last_week');
      case 'this_month': return dateRange.label;
      case 'this_year': return dateRange.label;
      case 'custom_date': return formatDate(new Date(dateRange.start.replace(/-/g, '/')), calendarType, language);
      case 'custom_week': return dateRange.label;
      case 'custom_month': return dateRange.label;
      case 'custom_year': return dateRange.label;
      default: return formatDate(new Date(), calendarType, language);
    }
  };

  const getRating = (): 'Excellent' | 'Good' | 'Average' | 'Poor' => {
    return metrics?.performanceRating || 'Poor';
  };

  const dateOptions: { key: DateRangeOption; labelKey: string }[] = [
    { key: 'today', labelKey: 'common.today' },
    { key: 'yesterday', labelKey: 'summary.yesterday' },
    { key: 'this_week', labelKey: 'summary.this_week' },
    { key: 'last_week', labelKey: 'summary.last_week' },
    { key: 'this_month', labelKey: 'summary.this_month' },
    { key: 'this_year', labelKey: 'summary.this_year' },
    { key: 'custom_date', labelKey: 'summary.custom_date' },
    { key: 'custom_week', labelKey: 'summary.custom_week' },
    { key: 'custom_month', labelKey: 'summary.custom_month' },
    { key: 'custom_year', labelKey: 'summary.custom_year' },
  ];

  return (
    <View style={[styles.screenWrapper, { backgroundColor: G.bg }]}>
      {/* Ambient Glow */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgWash, { top: -150, right: -100, backgroundColor: '#FFFFFF', opacity: 0.03 }]} />
        <View style={[styles.bgWash, { top: 300, left: -80, backgroundColor: '#FFFFFF', opacity: 0.02 }]} />
        <View style={[styles.bgWash, { top: 700, right: -60, backgroundColor: '#FFFFFF', opacity: 0.015 }]} />
      </View>

      <TutorialScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Top Navigation Bar */}
        <TutorialTarget id="sum-header">
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <View style={[styles.headerAvatarBox, { borderColor: G.border, backgroundColor: G.bgCard }]}>
              <TouchableOpacity onPress={openSidebar}>
                <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.headerAvatar} />
              </TouchableOpacity>
              <View style={[styles.onlineIndicator, { backgroundColor: G.fg, borderColor: G.bg }]} />
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TutorialButton tutorialId="summary" screenName={t('screen.summary')} />
            <TouchableOpacity 
              onPress={() => setShowDateSelector(true)}
              style={[styles.headerDateBadge, { 
                borderColor: G.borderLight,
                backgroundColor: G.bgCard
              }]}
            >
              <Calendar size={14} color={G.fg} style={{ marginRight: 6 }} />
              <AppText variant="caption" weight="bold" shrink={false} style={[styles.headerDateText, { color: G.fg }]} numberOfLines={1}>
                {getPeriodLabel()}
              </AppText>
              <ChevronDown size={12} color={G.fg} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <NotificationBell size={22} count={notifCount} />
          </View>
        </View>
        </TutorialTarget>

        {/* Period Header */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.screenHeader}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: G.muted }]} numberOfLines={1}>{t('common.overview')}</AppText>
          <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{getPeriodLabel()}</AppText>
        </Animated.View>

        {/* Metrics Grid */}
        <TutorialTarget id="sum-financial">
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.metricsGrid}>
          {/* Row 1: Sales Cash & Sales Items */}
          <View style={styles.metricsRow}>
            <MetricCard 
              label={t('summary.sales_cash')}
              value={              <AppNumber value={metrics?.netSalesCash ?? 0} prefix="ETB " size="title" weight="bold" compact />}
              icon={DollarSign}
            />
            <MetricCard 
              label={t('summary.sales_items')}
              value={<AppNumber value={metrics?.salesItems ?? 0} size="title" weight="bold" />}
              icon={Package}
            />
          </View>

          {/* Row 2: Profit & Expenses */}
          <View style={styles.metricsRow}>
            <MetricCard 
              label={t('summary.profit_cash')}
              value={<AppNumber value={metrics?.profit ?? 0} prefix="ETB " size="title" weight="bold" compact />}
              icon={TrendingUp}
            />
            <MetricCard 
              label={t('summary.expenses')}
              value={<AppNumber value={metrics?.expenses ?? 0} prefix="ETB " size="title" weight="bold" compact />}
              icon={CreditCard}
            />
          </View>

          {/* Row 3: Debt & Damage Loss */}
          <View style={styles.metricsRow}>
            <MetricCard 
              label={t('summary.debt')}
              value={<AppNumber value={metrics?.debt ?? 0} prefix="ETB " size="title" weight="bold" compact />}
              icon={BarChart3}
            />
            <MetricCard 
              label={t('summary.damage_loss')}
              value={<AppNumber value={metrics?.damageLoss ?? 0} prefix="ETB " size="title" weight="bold" compact />}
              icon={AlertTriangle}
            />
          </View>

          {/* Row 4: Price Changes & Net Profit */}
          <TutorialTarget id="sum-velocity">
          <View style={styles.metricsRow}>
            <MetricCard 
              label={t('summary.price_changes')}
              value={<AppNumber value={metrics?.priceChanges ?? 0} prefix="ETB " size="title" weight="bold" compact showSign />}
              icon={TrendingDown}
            />
            <View style={[styles.netMetricCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <View style={[styles.metricIconBox, { backgroundColor: G.accentGlass }]}>
                <Star size={18} color={G.muted} />
              </View>
              <AppNumber value={metrics?.netProfit ?? 0} prefix="ETB " size="title" weight="bold" showSign />
              <AppText variant="caption" weight="medium" style={[styles.metricLabel, { color: G.muted }]} numberOfLines={2}>{t('summary.net_profit')}</AppText>
            </View>
          </View>
          </TutorialTarget>
        </Animated.View>
        </TutorialTarget>

        {/* Performance Rating */}
        <TutorialTarget id="sum-pulse">
        <Animated.View entering={FadeInUp.delay(600).duration(600)} style={styles.perfSection}>
          <View style={[styles.perfCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.perfHeader}>
              <AppText variant="title" weight="bold" style={[styles.perfTitle, { color: G.fg }]} numberOfLines={2}>{t('summary.performance_rating')}</AppText>
              <PerformanceBadge rating={getRating()} />
            </View>
            <TutorialTarget id="sum-insights">
            <AppText variant="body" weight="medium" style={[styles.perfDesc, { color: G.muted }]} numberOfLines={4}>
              {t('summary.performance_desc')}
            </AppText>
            </TutorialTarget>
            <View style={[styles.perfFormula, { backgroundColor: G.accentGlass }]}>
              <AppText variant="caption" weight="medium" align="center" style={[styles.perfFormulaLabel, { color: G.muted, marginBottom: 4 }]} numberOfLines={2}>              {t('summary.formula_label')}</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 2, marginVertical: 2 }}>
                <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary }}>=</AppText>
                <AppNumber value={metrics?.profit ?? 0} size="micro" prefix="ETB " compact />
                <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary }}>+</AppText>
                <AppNumber value={metrics?.priceChangeGains ?? 0} size="micro" prefix="ETB " compact />
                <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary }}>−</AppText>
                <AppNumber value={metrics?.expenses ?? 0} size="micro" prefix="ETB " compact />
                <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary }}>−</AppText>
                <AppNumber value={metrics?.damageLoss ?? 0} size="micro" prefix="ETB " compact />
                <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary }}>−</AppText>
                <AppNumber value={metrics?.otherLosses ?? 0} size="micro" prefix="ETB " compact />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                <AppText variant="caption" weight="bold" style={{ color: G.fgSecondary }}>=</AppText>
                <AppNumber value={metrics?.netProfit ?? 0} prefix="ETB " size="caption" showSign />
              </View>
            </View>
          </View>
        </Animated.View>
        </TutorialTarget>

      </TutorialScrollView>

      {/* Date Selector Modal */}
      <Modal visible={showDateSelector} transparent animationType="fade" onRequestClose={() => setShowDateSelector(false)}>
        <TouchableOpacity style={styles.modalOverlayC} activeOpacity={1} onPress={() => setShowDateSelector(false)}>
          <View style={[styles.selectorBox, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppText variant="title" weight="bold" align="center" style={[styles.selectorTitle, { color: G.fg }]} numberOfLines={2}>{t('summary.select_date_range')}</AppText>
            <ScrollView style={styles.selectorList} showsVerticalScrollIndicator={false}>
              {dateOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.selectorItem,
                    activeOption === opt.key && { backgroundColor: G.accentGlass }
                  ]}
                  onPress={() => handleOptionSelect(opt.key)}
                >
                  <AppText variant="body" weight="bold" style={[
                    styles.selectorText,
                    { color: activeOption === opt.key ? G.fg : G.muted }
                  ]} numberOfLines={2}>
                    {t(opt.labelKey)}
                  </AppText>
                  {activeOption === opt.key && (
                    <View style={[styles.selectorDot, { backgroundColor: G.fg }]} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <CustomDatePicker
        visible={showCustomDatePicker}
        onClose={() => setShowCustomDatePicker(false)}
        onSelectDate={handleCustomDateSelect}
        initialDate={customDate}
        minDate={earliestDate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: { flex: 1 },
  scrollContent: { paddingBottom: 220, paddingTop: 10 },
  bgWash: { position: 'absolute', width: 400, height: 400, borderRadius: 200, opacity: 0.3 },
  topBar: {
    paddingHorizontal: 25,
    paddingTop: 65,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenHeader: {
    paddingHorizontal: 25,
    paddingTop: 10,
    paddingBottom: 25,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  headerLabel: { 
    fontFamily: Fonts.bold, 
    textTransform: 'uppercase', 
    letterSpacing: 1.5, 
    marginBottom: 8,
  },
  headerTitle: { 
    fontFamily: Fonts.bold, 
    letterSpacing: -1,
    lineHeight: 46,
  },
  headerDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 200,
  },
  headerDateText: {
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
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  // Metrics
  metricsGrid: {
    paddingHorizontal: 25,
    marginBottom: 25,
    gap: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    minHeight: 100,
  },
  metricIconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  metricLabel: {
    fontFamily: Fonts.medium,
    lineHeight: 14,
  },
  metricSub: {
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  netMetricCard: {
    flex: 1,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    minHeight: 100,
  },
  // Performance
  perfSection: {
    paddingHorizontal: 25,
    marginBottom: 30,
  },
  perfCard: {
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
  },
  perfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  perfTitle: {
    fontFamily: Fonts.bold,
  },
  perfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  perfLabel: {
    fontFamily: Fonts.bold,
  },
  perfDesc: {
    fontFamily: Fonts.medium,
    lineHeight: 20,
    marginBottom: 12,
  },
  perfFormula: {
    padding: 12,
    borderRadius: 12,
  },
  perfFormulaLabel: {
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  // Modals
  modalOverlayC: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorBox: {
    width: '85%',
    maxHeight: '70%',
    borderRadius: 28,
    padding: 25,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  selectorTitle: {
    fontFamily: Fonts.bold,
    marginBottom: 20,
    textAlign: 'center',
  },
  selectorList: {
    maxHeight: 350,
  },
  selectorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  selectorText: {
    fontFamily: Fonts.bold,
  },
  selectorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default SummaryScreen;