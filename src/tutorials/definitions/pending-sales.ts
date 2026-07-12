import type { TutorialDefinition } from '../types';

export const pendingSalesTutorial: TutorialDefinition = {
  id: 'pending-sales',
  screen: 'pending-sales',
  title: 'Pending Sales',
  subtitle: 'Review and complete pending transactions',
  steps: [
    {
      id: 'ps-intro',
      targetId: 'ps-header',
      title: 'Pending Transactions',
      description: 'View all sale transactions that are in progress or awaiting completion. Complete or cancel pending sales from here.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'ps-list',
      targetId: 'ps-list',
      title: 'Pending Items',
      description: 'Items that have been added to a sale but not yet finalized. Review quantities and prices before completing.',
      tooltipPosition: 'top',
    },
    {
      id: 'ps-actions',
      targetId: 'ps-actions',
      title: 'Complete or Cancel',
      description: 'Finalize the sale to record it in your ledger, or cancel to remove all pending items.',
      tooltipPosition: 'top',
    },
    {
      id: 'ps-totals',
      targetId: 'ps-totals',
      title: 'Running Total',
      description: 'See the subtotal, discounts, and grand total for the pending transaction in real-time as you make changes.',
      tooltipPosition: 'top',
    },
  ],
};
