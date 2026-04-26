import React, { useState, useEffect } from 'react';
import { 
  View,
  Text as RNText, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  Dimensions,
  Modal,
  Alert,
  RefreshControl,
  Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSidebar } from '@/context/SidebarContext';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import { 
  Plus, 
  Eye, 
  Bell, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Package,
  TrendingUp,
  Zap,
  ArrowUpRight,
  Wallet,
  Calendar,
  Layers,
  BarChart3
} from 'lucide-react-native';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp, 
  useSharedValue, 
  withSpring, 
  useAnimatedStyle,
  FadeOut
} from 'react-native-reanimated';
import { BarChart } from 'react-native-gifted-charts';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { 
  getRecentSales, 
  getSalesChartData, 
  insertSale, 
  getSalesSummary, 
  getTopSellingItems 
} from '@/database/db';
import { Fonts } from '@/constants/theme';
import { formatDate, formatShortDate, getDayName } from '@/utils/date-utils';
import { formatAbbreviated } from '@/utils/number-utils';
import SalesRecordScreen from './sales-record';
import SearchScreen from './search';
import GlobalCheckout from './sale-form';
import PendingSales from './pending';
import SaleDetailsScreen from './sales-details';
import GlobalHeader from '@/components/GlobalHeader';
import { useNotifications } from '@/hooks/useNotifications';

// Removed local PROFILE_IMAGES definition as it's now in SettingsContext

const { width, height } = Dimensions.get('window');
const CHART_WIDTH = width - 80; 
const CHART_HEIGHT = 150;

const SalesDashboard = () => {
  const { openSidebar } = useSidebar();
  const { userProfile, colors, calendarType, language, t, theme } = useSettings();
  const { notifCount } = useNotifications();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('W');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [periodOffset, setPeriodOffset] = useState(0);
  const [showSalesRecord, setShowSalesRecord] = useState(false);
  const [showSaleFlow, setShowSaleFlow] = useState(false);
  const [saleFlowStep, setSaleFlowStep] = useState<'search' | 'form' | 'pending'>('search');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [pendingSales, setPendingSales] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);
  const [isBarExpanded, setIsBarExpanded] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [chartDataState, setChartDataState] = useState<{ labels: string[], values: number[] }>({ labels: [], values: [] });
  const [summary, setSummary] = useState<any>(null);
  const [topItems, setTopItems] = useState<any[]>([]);

  const loadData = () => {
    const sales = getRecentSales(10);
    setRecentSales(sales);
    
    const dbChartData = getSalesChartData(activeTab as 'W' | 'M' | 'Y', periodOffset);
    if (dbChartData && dbChartData.length > 0) {
      setChartDataState({
        labels: dbChartData.map(d => d.label),
        values: dbChartData.map(d => d.value)
      });
    } else {
      setChartDataState({ labels: ['None'], values: [0] });
    }

    const salesSummary = getSalesSummary();
    setSummary(salesSummary);

    const products = getTopSellingItems(5);
    setTopItems(products);
  };

  const onRefresh = React.useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 800);
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [activeTab, periodOffset]);

  const expandedWidth = useSharedValue(56);
  useEffect(() => {
    expandedWidth.value = withSpring(isBarExpanded ? width - 50 : 56, { damping: 15, stiffness: 100 });
  }, [isBarExpanded, width]);

  const expandStyle = useAnimatedStyle(() => ({
    width: expandedWidth.value,
  }));

  useEffect(() => {
    setSelectedIdx(null);
    setPeriodOffset(0); 
  }, [activeTab]);

  const currentData = chartDataState;
  const maxValueInData = Math.max(...currentData.values, 500);
  const chartMax = maxValueInData * 1.3;

  // Format data for GiftedCharts with premium theme
  const chartData = currentData.values.map((val, i) => {
    let label = currentData.labels[i];
    if (activeTab === 'W' && label !== 'None') {
      const dayIdx = parseInt(label);
      if (!isNaN(dayIdx)) {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay() + dayIdx);
        label = getDayName(d, calendarType, language).substring(0, 3);
      }
    }

    return {
      value: val,
      label: label,
      frontColor: colors.primary,
      gradientColor: colors.primary + 'AA',
      topLabelComponent: () => (
        selectedIdx === i ? (
          <Animated.View entering={FadeInUp.duration(300)} style={styles.chartTooltip}>
            <RNText style={[styles.tooltipText, { color: '#FFF' }]}>{formatAbbreviated(val)}</RNText>
          </Animated.View>
        ) : null
      ),
    };
  });

  const totalRevenue = currentData.values.reduce((a, b) => a + b, 0);

  const handlePeriodChange = (tab: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const salesKPIs = [
    { title: t('sales.avg_sale'), value: `${Math.round(summary?.avgSaleValue || 0)} ETB`, icon: TrendingUp, color: colors.primary },
    { title: t('sales.vol_units'), value: summary?.totalVolume || '0', icon: Layers, color: colors.success || '#34C759' },
    { title: t('sales.peak_hour'), value: `${summary?.peakHour || '--'}:00`, icon: Clock, color: '#FF9500' },
    { title: t('sales.methods'), value: `${summary?.payments?.length || 0} ${t('sales.types')}`, icon: Wallet, color: '#FF3B30' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Background Ambience */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgWash, { top: -50, right: -50, backgroundColor: colors.primary, opacity: 0.08 }]} />
      </View>

      <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={[styles.scrollContent, { backgroundColor: 'transparent' }]}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={colors.text}
              colors={[colors.text]}
            />
          }
        >
          {/* Integrated Header */}
          <View style={styles.integratedHeader}>
            <View style={{ flex: 1 }}>
              <RNText style={[styles.headerLabel, { color: colors.textSecondary }]}>{t('sales.overview')}</RNText>
              <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('sales.revenue_hub')}</RNText>
            </View>
            
            <View style={styles.headerActions}>
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

              <TouchableOpacity onPress={openSidebar} style={[styles.headerAvatarBox, { borderColor: colors.border }]}>
                 <Image source={PROFILE_IMAGES[userProfile.avatarIndex]} style={styles.headerAvatar} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Revenue Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.revenueMainDisplay}>
              <RNText style={[styles.totalRevenueVal, { color: colors.text }]}>
                {formatAbbreviated(totalRevenue)}<RNText style={styles.currency}> ETB</RNText>
              </RNText>
              <RNText style={[styles.revenueRangeLabel, { color: colors.textSecondary }]}>
                {activeTab === 'W' ? t('sales.weekly_revenue') : activeTab === 'M' ? t('sales.monthly_revenue') : t('sales.yearly_revenue')}
              </RNText>
            </View>

            <View style={styles.chartContainer}>
              <BarChart
                data={chartData}
                barWidth={32}
                spacing={24}
                roundedTop
                hideRules
                hideAxesAndRules
                yAxisThickness={0}
                xAxisThickness={0}
                noOfSections={4}
                maxValue={chartMax}
                isAnimated
                showGradient
                initialSpacing={10}
                onPress={(item: any, index: number) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedIdx(index);
                }}
                width={width - 50}
                height={160}
                showValuesAsTopLabel={false}
              />
            </View>

            {/* Time Period Selectors */}
            <View style={[styles.periodBar, { backgroundColor: colors.surface }]}>
              {['W', 'M', 'Y'].map(tab => (
                <TouchableOpacity 
                   key={tab} 
                   onPress={() => handlePeriodChange(tab)}
                   style={[styles.periodTab, activeTab === tab && { backgroundColor: colors.background }]}
                >
                  <RNText style={[styles.periodTabText, { color: activeTab === tab ? colors.text : colors.textSecondary }]}>{tab}</RNText>
                </TouchableOpacity>
              ))}
              
              <View style={styles.periodDivider} />
              
              <TouchableOpacity onPress={() => setPeriodOffset(prev => prev - 1)} style={styles.navBtn}>
                <ChevronLeft size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPeriodOffset(prev => prev + 1)} disabled={periodOffset >= 0} style={[styles.navBtn, periodOffset >= 0 && { opacity: 0.3 }]}>
                <ChevronRight size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Business Intelligence Bento */}
          <View style={styles.bentoSection}>
            <View style={styles.bentoGrid}>
              {salesKPIs.map((kpi, idx) => {
                const KpiIcon = kpi.icon;
                return (
                  <Animated.View key={idx} entering={FadeInDown.delay(idx * 100).duration(500)} style={[styles.bentoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.bentoIconArea, { backgroundColor: kpi.color + '15' }]}>
                      <KpiIcon size={18} color={kpi.color} />
                    </View>
                    <RNText style={[styles.bentoValue, { color: colors.text }]}>{kpi.value}</RNText>
                    <RNText style={[styles.bentoLabel, { color: colors.textSecondary }]}>{kpi.title}</RNText>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          {/* Top Selling Products */}
          {topItems.length > 0 && (
            <View style={styles.topItemsSection}>
              <View style={styles.sectionHead}>
                <RNText style={[styles.sectionTitle, { color: colors.text }]}>{t('sales.top_performing')}</RNText>
                <BarChart3 size={18} color={colors.textSecondary} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topItemsScroll}>
                {topItems.map((item, idx) => (
                  <View key={idx} style={[styles.topItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
                      <RNText style={styles.rankText}>{idx + 1}</RNText>
                    </View>
                    <RNText numberOfLines={1} style={[styles.topItemName, { color: colors.text }]}>{item.name}</RNText>
                    <RNText style={[styles.topItemRevenue, { color: colors.primary }]}>{item.totalRevenue.toLocaleString()} ETB</RNText>
                    <RNText style={[styles.topItemVolume, { color: colors.textSecondary }]}>
                      {t('common.item_sold_count', { 
                        count: item.totalQty, 
                        unit: t('form.' + (item.baseUnit || 'pieces').toLowerCase()) 
                      })}
                    </RNText>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Transaction Ledger */}
          <View style={styles.ledgerSection}>
            <View style={styles.sectionHead}>
              <View>
                <RNText style={[styles.sectionTitle, { color: colors.text }]}>{t('sales.recent_sales')}</RNText>
                <RNText style={[styles.sectionSub, { color: colors.textSecondary }]}>{t('sales.detailed_ledger')}</RNText>
              </View>
              <TouchableOpacity onPress={() => setShowSalesRecord(true)}>
                <RNText style={[styles.viewAllBtn, { color: colors.primary }]}>{t('common.view_all')}</RNText>
              </TouchableOpacity>
            </View>

            <View style={styles.ledgerList}>
              {recentSales.map((sale, idx) => (
                <Animated.View key={idx} entering={FadeInDown.delay(300 + (idx * 50)).duration(500)}>
                  <SalesActivityCard 
                    sale={sale}
                    onPress={() => {
                      setSelectedSale(sale);
                      setShowSaleDetails(true);
                    }} 
                  />
                </Animated.View>
              ))}
              {recentSales.length === 0 && (
                <View style={styles.emptyContainer}>
                  <RNText style={[styles.emptyText, { color: colors.textSecondary }]}>{t('sales.no_sales')}</RNText>
                </View>
              )}
            </View>
          </View>

        </ScrollView>
      </Animated.View>

      {/* Expanding Smart FAB */}
      <View style={styles.dockedBarWrapper}>
        <Animated.View style={[expandStyle, { height: 56, borderRadius: 28, overflow: 'hidden' }]}>
          <BlurView intensity={80} tint={theme !== 'light' ? 'dark' : 'light'} style={[styles.dockedBar, { borderColor: colors.border, paddingHorizontal: isBarExpanded ? 10 : 0 }]}>
            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                <TouchableOpacity style={styles.dockBtn} onPress={() => { setShowSalesRecord(true); setIsBarExpanded(false); }}>
                  <Search size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}
            
            <TouchableOpacity 
              style={[styles.dockMainBtn, { backgroundColor: isBarExpanded ? colors.primary : colors.text }]} 
              onPress={() => {
                if(isBarExpanded) {
                  setSaleFlowStep('search');
                  setSelectedItem(null);
                  setShowSaleFlow(true);
                  setIsBarExpanded(false);
                } else {
                  setIsBarExpanded(true);
                }
              }}
            >
              <Plus size={24} color={isBarExpanded ? colors.background : colors.background} />
            </TouchableOpacity>
            
            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                <TouchableOpacity style={styles.dockBtn} onPress={() => { router.push('/(tabs)/summary'); setIsBarExpanded(false); }}>
                  <BarChart3 size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}
          </BlurView>
        </Animated.View>
      </View>


      {/* Sales Record Bottom Sheet */}
      <Modal
        visible={showSalesRecord}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSalesRecord(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSalesRecord(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <SalesRecordScreen onClose={() => setShowSalesRecord(false)} />
          </View>
        </View>
      </Modal>

      {/* Sale Details Bottom Sheet */}
      <Modal
        visible={showSaleDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSaleDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSaleDetails(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <SaleDetailsScreen 
                sale={selectedSale} 
                onClose={() => {
                  setShowSaleDetails(false);
                  loadData();
                }} 
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Sale Multi-Step Flow */}
      <Modal
        visible={showSaleFlow}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSaleFlow(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSaleFlow(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            {saleFlowStep === 'search' && (
              <SearchScreen 
                onSelectItem={(item: any) => {
                  const existing = pendingSales.find(s => s.id === item.id);
                  if (existing) {
                    setPendingSales(pendingSales.map(s => s.id === item.id ? { ...s, quantity: s.quantity + 1 } : s));
                  } else {
                    setPendingSales([...pendingSales, {
                      ...item,
                      id: item.id, // Using item ID as ID for cart uniquely
                      quantity: 1,
                      unitType: 'base', // Default to base unit
                    }]);
                  }
                  setSaleFlowStep('pending');
                }}
              />
            )}
            {saleFlowStep === 'pending' && (
              <PendingSales
                items={pendingSales}
                onUpdateItem={(id, updates) => {
                  setPendingSales(pendingSales.map(s => s.id === id ? { ...s, ...updates } : s));
                }}
                onRemoveItem={(id) => {
                  setPendingSales(pendingSales.filter(s => s.id !== id));
                }}
                onAddMore={() => {
                  setSaleFlowStep('search');
                }}
                onFinish={() => {
                  setSaleFlowStep('form');
                }}
              />
            )}
            {saleFlowStep === 'form' && (
              <GlobalCheckout 
                cart={pendingSales}
                onBack={() => setSaleFlowStep('pending')}
                onFinish={async (saleMetadata: any) => {
                  try {
                    for (const item of pendingSales) {
                      const finalUnitPrice = item.unitType === 'pack' ? item.packSellingPrice : item.baseSellingPrice;
                      const finalUnitLabel = item.unitType === 'pack' ? item.purchaseUnit : item.baseUnit;
                      
                      await insertSale({
                        itemId: item.id,
                        quantity: item.quantity,
                        unit: finalUnitLabel,
                        unitType: item.unitType,
                        discount: Number(saleMetadata.discount) / pendingSales.length, // Distribute discount
                        vat: saleMetadata.vat,
                        totalPrice: finalUnitPrice * item.quantity, // Individual item total
                        paymentMethod: saleMetadata.paymentMethod,
                        paymentStatus: saleMetadata.paymentStatus,
                        customerName: saleMetadata.customerName,
                        customerPhone: saleMetadata.customerPhone,
                        packId: null,
                      });
                    }
                    setShowSaleFlow(false);
                    setPendingSales([]);
                    setSaleFlowStep('search');
                    loadData();
                    Alert.alert('Sale Successful', 'The checkout has been completed and stock has been updated.');
                  } catch (e) {
                    Alert.alert('Error', 'Failed to record the sale.');
                  }
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const SalesActivityCard = ({ sale, onPress }: any) => {
  const { colors, t } = useSettings();
  const isPaid = sale.paymentStatus === 'Paid';

  return (
    <TouchableOpacity 
      style={[styles.activityItem, { borderBottomColor: colors.border }]} 
      activeOpacity={0.7} 
      onPress={onPress}
    >
      <View style={[styles.activityIconCircle, { backgroundColor: colors.surface }]}>
        <ArrowUpRight size={20} color={isPaid ? (colors.success || '#34C759') : colors.primary} />
      </View>
      
      <View style={styles.activityMain}>
        <RNText style={[styles.activityNameText, { color: colors.text }]}>{sale.itemName}</RNText>
        <RNText style={[styles.activityUnitText, { color: colors.textSecondary }]}>
          {sale.quantity} {sale.unit} • {sale.paymentMethod || 'Cash'}
        </RNText>
      </View>

      <View style={styles.activityEnd}>
        <RNText style={[styles.activityPriceText, { color: colors.text }]}>
          {sale.totalPrice.toLocaleString()} ETB
        </RNText>
        <View style={[styles.statusIndicator, { backgroundColor: isPaid ? (colors.success || '#34C759') + '15' : colors.primary + '15' }]}>
           <RNText style={[styles.statusIndicatorText, { color: isPaid ? (colors.success || '#34C759') : colors.primary }]}>
             {isPaid ? t('sales.payment_paid') : t('sales.payment_debt')}
           </RNText>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
    filter: 'blur(80px)', // Note: standard CSS filter, for RN use shadow or just opacity if not supported
  },
  integratedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 25,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
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
    fontSize: 12,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Fonts.bold,
  },
  headerAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  heroSection: {
    paddingHorizontal: 25,
    marginBottom: 30,
  },
  revenueMainDisplay: {
    marginBottom: 20,
  },
  totalRevenueVal: {
    fontSize: 42,
    fontFamily: Fonts.extrabold,
    letterSpacing: -1,
  },
  currency: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    opacity: 0.6,
  },
  revenueRangeLabel: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  chartContainer: {
    height: 180,
    justifyContent: 'flex-end',
    marginBottom: 25,
  },
  chartTooltip: {
    position: 'absolute',
    minWidth: 50,
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    bottom: 8,
    left: '50%',
    transform: [{ translateX: -25 }], // Perfectly center half of minWidth
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  periodTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  periodTabText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  periodDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 8,
  },
  navBtn: {
    padding: 8,
  },
  bentoSection: {
    paddingHorizontal: 25,
    marginBottom: 30,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bentoCard: {
    width: (width - 62) / 2,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  bentoIconArea: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  bentoValue: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  bentoLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  topItemsSection: {
    marginBottom: 30,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  topItemsScroll: {
    paddingHorizontal: 25,
    gap: 12,
  },
  topItemCard: {
    width: 150,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  rankBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomLeftRadius: 12,
  },
  rankText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: Fonts.extrabold,
  },
  topItemName: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    marginTop: 10,
    marginBottom: 4,
  },
  topItemRevenue: {
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  topItemVolume: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  ledgerSection: {
    paddingHorizontal: 25,
  },
  ledgerList: {
    marginTop: 10,
  },
  viewAllBtn: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  activityIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  activityMain: {
    flex: 1,
  },
  activityNameText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  activityUnitText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  activityEnd: {
    alignItems: 'flex-end',
  },
  activityPriceText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusIndicatorText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
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
    height: height * 0.85,
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

export default SalesDashboard;