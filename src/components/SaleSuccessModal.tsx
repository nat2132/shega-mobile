import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  Platform 
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withDelay, 
  withSequence,
  withTiming,
  FadeIn,
  FadeInDown,
  ScaleInCenter
} from 'react-native-reanimated';
import { 
  Check, 
  Printer, 
  Share2, 
  ShoppingBag, 
  ChevronRight,
  TrendingUp,
  CreditCard,
  Banknote,
  Navigation
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';
import { Fonts } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

// Premium Confetti Particle
const ConfettiParticle = ({ index }: { index: number }) => {
  const size = Math.random() * 8 + 4;
  const colors = ['#34C759', '#2F6FED', '#FFD700', '#FF3B30', '#AF52DE'];
  const color = colors[index % colors.length];
  
  const progress = useSharedValue(0);
  const xOffset = useSharedValue((Math.random() - 0.5) * width * 0.8);
  const rotate = useSharedValue(Math.random() * 360);

  useEffect(() => {
    progress.value = withDelay(
      Math.random() * 1000,
      withTiming(1, { duration: 2500 + Math.random() * 1000 })
    );
  }, []);

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
  };
  onClose: () => void;
}

const SaleSuccessModal: React.FC<SaleSuccessModalProps> = ({ saleData, onClose }) => {
  const { colors, t, theme } = useSettings();
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
  }, []);

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

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <View style={styles.overlay}>
      <BlurView intensity={theme === 'dark' ? 100 : 80} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      
      {/* Confetti Layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 40 }).map((_, i) => (
          <ConfettiParticle key={i} index={i} />
        ))}
      </View>

      <View style={styles.container}>
        {/* Animated Check Container with Radial Glow */}
        <View style={styles.iconContainer}>
          <Animated.View style={[styles.glowAura, { backgroundColor: colors.success }, animatedGlowStyle]} />
          <Animated.View style={[styles.successRing, { borderColor: colors.success + '40' }, animatedRingStyle]} />
          <Animated.View style={[styles.successRingInner, { borderColor: colors.success }, animatedRingStyle]} />
          <Animated.View style={[styles.iconCircle, { backgroundColor: colors.success }, animatedCheckStyle]}>
            <Check size={48} color="#FFF" strokeWidth={3} />
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(700)} style={styles.content}>
          <Text style={[styles.title, { color: colors.text, opacity: 0.6 }]}>{t('common.success').toUpperCase()}</Text>
          <Text style={[styles.subtitle, { color: colors.text }]}>
            {t('form.asset_initialized')}
          </Text>

          {/* Premium Receipt Card */}
          <Animated.View entering={FadeInDown.delay(900)} style={[styles.receiptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <View style={styles.receiptTop}>
                <View>
                   <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>{t('sale.total_settlement')}</Text>
                   <Text style={[styles.receiptTotal, { color: colors.text }]}>{formatPrice(saleData.totalPrice)} <Text style={{ fontSize: 16, opacity: 0.6 }}>ETB</Text></Text>
                </View>
                <View style={[styles.methodBadge, { backgroundColor: colors.text + '08' }]}>
                   {saleData.paymentMethod === 'Cash' ? (
                     <Banknote size={16} color={colors.text} />
                   ) : (
                     <CreditCard size={16} color={colors.text} />
                   )}
                   <Text style={[styles.methodText, { color: colors.text }]}>{saleData.paymentMethod.toUpperCase()}</Text>
                </View>
             </View>

             <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />

             <View style={styles.receiptBody}>
                <View style={styles.detailRow}>
                   <View style={[styles.detailIconBox, { backgroundColor: colors.primary + '10' }]}>
                      <ShoppingBag size={14} color={colors.primary} />
                   </View>
                   <Text style={[styles.detailText, { color: colors.textSecondary }]}>{t('common.items')}</Text>
                   <Text style={[styles.detailValue, { color: colors.text }]}>{saleData.itemCount}</Text>
                </View>
                <View style={styles.detailRow}>
                   <View style={[styles.detailIconBox, { backgroundColor: (saleData.paymentStatus === 'Paid' ? colors.success : '#FF9500') + '10' }]}>
                      <TrendingUp size={14} color={saleData.paymentStatus === 'Paid' ? colors.success : '#FF9500'} />
                   </View>
                   <Text style={[styles.detailText, { color: colors.textSecondary }]}>{t('expense.status')}</Text>
                   <Text style={[styles.detailValue, { color: saleData.paymentStatus === 'Paid' ? colors.success : '#FF9500' }]}>
                     {(saleData.paymentStatus === 'Paid' ? t('sale.settled_full') : t('sale.debt_credit')).toUpperCase()}
                   </Text>
                </View>
                {saleData.customerName && (
                  <View style={styles.detailRow}>
                     <View style={[styles.detailIconBox, { backgroundColor: colors.text + '10' }]}>
                        <Navigation size={14} color={colors.text} />
                     </View>
                     <Text style={[styles.detailText, { color: colors.textSecondary }]}>{t('sales.customer_name')}</Text>
                     <Text style={[styles.detailValue, { color: colors.text }]}>{saleData.customerName}</Text>
                  </View>
                )}
             </View>
          </Animated.View>

          {/* Action Row */}
          <View style={styles.actionRow}>
             <TouchableOpacity style={[styles.subBtn, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.7}>
                <Printer size={20} color={colors.text} />
                <Text style={[styles.subBtnText, { color: colors.text }]}>PRINT</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.subBtn, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.7}>
                <Share2 size={20} color={colors.text} />
                <Text style={[styles.subBtnText, { color: colors.text }]}>SHARE</Text>
             </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.finishBtn, { backgroundColor: colors.text }]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onClose();
            }}
            activeOpacity={0.9}
          >
            <Text style={[styles.finishBtnText, { color: colors.background }]}>{t('form.continue_intake').toUpperCase()}</Text>
            <ChevronRight size={20} color={colors.background} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.9,
    alignItems: 'center',
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
    filter: 'blur(30px)',
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
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    letterSpacing: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 28,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  receiptTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  receiptLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
    opacity: 0.6,
  },
  receiptTotal: {
    fontSize: 32,
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
    fontSize: 10,
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
    fontSize: 14,
    fontFamily: Fonts.semibold,
  },
  detailValue: {
    fontSize: 14,
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
    fontSize: 12,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
  },
  finishBtnText: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
});

export default SaleSuccessModal;
