import type { TutorialDefinition } from '../types';

export const createBudgetTutorial: TutorialDefinition = {
  id: 'create-budget',
  screen: 'create-budget',
  title: 'Create a Budget',
  subtitle: 'Set up a spending plan',
  steps: [
    {
      id: 'cb-intro',
      targetId: 'cb-header',
      title: 'Creating a Budget',
      description: 'Follow these steps to create a new budget. Budgets help you plan spending, track limits, and control costs.',
      tooltipPosition: 'bottom',
      fullContainer: true,
    },
    {
      id: 'cb-name',
      targetId: 'cb-name',
      title: 'Budget Name',
      description: 'Give your budget a clear name (e.g., "Monthly Operations", "Q1 Marketing"). This helps identify the budget in reports.',
      tooltipPosition: 'bottom',
      exampleValue: 'Q4 Operations Budget',
    },
    {
      id: 'cb-amount',
      targetId: 'cb-amount',
      title: 'Budget Amount',
      description: 'Set the total budget amount. The system will track spending against this limit and warn you as you approach it.',
      tooltipPosition: 'bottom',
      exampleValue: '50000',
    },
    {
      id: 'cb-period',
      targetId: 'cb-period',
      title: 'Budget Period',
      description: 'Set the period — daily, weekly, monthly, quarterly, or yearly. The system will track spending against this period.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'cb-commit',
      targetId: 'cb-commit-btn',
      title: 'Save Budget',
      description: 'Review your budget settings and confirm. The budget will be active immediately and track expenses in real-time.',
      tooltipPosition: 'bottom',
    },
  ],
};
