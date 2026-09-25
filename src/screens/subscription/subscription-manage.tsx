import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Crown,
  Shield,
  Smartphone,
  Monitor,
  Check,
  X,
  Clock,
  Calendar,
  RefreshCw,
  FileText,
  History,
  HeadphonesIcon,
  ArrowRight,
  Star,
  ChevronRight,
  AlertTriangle,
  Plus,
} from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { useSubscription, PREMIUM_FEATURES, FEATURE_LABELS, PremiumFeature } from '@/context/SubscriptionContext';
import { AppText } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { safeGoBack } from '@/services/navigation';
import { fetchSubscriptionStatus } from '@/services/api';
import { isOfflineError, OFFLINE_MESSAGE } from '@/services/connectivity';
import { applyServerSubscriptionStatus } from '@/database/db';
import { useToast } from '@/context/ToastContext';

const FEATURE_KEY_MAP: Record<string, string> = {
  reports: 'subscription.feature_reports',
  dashboard_overview: 'subscription.feature_dashboard',
  pdf_download: 'subscription.feature_pdf',
  csv_import: 'subscription.feature_csv',
  csv_export: 'subscription.feature_csv',
  debt: 'subscription.feature_debt',
  purchase_orders: 'subscription.feature_purchase_orders',
  multi_warehouse: 'subscription.feature_multi_warehouse',
  ai_assistant: 'subscription.feature_ai',
  health_score: 'subscription.feature_health',
  biometrics: 'subscription.feature_biometrics',
  themes: 'subscription.feature_themes',
  supplier_reminders: 'subscription.feature_suppliers',
  supplier_management: 'subscription.feature_supplier_management',
};

/**
 * The canonical plan structure — an edition of Mobile / Desktop /
 * Mobile + Desktop. Prices mirror the backend, which is the source of truth
 * (4,500 · 7,500 · 10,000 ETB per month).
 */
const PLAN_EDITIONS = [
  {
    key: 'mobile' as const,
    nameKey: 'subscription.plan_mobile',
    icon: Smartphone,
    color: '#6366F1',
    gradient: ['#6366F1', '#4F46E5'] as const,
    price: 4500,
    featured: false,
  },
  {
    key: 'desktop' as const,
    nameKey: 'subscription.plan_desktop',
    icon: Monitor,
    color: '#0EA5E9',
    gradient: ['#38BDF8', '#0284C7'] as const,
    price: 7500,
    featured: false,
  },
  {
    key: 'both' as const,
    nameKey: 'subscription.plan_both',
    icon: Crown,
    color: '#D4AF37',
    gradient: ['#F0D060', '#D4AF37', '#B8960C'] as const,
    price: 10000,
    featured: true,
  },
];

  const SubscriptionManageScreen: React.FC = () => {
  const { colors, t } = useSettings();
  const {
    subscription,
    isPremium,
    isTrial,
    isExpired,
    isExpiringSoon,
    daysUntilExpiry,
    trialDaysRemaining,
    payments,
    refresh,
  } = useSubscription();
  const router = useRouter();
  const { showToast } = useToast();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const gold = '#D4AF37';

  const toggleSection = (section: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleRestorePurchase = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const sub = await fetchSubscriptionStatus();
      if (sub.status === 'active' || sub.status === 'trial') {
        applyServerSubscriptionStatus({
          status: sub.status,
          plan: sub.plan || null,
          planName: sub.plan_name || null,
          expiresAt: sub.expires_at || null,
        });
        await refresh();
        showToast({ title: t('subscription.restore_success'), message: t('subscription.restore_success_desc'), type: 'success' });
      } else {
        showToast({ title: t('subscription.restore_none'), message: t('subscription.restore_none_desc'), type: 'info' });
      }
    } catch (error) {
      console.error('Restore purchase error:', error);
      showToast({
        title: t('subscription.restore_error'),
        message: isOfflineError(error) ? OFFLINE_MESSAGE : t('subscription.restore_error_desc'),
        type: 'error',
      });
    }
  };

  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('mailto:ssshegas@gmail.com').catch(() => {
      showToast({ title: t('subscription.support_error'), message: t('subscription.support_error_desc'), type: 'error' });
    });
  };

  const statusConfig: Record<string, { labelKey: string; color: string }> = {
    trial: { labelKey: 'subscription.trial_active', color: gold },
    pending_payment: { labelKey: 'subscription.pending_payment', color: colors.warning },
    pending_verification: { labelKey: 'subscription.pending_verification', color: colors.warning },
    active: { labelKey: 'subscription.active', color: colors.success },
    expired: { labelKey: 'subscription.expired', color: colors.error },
    cancelled: { labelKey: 'subscription.cancelled', color: colors.textSecondary },
    rejected: { labelKey: 'subscription.rejected_status', color: colors.error },
    payment_rejected: { labelKey: 'subscription.rejected_status', color: colors.error },
    renewing: { labelKey: 'subscription.renewing_status', color: colors.warning },
    none: { labelKey: 'subscription.no_subscription', color: colors.textSecondary },
  };

  const status = subscription?.status || 'trial';
  const config = statusConfig[status] || { labelKey: status, color: colors.textSecondary };
  const rawPlan = subscription?.plan || '';
  const normalizedPlan = rawPlan.toLowerCase();
  const planName = normalizedPlan.includes('desktop') && normalizedPlan.includes('mobile')
    ? t('subscription.plan_both')
    : normalizedPlan.includes('premium')
      ? t('subscription.plan_both')
      : normalizedPlan.includes('desktop')
        ? t('subscription.plan_desktop')
        : normalizedPlan.includes('mobile') || normalizedPlan.includes('basic')
          ? t('subscription.plan_mobile')
          : rawPlan
            ? rawPlan.replace(/\b\w/g, (c: string) => c.toUpperCase())
            : t('common.na');

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return t('common.na');
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch { return t('common.na'); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeGoBack()} style={styles.backButton}>
          <AppText variant="body" weight="semibold" style={{ color: colors.textSecondary }}>
            {t('subscription.back')}
          </AppText>
        </TouchableOpacity>
        <AppText variant="heading" weight="bold" style={{ color: colors.text }}>
          {t('subscription.manage')}
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
                {isPremium || isTrial ? <Crown size={24} color={gold} /> : <Shield size={24} color={PLAN_EDITIONS[0].color} />}
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="title" weight="bold" style={{ color: colors.text }}>
                  {t('subscription.plan_name', { plan: planName })}
                </AppText>
                <View style={[styles.statusDot, { backgroundColor: config.color }]}>
                  <AppText variant="micro" weight="bold" style={{ color: '#FFF', letterSpacing: 0.5 }}>
                    {t(config.labelKey).toUpperCase()}
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
                    {t('subscription.days_remaining', { days: String(trialDaysRemaining) })}
                  </AppText>
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressFill, { width: `${(trialDaysRemaining / 7) * 100}%`, backgroundColor: gold }]} />
                </View>
                <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
                  {t('subscription.trial_ends', { date: formatDate(subscription?.trialEndsAt) })}
                </AppText>
              </View>
            )}

            {subscription?.expiresAt && (
              <View style={[styles.expiryRow, { borderTopColor: colors.border }]}>
                <Calendar size={16} color={colors.textSecondary} />
                <AppText variant="body-sm" weight="medium" style={{ color: colors.textSecondary }}>
                  {t('subscription.expires', { date: formatDate(subscription.expiresAt) })}
                </AppText>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {isExpired && (
               <Animated.View entering={FadeInDown.delay(100).duration(500)} style={[styles.expiredBanner, { borderColor: colors.error + '30' }]}>
                 <View style={styles.expiredBannerIcon}>
                   <AlertTriangle size={20} color={colors.error} />
                 </View>
                 <View style={{ flex: 1 }}>
                   <AppText variant="body" weight="bold" style={{ color: colors.error }}>
                     {t('subscription.expired')}
                   </AppText>
                   <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
                     {t('subscription.expired_desc')}
                   </AppText>
                 </View>
               </Animated.View>
             )}

             {isExpiringSoon && daysUntilExpiry > 0 && (
               <Animated.View entering={FadeInDown.delay(100).duration(500)} style={[styles.expiringBanner, { borderColor: '#F59E0B30' }]}>
                 <View style={styles.expiringBannerIcon}>
                   <Clock size={20} color="#F59E0B" />
                 </View>
                 <View style={{ flex: 1 }}>
                   <AppText variant="body" weight="bold" style={{ color: '#F59E0B' }}>
                     {t('subscription.expiring_soon')}
                   </AppText>
                   <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
                     {t('subscription.expiring_banner', { days: String(daysUntilExpiry) })}
                   </AppText>
                 </View>
               </Animated.View>
             )}

             {isExpired && (
               <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.actionRow}>
                 <TouchableOpacity
                   style={[styles.renewButton, { backgroundColor: colors.error }]}
                   onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/subscription/renewal'); }}
                   activeOpacity={0.9}
                 >
                   <RefreshCw size={18} color="#FFF" />
                   <AppText variant="heading" weight="bold" style={{ color: '#FFF' }}>
                     {t('subscription.renew_now')}
                   </AppText>
                   <ArrowRight size={20} color="#FFF" />
                 </TouchableOpacity>
               </Animated.View>
             )}

             {!isPremium && !isTrial && !isExpired && (
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
                       {t('subscription.upgrade')}
                     </AppText>
                     <ArrowRight size={20} color="#FFF" />
                   </LinearGradient>
                 </TouchableOpacity>
               </Animated.View>
             )}

             {isPremium && subscription?.status === 'active' && !isExpired && (
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
                      {t('subscription.renew')}
                    </AppText>
                  </TouchableOpacity>
                </Animated.View>
              )}

              {(isPremium || isTrial) && !isExpired && (
                <Animated.View entering={FadeInDown.delay(250).duration(600)} style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.renewButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push('/subscription/addons');
                    }}
                    activeOpacity={0.8}
                  >
                    <Plus size={18} color={gold} />
                    <AppText variant="body" weight="bold" style={{ color: gold }}>
                      {t('subscription.addons_manage')}
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
                {t('subscription.available_plans')}
              </AppText>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            {expandedSection === 'pricing' && (
              <View style={styles.pricingSection}>
                <View style={styles.pricingRow}>
                  {PLAN_EDITIONS.map((plan) => {
                    const Icon = plan.icon;
                    const isP = plan.featured;
                    return (
                      <View key={plan.key} style={[styles.priceCard, { backgroundColor: colors.card, borderColor: isP ? gold : colors.border }]}>
                        {isP && (
                          <View style={[styles.recommendedBadge, { backgroundColor: gold }]}>
                            <Star size={12} color="#FFF" />
                            <AppText variant="micro" weight="bold" style={{ color: '#FFF' }}>{t('subscription.popular')}</AppText>
                          </View>
                        )}
                        <View style={[styles.priceCardIcon, { backgroundColor: (isP ? gold : plan.color) + '20' }]}>
                          <Icon size={20} color={isP ? gold : plan.color} />
                        </View>
                        <AppText variant="title-sm" weight="bold" style={{ color: colors.text }}>{t(plan.nameKey)}</AppText>
                        <TouchableOpacity
                          style={[styles.priceOption, { backgroundColor: colors.surface, borderColor: colors.border }]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push(`/subscription/payment?plan=${plan.key}&durationMonths=1&price=${plan.price}`);
                          }}
                        >
                          <AppText variant="body-sm" weight="medium" style={{ color: colors.textSecondary }}>
                            {t('subscription.month_1')}
                          </AppText>
                          <AppText variant="title" weight="black" style={{ color: colors.text }}>
                            {plan.price.toLocaleString()} <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>{t('subscription.etb')}</AppText>
                          </AppText>
                        </TouchableOpacity>
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
              {t('subscription.feature_comparison')}
            </AppText>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {expandedSection === 'features' && (
            <View style={styles.featuresList}>
              <View style={[styles.featureHeader, { borderBottomColor: colors.border }]}>
                <AppText variant="caption" weight="bold" style={{ color: colors.textSecondary, flex: 1 }}>
                  {t('subscription.feature_label')}
                </AppText>
                {PLAN_EDITIONS.map((plan) => (
                  <AppText
                    key={plan.key}
                    variant="caption"
                    weight="bold"
                    style={{ color: plan.featured ? gold : plan.color, width: 48, textAlign: 'center' }}
                  >
                    {t(plan.nameKey)}
                  </AppText>
                ))}
              </View>
              <View style={styles.featureRow}>
                <AppText variant="body-sm" weight="medium" style={{ color: colors.text, flex: 1 }}>{t('subscription.inventory_feature')}</AppText>
                <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
                <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
                <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
              </View>
              <View style={styles.featureRow}>
                <AppText variant="body-sm" weight="medium" style={{ color: colors.text, flex: 1 }}>{t('subscription.sales_feature')}</AppText>
                <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
                <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
                <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
              </View>
              <View style={styles.featureRow}>
                <AppText variant="body-sm" weight="medium" style={{ color: colors.text, flex: 1 }}>{t('subscription.contacts_feature')}</AppText>
                <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
                <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
                <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
              </View>
              <View style={styles.featureRow}>
                <AppText variant="body-sm" weight="medium" style={{ color: colors.text, flex: 1 }}>{t('subscription.stock_adjustments_feature')}</AppText>
                <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
                <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
                <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
              </View>
              {PREMIUM_FEATURES.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <AppText variant="body-sm" weight="medium" style={{ color: colors.text, flex: 1 }}>
                    {t(FEATURE_KEY_MAP[f]) || FEATURE_LABELS[f as PremiumFeature]?.name || f}
                  </AppText>
                  <X size={16} color={colors.error} style={{ width: 48, alignSelf: 'center' }} />
                  <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
                  <Check size={16} color={colors.success} style={{ width: 48, alignSelf: 'center' }} />
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
              {t('subscription.transaction_history')}
            </AppText>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {expandedSection === 'history' && (
            <View>
              {payments.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <History size={24} color={colors.textSecondary} />
                  <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>
                    {t('subscription.no_payment_history')}
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
                        {payment.amount?.toLocaleString()} {t('subscription.etb')}
                      </AppText>
                      <AppText variant="micro" weight="medium" style={{ color: payment.status === 'pending_verification' ? colors.warning : colors.success, textAlign: 'right' }}>
                        {payment.status === 'pending_verification' ? t('subscription.pending') : t('subscription.verified')}
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
            onPress={handleRestorePurchase}
          >
            <RefreshCw size={18} color={colors.textSecondary} />
            <AppText variant="body" weight="medium" style={{ color: colors.text }}>
              {t('subscription.restore')}
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.footerAction, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleContactSupport}
          >
            <HeadphonesIcon size={18} color={colors.textSecondary} />
            <AppText variant="body" weight="medium" style={{ color: colors.text }}>
              {t('subscription.support')}
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
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#EF444410',
    marginBottom: 12,
    gap: 12,
  },
  expiredBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EF444420',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expiringBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#F59E0B10',
    marginBottom: 12,
    gap: 12,
  },
  expiringBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F59E0B20',
    justifyContent: 'center',
    alignItems: 'center',
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
    flexWrap: 'wrap',
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
