import React, { useEffect } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';

import {
  Banknote,
  Check,
  ChevronRight,
  CreditCard,
  Navigation,
  Printer,
  Share2,
  ShoppingBag,
  TrendingUp,
  X
} from 'lucide-react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from 'react-native-reanimated';

import { AppNumber, AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// Premium Confetti Particle
const ConfettiParticle = ({ index, colors: themeColors }: { index: number; colors: any }) => {
  const size = Math.random() * 8 + 4;
  const palette = [themeColors.success, themeColors.primary, '#FFD700', themeColors.error, '#AF52DE'];
  const color = palette[index % palette.length];
  
  const progress = useSharedValue(0);
  const xOffset = useSharedValue((Math.random() - 0.5) * width * 0.8);
  const rotate = useSharedValue(Math.random() * 360);

  useEffect(() => {
    progress.value = withDelay(
      Math.random() * 1000,
      withTiming(1, { duration: 2500 + Math.random() * 1000 })
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: progress.value * (height * 0.8) - 100 },
      { translateX: xOffset.value + Math.sin(progress.value * 10) * 20 },
      { rotate: `${rotate.value + progress.value * 500}deg` }
    ],
    opacity: 1 - progress.value,
  }));

  return (
    <Animated.View 
      style={[
        { 
          position: 'absolute', 
          width: size, 
          height: size, 
          backgroundColor: color,
          borderRadius: size / 2,
          top: -20,
        }, 
        animatedStyle
      ]} 
    />
  );
};

interface SaleSuccessModalProps {
  saleData: {
    totalPrice: number;
    paymentMethod: string;
    itemCount: number;
    paymentStatus: string;
    customerName?: string;
    transactionId?: string;
  };
  onClose: () => void;
  onPrint?: () => void;
  onShare?: () => void;
  onViewDetails?: () => void;
}

const SaleSuccessModal: React.FC<SaleSuccessModalProps> = ({ saleData, onClose, onPrint, onShare, onViewDetails }) => {
  const { colors, t } = useSettings();
  const insets = useSafeAreaInsets();
  const checkScale = useSharedValue(0);
  const ringScale = useSharedValue(0);
  const glowScale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    ringScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    glowScale.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 80 }));
    checkScale.value = withDelay(400, withSpring(1, { damping: 8, stiffness: 120 }));
    opacity.value = withTiming(1, { duration: 600 });
  }, [checkScale, glowScale, opacity, ringScale]);

  const animatedCheckStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }]
  }));

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringScale.value
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value * 1.5 }],
    opacity: glowScale.value * 0.3
  }));

  return (
    <View style={styles.overlay}>
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.50)' }]} />
      </Pressable>

      {/* Confetti Layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 40 }).map((_, i) => (
          <ConfettiParticle key={i} index={i} colors={colors} />
        ))}
      </View>

      {/* Scrollable Modal Container */}
      <ScrollView 
        style={StyleSheet.absoluteFill}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable 
          style={[
            styles.scrollContentInner,
            {
              paddingTop: Math.max(insets.top, 20),
              paddingBottom: Math.max(insets.bottom, 20),
            }
          ]}
          onPress={onClose}
        >
          <Pressable 
            style={styles.container} 
            onPress={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={onClose}
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>

            {/* Animated Check Container with Radial Glow */}
            <View style={styles.iconContainer}>
              <Animated.View style={[styles.glowAura, { backgroundColor: colors.success }, animatedGlowStyle]} />
              <Animated.View style={[styles.successRing, { borderColor: colors.success + '40' }, animatedRingStyle]} />
              <Animated.View style={[styles.successRingInner, { borderColor: colors.success }, animatedRingStyle]} />
              <Animated.View style={[styles.iconCircle, { backgroundColor: colors.success }, animatedCheckStyle]}>
                <Check size={48} color={colors.background} strokeWidth={3} />
              </Animated.View>
            </View>

            <Animated.View entering={FadeInDown.delay(700)} style={styles.content}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.title, { color: colors.text, opacity: 0.6 }]} numberOfLines={1}>{t('common.success').toUpperCase()}</AppText>
              <AppText variant="heading" weight="bold" style={[styles.subtitle, { color: colors.text }]} numberOfLines={2}>
                {saleData.paymentStatus === 'Debt' ? (t('sale.debt_credit') || 'Credit Sale') : (t('sales.sale_success') || 'Sale Completed')}
              </AppText>

              {/* Premium Receipt Card */}
              <Animated.View entering={FadeInDown.delay(900)} style={[styles.receiptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                 <View style={styles.receiptTop}>
                    <View>
                       <AppText variant="caption" weight="medium" style={[styles.receiptLabel, { color: colors.textSecondary }]} numberOfLines={2}>{t('sale.total_settlement')}</AppText>
                       <AppNumber value={saleData.totalPrice} size="display" prefix="ETB " decimals={2} />
                    </View>
                     <View style={[styles.methodBadge, { backgroundColor: colors.text + '08' }]}>
                        {saleData.paymentMethod === 'Cash' ? (
                          <Banknote size={16} color={colors.text} />
                        ) : (
                          <CreditCard size={16} color={colors.text} />
                        )}
                        <AppText variant="caption" weight="bold" transform="uppercase" shrink={false} style={[styles.methodText, { color: colors.text }]} numberOfLines={2}>{saleData.paymentMethod.toUpperCase()}</AppText>
                     </View>
                 </View>

                 <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />

                 <View style={styles.receiptBody}>
                    <View style={styles.detailRow}>
                       <View style={[styles.detailIconBox, { backgroundColor: colors.primary + '10' }]}>
                          <ShoppingBag size={14} color={colors.primary} />
                       </View>
                    <AppText variant="caption" weight="medium" style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={2}>{t('common.items')}</AppText>
                    <AppNumber value={saleData.itemCount} size="body" />
                    </View>
                    <View style={styles.detailRow}>
                       <View style={[styles.detailIconBox, { backgroundColor: (saleData.paymentStatus === 'Paid' ? colors.success : colors.warning) + '10' }]}>
                           <TrendingUp size={14} color={saleData.paymentStatus === 'Paid' ? colors.success : colors.warning} />
                       </View>
                    <AppText variant="caption" weight="medium" style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={2}>{t('expense.status')}</AppText>
                    <AppText variant="body" weight="bold" shrink={false} style={[styles.detailValue, { color: saleData.paymentStatus === 'Paid' ? colors.success : colors.warning }]} numberOfLines={2}>
                         {(saleData.paymentStatus === 'Paid' ? t('sale.settled_full') : t('sale.debt_credit')).toUpperCase()}
                       </AppText>
                    </View>
                    {saleData.customerName && (
                      <View style={styles.detailRow}>
                         <View style={[styles.detailIconBox, { backgroundColor: colors.text + '10' }]}>
                            <Navigation size={14} color={colors.text} />
                         </View>
                      <AppText variant="caption" weight="medium" style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={2}>{t('sales.customer_name')}</AppText>
                      <AppText variant="body" weight="bold" style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>{saleData.customerName}</AppText>
                      </View>
                    )}
                 </View>
              </Animated.View>

              {/* Action Row */}
              <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.subBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    activeOpacity={0.7}
                    onPress={() => { onPrint?.(); onClose(); }}
                  >
                     <Printer size={20} color={colors.text} />
                     <AppText variant="caption" weight="bold" shrink={false} style={[styles.subBtnText, { color: colors.text }]} numberOfLines={1}>{t('common.print')}</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.subBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    activeOpacity={0.7}
                    onPress={() => { onShare?.(); onClose(); }}
                  >
                     <Share2 size={20} color={colors.text} />
                     <AppText variant="caption" weight="bold" shrink={false} style={[styles.subBtnText, { color: colors.text }]} numberOfLines={1}>{t('common.share')}</AppText>
                  </TouchableOpacity>
              </View>

              {/* Bottom actions */}
              <View style={{ width: '100%', gap: 12 }}>
                {onViewDetails && (
                  <TouchableOpacity
                    style={[styles.subBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    activeOpacity={0.7}
                    onPress={() => { onViewDetails(); onClose(); }}
                  >
                    <AppText variant="caption" weight="bold" style={[styles.subBtnText, { color: colors.text }]} numberOfLines={1}>{t('sales.view_details') || 'View Details'}</AppText>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.finishBtn, { backgroundColor: colors.text }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onClose();
                  }}
                  activeOpacity={0.9}
                >
                  <AppText variant="caption" weight="bold" transform="uppercase" shrink={false} style={[styles.finishBtnText, { color: colors.background }]} numberOfLines={1}>{t('common.done').toUpperCase()}</AppText>
                  <ChevronRight size={20} color={colors.background} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentInner: {
    flexGrow: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    width: width * 0.9,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconContainer: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  glowAura: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.3,
  },
  successRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  successRingInner: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.bold,
    letterSpacing: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: Fonts.extrabold,
    textAlign: 'center',
    marginBottom: 35,
    paddingHorizontal: 20,
    letterSpacing: -0.5,
  },
  receiptCard: {
    width: '100%',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    marginBottom: 25,
    elevation: 1,
  },
  receiptTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  receiptLabel: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
    opacity: 0.6,
  },
  receiptTotal: {
    fontFamily: Fonts.extrabold,
    letterSpacing: -1,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  methodText: {
    fontFamily: Fonts.extrabold,
    letterSpacing: 0.5,
  },
  receiptDivider: {
    height: 1,
    marginVertical: 20,
    opacity: 0.3,
  },
  receiptBody: {
    gap: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailText: {
    flex: 1,
    fontFamily: Fonts.semibold,
  },
  detailValue: {
    fontFamily: Fonts.bold,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 15,
  },
  subBtn: {
    flex: 1,
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  subBtnText: {
    fontFamily: Fonts.bold,
    letterSpacing: 1.5,
  },
  finishBtn: {
    width: '100%',
    height: 65,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    elevation: 2,
  },
  finishBtnText: {
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
});

export default SaleSuccessModal;