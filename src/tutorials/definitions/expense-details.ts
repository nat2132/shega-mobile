import type { TutorialDefinition } from '../types';

export const expenseDetailsTutorial: TutorialDefinition = {
  id: 'expense-details',
  screen: 'expense-details',
  title: 'Expense Details',
  subtitle: 'Review an expense record',
  steps: [
    {
      id: 'ed-intro',
      targetId: 'ed-header',
      title: 'Expense Details',
      description: 'Review the full details of an expense transaction including amount, category, date, and payment information.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'ed-amount',
      targetId: 'ed-amount',
      title: 'Amount & Category',
      description: 'The expense amount, category, and subcategory. This helps you understand where your money is going.',
      tooltipPosition: 'top',
      fullContainer: true,
},
    {
      id: 'ed-details',
      targetId: 'ed-details',
      title: 'Transaction Info',
      description: 'View the expense date, description, and whether it\'s a recurring payment. Recurring expenses show frequency and next due date.',
      tooltipPosition: 'top',
    },
    {
      id: 'ed-budget',
      targetId: 'ed-budget',
      title: 'Budget Impact',
      description: 'See how this expense affects your budget. If linked to a budget category, it shows remaining allowance and spending percentage.',
      tooltipPosition: 'top',
    },
    {
      id: 'ed-actions',
      targetId: 'ed-actions',
      title: 'Actions',
      description: 'Edit or delete this expense from here. You can also duplicate it for similar recurring entries.',
      tooltipPosition: 'top',
    },
  ],
};
