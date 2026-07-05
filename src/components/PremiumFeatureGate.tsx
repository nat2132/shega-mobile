import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Crown, Lock, ArrowRight } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { AppText } from '@/components/ui';
import { useRouter } from 'expo-router';

interface PremiumFeatureGateProps {
  feature: string;
  featureName?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const PremiumFeatureGate: React.FC<PremiumFeatureGateProps> = ({
  feature,
  featureName,
  children,
  fallback,
}) => {
  const { colors, theme } = useSettings();
  const { isFeatureUnlocked, isBasicFeature } = useSubscription();
  const router = useRouter();
  const gold = '#D4AF37';

  if (isFeatureUnlocked(feature)) {
    return <>{children}</>;
  }

  if (isBasicFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.lockIcon, { backgroundColor: gold + '15' }]}>
        <Crown size={20} color={gold} />
      </View>
      <View style={styles.textSection}>
        <AppText variant="body" weight="bold" style={{ color: colors.text }}>
          {featureName || 'Premium Feature'}
        </AppText>
        <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
          Upgrade to unlock this feature
        </AppText>
      </View>
      <TouchableOpacity
        style={[styles.upgradeButton, { backgroundColor: gold }]}
        onPress={() => router.push(`/subscription/upgrade?feature=${feature}`)}
        activeOpacity={0.8}
      >
        <AppText variant="caption" weight="bold" style={{ color: '#FFF' }}>
          Upgrade
        </AppText>
        <ArrowRight size={14} color="#FFF" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  lockIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textSection: {
    flex: 1,
    gap: 2,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
});

export default PremiumFeatureGate;
