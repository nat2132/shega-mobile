import type { TutorialDefinition } from '../types';

export const debtManagementTutorial: TutorialDefinition = {
  id: 'debt-management',
  screen: 'debt-management',
  title: 'Debt Management',
  subtitle: 'Track credits and collections',
  steps: [
    {
      id: 'dm-intro',
      targetId: 'dm-header',
      title: 'Debt Management',
      description: 'Track all credit transactions — what customers owe you and what you owe suppliers. Manage payments and due dates.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'dm-summary',
      targetId: 'dm-summary',
      title: 'Debt Overview',
      description: 'See total receivables (customers owe you) and total payables (you owe suppliers) at a glance.',
      tooltipPosition: 'top',
      fullContainer: true,
},
    {
      id: 'dm-actions',
      targetId: 'dm-actions',
      title: 'Collect & Pay',
      description: 'Record payments received from customers or make payments to suppliers directly from this screen.',
      tooltipPosition: 'top',
    },
  ],
};
