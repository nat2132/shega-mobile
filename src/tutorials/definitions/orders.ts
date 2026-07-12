import type { TutorialDefinition } from '../types';

export const ordersTutorial: TutorialDefinition = {
  id: 'orders',
  screen: 'orders',
  title: 'Orders',
  subtitle: 'Manage customer orders',
  steps: [
    {
      id: 'ord-intro',
      targetId: 'ord-header',
      title: 'Order Management',
      description: 'Track customer orders from creation to fulfillment. Manage order status, quantities, and delivery all in one place.',
      tooltipPosition: 'bottom',
      actionType: 'none',
    },
    {
      id: 'ord-add',
      targetId: 'ord-add-btn',
      title: 'Create New Order',
      description: 'Tap to create a new customer order. Select items, set quantities, add customer details, and choose payment terms.',
      tooltipPosition: 'left',
      actionType: 'none',
    },
    {
      id: 'ord-list',
      targetId: 'ord-list',
      title: 'Orders List',
      description: 'All orders organized by status. See pending, confirmed, and completed orders. Tap any order to view details or update status.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
  ],
};
