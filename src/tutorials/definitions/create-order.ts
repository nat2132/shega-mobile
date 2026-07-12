import type { TutorialDefinition } from '../types';

export const createOrderTutorial: TutorialDefinition = {
  id: 'create-order',
  screen: 'create-order',
  title: 'Create Order',
  subtitle: 'Place a customer order',
  steps: [
    {
      id: 'co-intro',
      targetId: 'co-header',
      title: 'Creating an Order',
      description: 'Create a new customer order by selecting items, setting quantities, and adding customer details.',
      tooltipPosition: 'bottom',

      actionType: 'none',
      fullContainer: true,
},
      {
      id: 'co-customer',
      targetId: 'co-customer',
      title: 'Customer Name',
      description: 'Enter the customer\'s name. This is required for order tracking. Existing customers will auto-complete as you type.',
      tooltipPosition: 'bottom',
      actionType: 'none',
      exampleValue: 'Abebe Kebede',
    },
    {
      id: 'co-items',
      targetId: 'co-item-search',
      title: 'Select Items',
      description: 'Search and select items to add to this order. You can add multiple items with different quantities.',
      tooltipPosition: 'bottom',
      actionType: 'none',
    },
    {
      id: 'co-commit',
      targetId: 'co-commit-btn',
      title: 'Place Order',
      description: 'Review the order summary and tap the commit button to finalize. The order will appear in your orders list.',
      tooltipPosition: 'bottom',
      actionType: 'none',
    },
  ],
};
