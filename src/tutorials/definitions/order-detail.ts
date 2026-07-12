import type { TutorialDefinition } from '../types';

export const orderDetailTutorial: TutorialDefinition = {
  id: 'order-detail',
  screen: 'order-detail',
  title: 'Order Details',
  subtitle: 'Review a purchase order',
  steps: [
    {
      id: 'od-intro',
      targetId: 'od-header',
      title: 'Purchase Order',
      description: 'This screen shows the complete details of a purchase order — items ordered, supplier info, and order status.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'od-summary',
      targetId: 'od-summary',
      title: 'Order Summary',
      description: 'View the order status, total items, and overall cost. The status indicator shows if the order is pending, received, or cancelled.',
      tooltipPosition: 'top',
      fullContainer: true,
},
    {
      id: 'od-items',
      targetId: 'od-items',
      title: 'Ordered Items',
      description: 'The list of items in this order, including quantities, unit prices, and line totals.',
      tooltipPosition: 'top',
    },
    {
      id: 'od-notes',
      targetId: 'od-notes',
      title: 'Notes & Attachments',
      description: 'Any notes or special instructions added when creating the order. Reference numbers and delivery notes are shown here.',
      tooltipPosition: 'top',
    },
  ],
};
