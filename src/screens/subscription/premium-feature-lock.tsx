import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  FadeInDown,
} from 'react-native-reanimated';
import { Crown, Lock, Sparkles, ArrowRight, Check } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface PremiumFeatureLockProps {
  featureName: string;
  description: string;
  benefits: string[];
  onUpgrade: () => void;
  onBack: () => void;
}

const PremiumFeatureLockScreen: React.FC<PremiumFeatureLockProps> = ({
  featureName,
  description,
  benefits,
  onUpgrade,
  onBack,
}) => {
  const { colors, theme, t } = useSettings();
  const lockScale = useSharedValue(0);
  const crownScale = useSharedValue(0);

  const gold = '#D4AF37';
  const goldLight = '#F0D060';
  const goldDark = '#B8960C';

  useEffect(() => {
    lockScale.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 100 }));
    crownScale.value = withDelay(400, withSpring(1, { damping: 8, stiffness: 120 }));
  }, []);

  const lockStyle = useAnimatedStyle(() => ({
    transform: [{ scale: lockScale.value }],
  }));

  const crownStyle = useAnimatedStyle(() => ({
    transform: [{ scale: crownScale.value }],
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <AppText variant="body" weight="semibold" style={{ color: colors.textSecondary }}>
            {t('subscription.back')}
          </AppText>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.iconSection}>
          <Animated.View style={[styles.lockIcon, lockStyle]}>
            <LinearGradient
              colors={[goldLight, gold, goldDark]}
              style={styles.lockGradient}
            >
              <Lock size={36} color="#FFF" strokeWidth={2.5} />
            </LinearGradient>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.textSection}>
          <View style={styles.badgeRow}>
            <View style={styles.premiumBadge}>
              <Crown size={14} color={gold} />
              <AppText variant="micro" weight="bold" style={{ color: gold, letterSpacing: 1 }}>
                {t('subscription.feature_locked')}
              </AppText>
            </View>
          </View>
          <AppText variant="display" weight="black" align="center" style={[styles.featureName, { color: colors.text }]}>
            {featureName}
          </AppText>
          <AppText variant="body-lg" weight="medium" align="center" style={[styles.description, { color: colors.textSecondary }]}>
            {description}
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.benefitsSection}>
          <AppText variant="title-sm" weight="bold" style={{ color: colors.text, marginBottom: 16 }}>
            {t('subscription.benefits')}
          </AppText>
          {benefits.map((benefit, idx) => (
            <View key={idx} style={styles.benefitRow}>
              <View style={[styles.checkIcon, { backgroundColor: gold + '20' }]}>
                <Check size={14} color={gold} strokeWidth={3} />
              </View>
              <AppText variant="body" weight="medium" style={{ color: colors.text, flex: 1 }}>
                {benefit}
              </AppText>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(700).duration(600)} style={styles.reasonsSection}>
          <View style={[styles.reasonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Sparkles size={20} color={gold} />
            <View style={{ flex: 1 }}>
              <AppText variant="body" weight="bold" style={{ color: colors.text, marginBottom: 4 }}>
                {t('subscription.why_upgrade')}
              </AppText>
              <AppText variant="body-sm" weight="regular" style={{ color: colors.textSecondary }}>
                {t('subscription.why_upgrade_desc')}
              </AppText>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.upgradeButton, { shadowColor: gold }]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onUpgrade();
          }}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[goldLight, gold, goldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.upgradeGradient}
          >
            <Crown size={20} color="#FFF" strokeWidth={2.5} />
            <AppText variant="heading" weight="bold" style={{ color: '#FFF' }}>
              {t('subscription.upgrade_to_premium')}
            </AppText>
            <ArrowRight size={22} color="#FFF" strokeWidth={2.5} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    alignSelf: 'flex-start',
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingBottom: 120,
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  lockIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  lockGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  badgeRow: {
    marginBottom: 12,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#D4AF37' + '20',
  },
  featureName: {
    marginBottom: 12,
  },
  description: {
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  benefitsSection: {
    width: '100%',
    marginBottom: 24,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  checkIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonsSection: {
    marginBottom: 24,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
    borderTopWidth: 1,
  },
  upgradeButton: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  upgradeGradient: {
    flexDirection: 'row',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
});

export default PremiumFeatureLockScreen;
