import type { TutorialDefinition } from '../types';

export const contactsTutorial: TutorialDefinition = {
  id: 'contacts',
  screen: 'contacts',
  title: 'Contacts',
  subtitle: 'Manage your business network',
  steps: [
    {
      id: 'con-intro',
      targetId: 'con-header',
      title: 'Business Contacts',
      description: 'Store and manage all your business contacts — customers, suppliers, and partners. Quick access to call, message, and track interactions.',
      tooltipPosition: 'bottom',
      actionType: 'none',
    },
    {
      id: 'con-add',
      targetId: 'con-add-btn',
      title: 'Add a Contact',
      description: 'Tap to add a new contact. Enter their name, phone number, email, and notes. Assign them as customer, supplier, or partner.',
      tooltipPosition: 'left',
      actionType: 'none',
    },
    {
      id: 'con-list',
      targetId: 'con-list',
      title: 'Contact List',
      description: 'All your contacts displayed here. Search by name or phone, tap to view details, call directly, or send a WhatsApp message.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
    {
      id: 'con-search',
      targetId: 'con-search',
      title: 'Search Contacts',
      description: 'Find any contact instantly by typing their name or phone number.',
      tooltipPosition: 'bottom',
      actionType: 'none',
    },
  ],
};
