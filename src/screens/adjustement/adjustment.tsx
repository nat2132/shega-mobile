import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Dimensions, FlatList, RefreshControl, Platform, TextInput, Image } from 'react-native';
import { 
  Box, 
  MoveUpRight, 
  MoveDownRight, 
  AlertTriangle, 
  ArrowRight, 
  Package,
  Search,
  Plus,
  Activity,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Layers,
  Zap,
  Info,
  Calendar,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  ChevronUp,
  Bell
} from 'lucide-react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Fonts } from '@/constants/theme';
import { useFocusEffect } from '@react-navigation/native';
import { getRecentAdjustments, getAdjustmentSummary } from '@/database/db';
import IncreaseScreen from './increase';
import DecreaseScreen from './decrease';
import DamagedScreen from './damaged';
import AdjustmentDetailsScreen from './adjustment-details';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useRouter } from 'expo-router';
import { useSidebar } from '@/context/SidebarContext';

const CalibrationLedgerItem = ({ item, onPress }: { item: any; onPress: () => void }) => {
  const { colors, t } = useSettings();
  
  const getStatusConfig = () => {
    switch(item.type) {
      case 'price_up': return { 
        icon: <TrendingUp size={20} color="#34C759" />, 
        bg: '#34C75915',
        label: t('adjustment.price_increase')
      };
      case 'price_down': return { 
        icon: <TrendingDown size={20} color="#FF3B30" />, 
        bg: '#FF3B3015',
        label: t('adjustment.price_decrease')
      };
      case 'damaged': return { 
        icon: <AlertTriangle size={20} color="#FF9500" />, 
        bg: '#FF950015',
        label: t('adjustment.damaged')
      };
      default: return { 
        icon: <Zap size={20} color={colors.textSecondary} />, 
        bg: colors.border,
        label: t('adj.manual')
      };
    }
  };

  const config = getStatusConfig();

  return (
    <TouchableOpacity 
      style={[styles.ledgerItem, { borderBottomColor: colors.border }]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.ledgerIconCircle, { backgroundColor: config.bg }]}>
        {config.icon}
      </View>
      <View style={styles.ledgerMain}>
        <Text style={[styles.ledgerName, { color: colors.text }]}>{item.itemName}</Text>
        <Text style={[styles.ledgerCategory, { color: colors.textSecondary }]}>
          {item.reason || t('adj.manual_correction')} • {item.createdAt?.split(' ')[0] || item.date}
        </Text>
      </View>
      <View style={styles.ledgerEnd}>
        {item.type === 'damaged' ? (
          <Text style={[styles.ledgerAmount, { color: '#FF3B30' }]}>-{item.quantity}</Text>
        ) : (
          <Text style={[styles.ledgerAmount, { color: item.type === 'price_up' ? '#34C759' : '#FF3B30' }]}>
            {item.newValue?.toLocaleString()}
          </Text>
        )}
        <Text style={[styles.ledgerCurrency, { color: colors.textSecondary }]}>
          {item.type === 'damaged' ? t('adj.units_suffix') : 'ETB'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const CalibrationSuite = () => {
  const { colors, t, theme, userProfile } = useSettings();
  const { openSidebar } = useSidebar();
  const { notifCount } = useNotifications();
  const router = useRouter();
  const [showOptions, setShowOptions] = useState(false);
  const [showIncrease, setShowIncrease] = useState(false);
  const [showDecrease, setShowDecrease] = useState(false);
  const [showDamaged, setShowDamaged] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [isBarExpanded, setIsBarExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const searchInputRef = React.useRef<TextInput>(null);

  const { width } = Dimensions.get('window');
  const expandedWidth = useSharedValue(56);
  React.useEffect(() => {
    expandedWidth.value = withSpring(isBarExpanded ? width - 50 : 56, { damping: 15, stiffness: 100 });
  }, [isBarExpanded, width]);

  const expandStyle = useAnimatedStyle(() => ({
    width: expandedWidth.value,
  }));

  const loadData = useCallback(async () => {
    const data = await getRecentAdjustments();
    setAdjustments(data);
    const summaryData = getAdjustmentSummary();
    setSummary(summaryData);
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
            <Text style={[styles.headerLabel, { color: colors.textSecondary }]}>{t('adj.stock_rectification')}</Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('adj.calibration_suite')}</Text>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={() => router.push('/notifications')} 
              style={[styles.headerIconBtn, { borderColor: colors.border }]}
            >
               <Bell size={22} color={colors.text} />
               {notifCount > 0 && (
                 <View style={[styles.notifBadge, { backgroundColor: colors.primary }]}>
                   <Text style={styles.notifBadgeText}>{notifCount}</Text>
                 </View>
               )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.headerIconBox, { borderColor: colors.border }]}
              onPress={() => Haptics.selectionAsync()}
            >
               <SlidersHorizontal size={22} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.headerAvatarBox, { borderColor: colors.border, marginLeft: 15 }]}
              onPress={openSidebar}
            >
               <Image source={PROFILE_IMAGES[userProfile.avatarIndex]} style={styles.headerAvatar} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Calibration Hero */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.heroSection}>
          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>{t('adj.monthly_records')}</Text>
                <Text style={[styles.heroValue, { color: colors.text }]}>{summary?.totalRecords?.toString().padStart(2, '0')}</Text>
              </View>
              <View style={[styles.fidelityIndicator, { backgroundColor: colors.primary + '15' }]}>
                <ShieldCheck size={24} color={colors.primary} />
                <Text style={[styles.fidelityText, { color: colors.primary }]}>{t('adj.active')}</Text>
              </View>
            </View>
            <View style={[styles.heroFooter, { borderTopColor: colors.border }]}>
              <View style={styles.impactStat}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('adj.capital_leakage')}</Text>
                <Text style={[styles.statValue, { color: '#FF3B30' }]}>-{summary?.capitalLeakage?.toLocaleString() || 0} ETB</Text>
              </View>
              <View style={styles.impactStat}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('adj.last_sync')}</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{t('adj.just_now')}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Intelligence Bento */}
        <View style={styles.bentoSection}>
          <Animated.View entering={FadeInDown.delay(400).duration(600)} style={[styles.mainBento, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.bentoHeaderRow}>
               <Text style={[styles.bentoLabel, { color: colors.textSecondary }]}>{t('adj.adjustment_hotspot')}</Text>
               <Zap size={16} color={colors.primary} />
            </View>
            <Text style={[styles.hotspotName, { color: colors.text }]}>{summary?.topItem?.name || t('adj.searching')}</Text>
            <Text style={[styles.hotspotSub, { color: colors.textSecondary }]}>
               {summary?.topItem?.count || 0} {t('adj.corrections_month')}
            </Text>
            <View style={styles.hotspotVisual}>
               <Layers size={40} color={colors.primary} opacity={0.2} strokeWidth={1} />
            </View>
          </Animated.View>

          <View style={styles.bentoRow}>
            <View style={[styles.smallBento, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.bentoLabel, { color: colors.textSecondary }]}>{t('adj.yield_flux')}</Text>
              <View style={styles.fluxRow}>
                <View style={styles.fluxItem}>
                   <ChevronUp size={14} color="#34C759" />
                   <Text style={[styles.fluxVal, { color: '#34C759' }]}>{summary?.typeDistribution?.find((t:any) => t.type === 'price_up')?.count || 0}</Text>
                </View>
                <View style={styles.fluxItem}>
                   <TrendingDown size={14} color="#FF3B30" />
                   <Text style={[styles.fluxVal, { color: '#FF3B30' }]}>{summary?.typeDistribution?.find((t:any) => t.type === 'price_down')?.count || 0}</Text>
                </View>
              </View>
            </View>
            
            <View style={[styles.smallBento, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.bentoLabel, { color: colors.textSecondary }]}>{t('adj.integrity_loss')}</Text>
              <Text style={[styles.bentoBigVal, { color: '#FF9500' }]}>{summary?.typeDistribution?.find((td:any) => td.type === 'damaged')?.count || 0}</Text>
              <Text style={[styles.bentoSubText, { color: colors.textSecondary }]}>{t('adj.units_damaged')}</Text>
            </View>
          </View>
        </View>

        {/* Calibration Ledger */}
        <View style={styles.ledgerSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('adj.calibration_ledger')}</Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>{t('adj.historical_record')}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => {
                setIsSearchVisible(!isSearchVisible);
                if (!isSearchVisible) {
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }
              }}>
                <Search size={22} color={isSearchVisible ? colors.primary : colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                <Info size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {isSearchVisible && (
            <Animated.View entering={FadeInUp} exiting={FadeOut} style={[styles.searchBarContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Search size={20} color={colors.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                ref={searchInputRef}
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('adj.search_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <RNText style={{ color: colors.primary, fontFamily: Fonts.bold }}>Clear</RNText>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}

          {adjustments.filter(a => a.itemName.toLowerCase().includes(searchQuery.toLowerCase()) || (a.reason && a.reason.toLowerCase().includes(searchQuery.toLowerCase()))).length > 0 ? (
            <View style={styles.ledgerList}>
              {adjustments
                .filter(a => a.itemName.toLowerCase().includes(searchQuery.toLowerCase()) || (a.reason && a.reason.toLowerCase().includes(searchQuery.toLowerCase())))
                .map((item, index) => (
                  <Animated.View key={item.id} entering={FadeInDown.delay(200 + index * 50).duration(400)}>
                  <CalibrationLedgerItem item={item} onPress={() => setSelectedAdjustment(item)} />
                </Animated.View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Box size={60} color={colors.border} strokeWidth={1} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('adjustment.no_records')}</Text>
            </View>
          )}
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
                    setIsBarExpanded(false); 
                    setIsSearchVisible(true);
                    setTimeout(() => searchInputRef.current?.focus(), 300);
                  }}
                >
                  <Search size={22} color={colors.textSecondary} />
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
              <Plus size={24} color={isBarExpanded ? colors.background : colors.background} strokeWidth={2.5} />
            </TouchableOpacity>

            {isBarExpanded && (
              <Animated.View entering={FadeIn.delay(100)} exiting={FadeOut.duration(100)}>
                <TouchableOpacity 
                  style={styles.dockBtn}
                  onPress={() => { onRefresh(); setIsBarExpanded(false); }}
                >
                  <RefreshCw size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}
          </BlurView>
        </Animated.View>
      </View>

      {/* Options Modal */}
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
        <TouchableOpacity style={styles.modalOverlayC} activeOpacity={1} onPress={() => setShowOptions(false)}>
          <View style={[styles.optionsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionsTitle, { color: colors.text }]}>{t('adjustment.select_type')}</Text>
            <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.border }]} onPress={() => { setShowOptions(false); setShowIncrease(true); }}>
              <TrendingUp size={20} color="#34C759" style={{ marginRight: 15 }} />
              <Text style={[styles.optionText, { color: colors.text }]}>{t('adjustment.price_increase')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionBtn, { borderBottomColor: colors.border }]} onPress={() => { setShowOptions(false); setShowDecrease(true); }}>
              <TrendingDown size={20} color="#FF3B30" style={{ marginRight: 15 }} />
              <Text style={[styles.optionText, { color: colors.text }]}>{t('adjustment.price_decrease')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionBtn} onPress={() => { setShowOptions(false); setShowDamaged(true); }}>
              <AlertTriangle size={20} color="#FF9500" style={{ marginRight: 15 }} />
              <Text style={[styles.optionText, { color: colors.text }]}>{t('adjustment.damaged')}</Text>
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
              {selectedAdjustment && (
                <AdjustmentDetailsScreen 
                  adjustment={selectedAdjustment} 
                  onClose={() => setSelectedAdjustment(null)} 
                  onRefresh={() => loadData()} 
                />
              )}
           </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: { flex: 1 },
  scrollContent: { paddingBottom: 220, paddingTop: 10 },
  bgWash: { position: 'absolute', width: 400, height: 400, borderRadius: 200, filter: 'blur(80px)' },
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
  headerLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontFamily: Fonts.bold },
  headerIconBox: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  heroSection: { paddingHorizontal: 25, marginBottom: 30 },
  heroCard: { borderRadius: 30, padding: 25, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  heroLabel: { fontSize: 13, fontFamily: Fonts.semibold, textTransform: 'uppercase', marginBottom: 8 },
  heroValue: { fontSize: 42, fontFamily: Fonts.extrabold, letterSpacing: -1 },
  fidelityIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15 },
  fidelityText: { fontSize: 12, fontFamily: Fonts.bold },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 20, borderTopWidth: 1 },
  impactStat: { gap: 4 },
  statLabel: { fontSize: 11, fontFamily: Fonts.semibold, textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontFamily: Fonts.bold },
  bentoSection: { paddingHorizontal: 25, marginBottom: 40, gap: 12 },
  mainBento: { borderRadius: 24, padding: 20, borderWidth: 1, height: 160 },
  bentoHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  bentoLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  hotspotName: { fontSize: 20, fontFamily: Fonts.bold, marginBottom: 4 },
  hotspotSub: { fontSize: 13, fontFamily: Fonts.medium },
  hotspotVisual: { position: 'absolute', right: 20, bottom: 20 },
  bentoRow: { flexDirection: 'row', gap: 12 },
  smallBento: { flex: 1, borderRadius: 24, padding: 20, borderWidth: 1, height: 110, justifyContent: 'center' },
  fluxRow: { gap: 8, marginTop: 10 },
  fluxItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fluxVal: { fontSize: 14, fontFamily: Fonts.bold },
  bentoBigVal: { fontSize: 28, fontFamily: Fonts.bold, marginTop: 4 },
  bentoSubText: { fontSize: 11, fontFamily: Fonts.semibold, marginTop: 2 },
  ledgerSection: { paddingHorizontal: 25 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  sectionTitle: { fontSize: 22, fontFamily: Fonts.bold },
  sectionSub: { fontSize: 13, fontFamily: Fonts.medium, marginTop: 4 },
  ledgerList: { gap: 2 },
  ledgerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1 },
  ledgerIconCircle: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  ledgerMain: { flex: 1 },
  ledgerName: { fontSize: 16, fontFamily: Fonts.bold, marginBottom: 4 },
  ledgerCategory: { fontSize: 12, fontFamily: Fonts.medium },
  ledgerEnd: { alignItems: 'flex-end' },
  ledgerAmount: { fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 },
  ledgerCurrency: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, fontFamily: Fonts.medium, marginTop: 15 },
  dockedBarWrapper: { position: 'absolute', bottom: 120, alignSelf: 'center', zIndex: 1000, alignItems: 'center', justifyContent: 'center' },
  dockedBar: { flex: 1, borderRadius: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 10, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  dockBtn: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  dockMainBtn: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
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
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.medium,
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
  notifBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  notifBadgeText: {
    color: 'white',
    fontSize: 10,
    fontFamily: Fonts.bold,
  },
});

export default CalibrationSuite;