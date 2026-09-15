import type { TutorialDefinition } from '../types';

export const notificationsTutorial: TutorialDefinition = {
  id: 'notifications',
  screen: 'notifications',
  title: 'Notifications',
  subtitle: 'Stay informed about your business',
  steps: [
    {
      id: 'nt-intro',
      targetId: 'nt-header',
      title: 'Notifications',
      description: 'View all your business notifications — low stock alerts, payment reminders, and more.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'nt-list',
      targetId: 'nt-list',
      title: 'Notification Feed',
      description: 'Each notification shows the type, message, and time. Unread notifications are highlighted. Tap to view details.',
      tooltipPosition: 'top',
      fullContainer: true,
},
    {
      id: 'nt-actions',
      targetId: 'nt-actions',
      title: 'Quick Actions',
      description: 'Mark notifications as read, dismiss them, or tap to take action directly (e.g., restock a low inventory item).',
      tooltipPosition: 'top',
    },
  ],
};
