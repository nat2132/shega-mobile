import type { TutorialDefinition } from '../types';

export const inventoryRecordsTutorial: TutorialDefinition = {
  id: 'inventory-records',
  screen: 'inventory-records',
  title: 'Inventory Records',
  subtitle: 'View stock movement history',
  steps: [
    {
      id: 'ir-intro',
      targetId: 'ir-header',
      title: 'Inventory Records',
      description: 'View the complete movement history for all inventory items — stock additions, sales, adjustments, and transfers.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'ir-filter',
      targetId: 'ir-filter',
      title: 'Filter Records',
      description: 'Filter by date range, transaction type (purchase, sale, adjustment), or specific item.',
      tooltipPosition: 'top',
    },
    {
      id: 'ir-list',
      targetId: 'ir-list',
      title: 'Movement Log',
      description: 'Every stock movement is listed chronologically with item name, type, quantity change, and resulting balance.',
      tooltipPosition: 'top',
    },
    {
      id: 'ir-summary',
      targetId: 'ir-summary',
      title: 'Movement Summary',
      description: 'See totals for inbound, outbound, and net stock movement for the selected period.',
      tooltipPosition: 'top',
    },
  ],
};
