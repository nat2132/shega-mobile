import { CustomDatePicker } from '@/components/CustomDatePicker';
import { Fonts } from '@/constants/theme';
import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import { getSummaryMetricsByDateRange, getEarliestRecordDate } from '@/database/db';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDate } from '@/utils/date-utils';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Bell,
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
  RefreshCw,
  ChevronDown,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Dimensions, Image, Modal, Platform, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View, Animated as RNAnimated } from 'react-native';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';

type DateRangeOption = 
  | 'today' | 'yesterday' | 'this_week' | 'last_week' 
  | 'this_month' | 'this_year' 
  | 'custom_date' | 'custom_week' | 'custom_month' | 'custom_year';

interface DateRange {
  start: string;
  end: string;
  label: string;
}

const MetricCard = React.memo(({ label, value, color, icon: Icon, subtitle }: { label: string; value: string; color: string; icon: any; subtitle?: string }) => {
  const { colors } = useSettings();
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.metricIconBox, { backgroundColor: colors.surface }]}>
        <Icon size={18} color={colors.textSecondary} />
      </View>
      <AppText variant="title" weight="bold" style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>{value}</AppText>
      <AppText variant="caption" weight="medium" style={[styles.metricLabel, { color: colors.textSecondary }]} numberOfLines={2}>{label}</AppText>
      {subtitle && <AppText variant="caption" weight="regular" style={[styles.metricSub, { color: colors.textSecondary }]} numberOfLines={2}>{subtitle}</AppText>}
    </View>
  );
});
MetricCard.displayName = 'MetricCard';

const PerformanceBadge = React.memo(({ rating }: { rating: 'Excellent' | 'Good' | 'Average' | 'Poor' }) => {
  const { colors, t } = useSettings();

  const config = React.useMemo(() => ({
    Excellent: { icon: Star, color: '#34C759', bg: '#34C75915', label: t('summary.excellent') },
    Good: { icon: ThumbsUp, color: '#007AFF', bg: '#007AFF15', label: t('summary.good') },
    Average: { icon: Meh, color: '#FF9500', bg: '#FF950015', label: t('summary.average') },
    Poor: { icon: Frown, color: '#FF3B30', bg: '#FF3B3015', label: t('summary.poor') },
  }), [t]);

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
  const { colors, calendarType, language, t, theme, userProfile } = useSettings();
  const { notifCount } = useNotifications();
  const router = useRouter();
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

  const formatCash = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toLocaleString();
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
    <View style={[styles.screenWrapper, { backgroundColor: colors.background }]}>
      {/* Ambient Glow */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgWash, { top: -150, right: -100, backgroundColor: colors.primary, opacity: 0.05 }]} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
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
              onPress={() => setShowDateSelector(true)}
              style={[styles.headerDateBadge, { 
                borderColor: colors.border,
                backgroundColor: colors.surface || colors.card
              }]}
            >
              <Calendar size={14} color={colors.primary} style={{ marginRight: 6 }} />
              <AppText variant="caption" weight="bold" shrink={false} style={[styles.headerDateText, { color: colors.primary }]} numberOfLines={1}>
                {getPeriodLabel()}
              </AppText>
              <ChevronDown size={12} color={colors.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

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

        {/* Period Header */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.screenHeader}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('common.overview')}</AppText>
          <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{getPeriodLabel()}</AppText>
        </Animated.View>

        {/* Metrics Grid */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.metricsGrid}>
          {/* Row 1: Sales Cash & Sales Items */}
          <View style={styles.metricsRow}>
            <MetricCard 
              label={t('summary.sales_cash')}
              value={`${formatCash(metrics?.salesCash || 0)} ${t('common.etb')}`}
              color="#34C759"
              icon={DollarSign}
            />
            <MetricCard 
              label={t('summary.sales_items')}
              value={`${(metrics?.salesItems || 0).toLocaleString()}`}
              color="#007AFF"
              icon={Package}
            />
          </View>

          {/* Row 2: Profit & Expenses */}
          <View style={styles.metricsRow}>
            <MetricCard 
              label={t('summary.profit_cash')}
              value={`${formatCash(metrics?.profit || 0)} ${t('common.etb')}`}
              color="#34C759"
              icon={TrendingUp}
            />
            <MetricCard 
              label={t('summary.expenses')}
              value={`${formatCash(metrics?.expenses || 0)} ${t('common.etb')}`}
              color="#FF3B30"
              icon={CreditCard}
            />
          </View>

          {/* Row 3: Debt & Damage Loss */}
          <View style={styles.metricsRow}>
            <MetricCard 
              label={t('summary.debt')}
              value={`${formatCash(metrics?.debt || 0)} ${t('common.etb')}`}
              color="#FF9500"
              icon={BarChart3}
            />
            <MetricCard 
              label={t('summary.damage_loss')}
              value={`${formatCash(metrics?.damageLoss || 0)} ${t('common.etb')}`}
              color="#FF3B30"
              icon={AlertTriangle}
            />
          </View>

          {/* Row 4: Price Changes & Net Profit */}
          <View style={styles.metricsRow}>
            <MetricCard 
              label={t('summary.price_changes')}
              value={`${metrics?.priceChanges && metrics.priceChanges >= 0 ? '+' : ''}${formatCash(metrics?.priceChanges || 0)} ${t('common.etb')}`}
              color={metrics?.priceChanges && metrics.priceChanges >= 0 ? '#34C759' : '#FF3B30'}
              icon={TrendingDown}
            />
            <View style={[styles.netMetricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.metricIconBox, { backgroundColor: colors.surface }]}>
                <Star size={18} color={colors.textSecondary} />
              </View>
              <AppText variant="title" weight="bold" style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>
                {metrics?.netProfit && metrics.netProfit >= 0 ? '+' : ''}{formatCash(metrics?.netProfit || 0)} {t('common.etb')}
              </AppText>
              <AppText variant="caption" weight="medium" style={[styles.metricLabel, { color: colors.textSecondary }]} numberOfLines={2}>{t('summary.net_profit')}</AppText>
            </View>
          </View>
        </Animated.View>

        {/* Performance Rating */}
        <Animated.View entering={FadeInUp.delay(600).duration(600)} style={styles.perfSection}>
          <View style={[styles.perfCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.perfHeader}>
              <AppText variant="title" weight="bold" style={[styles.perfTitle, { color: colors.text }]} numberOfLines={2}>{t('summary.performance_rating')}</AppText>
              <PerformanceBadge rating={getRating()} />
            </View>
            <AppText variant="body" weight="medium" style={[styles.perfDesc, { color: colors.textSecondary }]} numberOfLines={4}>
              {t('summary.performance_desc')}
            </AppText>
            <View style={styles.perfFormula}>
              <AppText variant="caption" weight="medium" align="center" style={[styles.perfFormulaLabel, { color: colors.textSecondary, marginBottom: 4 }]} numberOfLines={2}>              {t('summary.formula_label')}</AppText>
              <AppText variant="micro" weight="medium" align="center" shrink={false} style={{ color: colors.text, marginVertical: 2 }}>
                = {formatCash(metrics?.profit || 0)} + {formatCash(metrics?.priceChangeGains || 0)} − {formatCash(metrics?.expenses || 0)} − {formatCash(metrics?.damageLoss || 0)} − {formatCash(metrics?.otherLosses || 0)}
              </AppText>
              <AppText variant="caption" weight="bold" align="center" shrink={false} style={{ color: metrics?.netProfit && metrics.netProfit >= 0 ? '#34C759' : '#FF3B30', marginTop: 2 }}>
                = {metrics?.netProfit && metrics.netProfit >= 0 ? '+' : ''}{formatCash(metrics?.netProfit || 0)} {t('common.etb')}
              </AppText>
            </View>
          </View>
        </Animated.View>

      </ScrollView>

      {/* Date Selector Modal */}
      <Modal visible={showDateSelector} transparent animationType="fade" onRequestClose={() => setShowDateSelector(false)}>
        <TouchableOpacity style={styles.modalOverlayC} activeOpacity={1} onPress={() => setShowDateSelector(false)}>
          <View style={[styles.selectorBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <AppText variant="title" weight="bold" align="center" style={[styles.selectorTitle, { color: colors.text }]} numberOfLines={2}>{t('summary.select_date_range')}</AppText>
            <ScrollView style={styles.selectorList} showsVerticalScrollIndicator={false}>
              {dateOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.selectorItem,
                    activeOption === opt.key && { backgroundColor: colors.primary + '15' }
                  ]}
                  onPress={() => handleOptionSelect(opt.key)}
                >
                  <AppText variant="body" weight="bold" style={[
                    styles.selectorText,
                    { color: activeOption === opt.key ? colors.primary : colors.text }
                  ]} numberOfLines={2}>
                    {t(opt.labelKey)}
                  </AppText>
                  {activeOption === opt.key && (
                    <View style={[styles.selectorDot, { backgroundColor: colors.primary }]} />
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
  headerLabel: { 
    fontFamily: Fonts.bold, 
    textTransform: 'uppercase', 
    letterSpacing: 1.5, 
    marginBottom: 8,
    opacity: 0.7
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
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  perfFormulaLabel: {
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  // Modals
  modalOverlayC: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
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