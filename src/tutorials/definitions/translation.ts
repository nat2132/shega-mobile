import type { TutorialDefinition } from '../types';

export const translationTutorial: TutorialDefinition = {
  id: 'translation',
  screen: 'translation',
  title: 'Language Settings',
  subtitle: 'Choose your preferred language',
  steps: [
    {
      id: 'tr-intro',
      targetId: 'tr-header',
      title: 'Language Selection',
      description: 'Choose your preferred language for the app interface. All menus, labels, and notifications will use your selection.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'tr-list',
      targetId: 'tr-list',
      title: 'Available Languages',
      description: 'Select from available languages. The app interface will update immediately to your chosen language.',
      tooltipPosition: 'top',
    },
    {
      id: 'tr-current',
      targetId: 'tr-current',
      title: 'Current Language',
      description: 'Your current language is highlighted. Tap a different language to switch.',
      tooltipPosition: 'top',
    },
  ],
};
