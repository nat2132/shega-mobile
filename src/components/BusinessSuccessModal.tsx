import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions,
  ScrollView 
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withDelay,
  withTiming,
  FadeInDown,
  FadeIn
} from 'react-native-reanimated';
import { 
  Check, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Receipt,
  AlertOctagon,
  Package,
  Activity
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

export interface BusinessSuccessDetails {
  title: string;
  subtitle: string;
  mainLabel: string;
  mainValue: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  iconType: 'price_up' | 'price_down' | 'damaged' | 'expense';
  itemName?: string;
}

interface BusinessSuccessModalProps {
  details: BusinessSuccessDetails;
  onClose: () => void;
}

const BusinessSuccessModal: React.FC<BusinessSuccessModalProps> = ({ details, onClose }) => {
  const { colors, t, theme } = useSettings();
  const checkScale = useSharedValue(0);
  const ringScale = useSharedValue(0);
  const glowScale = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    ringScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    glowScale.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 80 }));
    checkScale.value = withDelay(400, withSpring(1, { damping: 8, stiffness: 120 }));
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

  const getThemeColor = () => {
    switch (details.iconType) {
      case 'price_up': return '#34C759';
      case 'price_down': return '#FF3B30';
      case 'damaged': return '#FF9500';
      case 'expense': return '#AF52DE';
      default: return colors.primary;
    }
  };

  const themeColor = getThemeColor();

  return (
    <View style={[styles.overlay, { zIndex: 9999 }]}>
      <BlurView intensity={theme === 'dark' ? 100 : 80} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      
      {/* Confetti Layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 40 }).map((_, i) => (
          <ConfettiParticle key={i} index={i} />
        ))}
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        centerContent={true}
      >
        <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Animated.View style={[styles.glowAura, { backgroundColor: themeColor }, animatedGlowStyle]} />
          <Animated.View style={[styles.successRing, { borderColor: themeColor + '40' }, animatedRingStyle]} />
          <Animated.View style={[styles.iconCircle, { backgroundColor: themeColor }, animatedCheckStyle]}>
            <Check size={48} color="#FFF" strokeWidth={3} />
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(700)} style={styles.content}>
          <Text style={[styles.title, { color: colors.text, opacity: 0.6 }]}>{details.title.toUpperCase()}</Text>
          <Text style={[styles.subtitle, { color: themeColor }]}>{details.subtitle.toUpperCase()}</Text>
          
          <View style={[styles.glassCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
             {details.itemName && (
               <View style={styles.itemRow}>
                 <View style={[styles.itemIconBox, { backgroundColor: themeColor + '10' }]}>
                    <Package size={16} color={themeColor} />
                 </View>
                 <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{details.itemName}</Text>
               </View>
             )}

             <View style={styles.mainMetrics}>
                <View style={styles.metricItem}>
                   <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{details.mainLabel}</Text>
                   <Text style={[styles.metricValue, { color: colors.text }]}>{details.mainValue}</Text>
                </View>
                
                {details.secondaryValue && (
                  <>
                    <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />
                    <View style={styles.metricItem}>
                       <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{details.secondaryLabel}</Text>
                       <Text style={[styles.metricValue, { color: themeColor }]}>{details.secondaryValue}</Text>
                    </View>
                  </>
                )}
             </View>

             <View style={[styles.footerRow, { borderTopColor: colors.border }]}>
                <Activity size={14} color={colors.textSecondary} />
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t('adj.security_footer')}</Text>
             </View>
          </View>

          <TouchableOpacity 
            style={[styles.finishBtn, { backgroundColor: colors.text }]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onClose();
            }}
            activeOpacity={0.9}
          >
            <Text style={[styles.finishBtnText, { color: colors.background }]}>{t('common.done').toUpperCase()}</Text>
            <ChevronRight size={20} color={colors.background} />
          </TouchableOpacity>
        </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  container: {
    width: width * 0.9,
    alignItems: 'center',
  },
  iconContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 28,
    fontFamily: Fonts.extrabold,
    letterSpacing: -0.5,
    marginBottom: 25,
    textAlign: 'center',
  },
  glassCard: {
    width: '100%',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  itemIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    flex: 1,
  },
  mainMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
    opacity: 0.6,
  },
  metricValue: {
    fontSize: 22,
    fontFamily: Fonts.bold,
  },
  dividerVertical: {
    width: 1,
    height: 35,
    marginHorizontal: 10,
    opacity: 0.3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    opacity: 0.5,
  },
  footerText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
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

export default BusinessSuccessModal;
