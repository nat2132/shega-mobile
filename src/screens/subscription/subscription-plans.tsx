import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import {
  Crown,
  Check,
  ArrowRight,
  Zap,
  Shield,
  Star,
  Sparkles,
} from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface SubscriptionPlansProps {
  onSelectPlan: (plan: string, durationMonths: number, price: number) => void;
  onBack: () => void;
}

const PLANS = {
  basic: {
    nameKey: 'subscription.plan_basic',
    icon: Shield,
    color: '#6366F1',
    gradient: ['#6366F1', '#4F46E5'] as const,
    prices: [
      { labelKey: 'subscription.month_1', months: 1, price: 1999 },
      { labelKey: 'subscription.months_3', months: 3, price: 2499 },
    ],
    featureKeys: [
      'subscription.feature_inventory',
      'subscription.feature_sales_tracking',
      'subscription.feature_contact_mgmt',
      'subscription.feature_stock_adj',
    ],
  },
  premium: {
    nameKey: 'subscription.plan_premium',
    icon: Crown,
    color: '#D4AF37',
    gradient: ['#F0D060', '#D4AF37', '#B8960C'] as const,
    prices: [
      { labelKey: 'subscription.month_1', months: 1, price: 2499 },
      { labelKey: 'subscription.months_3', months: 3, price: 5499 },
    ],
    featureKeys: [
      'subscription.feature_everything_basic',
      'subscription.feature_reports',
      'subscription.feature_dashboard',
      'subscription.feature_pdf',
      'subscription.feature_csv',
      'subscription.feature_expense',
      'subscription.feature_budget',
      'subscription.feature_debt',
      'subscription.feature_orders',
      'subscription.feature_purchase_orders',
      'subscription.feature_multi_warehouse',
      'subscription.feature_ai',
      'subscription.feature_health',
      'subscription.feature_biometrics',
      'subscription.feature_themes',
      'subscription.feature_suppliers',
    ],
  },
};

const SubscriptionPlansScreen: React.FC<SubscriptionPlansProps> = ({ onSelectPlan, onBack }) => {
  const { colors, theme, t } = useSettings();
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>('premium');
  const [selectedPrice, setSelectedPrice] = useState(PLANS.premium.prices[0]);
  const isDark = theme !== 'light';
  const gold = '#D4AF37';

  const plan = PLANS[selectedPlan];
  const isPremium = selectedPlan === 'premium';

  const handleSelect = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSelectPlan(selectedPlan, selectedPrice.months, selectedPrice.price);
  };

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

        <View style={styles.planToggle}>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              selectedPlan === 'basic' && { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => { setSelectedPlan('basic'); setSelectedPrice(PLANS.basic.prices[0]); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Shield size={18} color={selectedPlan === 'basic' ? colors.text : colors.textSecondary} />
            <AppText variant="body" weight={selectedPlan === 'basic' ? 'bold' : 'medium'} style={{ color: selectedPlan === 'basic' ? colors.text : colors.textSecondary }}>
              {t(PLANS.basic.nameKey)}
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              isPremium && { backgroundColor: gold + '20', borderColor: gold },
            ]}
            onPress={() => { setSelectedPlan('premium'); setSelectedPrice(PLANS.premium.prices[0]); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Crown size={18} color={isPremium ? gold : colors.textSecondary} />
            <AppText variant="body" weight={isPremium ? 'bold' : 'medium'} style={{ color: isPremium ? gold : colors.textSecondary }}>
              {t(PLANS.premium.nameKey)}
            </AppText>
          </TouchableOpacity>
        </View>

        <View style={styles.pricingRow}>
          {plan.prices.map((p, idx) => (
            <Animated.View
              key={p.labelKey}
              entering={FadeInDown.delay(200 + idx * 100).duration(600)}
              style={{ flex: 1 }}
            >
              <TouchableOpacity
                style={[
                  styles.priceCard,
                  {
                    backgroundColor: selectedPrice.months === p.months ? colors.card : colors.surface,
                    borderColor: selectedPrice.months === p.months ? plan.color : colors.border,
                  },
                ]}
                onPress={() => { setSelectedPrice(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                activeOpacity={0.8}
              >
                {isPremium && idx === 1 && (
                  <View style={styles.bestValueBadge}>
                    <Star size={12} color="#FFF" />
                    <AppText variant="micro" weight="bold" style={{ color: '#FFF' }}>{t('subscription.best_value')}</AppText>
                  </View>
                )}
                <AppText variant="caption" weight="bold" transform="uppercase" style={{ color: colors.textSecondary, letterSpacing: 1 }}>
                  {t(p.labelKey)}
                </AppText>
                <AppText variant="display" weight="black" style={[styles.price, { color: colors.text }]}>
                  {p.price.toLocaleString()}
                </AppText>
                <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
                  {t('subscription.etb')}
                </AppText>
                {selectedPrice.months === p.months && (
                  <View style={[styles.selectedDot, { backgroundColor: plan.color }]}>
                    <Check size={14} color="#FFF" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.featuresSection}>
          <AppText variant="title" weight="bold" style={{ color: colors.text, marginBottom: 16 }}>
            {t('subscription.plan_features', { plan: t(plan.nameKey) })}
          </AppText>
          {plan.featureKeys.map((featureKey, idx) => (
            <View key={idx} style={styles.featureRow}>
              <View style={[styles.featureCheck, { backgroundColor: plan.color + '20' }]}>
                {isPremium ? (
                  <Sparkles size={14} color={plan.color} strokeWidth={2.5} />
                ) : (
                  <Check size={14} color={plan.color} strokeWidth={3} />
                )}
              </View>
              <AppText variant="body" weight="medium" style={{ color: colors.text, flex: 1 }}>
                {t(featureKey)}
              </AppText>
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      <Animated.View entering={FadeIn.delay(500).duration(600)} style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <View style={styles.footerPriceRow}>
          <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
            {t(selectedPrice.labelKey)}
          </AppText>
          <AppText variant="display-lg" weight="black" style={{ color: colors.text }}>
            {selectedPrice.price.toLocaleString()} <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>{t('subscription.etb')}</AppText>
          </AppText>
        </View>
        <TouchableOpacity
          style={[styles.subscribeButton, { shadowColor: plan.color }]}
          onPress={handleSelect}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={plan.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.subscribeGradient}
          >
            <AppText variant="heading" weight="bold" style={styles.subscribeText}>
              {isPremium ? t('subscription.go_premium') : t('subscription.get_started')}
            </AppText>
            <ArrowRight size={22} color="#FFF" strokeWidth={2.5} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 180,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    alignSelf: 'flex-start',
  },
  titleSection: {
    paddingHorizontal: 32,
    marginBottom: 28,
  },
  planToggle: {
    flexDirection: 'row',
    marginHorizontal: 32,
    gap: 12,
    marginBottom: 24,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pricingRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    gap: 12,
    marginBottom: 32,
  },
  priceCard: {
    flex: 1,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  price: {
    marginTop: 8,
    marginBottom: 4,
  },
  selectedDot: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuresSection: {
    paddingHorizontal: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  featureCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 16,
  },
  footerPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subscribeButton: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  subscribeGradient: {
    flexDirection: 'row',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  subscribeText: {
    color: '#FFF',
    letterSpacing: 1,
  },
});

export default SubscriptionPlansScreen;
