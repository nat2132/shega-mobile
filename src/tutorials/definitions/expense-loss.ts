import type { TutorialDefinition } from '../types';

export const expenseLossTutorial: TutorialDefinition = {
  id: 'expense-loss',
  screen: 'expense-loss',
  title: 'Expense Loss',
  subtitle: 'Track financial losses',
  steps: [
    {
      id: 'exl-intro',
      targetId: 'exl-header',
      title: 'Loss Tracking',
      description: 'This screen shows expenses categorized as losses — damaged goods, theft, wastage, or other financial losses.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'exl-list',
      targetId: 'exl-list',
      title: 'Loss Entries',
      description: 'Each loss entry shows the amount, type, date, and description. Tap for more details about the incident.',
      tooltipPosition: 'top',
    },
  ],
};
