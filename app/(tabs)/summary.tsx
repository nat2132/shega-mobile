import React from 'react';
import SummaryScreen from '@/screens/summary/summary';
import PremiumFeatureGate from '@/components/PremiumFeatureGate';

export default function SummaryRoute() {
  return (
    <PremiumFeatureGate feature="reports">
      <SummaryScreen />
    </PremiumFeatureGate>
  );
}
