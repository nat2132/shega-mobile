import type { TutorialDefinition } from '../types';

export const settingsTutorial: TutorialDefinition = {
  id: 'settings',
  screen: 'settings',
  title: 'Settings',
  subtitle: 'Customize your experience',
  steps: [
    {
      id: 'settings-intro',
      targetId: 'settings-header',
      title: 'Settings Center',
      description: 'Configure every aspect of your app. From appearance and security to notifications and data management, everything is here.',
      tooltipPosition: 'bottom',

      actionType: 'none',
      fullContainer: true,
},
      {
      id: 'settings-profile',
      targetId: 'settings-profile',
      title: 'Profile & Account',
      description: 'Edit your name, business name, and avatar. Your profile appears in the dashboard header and reports.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
    {
      id: 'settings-theme',
      targetId: 'settings-theme',
      title: 'Theme Selection',
      description: 'Choose from 7 premium themes: Light, Dark, Midnight, Emerald, Charcoal, Slate, and Cocoa. Each theme has a carefully crafted color palette.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
    {
      id: 'settings-security',
      targetId: 'settings-security',
      title: 'Security & Privacy',
      description: 'Set or change your PIN, enable biometric unlock (fingerprint/Face ID), and manage your recovery code for account access.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
    {
      id: 'settings-notifications',
      targetId: 'settings-notifications',
      title: 'Notification Preferences',
      description: 'Control which alerts you receive — stock shortages, expiration reminders, daily summaries, credit alerts, and more.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
    {
      id: 'settings-language',
      targetId: 'settings-language',
      title: 'Language & Localization',
      description: 'Switch between English, Amharic, Oromo, and Tigrinya. The calendar, date format, and time system adapt automatically.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
    {
      id: 'settings-export',
      targetId: 'settings-export',
      title: 'Data Management',
      description: 'Export your database as a backup file for safekeeping. Regular backups protect your business data against accidental loss.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
  ],
};
