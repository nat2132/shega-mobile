import type { TutorialDefinition } from '../types';

export const remindersTutorial: TutorialDefinition = {
  id: 'reminders',
  screen: 'reminders',
  title: 'Reminder History',
  subtitle: 'Track your reminders',
  steps: [
    {
      id: 'rm-intro',
      targetId: 'rm-header',
      title: 'Reminder History',
      description: 'View all scheduled and past reminders for payments, stock checks, and business tasks.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'rm-list',
      targetId: 'rm-list',
      title: 'Reminder List',
      description: 'Each reminder shows the title, due date, priority, and status. Completed reminders are marked with a check.',
      tooltipPosition: 'top',
    },
  ],
};
