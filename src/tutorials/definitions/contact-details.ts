import type { TutorialDefinition } from '../types';

export const contactDetailsTutorial: TutorialDefinition = {
  id: 'contact-details',
  screen: 'contact-details',
  title: 'Contact Details',
  subtitle: 'View and manage a contact',
  steps: [
    {
      id: 'cd-intro',
      targetId: 'cd-header',
      title: 'Contact Profile',
      description: 'This screen shows all information about a contact — personal details, transaction history, and outstanding balances.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'cd-info',
      targetId: 'cd-info',
      title: 'Contact Information',
      description: 'View name, phone numbers, account number, category, and notes about this contact. Tap to call or message.',
      tooltipPosition: 'top',
    },
    {
      id: 'cd-balance',
      targetId: 'cd-balance',
      title: 'Outstanding Balance',
      description: 'Any outstanding credit balance for this contact. Track what they owe and when payments are due.',
      tooltipPosition: 'top',
    },
    {
      id: 'cd-actions',
      targetId: 'cd-actions',
      title: 'Actions',
      description: 'Edit contact details, record a sale, or collect payment directly from this screen.',
      tooltipPosition: 'top',
    },
  ],
};
