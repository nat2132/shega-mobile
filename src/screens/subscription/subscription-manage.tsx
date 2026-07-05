import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import {
  Crown,
  Shield,
  Check,
  X,
  Clock,
  Calendar,
  RefreshCw,
  CreditCard,
  FileText,
  History,
  HeadphonesIcon,
  ArrowRight,
  Star,
  ChevronRight,
  AlertCircle,
} from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { useSubscription, PREMIUM_FEATURES, FEATURE_LABELS, PremiumFeature } from '@/context/SubscriptionContext';
import { AppText } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const PLANS = {
  basic: {
    name: 'Basic',
    icon: Shield,
    color: '#6366F1',
    gradient: ['#6366F1', '#4F46E5'] as const,
    prices: [
      { label: '1 Month', months: 1, price: 1999 },
      { label: '3 Months', months: 3, price: 2499 },
    ],
  },
  premium: {
    name: 'Premium',
    icon: Crown,
    color: '#D4AF37',
    gradient: ['#F0D060', '#D4AF37', '#B8960C'] as const,
    prices: [
      { label: '1 Month', months: 1, price: 2499 },
      { label: '3 Months', months: 3, price: 5499 },
    ],
  },
};

const SubscriptionManageScreen: React.FC = () => {
  const { colors, theme } = useSettings();
  const {
    subscription,
    isPremium,
    isTrial,
    trialDaysRemaining,
    payments,
    renewals,
    auditLog,
    cancelCurrentSubscription,
    renewCurrentSubscription,
    refresh,
  } = useSubscription();
  const router = useRouter();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const gold = '#D4AF37';

  const toggleSection = (section: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSection(expandedSection === section ? null : section);
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    trial: { label: 'Trial Active', color: gold },
    pending_payment: { label: 'Pending Payment', color: colors.warning },
    pending_verification: { label: 'Pending Verification', color: colors.warning },
    active: { label: 'Active', color: colors.success },
    expired: { label: 'Expired', color: colors.error },
    cancelled: { label: 'Cancelled', color: colors.textSecondary },
    rejected: { label: 'Rejected', color: colors.error },
    renewing: { label: 'Renewing', color: colors.warning },
  };

  const status = subscription?.status || 'trial';
  const config = statusConfig[status] || { label: status, color: colors.textSecondary };
  const planName = subscription?.plan === 'premium' ? 'Premium' : 'Basic';

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch { return 'N/A'; }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <AppText variant="body" weight="semibold" style={{ color: colors.textSecondary }}>
            Back
          </AppText>
        </TouchableOpacity>
        <AppText variant="heading" weight="bold" style={{ color: colors.text }}>
          Subscription
        </AppText>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); refresh(); }}>
          <RefreshCw size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Current Plan Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LinearGradient
            colors={isPremium || isTrial ? [gold + '15', 'transparent'] : ['#6366F1' + '10', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.planGradient}
          >
            <View style={styles.planHeader}>
              <View style={[styles.planIcon, { backgroundColor: isPremium || isTrial ? gold + '20' : '#6366F1' + '20' }]}>
                {isPremium || isTrial ? <Crown size={24} color={gold} /> : <Shield size={24} color={PLANS.basic.color} />}
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="title" weight="bold" style={{ color: colors.text }}>
                  {planName} Plan
                </AppText>
                <View style={[styles.statusDot, { backgroundColor: config.color }]}>
                  <AppText variant="micro" weight="bold" style={{ color: '#FFF', letterSpacing: 0.5 }}>
                    {config.label.toUpperCase()}
                  </AppText>
                </View>
              </View>
            </View>

            {isTrial && (
              <View style={[styles.trialSection, { borderTopColor: colors.border }]}>
                <View style={styles.trialDays}>
                  <Clock size={18} color={gold} />
                  <AppText variant="display" weight="black" style={{ color: gold }}>
                    {trialDaysRemaining}
                  </AppText>
                  <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>
                    days remaining
                  </AppText>
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressFill, { width: `${(trialDaysRemaining / 7) * 100}%`, backgroundColor: gold }]} />
                </View>
                <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
                  Trial ends {formatDate(subscription?.trialEndsAt)}
                </AppText>
              </View>
            )}

            {subscription?.expiresAt && (
              <View style={[styles.expiryRow, { borderTopColor: colors.border }]}>
                <Calendar size={16} color={colors.textSecondary} />
                <AppText variant="body-sm" weight="medium" style={{ color: colors.textSecondary }}>
                  Expires: {formatDate(subscription.expiresAt)}
                </AppText>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Upgrade / Renew Buttons */}
        {!isPremium && !isTrial && (
          <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.actionRow}>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); router.push('/subscription/plans'); }}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[gold + 'E6', gold, '#B8960C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.upgradeGradient}
              >
                <Crown size={18} color="#FFF" />
                <AppText variant="heading" weight="bold" style={{ color: '#FFF' }}>
                  Upgrade to Premium
                </AppText>
                <ArrowRight size={20} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {isPremium && subscription?.status === 'active' && (
          <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.renewButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/subscription/plans');
              }}
              activeOpacity={0.8}
            >
              <RefreshCw size={18} color={gold} />
              <AppText variant="body" weight="bold" style={{ color: gold }}>
                Renew Subscription
              </AppText>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Pricing Cards */}
        {!isPremium && (
          <Animated.View entering={FadeInDown.delay(300).duration(600)}>
            <TouchableOpacity
              style={[styles.sectionHeader, { borderBottomColor: colors.border }]}
              onPress={() => toggleSection('pricing')}
              activeOpacity={0.7}
            >
              <AppText variant="title-sm" weight="bold" style={{ color: colors.text }}>
                Available Plans
              </AppText>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            {expandedSection === 'pricing' && (
              <View style={styles.pricingSection}>
                <View style={styles.pricingRow}>
                  {(['basic', 'premium'] as const).map((p) => {
                    const pl = PLANS[p];
                    const isP = p === 'premium';
                    return (
                      <View key={p} style={[styles.priceCard, { backgroundColor: colors.card, borderColor: isP ? gold : colors.border }]}>
                        {isP && (
                          <View style={[styles.recommendedBadge, { backgroundColor: gold }]}>
                            <Star size={12} color="#FFF" />
                            <AppText variant="micro" weight="bold" style={{ color: '#FFF' }}>POPULAR</AppText>
                          </View>
                        )}
                        <View style={[styles.priceCardIcon, { backgroundColor: isP ? gold + '20' : '#6366F1' + '20' }]}>
                          {isP ? <Crown size={20} color={gold} /> : <Shield size={20} color={pl.color} />}
                        </View>
                        <AppText variant="title-sm" weight="bold" style={{ color: colors.text }}>{pl.name}</AppText>
                        {pl.prices.map((pr, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={[styles.priceOption, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              router.push(`/subscription/payment?plan=${p}&durationMonths=${pr.months}&price=${pr.price}`);
                            }}
                          >
                            <AppText variant="body-sm" weight="medium" style={{ color: colors.textSecondary }}>
                              {pr.label}
                            </AppText>
                            <AppText variant="title" weight="black" style={{ color: colors.text }}>
                              {pr.price.toLocaleString()} <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>ETB</AppText>
                            </AppText>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Feature Comparison */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <TouchableOpacity
            style={[styles.sectionHeader, { borderBottomColor: colors.border }]}
            onPress={() => toggleSection('features')}
            activeOpacity={0.7}
          >
            <AppText variant="title-sm" weight="bold" style={{ color: colors.text }}>
              Feature Comparison
            </AppText>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {expandedSection === 'features' && (
            <View style={styles.featuresList}>
              <View style={[styles.featureHeader, { borderBottomColor: colors.border }]}>
                <AppText variant="caption" weight="bold" style={{ color: colors.textSecondary, flex: 1 }}>
                  Feature
                </AppText>
                <AppText variant="caption" weight="bold" style={{ color: PLANS.basic.color, width: 60, textAlign: 'center' }}>
                  Basic
                </AppText>
                <AppText variant="caption" weight="bold" style={{ color: gold, width: 60, textAlign: 'center' }}>
                  Premium
                </AppText>
              </View>
              <View style={styles.featureRow}>
                <AppText variant="body-sm" weight="medium" style={{ color: colors.text, flex: 1 }}>Inventory</AppText>
                <Check size={16} color={colors.success} style={{ width: 60, alignSelf: 'center' }} />
                <Check size={16} color={colors.success} style={{ width: 60, alignSelf: 'center' }} />
              </View>
              <View style={styles.featureRow}>
                <AppText variant="body-sm" weight="medium" style={{ color: colors.text, flex: 1 }}>Sales</AppText>
                <Check size={16} color={colors.success} style={{ width: 60, alignSelf: 'center' }} />
                <Check size={16} color={colors.success} style={{ width: 60, alignSelf: 'center' }} />
              </View>
              <View style={styles.featureRow}>
                <AppText variant="body-sm" weight="medium" style={{ color: colors.text, flex: 1 }}>Contacts</AppText>
                <Check size={16} color={colors.success} style={{ width: 60, alignSelf: 'center' }} />
                <Check size={16} color={colors.success} style={{ width: 60, alignSelf: 'center' }} />
              </View>
              <View style={styles.featureRow}>
                <AppText variant="body-sm" weight="medium" style={{ color: colors.text, flex: 1 }}>Stock Adjustments</AppText>
                <Check size={16} color={colors.success} style={{ width: 60, alignSelf: 'center' }} />
                <Check size={16} color={colors.success} style={{ width: 60, alignSelf: 'center' }} />
              </View>
              {PREMIUM_FEATURES.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <AppText variant="body-sm" weight="medium" style={{ color: colors.text, flex: 1 }}>
                    {FEATURE_LABELS[f as PremiumFeature]?.name || f}
                  </AppText>
                  <X size={16} color={colors.error} style={{ width: 60, alignSelf: 'center' }} />
                  <Check size={16} color={colors.success} style={{ width: 60, alignSelf: 'center' }} />
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Transaction History */}
        <Animated.View entering={FadeInDown.delay(500).duration(600)}>
          <TouchableOpacity
            style={[styles.sectionHeader, { borderBottomColor: colors.border }]}
            onPress={() => toggleSection('history')}
            activeOpacity={0.7}
          >
            <AppText variant="title-sm" weight="bold" style={{ color: colors.text }}>
              Transaction History
            </AppText>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {expandedSection === 'history' && (
            <View>
              {payments.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <History size={24} color={colors.textSecondary} />
                  <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>
                    No payment history yet
                  </AppText>
                </View>
              ) : (
                payments.map((payment, idx) => (
                  <View key={idx} style={[styles.historyItem, { borderBottomColor: colors.border }]}>
                    <View style={[styles.historyIcon, { backgroundColor: payment.status === 'verified' ? colors.success + '20' : colors.warning + '20' }]}>
                      <FileText size={16} color={payment.status === 'verified' ? colors.success : colors.warning} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="body-sm" weight="semibold" style={{ color: colors.text }}>
                        {payment.planName}
                      </AppText>
                      <AppText variant="micro" weight="medium" style={{ color: colors.textSecondary }}>
                        {payment.transactionId} · {formatDate(payment.createdAt)}
                      </AppText>
                    </View>
                    <View>
                      <AppText variant="body" weight="bold" style={{ color: colors.text }}>
                        {payment.amount?.toLocaleString()} ETB
                      </AppText>
                      <AppText variant="micro" weight="medium" style={{ color: payment.status === 'pending_verification' ? colors.warning : colors.success, textAlign: 'right' }}>
                        {payment.status === 'pending_verification' ? 'Pending' : 'Verified'}
                      </AppText>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </Animated.View>

        {/* Restore / Support */}
        <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.footerActions}>
          <TouchableOpacity
            style={[styles.footerAction, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              refresh();
            }}
          >
            <RefreshCw size={18} color={colors.textSecondary} />
            <AppText variant="body" weight="medium" style={{ color: colors.text }}>
              Restore Purchase
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.footerAction, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <HeadphonesIcon size={18} color={colors.textSecondary} />
            <AppText variant="body" weight="medium" style={{ color: colors.text }}>
              Contact Support
            </AppText>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  planCard: {
    marginHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  planGradient: {
    padding: 24,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  trialSection: {
    borderTopWidth: 1,
    paddingTop: 16,
    gap: 10,
  },
  trialDays: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 4,
  },
  actionRow: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  upgradeButton: {
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  upgradeGradient: {
    flexDirection: 'row',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  renewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  pricingSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priceCard: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  recommendedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomLeftRadius: 10,
  },
  priceCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceOption: {
    width: '100%',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  featuresList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerActions: {
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 16,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
});

export default SubscriptionManageScreen;
