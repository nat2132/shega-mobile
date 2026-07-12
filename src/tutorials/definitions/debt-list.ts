import type { TutorialDefinition } from '../types';

export const debtListTutorial: TutorialDefinition = {
  id: 'debt-list',
  screen: 'debt-list',
  title: 'Debt Records',
  subtitle: 'View all debt entries',
  steps: [
    {
      id: 'dl-intro',
      targetId: 'dl-header',
      title: 'Debt Records',
      description: 'View all debt and credit records. This includes both receivables (customers owe you) and payables (you owe suppliers).',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'dl-list',
      targetId: 'dl-list',
      title: 'Debt Entries',
      description: 'Each entry shows the person or company, amount, due date, and status (pending, overdue, paid).',
      tooltipPosition: 'top',
      fullContainer: true,
},
  ],
};
