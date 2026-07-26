import type { TutorialDefinition } from '../types';

export const collectPaymentsTutorial: TutorialDefinition = {
  id: 'collect-payments',
  screen: 'collect-payments',
  title: 'Collect Payments Hub',
  subtitle: 'Manage credit balances and collect customer payments',
  steps: [
    {
      id: 'cp-intro',
      targetId: 'cp-header',
      title: 'Collect Payments Overview',
      description: 'View overall outstanding credit totals, export combined invoice summaries, or search specific debt accounts.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'cp-customer',
      targetId: 'cp-customer-search',
      title: 'Search & Select Customer',
      description: 'Search by customer name or phone to view total amounts owed, due dates, and individual credit items.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'cp-items',
      targetId: 'cp-items',
      title: 'Select Debt Items',
      description: 'Select individual debt items to make partial or full item payments, or view customer payment activity history.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'cp-amount',
      targetId: 'cp-amount',
      title: 'Total & Selection Summary',
      description: 'Check the total outstanding balance and see real-time payment calculations for selected items.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'cp-commit',
      targetId: 'cp-commit-btn',
      title: 'Execute Payment or Write-Off',
      description: 'Choose "Pay All" for full settlement, "Pay Selected" for itemized collection, or mark uncollectible debt as a loss.',
      tooltipPosition: 'top',
    },
  ],
};
