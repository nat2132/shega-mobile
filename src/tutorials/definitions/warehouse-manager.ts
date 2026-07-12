import type { TutorialDefinition } from '../types';

export const warehouseManagerTutorial: TutorialDefinition = {
  id: 'warehouse-manager',
  screen: 'warehouse-manager',
  title: 'Warehouse Manager',
  subtitle: 'Manage your storage locations',
  steps: [
    {
      id: 'wm-intro',
      targetId: 'wm-header',
      title: 'Warehouse Management',
      description: 'Manage your storage locations and organize inventory across multiple warehouses or storage areas.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'wm-list',
      targetId: 'wm-list',
      title: 'Warehouse List',
      description: 'View all your warehouses and storage locations. Each entry shows item count and total stock value.',
      tooltipPosition: 'top',
      fullContainer: true,
},
  ],
};
