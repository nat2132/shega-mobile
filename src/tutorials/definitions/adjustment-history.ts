import type { TutorialDefinition } from '../types';

export const adjustmentHistoryTutorial: TutorialDefinition = {
  id: 'adjustment-history',
  screen: 'adjustment-history',
  title: 'Adjustment History',
  subtitle: 'Review all price and stock adjustments',
  steps: [
    {
      id: 'ah-intro',
      targetId: 'ah-header',
      title: 'Adjustment History',
      description: 'View the complete history of all price changes, stock adjustments, and damaged item records.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'ah-filter',
      targetId: 'ah-filter',
      title: 'Filter Adjustments',
      description: 'Filter by adjustment type (price increase, decrease, damaged, stock correction) or by date range.',
      tooltipPosition: 'top',
    },
    {
      id: 'ah-list',
      targetId: 'ah-list',
      title: 'Adjustment Entries',
      description: 'Each entry shows the item name, adjustment type, old and new values, reason, and the user who made the change.',
      tooltipPosition: 'top',
    },
  ],
};
