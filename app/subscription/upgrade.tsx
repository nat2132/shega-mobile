import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import PremiumFeatureLockScreen from '../../src/screens/subscription/premium-feature-lock';
import { FEATURE_LABELS, PremiumFeature } from '@/context/SubscriptionContext';

export default function PremiumUpgrade() {
  const { feature } = useLocalSearchParams<{ feature: string }>();
  const featureData = feature && feature in FEATURE_LABELS
    ? FEATURE_LABELS[feature as PremiumFeature]
    : { name: 'Premium Feature', description: 'Unlock this premium feature with a subscription.', benefits: ['Access premium tools', 'Grow your business', 'Get insights'] };

  return (
    <PremiumFeatureLockScreen
      featureName={featureData.name}
      description={featureData.description}
      benefits={featureData.benefits}
      onUpgrade={() => router.replace('/subscription/plans')}
      onBack={() => router.back()}
    />
  );
}
