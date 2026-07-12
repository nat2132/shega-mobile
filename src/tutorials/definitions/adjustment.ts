import type { TutorialDefinition } from '../types';

export const adjustmentTutorial: TutorialDefinition = {
  id: 'adjustment',
  screen: 'adjustment',
  title: 'Adjustments',
  subtitle: 'Manage price and stock changes',
  steps: [
    {
      id: 'adj-intro',
      targetId: 'adj-header',
      title: 'Adjustments Hub',
      description: 'Make corrections to your inventory — price changes, damaged item logging, and stock corrections. All adjustments are recorded in an immutable audit trail.',
      tooltipPosition: 'bottom',

      actionType: 'none',
      fullContainer: true,
},
      {
      id: 'adj-types',
      targetId: 'adj-types',
      title: 'Adjustment Types',
      description: 'Choose from three types: Price Increase, Price Decrease, or Damaged Items. Each type creates a permanent record for auditing.',
      tooltipPosition: 'bottom',
      actionType: 'none',
    },
    {
      id: 'adj-ledger',
      targetId: 'adj-ledger',
      title: 'Calibration Ledger',
      description: 'All past adjustments are recorded here. View the audit trail with timestamps, previous and new values, and reasons for each change.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
    {
      id: 'adj-stats',
      targetId: 'adj-stats',
      title: 'Integrity Statistics',
      description: 'Track monthly corrections, capital leakage from damaged items, and stock integrity scores to monitor inventory health.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
  ],
};
