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
    },
    {
      id: 'cb-name',
      targetId: 'cb-name',
      title: 'Budget Name',
      description: 'Give your budget a clear name (e.g., "Monthly Operations", "Q1 Marketing"). This helps identify the budget in reports.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'cb-type',
      targetId: 'cb-type',
      title: 'Budget Type',
      description: 'Choose the budget type — business-wide, department-specific, or project-based. This determines how spending is tracked.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'cb-period',
      targetId: 'cb-period',
      title: 'Budget Period',
      description: 'Set the period — daily, weekly, monthly, quarterly, or yearly. The system will track spending against this period.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'cb-categories',
      targetId: 'cb-categories',
      title: 'Budget Categories',
      description: 'Add spending categories and allocate amounts to each. For example: rent, utilities, supplies. Each category gets its own limit.',
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
