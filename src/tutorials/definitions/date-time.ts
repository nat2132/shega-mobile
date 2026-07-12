import type { TutorialDefinition } from '../types';

export const dateTimeTutorial: TutorialDefinition = {
  id: 'date-time',
  screen: 'date-time',
  title: 'Date & Time Settings',
  subtitle: 'Configure date and time formats',
  steps: [
    {
      id: 'dt-intro',
      targetId: 'dt-header',
      title: 'Date & Time',
      description: 'Customize how dates and times are displayed throughout the app. Choose your preferred calendar and time format.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'dt-calendar',
      targetId: 'dt-calendar',
      title: 'Calendar Type',
      description: 'Choose between Gregorian and Ethiopian calendar systems. All dates in the app will use your selection.',
      tooltipPosition: 'top',
      fullContainer: true,
},
    {
      id: 'dt-time',
      targetId: 'dt-time',
      title: 'Time Format',
      description: 'Select 12-hour or 24-hour time format. This affects how times appear on receipts, reports, and screens.',
      tooltipPosition: 'top',
    },
    {
      id: 'dt-save',
      targetId: 'dt-save-btn',
      title: 'Save Settings',
      description: 'Save your date and time preferences. The entire app updates to reflect your chosen format.',
      tooltipPosition: 'top',
    },
  ],
};
