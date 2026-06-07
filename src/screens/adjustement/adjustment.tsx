import { Fonts } from '@/constants/theme';
import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import { formatTime } from '@/utils/date-utils';
import { getAdjustmentDashboardMetrics, getRecentAdjustments } from '@/database/db';
import { useNotifications } from '@/hooks/useNotifications';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
    AlertTriangle,
    BarChart3,
    Bell,
    Box,
    ChevronRight,
    DollarSign,
    Eye,
    Plus,
    RefreshCw,
    TrendingDown,
    TrendingUp
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Dimensions, Image, Modal, Platform, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
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
const AdjustmentItem = React.memo(({ item, onPress }: { item: any; onPress: () => void }) => {
  const { colors, timeSystem, language, t } = useSettings();

  if (!item) return null;

  const safeType = item?.type || 'unknown';
  const safeItem = {
    itemName: item?.itemName || t('common.unknown_item'),
    reason: item?.reason || t('adj.manual_correction'),
    createdAt: item?.createdAt || item?.date || '',
    newValue: Number(item?.newValue) || 0,
    quantity: Number(item?.quantity) || 0,
    type: safeType
  };

  const config = React.useMemo(() => {
    switch(safeType) {
      case 'price_up': return {
        icon: <TrendingUp size={18} color={colors.textSecondary} />,
        bg: colors.surface,
        label: t('adjustment.price_increase')
      };
      case 'price_down': return {
        icon: <TrendingDown size={18} color={colors.textSecondary} />,
        bg: colors.surface,
        label: t('adjustment.price_decrease')
      };
      case 'damaged': return {
        icon: <AlertTriangle size={18} color={colors.textSecondary} />,
        bg: colors.surface,
        label: t('adjustment.damaged')
      };
      default: return {
        icon: <BarChart3 size={18} color={colors.textSecondary} />,
        bg: colors.surface,
        label: t('adj.manual')
      };
    }
  }, [safeType, colors.surface, colors.textSecondary, t]);

  const timeStr = safeItem.createdAt ? formatTime(safeItem.createdAt, timeSystem, language) : '';

  return (
    <TouchableOpacity
      style={[styles.adjItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.adjIconCircle, { backgroundColor: config.bg }]}>
        {config.icon}
      </View>
      <View style={styles.adjMain}>
        <AppText variant="body" weight="bold" style={[styles.adjName, { color: colors.text }]} numberOfLines={1}>{safeItem.itemName}</AppText>
        <AppText variant="caption" weight="medium" style={[styles.adjType, { color: colors.textSecondary }]} numberOfLines={1}>{config.label}</AppText>
      </View>
      <View style={styles.adjEnd}>
        {safeType === 'damaged' ? (
          <AppText variant="body" weight="bold" shrink={false} style={[styles.adjAmount, { color: colors.text }]}>-{safeItem.quantity}</AppText>
        ) : (
          <AppText variant="body" weight="bold" shrink={false} style={[styles.adjAmount, { color: colors.text }]}>{safeItem.newValue.toLocaleString()}</AppText>
          )}
        <AppText variant="caption" weight="medium" style={[styles.adjTime, { color: colors.textSecondary }]} numberOfLines={1}>
          {timeStr || t('common.n_a')}
        </AppText>
      </View>
    </TouchableOpacity>
  );
});
AdjustmentItem.displayName = 'AdjustmentItem';

const MetricCard = ({ label, value, color, icon: Icon, accent }: { label: string; value: string; color: string; icon: any; accent?: string }) => {
  const { colors } = useSettings();
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.metricIconBox, { backgroundColor: colors.surface }]}>
        <Icon size={20} color={colors.textSecondary} />
      </View>
      <AppText variant="heading" weight="bold" style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>{value}</AppText>
      <AppText variant="caption" weight="medium" style={[styles.metricLabel, { color: colors.textSecondary }]} numberOfLines={2}>{label}</AppText>
    </View>
  );
};

const AdjustmentScreen = () => {
  const { colors, t, theme, userProfile } = useSettings();
  const { openSidebar } = useSidebar();
  const { notifCount } = useNotifications();
  const router = useRouter();
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

  const getNetChangeColor = () => {
    if (!metrics) return colors.text;
    if (metrics.netValueChange > 0) return '#34C759';
    if (metrics.netValueChange < 0) return '#FF3B30';
    return colors.text;
  };

  const getNetChangePrefix = () => {
    if (!metrics) return '';
    if (metrics.netValueChange > 0) return '+';
    return '';
  };

  return (
    <View style={[styles.screenWrapper, { backgroundColor: colors.background }]}>
      {/* Ambient Background */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgWash, { top: -150, left: -100, backgroundColor: colors.primary, opacity: 0.04 }]} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Integrated Header */}
        <View style={styles.integratedHeader}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.stock_rectification')}</AppText>
            <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('adj.calibration_suite')}</AppText>
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

            <TouchableOpacity 
              style={[styles.headerAvatarBox, { borderColor: colors.border, marginLeft: 10 }]}
              onPress={openSidebar}
            >
                <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.headerAvatar} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Dashboard Metrics Grid */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            <MetricCard 
              label={t('adj.metric_items_increased')}
              value={t('adj.items_suffix', { count: String(metrics?.itemsIncreased || 0) })}
              color="#34C759"
              icon={TrendingUp}
            />
            <MetricCard 
              label={t('adj.metric_items_decreased')}
              value={t('adj.items_suffix', { count: String(metrics?.itemsDecreased || 0) })}
              color="#FF3B30"
              icon={TrendingDown}
            />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard 
              label={t('adj.metric_damaged')}
              value={t('adj.units_suffix', { count: String(metrics?.damagedItems || 0) })}
              color="#FF9500"
              icon={AlertTriangle}
            />
            <MetricCard 
              label={t('adj.metric_value_lost')}
              value={`${(metrics?.estimatedValueLost || 0).toLocaleString()} ${t('common.etb')}`}
              color="#FF3B30"
              icon={DollarSign}
            />
          </View>
          <View style={styles.metricsRow}>
            <View style={[styles.netMetricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.netMetricRow}>
                <BarChart3 size={22} color={colors.textSecondary} />
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.netMetricLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('adj.metric_net_change')}</AppText>
              </View>
              <AppText variant="heading" weight="bold" style={[styles.netMetricValue, { color: colors.text }]} numberOfLines={1}>
                {getNetChangePrefix()}{(metrics?.netValueChange || 0).toLocaleString()} {t('common.etb')}
              </AppText>
            </View>
          </View>
        </Animated.View>

        {/* Recent Adjustments Section */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <View>
              <AppText variant="subtitle" weight="bold" style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={2}>{t('adj.recent_title')}</AppText>
              <AppText variant="body-sm" weight="medium" style={[styles.sectionSub, { color: colors.textSecondary }]} numberOfLines={2}>{t('adj.recent_sub')}</AppText>
            </View>
            <TouchableOpacity 
              style={[styles.viewAllBtn, { backgroundColor: colors.primary + '15' }]}
              onPress={handleViewHistory}
            >
              <AppText variant="body-sm" weight="bold" style={[styles.viewAllText, { color: colors.primary }]} numberOfLines={1}>{t('common.view_all')}</AppText>
              <ChevronRight size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {adjustments.length > 0 ? (
            <View style={styles.adjList}>
              {adjustments.map((item, index) => (
                <Animated.View key={item.id} entering={FadeInUp.delay(500 + index * 50).duration(400)}>
                  <AdjustmentItem item={item} onPress={() => setSelectedAdjustment(item)} />
                </Animated.View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Box size={50} color={colors.border} strokeWidth={1} />
              <AppText variant="body" weight="medium" align="center" style={[styles.emptyText, { color: colors.textSecondary }]} numberOfLines={2}>{t('adjustment.no_records')}</AppText>
            </View>
          )}
        </Animated.View>

      </ScrollView>
      
      {/* Quick Actions FAB */}
      <View style={styles.dockedBarWrapper}>
        <Animated.View style={[expandStyle, { height: 56, borderRadius: 28, overflow: 'hidden' }]}>
          <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint={theme === 'light' ? 'light' : 'dark'} style={[styles.dockedBar, { borderColor: colors.border, paddingHorizontal: isBarExpanded ? 10 : 0 }]}>
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
                  <TrendingUp size={20} color="#34C759" />
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
                  <TrendingDown size={20} color="#FF3B30" />
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
                  <AlertTriangle size={20} color="#FF9500" />
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
                  <Eye size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}
            
            <TouchableOpacity 
              style={[styles.dockMainBtn, { backgroundColor: isBarExpanded ? colors.primary : colors.text }]}
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
                <RefreshCw size={24} color={colors.background} strokeWidth={2.5} />
              ) : (
                <Plus size={24} color={colors.background} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </View>

      {/* Options Modal */}
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
        <TouchableOpacity style={styles.modalOverlayC} activeOpacity={1} onPress={() => setShowOptions(false)}>
          <View style={[styles.optionsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <AppText variant="heading" weight="bold" align="center" style={[styles.optionsTitle, { color: colors.text }]} numberOfLines={2}>{t('adjustment.select_type')}</AppText>
              <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.border }]} onPress={() => { setShowOptions(false); setShowIncrease(true); }}>
              <TrendingUp size={20} color="#34C759" style={{ marginRight: 15 }} />
              <AppText variant="subtitle" weight="bold" style={[styles.optionText, { color: colors.text }]} numberOfLines={1}>{t('adj.add_increase')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.border }]} onPress={() => { setShowOptions(false); setShowDecrease(true); }}>
              <TrendingDown size={20} color="#FF3B30" style={{ marginRight: 15 }} />
              <AppText variant="subtitle" weight="bold" style={[styles.optionText, { color: colors.text }]} numberOfLines={1}>{t('adj.add_decrease')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.border }]} onPress={() => { setShowOptions(false); setShowDamaged(true); }}>
              <AlertTriangle size={20} color="#FF9500" style={{ marginRight: 15 }} />
              <AppText variant="subtitle" weight="bold" style={[styles.optionText, { color: colors.text }]} numberOfLines={1}>{t('adj.record_damage')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionBtn} onPress={() => { setShowOptions(false); handleViewHistory(); }}>
              <Eye size={20} color={colors.textSecondary} style={{ marginRight: 15 }} />
              <AppText variant="subtitle" weight="bold" style={[styles.optionText, { color: colors.text }]} numberOfLines={1}>{t('adj.view_history')}</AppText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Forms Modals */}
      <Modal visible={showIncrease} transparent animationType="slide" onRequestClose={() => setShowIncrease(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowIncrease(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.88 }]}>
            <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
            <IncreaseScreen onComplete={() => { setShowIncrease(false); loadData(); }} />
          </View>
        </View>
      </Modal>

      <Modal visible={showDecrease} transparent animationType="slide" onRequestClose={() => setShowDecrease(false)}>
        <View style={styles.modalOverlay}>
           <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowDecrease(false)} />
           <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.88 }]}>
              <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
              <DecreaseScreen onComplete={() => { setShowDecrease(false); loadData(); }} />
           </View>
        </View>
      </Modal>

      <Modal visible={showDamaged} transparent animationType="slide" onRequestClose={() => setShowDamaged(false)}>
        <View style={styles.modalOverlay}>
           <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowDamaged(false)} />
           <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.88 }]}>
              <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
              <DamagedScreen onComplete={() => { setShowDamaged(false); loadData(); }} />
           </View>
        </View>
      </Modal>

      <Modal visible={!!selectedAdjustment} transparent animationType="slide" onRequestClose={() => setSelectedAdjustment(null)}>
        <View style={styles.modalOverlay}>
           <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedAdjustment(null)} />
           <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background, height: Dimensions.get('window').height * 0.88 }]}>
              <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
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
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 4,
  },
  viewAllText: {
    fontFamily: Fonts.bold,
  },
  adjList: {
    gap: 2,
  },
  adjItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  adjIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  adjMain: {
    flex: 1,
  },
  adjName: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  adjType: {
    fontFamily: Fonts.medium,
  },
  adjEnd: {
    alignItems: 'flex-end',
  },
  adjAmount: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  adjTime: {
    fontFamily: Fonts.medium,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontFamily: Fonts.medium,
    marginTop: 15,
  },
  // FAB
  dockedBarWrapper: { position: 'absolute', bottom: 120, alignSelf: 'center', zIndex: 1000, alignItems: 'center', justifyContent: 'center' },
  dockedBar: { flex: 1, borderRadius: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 10, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  dockBtn: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  dockMainBtn: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
  // Modals
  modalOverlayC: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  optionsBox: { width: '85%', borderRadius: 28, padding: 25, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 15 },
  optionsTitle: { fontSize: 20, fontFamily: Fonts.bold, marginBottom: 25, textAlign: 'center' },
  optionBtn: { width: '100%', paddingVertical: 18, flexDirection: 'row', alignItems: 'center' },
  optionText: { fontSize: 16, fontFamily: Fonts.bold },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  bottomSheetContainer: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40, overflow: 'hidden' },
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