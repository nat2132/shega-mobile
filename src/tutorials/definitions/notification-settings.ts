import type { TutorialDefinition } from '../types';

export const notificationSettingsTutorial: TutorialDefinition = {
  id: 'notification-settings',
  screen: 'notification-settings',
  title: 'Notification Settings',
  subtitle: 'Configure your alerts',
  steps: [
    {
      id: 'ns-intro',
      targetId: 'ns-header',
      title: 'Notification Preferences',
      description: 'Choose which business notifications you receive. Control alerts for stock, payments, and more.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'ns-stock',
      targetId: 'ns-stock',
      title: 'Stock Alerts',
      description: 'Get notified when inventory items reach low stock levels. Set your preferred threshold for each item.',
      tooltipPosition: 'top',
      fullContainer: true,
},
    {
      id: 'ns-payment',
      targetId: 'ns-payment',
      title: 'Payment Reminders',
      description: 'Receive reminders for upcoming and overdue payments. Stay on top of credit collections and bill payments.',
      tooltipPosition: 'top',
    },
  ],
};
