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
  CreditCard,
  Gift,
} from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plan } from '@/services/api';

interface SubscriptionPlansProps {
  plans: Plan[] | null;
  onSelectPlan: (plan: Plan) => void;
  /** Omitted during first-time onboarding, where there is nothing to go back to. */
  onBack?: () => void;
  onStartTrial?: () => void;
  /**
   * "Pay Now" — subscribe immediately instead of trialling. Supplied during
   * first-time onboarding, where the platform has exactly one plan, so the
   * customer sees the plan and price alongside a trial-or-pay choice.
   */
  onPayNow?: (plan: Plan) => void;
  /** "Pay later" escape hatch, so a first-time signup is never trapped here. */
  onSkip?: () => void;
}

const SubscriptionPlansScreen: React.FC<SubscriptionPlansProps> = ({ plans, onSelectPlan, onBack, onStartTrial, onPayNow, onSkip }) => {
  const { colors, t } = useSettings();

  // Every backend plan is offered by name (Mobile / Desktop / Mobile + Desktop),
  // prefixed with the 7-day free trial. The server is the source of truth for
  // plan ids, prices and device/business caps.
  const pool = plans ?? [];

  /**
   * First-time onboarding offers this platform's single plan with two ways
   * forward — start the free trial, or pay for the same plan now. Everywhere
   * else the full catalogue is listed, because each entry is itself the
   * "Pay Now" action for that plan.
   */
  if (onPayNow && pool.length > 0) {
    const plan = pool[0];
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.titleSection}>
            <AppText variant="display" weight="black" align="center" style={{ color: colors.text, marginBottom: 8 }}>
              {t('subscription.available_plans')}
            </AppText>
            <AppText variant="body-lg" weight="medium" align="center" style={{ color: colors.textSecondary }}>
              {t('subscription.unlock_power')}
            </AppText>
          </Animated.View>

          {/* The one plan for this platform, with its monthly price. */}
          <Animated.View entering={FadeInDown.delay(150).duration(550)}>
            <View style={[styles.planCard, { backgroundColor: colors.card, borderColor: '#D4AF37' }]}>
              <View style={styles.planHeader}>
                <View style={[styles.optionIcon, { backgroundColor: '#D4AF37' + '20' }]}>
                  <CalendarDays size={26} color="#D4AF37" />
                </View>
                <View style={styles.optionBody}>
                  <AppText variant="heading" weight="bold" style={{ color: colors.text }}>
                    {plan.display_name || plan.name}
                  </AppText>
                  <AppText variant="body-sm" weight="medium" style={{ color: colors.textSecondary }}>
                    {formatPrice(plan.price)} {t('subscription.etb')} / {t('subscription.month')}
                  </AppText>
                </View>
              </View>

              <View style={styles.actionGroup}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#D4AF37' }]}
                  onPress={onStartTrial}
                  activeOpacity={0.85}
                >
                  <Gift size={18} color="#FFF" />
                  <AppText variant="body" weight="bold" style={{ color: '#FFF' }}>
                    {t('subscription.start_free_trial')}
                  </AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonOutline, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => onPayNow(plan)}
                  activeOpacity={0.85}
                >
                  <CreditCard size={18} color={colors.text} />
                  <AppText variant="body" weight="bold" style={{ color: colors.text }}>
                    {t('subscription.pay_now')}
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {onSkip ? (
            <View style={styles.skipRow}>
              <TouchableOpacity onPress={onSkip} style={styles.skipButton} activeOpacity={0.85}>
                <AppText variant="body" weight="semibold" style={{ color: colors.textSecondary }}>
                  {t('common.later')}
                </AppText>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const OPTIONS = [
    { key: 'trial', title: t('subscription.free_trial'), sub: t('subscription.free_trial_desc'), onPress: onStartTrial, url: Gift, accent: true },
    ...(pool.map((p, idx) => ({
      key: `plan-${p.id}-${idx}`,
      title: p.display_name || p.name,
      sub: formatPrice(p.price) + ' ' + t('subscription.etb'),
      onPress: () => onSelectPlan(p),
      url: null,
      accent: false,
    }))),
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {onBack ? (
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <AppText variant="body" weight="semibold" style={{ color: colors.textSecondary }}>
                {t('subscription.back')}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.titleSection}>
          <AppText variant="display" weight="black" align="center" style={{ color: colors.text, marginBottom: 8 }}>
            {t('subscription.available_plans')}
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

        {onSkip ? (
          <View style={styles.skipRow}>
            <TouchableOpacity onPress={onSkip} style={styles.skipButton} activeOpacity={0.85}>
              <AppText variant="body" weight="semibold" style={{ color: colors.textSecondary }}>
                {t('common.later')}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : null}
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
  skipRow: { alignItems: 'center', marginTop: 28 },
  skipButton: { paddingVertical: 12, paddingHorizontal: 24 },
  planCard: { marginHorizontal: 24, padding: 20, borderRadius: 20, borderWidth: 1.5 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actionGroup: { marginTop: 20, gap: 10 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
  },
  actionButtonOutline: { borderWidth: 1.5 },
});

export default SubscriptionPlansScreen;