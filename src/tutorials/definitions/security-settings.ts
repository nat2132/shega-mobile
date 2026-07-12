import type { TutorialDefinition } from '../types';

export const securitySettingsTutorial: TutorialDefinition = {
  id: 'security-settings',
  screen: 'security-settings',
  title: 'Security Settings',
  subtitle: 'Protect your account',
  steps: [
    {
      id: 'sec-intro',
      targetId: 'sec-header',
      title: 'Security',
      description: 'Manage your account security settings — PIN, biometric authentication, and recovery options.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'sec-pin',
      targetId: 'sec-pin',
      title: 'Change PIN',
      description: 'Update your 6-digit security PIN. This is required to access the app and authorize transactions.',
      tooltipPosition: 'top',
    },
    {
      id: 'sec-biometric',
      targetId: 'sec-biometric',
      title: 'Biometric Auth',
      description: 'Enable fingerprint or face ID for quicker, secure access to the app without entering your PIN each time.',
      tooltipPosition: 'top',
    },
    {
      id: 'sec-recovery',
      targetId: 'sec-recovery',
      title: 'Recovery Code',
      description: 'View your recovery code. Keep this safe — it\'s the only way to regain access if you forget your PIN.',
      tooltipPosition: 'top',
    },
  ],
};
