import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import PremiumFeatureLockScreen from '../../src/screens/subscription/premium-feature-lock';
import { FEATURE_LABELS, PremiumFeature } from '@/context/SubscriptionContext';
import { useSettings } from '@/context/SettingsContext';

const FEATURE_KEY_MAP: Record<string, string> = {
  reports: 'subscription.feature_reports',
  dashboard_overview: 'subscription.feature_dashboard',
  pdf_download: 'subscription.feature_pdf',
  csv_import: 'subscription.feature_csv',
  csv_export: 'subscription.feature_csv',
  expense: 'subscription.feature_expense',
  budget: 'subscription.feature_budget',
  debt: 'subscription.feature_debt',
  orders: 'subscription.feature_orders',
  purchase_orders: 'subscription.feature_purchase_orders',
  multi_warehouse: 'subscription.feature_multi_warehouse',
  ai_assistant: 'subscription.feature_ai',
  health_score: 'subscription.feature_health',
  biometrics: 'subscription.feature_biometrics',
  themes: 'subscription.feature_themes',
  supplier_reminders: 'subscription.feature_suppliers',
};

export default function PremiumUpgrade() {
  const { t } = useSettings();
  const { feature } = useLocalSearchParams<{ feature: string }>();
  const featureData = feature && feature in FEATURE_LABELS
    ? FEATURE_LABELS[feature as PremiumFeature]
    : { name: 'Premium Feature', description: 'Unlock this premium feature with a subscription.', benefits: ['Access premium tools', 'Grow your business', 'Get insights'] };

  return (
    <PremiumFeatureLockScreen
      featureName={t(FEATURE_KEY_MAP[feature || '']) || featureData.name}
      description={featureData.description}
      benefits={featureData.benefits}
      onUpgrade={() => router.replace('/subscription/plans')}
      onBack={() => router.back()}
    />
  );
}
