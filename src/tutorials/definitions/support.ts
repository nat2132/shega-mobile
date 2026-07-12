import type { TutorialDefinition } from '../types';

export const supportTutorial: TutorialDefinition = {
  id: 'support',
  screen: 'support',
  title: 'Help & Support',
  subtitle: 'Get help and app information',
  steps: [
    {
      id: 'su-intro',
      targetId: 'su-header',
      title: 'Help & Support',
      description: 'Access app information, contact support, and view frequently asked questions.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'su-info',
      targetId: 'su-info',
      title: 'App Information',
      description: 'View the app version, build number, and system status. Check for updates here.',
      tooltipPosition: 'top',
    },
    {
      id: 'su-contact',
      targetId: 'su-contact',
      title: 'Contact Support',
      description: 'Reach out to our support team via email or phone. We\'re here to help with any issues or questions.',
      tooltipPosition: 'top',
    },
    {
      id: 'su-faq',
      targetId: 'su-faq',
      title: 'FAQ & Guides',
      description: 'Browse frequently asked questions and user guides to learn more about app features.',
      tooltipPosition: 'top',
    },
  ],
};
