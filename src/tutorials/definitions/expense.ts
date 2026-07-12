import type { TutorialDefinition } from '../types';

export const expenseTutorial: TutorialDefinition = {
  id: 'expense',
  screen: 'expense',
  title: 'Expense Tracker',
  subtitle: 'Monitor and control your spending',
  steps: [
    {
      id: 'exp-intro',
      targetId: 'exp-header',
      title: 'Expense Management',
      description: 'Track every outflow from your business. Monitor spending patterns, manage bills, and stay on top of your financial health.',
      tooltipPosition: 'bottom',
      actionType: 'none',
    },
    {
      id: 'exp-add',
      targetId: 'exp-add-btn',
      title: 'Record an Expense',
      description: 'Tap to log a new expense. Enter the payee, amount, category, and notes. You can also set up recurring bills for regular payments like rent or utilities.',
      tooltipPosition: 'left',
      actionType: 'none',
    },
    {
      id: 'exp-summary',
      targetId: 'exp-summary',
      title: 'Monthly Overview',
      description: 'See your total monthly expenses, compare against last month, and track spending categories at a glance.',
      tooltipPosition: 'bottom',
      actionType: 'none',
    },
    {
      id: 'exp-ledger',
      targetId: 'exp-ledger',
      title: 'Expense Ledger',
      description: 'Every transaction is recorded chronologically. Tap any entry to view or edit details. Swipe to delete if needed.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
    {
      id: 'exp-health',
      targetId: 'exp-health',
      title: 'Expense Health',
      description: 'View your overdue and due-today bills here. Tap "Paid" to mark recurring expenses as settled and keep your payment tracking accurate.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
    {
      id: 'exp-budget',
      targetId: 'exp-budget',
      title: 'Budget Setting',
      description: 'Set a monthly spending limit to control costs. Track your spending against budget in real-time and get alerts when you\'re close to the limit.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
  ],
};
