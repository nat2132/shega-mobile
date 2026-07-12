import type { TutorialDefinition } from '../types';

export const oncreditListTutorial: TutorialDefinition = {
  id: 'oncredit-list',
  screen: 'oncredit-list',
  title: 'On-Credit List',
  subtitle: 'Items sold on credit',
  steps: [
    {
      id: 'ocl-intro',
      targetId: 'ocl-header',
      title: 'On-Credit Items',
      description: 'View all items that have been sold on credit and are awaiting payment from customers.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'ocl-list',
      targetId: 'ocl-list',
      title: 'Credit Items',
      description: 'Each entry shows the customer name, item sold, amount due, and days outstanding.',
      tooltipPosition: 'top',
    },
  ],
};
