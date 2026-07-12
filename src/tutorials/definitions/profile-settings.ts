import type { TutorialDefinition } from '../types';

export const profileSettingsTutorial: TutorialDefinition = {
  id: 'profile-settings',
  screen: 'profile-settings',
  title: 'Profile Settings',
  subtitle: 'Manage your personal information',
  steps: [
    {
      id: 'pset-intro',
      targetId: 'pset-header',
      title: 'Your Profile',
      description: 'Manage your personal and business information. Update your name, business name, and profile photo.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pset-avatar',
      targetId: 'pset-avatar',
      title: 'Profile Photo',
      description: 'Tap your avatar to change your profile photo. You can take a new photo or choose from your gallery.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pset-name',
      targetId: 'pset-name',
      title: 'Name & Business',
      description: 'Update your full name and business name. Your name appears on receipts and reports.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pset-save',
      targetId: 'pset-save-btn',
      title: 'Save Changes',
      description: 'Tap to save your profile changes. Updates are applied immediately across the app.',
      tooltipPosition: 'bottom',
    },
  ],
};
