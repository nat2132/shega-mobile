import type { TutorialDefinition } from '../types';

export const itemDetailsTutorial: TutorialDefinition = {
  id: 'item-details',
  screen: 'item-details',
  title: 'Item Details',
  subtitle: 'View complete inventory item information',
  steps: [
    {
      id: 'id-intro',
      targetId: 'id-header',
      title: 'Item Overview',
      description: 'This screen shows everything about an inventory item — stock levels, pricing, supplier info, and movement history.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'id-stats',
      targetId: 'id-stats',
      title: 'Stock & Pricing',
      description: 'View current stock quantity, buying price, selling price, and calculated profit margin. Low stock items are highlighted.',
      tooltipPosition: 'top',
      fullContainer: true,
},
    {
      id: 'id-details',
      targetId: 'id-details',
      title: 'Item Information',
      description: 'Detailed information including category, brand, unit type, supplier, and expiry date for perishable items.',
      tooltipPosition: 'top',
    },
    {
      id: 'id-history',
      targetId: 'id-history',
      title: 'Movement History',
      description: 'View the complete transaction history for this item — sales, purchases, adjustments, and stock counts.',
      tooltipPosition: 'top',
    },
    {
      id: 'id-actions',
      targetId: 'id-actions',
      title: 'Quick Actions',
      description: 'Perform actions on this item — restock, adjust price, mark as damaged, or update item details.',
      tooltipPosition: 'top',
    },
  ],
};
