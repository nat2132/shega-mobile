import type { TutorialDefinition } from '../types';

export const expenseListTutorial: TutorialDefinition = {
  id: 'expense-list',
  screen: 'expense-list',
  title: 'Expense Records',
  subtitle: 'Browse all expense entries',
  steps: [
    {
      id: 'el-intro',
      targetId: 'el-header',
      title: 'Expense Records',
      description: 'Browse through all your recorded expenses. Each entry shows the amount, category, date, and description.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'el-filter',
      targetId: 'el-filter',
      title: 'Filter Expenses',
      description: 'Filter by date range, category, or budget. Search by description or amount to find specific entries.',
      tooltipPosition: 'top',
    },
    {
      id: 'el-list',
      targetId: 'el-list',
      title: 'Expense List',
      description: 'Each entry shows the amount, category badge, date, and description. Tap any entry to view or edit details.',
      tooltipPosition: 'top',
    },
  ],
};
