import type { TutorialDefinition } from '../types';

export const lowStockListTutorial: TutorialDefinition = {
  id: 'low-stock-list',
  screen: 'low-stock-list',
  title: 'Low Stock Items',
  subtitle: 'Items needing reorder',
  steps: [
    {
      id: 'lsl-intro',
      targetId: 'lsl-header',
      title: 'Low Stock Alerts',
      description: 'View all inventory items that are running low and need to be restocked soon.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'lsl-list',
      targetId: 'lsl-list',
      title: 'Low Stock Items',
      description: 'Each item shows current stock level, minimum threshold, and supplier information for quick reordering.',
      tooltipPosition: 'top',
      fullContainer: true,
},
  ],
};
