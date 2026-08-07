import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import {
  Crown,
  Check,
  ArrowRight,
  Star,
} from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plan } from '@/services/api';

interface SubscriptionPlansProps {
  plans: Plan[] | null;
  onSelectPlan: (plan: Plan) => void;
  onBack: () => void;
}

const SubscriptionPlansScreen: React.FC<SubscriptionPlansProps> = ({ plans, onSelectPlan, onBack }) => {
  const { colors, t } = useSettings();
  const gold = '#D4AF37';
  const basicColor = '#6366F1';

  // Group fetched plans by plan name (basic / premium).
  const grouped = usePlanGroups(plans);
  const groups = Object.values(grouped);

  const [selectedPlan, setSelectedPlan] = useState<string>(groups[0]?.name ?? 'premium');
  const [selectedPrice, setSelectedPrice] = useState<Plan | null>(groups[0]?.items[0] ?? null);

  const activeGroup = groups.find((g) => g.name === selectedPlan);

  const handleSelectPrice = (g: { name: string; items: Plan[] }) => {
    if (g.name === selectedPlan) return;
    setSelectedPlan(g.name);
    setSelectedPrice(g.items[0]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePrice = (plan: Plan) => {
    setSelectedPrice(plan);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSelect = () => {
    if (!selectedPrice) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSelectPlan(selectedPrice);
  };

  const isPremium = selectedPlan === 'premium';

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
          <>
            <View style={styles.planToggle}>
              {groups.map((g) => {
                const isSelected = g.name === selectedPlan;
                const isP = g.name === 'premium';
                return (
                  <TouchableOpacity
                    key={g.name}
                    style={[
                      styles.toggleOption,
                      isP && isSelected && { backgroundColor: gold + '20', borderColor: gold },
                      !isP && isSelected && { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                    onPress={() => handleSelectPrice(g)}
                  >
                    {isP ? <Crown size={18} color={isSelected ? gold : colors.textSecondary} /> : null}
                    <AppText variant="body" weight={isSelected ? 'bold' : 'medium'} style={{ color: isP && isSelected ? gold : colors.textSecondary }}>
                      {cap(g.name)}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.pricingRow}>
              {(activeGroup?.items ?? []).map((p, idx) => {
                const color = isPremium ? gold : basicColor;
                const selected = selectedPrice?.id === p.id;
                return (
                  <Animated.View
                    key={`${p.name}-${p.id}`}
                    entering={FadeInDown.delay(200 + idx * 100).duration(600)}
                    style={{ flex: 1 }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.priceCard,
                        {
                          backgroundColor: selected ? colors.card : colors.surface,
                          borderColor: selected ? color : colors.border,
                        },
                      ]}
                      onPress={() => handlePrice(p)}
                      activeOpacity={0.8}
                    >
                      {isPremium && idx === (activeGroup?.items ?? []).length - 1 && idx > 0 && (
                        <View style={styles.bestValueBadge}>
                          <Star size={12} color="#FFF" />
                          <AppText variant="micro" weight="bold" style={{ color: '#FFF' }}>{t('subscription.best_value')}</AppText>
                        </View>
                      )}
                      <AppText variant="caption" weight="bold" style={{ color: colors.textSecondary }}>
                        {p.duration_months} {p.duration_months > 1 ? t('subscription.duration_months') : t('subscription.duration_month')}
                      </AppText>
                      <AppText variant="display" weight="black" style={[styles.price, { color: colors.text }]}>
                        {formatPrice(p.price)}
                      </AppText>
                      <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
                        {t('subscription.etb')}
                      </AppText>
                      <AppText variant="micro" weight="medium" numberOfLines={2} style={{ color: colors.textSecondary, marginTop: 4 }}>
                        {p.features?.slice(0, 2).join(' · ') || ''}
                      </AppText>
                      {selected && (
                        <View style={[styles.selectedDot, { backgroundColor: color }]}>
                          <Check size={14} color="#FFF" strokeWidth={3} />
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <Animated.View entering={FadeIn.delay(500).duration(600)} style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <View style={styles.footerPriceRow}>
          <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
            {selectedPrice ? `${cap(selectedPrice.name)} · ${selectedPrice.duration_months} month(s)` : ''}
          </AppText>
          <AppText variant="display-lg" weight="black" style={{ color: colors.text }}>
            {selectedPrice ? formatPrice(selectedPrice.price) : '—'} <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>{t('subscription.etb')}</AppText>
          </AppText>
        </View>
        <TouchableOpacity
          style={[styles.subscribeButton, { shadowColor: isPremium ? gold : basicColor }]}
          onPress={handleSelect}
          disabled={!selectedPrice}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={isPremium ? ['#F0D060', '#D4AF37', '#B8960C'] : ['#6366F1', '#4F46E5']}
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

function usePlanGroups(plans: Plan[] | null) {
  const groups: Record<string, { name: string; items: Plan[] }> = {};
  (plans ?? []).forEach((p) => {
    if (!groups[p.name]) groups[p.name] = { name: p.name, items: [] };
    groups[p.name].items.push(p);
  });
  // Sort premium last for toggle ordering.
  return groups;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function formatPrice(n?: number): string {
  return (n ?? 0).toLocaleString();
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 180 },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  backButton: { padding: 8, alignSelf: 'flex-start' },
  titleSection: { paddingHorizontal: 32, marginBottom: 28 },
  loading: { paddingVertical: 60, alignItems: 'center' },
  planToggle: { flexDirection: 'row', marginHorizontal: 32, gap: 12, marginBottom: 24 },
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
  pricingRow: { flexDirection: 'row', marginHorizontal: 24, gap: 12, marginBottom: 32 },
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
  price: { marginTop: 8, marginBottom: 4 },
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
  footerPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subscribeButton: { borderRadius: 20, overflow: 'hidden', elevation: 6, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  subscribeGradient: { flexDirection: 'row', height: 60, justifyContent: 'center', alignItems: 'center', gap: 10 },
  subscribeText: { color: '#FFF', letterSpacing: 1 },
});

export default SubscriptionPlansScreen;