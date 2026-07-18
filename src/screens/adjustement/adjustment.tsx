import { Fonts } from '@/constants/theme';
import { NotificationBell } from '@/components/NotificationBell';
import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import { formatTime } from '@/utils/date-utils';
import { getAdjustmentDashboardMetrics, getRecentAdjustments } from '@/database/db';
import { useNotifications } from '@/hooks/useNotifications';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
    AlertTriangle,
    BarChart3,
    Box,
    DollarSign,
    Eye,
    Plus,
    TrendingDown,
    TrendingUp,
    X
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Dimensions, Image, Modal, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppNumber, AppText} from '@/components/ui';
import Animated, {
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import AdjustmentDetailsScreen from './adjustment-details';
import DamagedScreen from './damaged';
import DecreaseScreen from './decrease';
import IncreaseScreen from './increase';
import { getAdjustmentGlass } from './glass-adjustment';
import { useTutorial, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { adjustmentTutorial } from '@/tutorials/definitions';
const TYPE_CONFIG: Record<string, { icon: any; iconBg: string; labelKey: string }> = {
  price_up: { icon: TrendingUp, iconBg: '#30D158', labelKey: 'adjustment.price_increase' },
  price_down: { icon: TrendingDown, iconBg: '#FF453A', labelKey: 'adjustment.price_decrease' },
  damaged: { icon: AlertTriangle, iconBg: '#FF9F0A', labelKey: 'adjustment.damaged' },
  default: { icon: BarChart3, iconBg: '#8E8E93', labelKey: 'adj.manual' },
};

const AdjustmentItem = React.memo(({ item, onPress }: { item: any; onPress: () => void }) => {
  const { colors, timeSystem, language, t } = useSettings();
  const G = getAdjustmentGlass(colors);

  const safeType = item?.type || 'unknown';
  const cfg = TYPE_CONFIG[safeType] || TYPE_CONFIG.default;
  const IconComp = cfg.icon;

  if (!item) return null;

  const safeItem = {
    itemName: item?.itemName || t('common.unknown_item'),
    reason: item?.reason || t('adj.manual_correction'),
    createdAt: item?.createdAt || item?.date || '',
    newValue: Number(item?.newValue) || 0,
    quantity: Number(item?.quantity) || 0,
    type: safeType,
  };

  const timeStr = safeItem.createdAt ? formatTime(safeItem.createdAt, timeSystem, language) : '';

  return (
    <TouchableOpacity
      style={[styles.activityCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.activityIconCircle, { backgroundColor: cfg.iconBg + '18', borderColor: G.border }]}>
        <IconComp size={18} color={cfg.iconBg} />
      </View>
      <View style={styles.activityInfo}>
        <AppText variant="body" weight="bold" style={[styles.activityName, { color: G.fg }]} numberOfLines={1}>{safeItem.itemName}</AppText>
        <AppText variant="body-sm" weight="medium" style={[styles.activityMeta, { color: G.muted }]} numberOfLines={1}>{t(cfg.labelKey)}</AppText>
      </View>
      <View style={styles.activityRight}>
        {safeType === 'damaged' ? (
          <AppNumber value={safeItem.quantity} size="body" weight="bold" showSign style={[styles.activityAmount, { color: cfg.iconBg }]} />
        ) : (
          <AppNumber value={safeItem.newValue} size="body" weight="bold" style={[styles.activityAmount, { color: G.fg }]} />
        )}
        <AppText variant="caption" weight="medium" style={[styles.activityTime, { color: G.muted }]} numberOfLines={1}>
          {timeStr || t('common.n_a')}
        </AppText>
      </View>
    </TouchableOpacity>
  );
});
AdjustmentItem.displayName = 'AdjustmentItem';

const MetricCard = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: any }) => {
  const { colors } = useSettings();
  const G = getAdjustmentGlass(colors);
  return (
    <View style={[styles.metricCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
      <View style={[styles.metricIconBox, { backgroundColor: G.accentGlass }]}>
        <Icon size={20} color={G.muted} />
      </View>
      {typeof value === 'string' ? (
        <AppText variant="heading" weight="bold" style={[styles.metricValue, { color: G.fg }]} numberOfLines={1}>{value}</AppText>
      ) : value}
      <AppText variant="caption" weight="medium" style={[styles.metricLabel, { color: G.muted }]} numberOfLines={2}>{label}</AppText>
    </View>
  );
};

const AdjustmentScreen = () => {
  const { colors, t, userProfile } = useSettings();
  const G = getAdjustmentGlass(colors);
  const { openSidebar } = useSidebar();
  const { notifCount } = useNotifications();
  const router = useRouter();
  const tutorial = useTutorial({ tutorial: adjustmentTutorial });
  const [showOptions, setShowOptions] = useState(false);
  const [showIncrease, setShowIncrease] = useState(false);
  const [showDecrease, setShowDecrease] = useState(false);
  const [showDamaged, setShowDamaged] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [isBarExpanded, setIsBarExpanded] = useState(false);

  const { width } = Dimensions.get('window');
  const expandedWidth = useSharedValue(56);
  
  React.useEffect(() => {
    expandedWidth.value = withSpring(isBarExpanded ? width - 50 : 56, { damping: 15, stiffness: 100 });
  }, [isBarExpanded, width, expandedWidth]);

  const expandStyle = useAnimatedStyle(() => ({
    width: expandedWidth.value,
  }));

  const loadData = useCallback(async () => {
    const data = await getRecentAdjustments(undefined, 5);
    setAdjustments(data);
    const metricsData = getAdjustmentDashboardMetrics();
    setMetrics(metricsData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadData();
  };

  const handleViewHistory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Trigger the adjustment details full screen
    setSelectedAdjustment({ viewAll: true } as any);
  };

  return (
    <View style={[styles.screenWrapper, { backgroundColor: G.bg }]}>
      {/* Ambient Background */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgWash, { top: -150, left: -100, backgroundColor: '#FFFFFF', opacity: 0.03 }]} />
        <View style={[styles.bgWash, { top: 350, right: -80, backgroundColor: '#FFFFFF', opacity: 0.02 }]} />
        <View style={[styles.bgWash, { top: 700, left: -50, backgroundColor: '#FFFFFF', opacity: 0.015 }]} />
      </View>

      <TutorialScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Integrated Header */}
        <TutorialTarget id="adj-header">
        <View style={styles.integratedHeader}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: G.muted }]} numberOfLines={1}>{t('adj.stock_rectification')}</AppText>
            <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{t('adj.calibration_suite')}</AppText>
          </View>
          
          <View style={styles.headerActions}>
            <TutorialButton tutorialId="adjustment" screenName={t('screen.adjustment')} />
            <NotificationBell size={22} count={notifCount} />

            <View style={[styles.headerAvatarBox, { borderColor: G.border, backgroundColor: G.bgCard, marginLeft: 10 }]}>
              <TouchableOpacity onPress={openSidebar}>
                <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.headerAvatar} />
              </TouchableOpacity>
              <View style={[styles.onlineIndicator, { backgroundColor: G.fg, borderColor: G.bg }]} />
            </View>
          </View>
        </View>
        </TutorialTarget>

        {/* Dashboard Metrics Grid */}
        <TutorialTarget id="adj-types">
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            <MetricCard 
              label={t('adj.metric_items_increased')}
              value={<AppNumber value={metrics?.itemsIncreased ?? 0} size="heading" weight="bold" />}
              icon={TrendingUp}
            />
            <MetricCard 
              label={t('adj.metric_items_decreased')}
              value={<AppNumber value={metrics?.itemsDecreased ?? 0} size="heading" weight="bold" />}
              icon={TrendingDown}
            />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard 
              label={t('adj.metric_damaged')}
              value={<AppNumber value={metrics?.damagedItems ?? 0} size="heading" weight="bold" />}
              icon={AlertTriangle}
            />
            <TutorialTarget id="adj-stats">
            <MetricCard 
              label={t('adj.metric_value_lost')}
              value={<AppNumber value={metrics?.estimatedValueLost ?? 0} prefix="ETB " size="heading" weight="bold" />}
              icon={DollarSign}
            />
            </TutorialTarget>
          </View>
          <View style={styles.metricsRow}>
            <View style={[styles.netMetricCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <View style={styles.netMetricRow}>
                <BarChart3 size={22} color={G.muted} />
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.netMetricLabel, { color: G.muted }]} numberOfLines={1}>{t('adj.metric_net_change')}</AppText>
              </View>
              <AppNumber value={metrics?.netValueChange ?? 0} prefix="ETB " size="heading" weight="bold" showSign />
            </View>
          </View>
        </Animated.View>
        </TutorialTarget>

        {/* Recent Adjustments Section */}
        <TutorialTarget id="adj-ledger">
        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <View>
              <AppText variant="heading" weight="bold" style={[styles.sectionTitle, { color: G.fg }]} numberOfLines={2}>{t('adj.recent_title')}</AppText>
              <AppText variant="body-sm" weight="medium" style={[styles.sectionSub, { color: G.muted }]} numberOfLines={1}>{t('adj.recent_sub')}</AppText>
            </View>
            <TouchableOpacity 
              style={[styles.viewAllBtn, { borderColor: G.border }]}
              onPress={handleViewHistory}
            >
              <AppText variant="body" weight="bold" shrink={false} style={[styles.viewAllText, { color: G.fgSecondary }]} numberOfLines={1}>{t('common.view_all')}</AppText>
            </TouchableOpacity>
          </View>

          {adjustments.length > 0 ? (
            <View style={styles.feedList}>
              {adjustments.map((item, index) => (
                <Animated.View key={item.id} entering={FadeInUp.delay(500 + index * 40).springify().damping(22).stiffness(150)}>
                  <AdjustmentItem item={item} onPress={() => setSelectedAdjustment(item)} />
                </Animated.View>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <View style={[styles.activityIconCircle, { backgroundColor: G.accentGlass, borderColor: G.border }]}>
                <Box size={22} color={G.muted} />
              </View>
              <AppText variant="body" weight="medium" style={[styles.emptyText, { color: G.muted }]} numberOfLines={2}>{t('adjustment.no_records')}</AppText>
            </View>
          )}
        </Animated.View>
        </TutorialTarget>

      </TutorialScrollView>
      
      {/* Quick Actions FAB */}
      <View style={styles.dockedBarWrapper}>
        <Animated.View style={[expandStyle, { height: 60, borderRadius: 30, overflow: 'hidden' }]}>
          <View style={[styles.dockedBar, { borderColor: G.borderLight, backgroundColor: G.bgCardStrong, paddingHorizontal: isBarExpanded ? 12 : 0 }]}>
            {isBarExpanded && (
              <Animated.View entering={FadeInUp.delay(100)}>
                <TouchableOpacity 
                  style={styles.dockBtn}
                  onPress={() => { 
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
                    setIsBarExpanded(false);
                    setShowIncrease(true);
                  }}
                >
                  <TrendingUp size={20} color={colors.success} />
                </TouchableOpacity>
              </Animated.View>
            )}
            
            {isBarExpanded && (
              <Animated.View entering={FadeInUp.delay(150)}>
                <TouchableOpacity 
                  style={styles.dockBtn}
                  onPress={() => { 
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
                    setIsBarExpanded(false);
                    setShowDecrease(true);
                  }}
                >
                  <TrendingDown size={20} color={colors.error} />
                </TouchableOpacity>
              </Animated.View>
            )}

            {isBarExpanded && (
              <Animated.View entering={FadeInUp.delay(200)}>
                <TouchableOpacity 
                  style={styles.dockBtn}
                  onPress={() => { 
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
                    setIsBarExpanded(false);
                    setShowDamaged(true);
                  }}
                >
                  <AlertTriangle size={20} color={colors.warning} />
                </TouchableOpacity>
              </Animated.View>
            )}

            {isBarExpanded && (
              <Animated.View entering={FadeInUp.delay(250)}>
                <TouchableOpacity 
                  style={styles.dockBtn}
                  onPress={() => { 
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
                    setIsBarExpanded(false);
                    handleViewHistory();
                  }}
                >
                  <Eye size={20} color={G.muted} />
                </TouchableOpacity>
              </Animated.View>
            )}
            
            <TouchableOpacity 
              style={[styles.dockMainBtn, { backgroundColor: G.fg }]}
              onPress={() => {
                if(isBarExpanded) {
                  setShowOptions(true);
                  setIsBarExpanded(false);
                } else {
                  setIsBarExpanded(true);
                }
              }}
            >
              {isBarExpanded ? (
                <X size={24} color={G.bg} strokeWidth={2.5} />
              ) : (
                <Plus size={24} color={G.bg} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      {/* Options Modal */}
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
        <TouchableOpacity style={styles.modalOverlayC} activeOpacity={1} onPress={() => setShowOptions(false)}>
          <View style={[styles.optionsBox, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppText variant="heading" weight="bold" align="center" style={[styles.optionsTitle, { color: G.fg }]} numberOfLines={2}>{t('adjustment.select_type')}</AppText>
              <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: G.border }]} onPress={() => { setShowOptions(false); setShowIncrease(true); }}>
              <TrendingUp size={20} color={colors.success} style={{ marginRight: 15 }} />
              <AppText variant="subtitle" weight="bold" style={[styles.optionText, { color: G.fg }]} numberOfLines={1}>{t('adj.add_increase')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: G.border }]} onPress={() => { setShowOptions(false); setShowDecrease(true); }}>
              <TrendingDown size={20} color={colors.error} style={{ marginRight: 15 }} />
              <AppText variant="subtitle" weight="bold" style={[styles.optionText, { color: G.fg }]} numberOfLines={1}>{t('adj.add_decrease')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: G.border }]} onPress={() => { setShowOptions(false); setShowDamaged(true); }}>
              <AlertTriangle size={20} color={colors.warning} style={{ marginRight: 15 }} />
              <AppText variant="subtitle" weight="bold" style={[styles.optionText, { color: G.fg }]} numberOfLines={1}>{t('adj.record_damage')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionBtn} onPress={() => { setShowOptions(false); handleViewHistory(); }}>
              <Eye size={20} color={G.muted} style={{ marginRight: 15 }} />
              <AppText variant="subtitle" weight="bold" style={[styles.optionText, { color: G.fg }]} numberOfLines={1}>{t('adj.view_history')}</AppText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Forms Modals */}
      <Modal visible={showIncrease} transparent animationType="slide" onRequestClose={() => setShowIncrease(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowIncrease(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: G.bg, borderTopWidth: 1, borderTopColor: G.border, height: Dimensions.get('window').height * 0.90 }]}>
            <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: G.mutedLight }]} /></View>
            <IncreaseScreen onComplete={() => { setShowIncrease(false); loadData(); }} />
          </View>
        </View>
      </Modal>

      <Modal visible={showDecrease} transparent animationType="slide" onRequestClose={() => setShowDecrease(false)}>
        <View style={styles.modalOverlay}>
           <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowDecrease(false)} />
           <View style={[styles.bottomSheetContainer, { backgroundColor: G.bg, borderTopWidth: 1, borderTopColor: G.border, height: Dimensions.get('window').height * 0.90 }]}>
              <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: G.mutedLight }]} /></View>
              <DecreaseScreen onComplete={() => { setShowDecrease(false); loadData(); }} />
           </View>
        </View>
      </Modal>

      <Modal visible={showDamaged} transparent animationType="slide" onRequestClose={() => setShowDamaged(false)}>
        <View style={styles.modalOverlay}>
           <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowDamaged(false)} />
           <View style={[styles.bottomSheetContainer, { backgroundColor: G.bg, borderTopWidth: 1, borderTopColor: G.border, height: Dimensions.get('window').height * 0.90 }]}>
              <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: G.mutedLight }]} /></View>
              <DamagedScreen onComplete={() => { setShowDamaged(false); loadData(); }} />
           </View>
        </View>
      </Modal>

      <Modal visible={!!selectedAdjustment} transparent animationType="slide" onRequestClose={() => setSelectedAdjustment(null)}>
        <View style={styles.modalOverlay}>
           <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedAdjustment(null)} />
           <View style={[styles.bottomSheetContainer, { backgroundColor: G.bg, borderTopWidth: 1, borderTopColor: G.border, height: Dimensions.get('window').height * 0.90 }]}>
              <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: G.mutedLight }]} /></View>
              {selectedAdjustment && selectedAdjustment.viewAll ? (
                <AdjustmentDetailsScreen 
                  adjustment={null} 
                  onClose={() => setSelectedAdjustment(null)} 
                  onRefresh={() => loadData()} 
                />
              ) : selectedAdjustment ? (
                <AdjustmentDetailsScreen 
                  adjustment={selectedAdjustment} 
                  onClose={() => setSelectedAdjustment(null)} 
                  onRefresh={() => loadData()} 
                />
              ) : null}
           </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: { flex: 1 },
  scrollContent: { paddingBottom: 220, paddingTop: 10 },
  bgWash: { position: 'absolute', width: 400, height: 400, borderRadius: 200, opacity: 0.3 },
  integratedHeader: {
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
  headerLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontFamily: Fonts.bold },
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
  // Metrics Section
  metricsGrid: {
    paddingHorizontal: 25,
    marginBottom: 30,
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
    width: 36,
    height: 36,
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
  netMetricCard: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  netMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  netMetricLabel: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  netMetricValue: {
    fontFamily: Fonts.bold,
  },
  // Recent Adjustments
  recentSection: {
    paddingHorizontal: 25,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  sectionSub: {
    fontFamily: Fonts.medium,
  },
  viewAllBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  viewAllText: {
    fontFamily: Fonts.bold,
  },
  feedList: {
    gap: 0,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  activityIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderWidth: 1,
    overflow: 'hidden',
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  activityMeta: {
    fontFamily: Fonts.medium,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  activityTime: {
    fontFamily: Fonts.medium,
  },
  emptyState: {
    paddingVertical: 56,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    gap: 12,
    overflow: 'hidden',
  },
  emptyText: {
    fontFamily: Fonts.medium,
  },
  // FAB
  dockedBarWrapper: { position: 'absolute', bottom: 120, alignSelf: 'center', zIndex: 1000, alignItems: 'center', justifyContent: 'center' },
  dockedBar: { flex: 1, borderRadius: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 10, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  dockBtn: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  dockMainBtn: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  // Modals
  modalOverlayC: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  optionsBox: { width: '85%', borderRadius: 28, padding: 25, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  optionsTitle: { fontSize: 20, fontFamily: Fonts.bold, marginBottom: 25, textAlign: 'center' },
  optionBtn: { width: '100%', paddingVertical: 18, flexDirection: 'row', alignItems: 'center' },
  optionText: { fontSize: 16, fontFamily: Fonts.bold },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  bottomSheetContainer: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40 },
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

export default AdjustmentScreen;