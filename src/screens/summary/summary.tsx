import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Text as RNText, StyleSheet, ScrollView, RefreshControl, Platform, TouchableOpacity, Dimensions, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ShoppingBag, 
  Clock, 
  BarChart3,
  Search,
  RefreshCw,
  Info,
  ChevronRight,
  Activity,
  Zap,
  ShieldCheck,
  Layers,
  Sparkles,
  ArrowUpRight,
  Target,
  Bell,
  Calendar
} from 'lucide-react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeOut
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
import { Fonts } from '@/constants/theme';
import { getDashboardStats, getSummaryAnalytics } from '@/database/db';
import { useFocusEffect } from '@react-navigation/native';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import { formatDate, getFriendlyDate } from '@/utils/date-utils';
import { formatAbbreviated } from '@/utils/number-utils';
import { useNotifications } from '@/hooks/useNotifications';
import { useRouter } from 'expo-router';
import { useSidebar } from '@/context/SidebarContext';
import { CustomDatePicker } from '@/components/CustomDatePicker';

const HealthScoreRing = ({ score }: { score: number }) => {
  const { colors, t } = useSettings();
  const size = 100;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (score / 100) * circumference;

  return (
    <View style={styles.ringWrapper}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size/2}, ${size/2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            fill="transparent"
          />
        </G>
        <View style={[StyleSheet.absoluteFill, styles.ringContent]}>
          <Text style={[styles.ringScore, { color: colors.text }]}>{score}</Text>
          <Text style={[styles.ringLabel, { color: colors.textSecondary }]}>{t('expense.status')}</Text>
        </View>
      </Svg>
    </View>
  );
};

const SummaryScreen = () => {
  const { openSidebar } = useSidebar();
  const { colors, calendarType, language, t, theme, userProfile } = useSettings();
  const { notifCount } = useNotifications();
  const router = useRouter();
  const [metrics, setMetrics] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isBarExpanded, setIsBarExpanded] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showRangeSelector, setShowRangeSelector] = useState(false);
  const [activeRange, setActiveRange] = useState<'D' | 'W' | 'M'>('D');
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { width } = Dimensions.get('window');

  const expandedWidth = useSharedValue(60);
  React.useEffect(() => {
    expandedWidth.value = withSpring(isBarExpanded ? width - 50 : 60, { damping: 15, stiffness: 100 });
  }, [isBarExpanded, width]);

  const expandStyle = useAnimatedStyle(() => ({
    width: expandedWidth.value,
  }));

  const loadData = useCallback(() => {
    const stats = getDashboardStats(targetDate);
    if (stats) setMetrics(stats);
    const summaryData = getSummaryAnalytics(targetDate);
    if (summaryData) setAnalytics(summaryData);
  }, [targetDate]);

  useEffect(() => {
    loadData();
  }, [targetDate, loadData]);

  const onRefresh = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 800);
  }, [loadData]);

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100" : "0";
    const diff = ((current - previous) / previous) * 100;
    return `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`;
  };

  const revenueTrend = metrics ? calculateTrend(metrics.today.revenue, metrics.yesterday.revenue) : "0";
  const expenseTrend = metrics ? calculateTrend(metrics.today.expenses, metrics.yesterday.expenses) : "0";

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
          <RNText style={[styles.headerLabel, { color: colors.textSecondary }]}>{t('common.overview')}</RNText>
          <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('summary.dashboard') || 'Overview'}</RNText>
        </Animated.View>

        {/* Intelligence Hero */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.heroSection}>
          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroSubLabel, { color: colors.textSecondary }]}>{t('summary.gross_profit_today')}</Text>
                <Text style={[styles.heroMainValue, { color: colors.text, fontSize: 36 }]}>
                   {formatAbbreviated(metrics?.today.grossProfit || 0)}
                   <Text style={styles.heroCurrency}> {t('common.etb')}</Text>
                </Text>
                <View style={[styles.heroTrendBadge, { backgroundColor: '#34C75915', marginTop: 10 }]}>
                  <TrendingUp size={14} color="#34C759" />
                  <Text style={[styles.heroTrendText, { color: '#34C759' }]}>{t('summary.peak_performance')}</Text>
                </View>
              </View>
              <HealthScoreRing score={analytics?.healthScore || 0} />
            </View>

            <View style={[styles.heroStatsRow, { marginTop: 20 }]}>
              <View style={styles.heroStatItem}>
                <Text style={[styles.heroSubLabel, { color: colors.textSecondary }]}>{t('summary.sales_inflow')}</Text>
                <Text style={[styles.heroSecondaryValue, { color: colors.primary }]}>
                   {formatAbbreviated(metrics?.today.revenue || 0)}
                   <Text style={styles.heroCurrencySmall}> {t('common.etb')}</Text>
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.heroStatItem}>
                <Text style={[styles.heroSubLabel, { color: colors.textSecondary }]}>{t('summary.total_sales')}</Text>
                <Text style={[styles.heroSecondaryValue, { color: colors.text }]}>
                   {metrics?.today.salesCount || 0}
                </Text>
              </View>
            </View>
            
            <View style={[styles.heroFooter, { borderTopColor: colors.border }]}>
              <View style={styles.heroFooterItem}>
                 <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>{t('summary.velocity')}</Text>
                 <Text style={[styles.footerValue, { color: colors.text }]}>{formatAbbreviated(metrics?.today.salesCount || 0)} {t('inv.items_suffix')}</Text>
              </View>
              <View style={[styles.footerDivider, { backgroundColor: colors.border }]} />
              <View style={styles.heroFooterItem}>
                 <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>{t('expense.status')}</Text>
                 <Text style={[styles.footerValue, { color: '#34C759' }]}>{t('summary.excellent')}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Intelligence Bento Grid */}
        <View style={styles.bentoSection}>
          {/* Main Spotlight Bento */}
          <Animated.View entering={FadeInDown.delay(400).duration(600)} style={[styles.wideBento, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <View style={styles.bentoHeaderRow}>
                <View style={[styles.bentoIconBox, { backgroundColor: colors.primary + '15' }]}>
                   <Zap size={20} color={colors.primary} />
                </View>
                <Text style={[styles.bentoTypeLabel, { color: colors.textSecondary }]}>{t('summary.velocity_spotlight')}</Text>
             </View>
             <Text style={[styles.spotlightName, { color: colors.text }]}>{analytics?.topItem?.name || t('adj.searching')}</Text>
             <Text style={[styles.spotlightSub, { color: colors.textSecondary }]}>
                {t('summary.moved_today', { count: analytics?.topItem?.quantity || 0 })}
             </Text>
             <View style={styles.bentoVisual}>
                <Activity size={40} color={colors.primary} opacity={0.2} />
             </View>
          </Animated.View>

          {/* Sub Bento Rows */}
          <View style={styles.bentoRow}>
             <Animated.View entering={FadeInLeft.delay(500).duration(600)} style={[styles.smallBento, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.bentoSmallLabel, { color: colors.textSecondary }]}>{t("summary.inflow")}</Text>
                <Text style={[styles.bentoSmallValue, { color: colors.text }]}>{formatAbbreviated(metrics?.today.revenue || 0)}</Text>
                <View style={styles.bentoTrendRow}>
                   <ArrowUpRight size={14} color="#34C759" />
                   <Text style={[styles.bentoTrendText, { color: '#34C759' }]}>{revenueTrend}%</Text>
                </View>
             </Animated.View>

             <Animated.View entering={FadeInRight.delay(500).duration(600)} style={[styles.smallBento, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.bentoSmallLabel, { color: colors.textSecondary }]}>{t("summary.outflow")}</Text>
                <Text style={[styles.bentoSmallValue, { color: colors.text }]}>{formatAbbreviated(metrics?.today.expenses || 0)}</Text>
                <View style={styles.bentoTrendRow}>
                   <TrendingDown size={14} color={expenseTrend.startsWith('-') ? '#34C759' : '#FF3B30'} />
                   <Text style={[styles.bentoTrendText, { color: expenseTrend.startsWith('-') ? '#34C759' : '#FF3B30' }]}>{expenseTrend}%</Text>
                </View>
             </Animated.View>
          </View>

          <Animated.View entering={FadeInUp.delay(600).duration(600)} style={[styles.obligationBento, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <View style={styles.obligationHeader}>
                <Clock size={16} color="#FF9500" />
                <Text style={[styles.bentoSmallLabel, { color: colors.textSecondary, marginLeft: 8 }]}>{t('summary.obligations')}</Text>
             </View>
             <Text style={[styles.bentoSmallValue, { color: colors.text, marginTop: 10 }]}>{formatAbbreviated(metrics?.today.debt || 0)} ETB</Text>
             <Text style={[styles.obligationSub, { color: colors.textSecondary }]}>{t('summary.outstanding_recovery')}</Text>
          </Animated.View>
        </View>

        {/* Performance Pulse Ledger */}
        <View style={styles.ledgerSection}>
           <View style={styles.sectionHeader}>
             <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('summary.performance_pulse')}</Text>
             <TouchableOpacity>
                <Info size={18} color={colors.textSecondary} />
             </TouchableOpacity>
           </View>
 
           <View style={[styles.ledgerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <PulseRow 
               label={t('summary.sales_inflow')} 
               value={`+ ${formatAbbreviated(metrics?.today.revenue || 0)}`} 
               color="#34C759" 
               Icon={TrendingUp}
             />
             <View style={[styles.ledgerDivider, { backgroundColor: colors.border }]} />
             <PulseRow 
               label={t('summary.operational_outflow')} 
               value={`- ${formatAbbreviated(metrics?.today.expenses || 0)}`} 
               color="#FF3B30" 
               Icon={Wallet}
             />
             <View style={[styles.ledgerDivider, { backgroundColor: colors.border }]} />
             <PulseRow 
               label={t('summary.net_pulse')} 
               value={`+ ${formatAbbreviated(metrics?.today.grossProfit || 0)}`} 
               color={colors.primary} 
               Icon={Activity}
               isMain
             />
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
                  onPress={() => { 
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
                    setShowRangeSelector(true);
                    setIsBarExpanded(false); 
                  }}
                >
                  <Search size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}
            
            <TouchableOpacity 
              style={[styles.dockMainBtn, { backgroundColor: isBarExpanded ? colors.primary : colors.text }]}
              onPress={() => {
                if (isBarExpanded) {
                  setShowInsights(true);
                  setIsBarExpanded(false);
                } else {
                  setIsBarExpanded(true);
                }
              }}
            >
              <Target size={24} color={isBarExpanded ? colors.background : colors.background} />
            </TouchableOpacity>

            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                <TouchableOpacity style={styles.dockBtn} onPress={() => { onRefresh(); setIsBarExpanded(false); }}>
                  <RefreshCw size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}
          </BlurView>
        </Animated.View>
      </View>

      {/* Range Selector Modal */}
      <Modal visible={showRangeSelector} transparent animationType="fade" onRequestClose={() => setShowRangeSelector(false)}>
        <TouchableOpacity style={styles.modalOverlayC} activeOpacity={1} onPress={() => setShowRangeSelector(false)}>
           <View style={[styles.rangeBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <Text style={[styles.rangeTitle, { color: colors.text }]}>{t('common.date')}</Text>
             <View style={styles.rangeOptions}>
               {(['D', 'W', 'M'] as const).map((r) => (
                 <TouchableOpacity 
                   key={r} 
                   style={[styles.rangeBtn, activeRange === r && { backgroundColor: colors.primary }]}
                   onPress={() => { setActiveRange(r); setShowRangeSelector(false); Haptics.selectionAsync(); }}
                 >
                   <Text style={[styles.rangeText, { color: activeRange === r ? colors.background : colors.text }]}>
                     {r === 'D' ? t('common.today_short') : r === 'W' ? t('common.week_short') : t('common.month_short')}
                   </Text>
                 </TouchableOpacity>
               ))}
             </View>
           </View>
        </TouchableOpacity>
      </Modal>

      {/* Insights Modal */}
      <Modal visible={showInsights} transparent animationType="slide" onRequestClose={() => setShowInsights(false)}>
         <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowInsights(false)} />
            <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.7 }]}>
               <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
               <ScrollView contentContainerStyle={styles.insightsContent}>
                  <View style={styles.insightsHero}>
                    <View style={[styles.insightsIconCircle, { backgroundColor: colors.primary + '15' }]}>
                       <Sparkles size={32} color={colors.primary} />
                    </View>
                    <Text style={[styles.insightsTitle, { color: colors.text }]}>{t('summary.intel_insights')}</Text>
                    <Text style={[styles.insightsSub, { color: colors.textSecondary }]}>{t('summary.deep_dive')}</Text>
                  </View>

                  <View style={styles.insightGrid}>
                    <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                       <Activity size={20} color={colors.primary} style={{ marginBottom: 10 }} />
                       <Text style={[styles.insightVal, { color: colors.text }]}>{analytics?.healthScore}%</Text>
                       <Text style={[styles.insightLab, { color: colors.textSecondary }]}>{t('summary.health_score')}</Text>
                    </View>
                    <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                       <ShoppingBag size={20} color={colors.success} style={{ marginBottom: 10 }} />
                       <Text style={[styles.insightVal, { color: colors.text }]} numberOfLines={1}>{analytics?.topItem?.name}</Text>
                       <Text style={[styles.insightLab, { color: colors.textSecondary }]}>{t('summary.trending_asset')}</Text>
                    </View>
                  </View>

                  <View style={[styles.analysisBox, { backgroundColor: colors.text + '05' }]}>
                     <Text style={[styles.analysisText, { color: colors.text }]}>
                       {t('summary.analysis_desc', { 
                         level: analytics?.healthScore > 70 ? t('summary.superior') : t('summary.stable_efficiency')
                       })}
                     </Text>
                  </View>
               </ScrollView>
            </View>
         </View>
      </Modal>

      <CustomDatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={(date) => { 
          if (date) setTargetDate(date); 
          setShowDatePicker(false); 
        }}
        initialDate={targetDate}
      />
    </View>
  );
};

const PulseRow = ({ label, value, color, Icon, isMain = false }: any) => {
  const { colors } = useSettings();
  return (
    <View style={[styles.pulseRow, isMain && styles.pulseRowMain]}>
      <View style={styles.pulseLabelGroup}>
         <View style={[styles.pulseIconContainer, { backgroundColor: color + '15' }]}>
            <Icon size={18} color={color} />
         </View>
         <Text style={[styles.pulseLabel, { color: isMain ? colors.text : colors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.pulseValue, { color: isMain ? colors.text : color }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: { flex: 1 },
  scrollContent: { paddingBottom: 220, paddingTop: 10 },
  bgWash: { position: 'absolute', width: 400, height: 400, borderRadius: 200, filter: 'blur(100px)' },
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
  modalOverlayC: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
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
  rangeBox: {
    width: 280,
    padding: 25,
    borderRadius: 25,
    borderWidth: 1,
  },
  rangeTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginBottom: 20,
    textAlign: 'center',
  },
  rangeOptions: {
    gap: 10,
  },
  rangeBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  rangeText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  insightsContent: {
    padding: 25,
  },
  insightsHero: {
    alignItems: 'center',
    marginBottom: 30,
  },
  insightsIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  insightsTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
  },
  insightsSub: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    marginTop: 5,
  },
  insightGrid: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 25,
  },
  insightCard: {
    flex: 1,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
  },
  insightVal: {
    fontSize: 20,
    fontFamily: Fonts.bold,
  },
  insightLab: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  analysisBox: {
    padding: 20,
    borderRadius: 20,
  },
  analysisText: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    lineHeight: 22,
  },
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
    paddingBottom: 35,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  headerLabel: { 
    fontSize: 13, 
    fontFamily: Fonts.bold, 
    textTransform: 'uppercase', 
    letterSpacing: 1.5, 
    marginBottom: 8,
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
  headerIconBox: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  heroSection: { paddingHorizontal: 25, marginBottom: 30 },
  heroCard: { borderRadius: 32, padding: 25, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 12 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 15 },
  heroStatItem: { flex: 1 },
  statDivider: { width: 1, height: 30, marginHorizontal: 20 },
  heroMainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  heroProfitRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  heroSecondaryValue: { fontSize: 24, fontFamily: Fonts.bold, letterSpacing: -0.5 },
  heroCurrencySmall: { fontSize: 12, fontFamily: Fonts.bold },
  heroTrendBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 15, gap: 6 },
  heroTrendText: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  ringWrapper: { marginLeft: 10 },
  ringContent: { justifyContent: 'center', alignItems: 'center' },
  ringScore: { fontSize: 24, fontFamily: Fonts.bold },
  ringLabel: { fontSize: 10, fontFamily: Fonts.semibold, textTransform: 'uppercase' },
  heroFooter: { flexDirection: 'row', alignItems: 'center', paddingTop: 20, borderTopWidth: 1 },
  heroFooterItem: { flex: 1, gap: 4 },
  footerLabel: { fontSize: 11, fontFamily: Fonts.semibold, textTransform: 'uppercase' },
  footerValue: { fontSize: 16, fontFamily: Fonts.bold },
  footerDivider: { width: 1, height: 30, marginHorizontal: 15 },
  bentoSection: { paddingHorizontal: 25, marginBottom: 35, gap: 12 },
  wideBento: { borderRadius: 28, padding: 22, borderWidth: 1, minHeight: 140 },
  bentoHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
  bentoIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  bentoTypeLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  spotlightName: { fontSize: 22, fontFamily: Fonts.bold, marginBottom: 6 },
  spotlightSub: { fontSize: 14, fontFamily: Fonts.medium },
  bentoVisual: { position: 'absolute', right: 25, bottom: 25 },
  bentoRow: { flexDirection: 'row', gap: 12 },
  smallBento: { flex: 1, borderRadius: 28, padding: 22, borderWidth: 1, minHeight: 120 },
  bentoSmallLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  bentoSmallValue: { fontSize: 22, fontFamily: Fonts.bold, marginTop: 8 },
  bentoTrendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  bentoTrendText: { fontSize: 12, fontFamily: Fonts.bold },
  obligationBento: { borderRadius: 28, padding: 22, borderWidth: 1 },
  obligationHeader: { flexDirection: 'row', alignItems: 'center' },
  obligationSub: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 4 },
  ledgerSection: { paddingHorizontal: 25 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 22, fontFamily: Fonts.bold },
  ledgerCard: { borderRadius: 28, padding: 15, borderWidth: 1 },
  pulseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 10 },
  pulseRowMain: { backgroundColor: 'transparent' },
  pulseLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pulseIconContainer: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  pulseLabel: { fontSize: 15, fontFamily: Fonts.semibold },
  pulseValue: { fontSize: 18, fontFamily: Fonts.bold },
  ledgerDivider: { height: 1, marginHorizontal: 10 },
  dockedBarWrapper: { position: 'absolute', bottom: 120, alignSelf: 'center', zIndex: 1000, alignItems: 'center', justifyContent: 'center' },
  dockedBar: { flex: 1, borderRadius: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 10, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  dockBtn: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  dockMainBtn: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
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

export default SummaryScreen;