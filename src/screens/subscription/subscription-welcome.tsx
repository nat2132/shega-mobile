import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import { Sparkles, Crown, ArrowRight, Gift } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { AppText } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface SubscriptionWelcomeProps {
  onContinue: () => void;
}

const SubscriptionWelcomeScreen: React.FC<SubscriptionWelcomeProps> = ({ onContinue }) => {
  const { colors, theme, t } = useSettings();
  const { trialDaysRemaining } = useSubscription();
  const crownScale = useSharedValue(0);
  const ringScale = useSharedValue(0);

  const isDark = theme !== 'light';
  const gold = '#D4AF37';
  const goldLight = '#F0D060';
  const goldDark = '#B8960C';

  useEffect(() => {
    crownScale.value = withDelay(300, withSpring(1, { damping: 8, stiffness: 100 }));
    ringScale.value = withDelay(100, withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000 }),
        withTiming(1, { duration: 2000 }),
      ),
      -1,
      true,
    ));
  }, []);

  const crownStyle = useAnimatedStyle(() => ({
    transform: [{ scale: crownScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
  }));

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onContinue();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.iconSection}>
          <Animated.View style={[styles.ring, ringStyle]}>
            <View style={[styles.ringInner, { borderColor: gold + '40' }]} />
          </Animated.View>
          <Animated.View style={[styles.crownWrapper, crownStyle]}>
            <LinearGradient
              colors={[goldLight, gold, goldDark]}
              style={styles.crownGradient}
            >
              <Crown size={48} color="#FFF" strokeWidth={2} />
            </LinearGradient>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(500).duration(800)} style={styles.textSection}>
          <AppText variant="hero" weight="black" align="center" style={[styles.title, { color: colors.text }]}>
            {t('subscription.welcome_title')}
          </AppText>
          <AppText variant="body-lg" weight="medium" align="center" style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('subscription.welcome_desc')}
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(700).duration(800)} style={styles.benefitsSection}>
          <View style={styles.benefitRow}>
            <View style={[styles.benefitIcon, { backgroundColor: gold + '20' }]}>
              <Gift size={18} color={gold} />
            </View>
            <AppText variant="body" weight="semibold" style={[styles.benefitText, { color: colors.text }]}>
              {t('subscription.7day_trial')}
            </AppText>
          </View>
          <View style={styles.benefitRow}>
            <View style={[styles.benefitIcon, { backgroundColor: gold + '20' }]}>
              <Sparkles size={18} color={gold} />
            </View>
            <AppText variant="body" weight="semibold" style={[styles.benefitText, { color: colors.text }]}>
              {t('subscription.all_features')}
            </AppText>
          </View>
          <View style={styles.benefitRow}>
            <View style={[styles.benefitIcon, { backgroundColor: gold + '20' }]}>
              <Crown size={18} color={gold} />
            </View>
            <AppText variant="body" weight="semibold" style={[styles.benefitText, { color: colors.text }]}>
              {t('subscription.no_payment_required')}
            </AppText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(900).duration(800)} style={styles.trialBadge}>
          <LinearGradient
            colors={[gold + '20', gold + '10']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.trialBadgeGradient}
          >
            <Crown size={16} color={gold} />
            <AppText variant="body" weight="bold" style={[styles.trialBadgeText, { color: gold }]}>
              {t('subscription.trial_banner', { days: String(trialDaysRemaining) })}
            </AppText>
          </LinearGradient>
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(1100).duration(800)} style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, { shadowColor: gold }]}
          onPress={handleContinue}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[goldLight, gold, goldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.continueGradient}
          >
            <AppText variant="heading" weight="bold" style={styles.continueText}>
              {t('subscription.welcome_cta')}
            </AppText>
            <ArrowRight size={22} color="#FFF" strokeWidth={2.5} />
          </LinearGradient>
        </TouchableOpacity>
        <AppText variant="caption" weight="medium" align="center" style={[styles.footerText, { color: colors.textSecondary }]}>
          {t('subscription.footer_no_charges')}
        </AppText>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconSection: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringInner: {
    width: '100%',
    height: '100%',
    borderRadius: 70,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  crownWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  crownGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textSection: {
    marginBottom: 32,
  },
  title: {
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  benefitsSection: {
    width: '100%',
    marginBottom: 32,
    gap: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    flex: 1,
  },
  trialBadge: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  trialBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  trialBadgeText: {
    letterSpacing: 0.5,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 48,
    gap: 12,
  },
  continueButton: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  continueGradient: {
    flexDirection: 'row',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  continueText: {
    color: '#FFF',
    letterSpacing: 1,
  },
  footerText: {
    opacity: 0.7,
  },
});

export default SubscriptionWelcomeScreen;
