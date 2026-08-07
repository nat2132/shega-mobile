import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeInDown,
} from 'react-native-reanimated';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Gift,
} from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plan } from '@/services/api';

interface SubscriptionPlansProps {
  plans: Plan[] | null;
  onSelectPlan: (plan: Plan) => void;
  onBack: () => void;
  onStartTrial?: () => void;
}

const SubscriptionPlansScreen: React.FC<SubscriptionPlansProps> = ({ plans, onSelectPlan, onBack, onStartTrial }) => {
  const { colors, t } = useSettings();

  // Exactly three subscriptions: 7-day free trial, 1 month, 3 months.
  const month1 = (plans ?? []).find((p) => p.duration_months === 1);
  const month3 = (plans ?? []).find((p) => p.duration_months === 3);

  const OPTIONS = [
    { key: 'trial', title: t('subscription.free_trial'), sub: t('subscription.free_trial_desc'), onPress: onStartTrial, url: Gift, accent: true },
    ...(month1 ? [{ key: 'm1', title: `${t('subscription.duration_month')} ${t('subscription.subscription')}`, sub: formatPrice(month1.price) + ' ' + t('subscription.etb'), onPress: () => onSelectPlan(month1), url: null, accent: false }] : []),
    ...(month3 ? [{ key: 'm3', title: `${t('subscription.duration_months')} ${t('subscription.subscription')}`, sub: formatPrice(month3.price) + ' ' + t('subscription.etb'), onPress: () => onSelectPlan(month3), url: null, accent: false }] : []),
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <AppText variant="body" weight="semibold" style={{ color: colors.textSecondary }}>
              {t('subscription.back')}
            </AppText>
          </TouchableOpacity>
        </View>

        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.titleSection}>
          <AppText variant="display" weight="black" align="center" style={{ color: colors.text, marginBottom: 8 }}>
            {t('subscription.plans')}
          </AppText>
          <AppText variant="body-lg" weight="medium" align="center" style={{ color: colors.textSecondary }}>
            {t('subscription.unlock_power')}
          </AppText>
        </Animated.View>

        {plans === null ? (
          <View style={styles.loading}>
            <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>
              {t('subscription.loading_plans')}
            </AppText>
          </View>
        ) : (
          <View style={styles.optionList}>
            {OPTIONS.map((opt, idx) => (
              <Animated.View key={opt.key} entering={FadeInDown.delay(150 + idx * 100).duration(550)}>
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    { backgroundColor: colors.card, borderColor: opt.accent ? '#D4AF37' : colors.border },
                  ]}
                  onPress={opt.onPress}
                  activeOpacity={0.85}
                >
                  <View style={[styles.optionIcon, { backgroundColor: opt.accent ? '#D4AF37' + '20' : colors.surface }]}>
                    {opt.accent ? <Gift size={26} color="#D4AF37" /> : <CalendarDays size={26} color={colors.primary} />}
                  </View>
                  <View style={styles.optionBody}>
                    <AppText variant="heading" weight="bold" style={{ color: colors.text }}>
                      {opt.title}
                    </AppText>
                    <AppText variant="body-sm" weight="medium" style={{ color: colors.textSecondary }} numberOfLines={2}>
                      {opt.sub}
                    </AppText>
                  </View>
                  <View style={[styles.optionArrow, { backgroundColor: opt.accent ? '#D4AF37' : colors.surface }]}>
                    {opt.accent ? <Check size={18} color="#FFF" strokeWidth={3} /> : <ArrowRight size={18} color={colors.text} strokeWidth={2.5} />}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

function formatPrice(n?: number): string {
  return (n ?? 0).toLocaleString();
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  backButton: { padding: 8, alignSelf: 'flex-start' },
  titleSection: { paddingHorizontal: 32, marginBottom: 32 },
  loading: { paddingVertical: 60, alignItems: 'center' },
  optionList: { gap: 14, paddingHorizontal: 24 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionBody: { flex: 1, gap: 2 },
  optionArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SubscriptionPlansScreen;