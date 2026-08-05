import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Lock,
  Shield,
  Crown,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscription } from '@/context/SubscriptionContext';
import { useRouter } from 'expo-router';

const SubscriptionRenewalScreen = () => {
  const { colors, t } = useSettings();
  const { daysUntilExpiry, subscription } = useSubscription();
  const router = useRouter();
  const G = { bg: colors.background, card: colors.card, border: colors.border, text: colors.text, muted: colors.textSecondary, fg: colors.primary };

  const handleRenewPremium = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/subscription/plans');
  };

  const handleRenewBasic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/subscription/plans');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: '#EF444420' }]}>
            <AlertTriangle size={48} color="#EF4444" />
          </View>
          <AppText variant="display" weight="black" align="center" style={[styles.headerTitle, { color: G.text }]} numberOfLines={2}>
            {t('subscription.expired_title')}
          </AppText>
          <AppText variant="body-lg" weight="medium" align="center" style={[styles.headerSub, { color: G.muted }]} numberOfLines={3}>
            {t('subscription.expired_desc')}
          </AppText>
        </View>

        <View style={[styles.card, { backgroundColor: G.card, borderColor: G.border }]}>
          <View style={styles.cardHeader}>
            <Lock size={20} color={G.muted} />
            <AppText variant="body" weight="bold" style={{ color: G.text }}>
              {t('subscription.current_status')}
            </AppText>
          </View>
          <View style={styles.statusRow}>
            <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
              {t('subscription.plan')}
            </AppText>
            <AppText variant="body" weight="bold" style={{ color: G.text }}>
              {subscription?.plan === 'premium' ? t('subscription.plan_premium') : t('subscription.plan_basic')}
            </AppText>
          </View>
          <View style={styles.statusRow}>
            <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
              {t('subscription.status')}
            </AppText>
            <AppText variant="body" weight="bold" style={{ color: '#EF4444' }}>
              {t('subscription.expired')}
            </AppText>
          </View>
          {daysUntilExpiry > 0 && (
            <View style={styles.statusRow}>
              <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                {t('subscription.expired_days_ago')}
              </AppText>
              <AppText variant="body" weight="bold" style={{ color: G.text }}>
                {daysUntilExpiry} {t('subscription.days')}
              </AppText>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: G.card, borderColor: G.border }]}>
          <View style={styles.cardHeader}>
            <Shield size={20} color={G.muted} />
            <AppText variant="body" weight="bold" style={{ color: G.text }}>
              {t('subscription.limited_access')}
            </AppText>
          </View>
          <View style={styles.accessRow}>
            <View style={styles.accessItem}>
              <Shield size={16} color="#22C55E" />
              <AppText variant="body" weight="medium" style={{ color: G.text }}>
                {t('subscription.view_data')}
              </AppText>
            </View>
          </View>
          <View style={styles.accessRow}>
            <View style={styles.accessItem}>
              <Shield size={16} color="#22C55E" />
              <AppText variant="body" weight="medium" style={{ color: G.text }}>
                {t('subscription.backup_data')}
              </AppText>
            </View>
          </View>
          <View style={styles.accessRow}>
            <View style={styles.accessItem}>
              <Lock size={16} color="#EF4444" />
              <AppText variant="body" weight="medium" style={{ color: G.muted }}>
                {t('subscription.add_inventory')}
              </AppText>
            </View>
          </View>
          <View style={styles.accessRow}>
            <View style={styles.accessItem}>
              <Lock size={16} color="#EF4444" />
              <AppText variant="body" weight="medium" style={{ color: G.muted }}>
                {t('subscription.make_sales')}
              </AppText>
            </View>
          </View>
          <View style={styles.accessRow}>
            <View style={styles.accessItem}>
              <Lock size={16} color="#EF4444" />
              <AppText variant="body" weight="medium" style={{ color: G.muted }}>
                {t('subscription.add_expenses')}
              </AppText>
            </View>
          </View>
          <View style={styles.accessRow}>
            <View style={styles.accessItem}>
              <Lock size={16} color="#EF4444" />
              <AppText variant="body" weight="medium" style={{ color: G.muted }}>
                {t('subscription.premium_analytics')}
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.actionSection}>
          <AppText variant="heading" weight="bold" style={[styles.actionTitle, { color: G.text }]}>
            {t('subscription.renew_to_continue')}
          </AppText>
          <TouchableOpacity
            style={[styles.renewButton, { backgroundColor: '#D4AF37' }]}
            onPress={handleRenewPremium}
            activeOpacity={0.9}
          >
            <Crown size={22} color="#FFF" />
            <AppText variant="heading" weight="bold" style={styles.renewButtonText}>
              {t('subscription.renew_premium')}
            </AppText>
            <ArrowRight size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.renewButton, { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.border }]}
            onPress={handleRenewBasic}
            activeOpacity={0.9}
          >
            <Shield size={22} color="#FFF" />
            <AppText variant="heading" weight="bold" style={styles.renewButtonText}>
              {t('subscription.renew_basic')}
            </AppText>
            <ArrowRight size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    marginBottom: 8,
  },
  headerSub: {
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#00000010',
  },
  accessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#00000010',
  },
  accessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  actionSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  actionTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  renewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 18,
    marginBottom: 12,
    gap: 10,
  },
  renewButtonText: {
    color: '#FFF',
  },
});

export default SubscriptionRenewalScreen;