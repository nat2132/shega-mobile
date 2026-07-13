import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Crown, Clock } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { AppText } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const PremiumTrialBanner: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { colors, theme, t } = useSettings();
  const { isTrial, trialDaysRemaining } = useSubscription();
  const router = useRouter();
  const gold = '#D4AF37';

  if (!isTrial || trialDaysRemaining <= 0) return null;

  if (compact) {
    return (
      <Animated.View entering={FadeInDown.duration(500)}>
        <TouchableOpacity
          style={[styles.compactBanner, { backgroundColor: gold + '15', borderColor: gold + '30' }]}
          onPress={() => router.push('/subscription/manage')}
          activeOpacity={0.8}
        >
          <Crown size={14} color={gold} />
          <AppText variant="caption" weight="bold" style={{ color: gold, flex: 1 }}>
            {t('subscription.trial')}
          </AppText>
          <View style={styles.compactDays}>
            <Clock size={12} color={gold} />
            <AppText variant="micro" weight="bold" style={{ color: gold }}>
              {trialDaysRemaining}{t('common.d')}
            </AppText>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(500)}>
      <TouchableOpacity
        style={styles.bannerContainer}
        onPress={() => router.push('/subscription/manage')}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={[gold + '25', gold + '10']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerGradient}
        >
          <View style={[styles.bannerIcon, { backgroundColor: gold + '30' }]}>
            <Crown size={18} color={gold} strokeWidth={2.5} />
          </View>
          <View style={styles.bannerText}>
            <AppText variant="body" weight="bold" style={{ color: gold }}>
              {t('subscription.trial')}
            </AppText>
            <AppText variant="caption" weight="medium" style={{ color: gold + 'CC' }}>
              {t('subscription.trial_banner', { days: String(trialDaysRemaining) })}
            </AppText>
          </View>
          <View style={[styles.daysBadge, { backgroundColor: gold + '30' }]}>
            <AppText variant="caption" weight="black" style={{ color: gold }}>
              {trialDaysRemaining}
            </AppText>
            <AppText variant="micro" weight="medium" style={{ color: gold + 'CC' }}>
              {t('common.d')}
            </AppText>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  bannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  bannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerText: {
    flex: 1,
    gap: 2,
  },
  daysBadge: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  compactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  compactDays: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

export default PremiumTrialBanner;
