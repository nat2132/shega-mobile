import type { TutorialDefinition } from '../types';

export const warehouseSettingsTutorial: TutorialDefinition = {
  id: 'warehouse-settings',
  screen: 'warehouse-settings',
  title: 'Warehouse Settings',
  subtitle: 'Configure storage locations',
  steps: [
    {
      id: 'ws-intro',
      targetId: 'ws-header',
      title: 'Warehouse Settings',
      description: 'Manage your warehouse and storage location preferences. Set default warehouses for receiving stock.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'ws-default',
      targetId: 'ws-default',
      title: 'Default Warehouse',
      description: 'Set your default warehouse for new inventory items and purchases. Items will be assigned here by default.',
      tooltipPosition: 'top',
    },
    {
      id: 'ws-list',
      targetId: 'ws-list',
      title: 'Warehouse List',
      description: 'View all your warehouses with item counts and stock values. Tap to manage each location.',
      tooltipPosition: 'top',
    },
    {
      id: 'ws-prefs',
      targetId: 'ws-prefs',
      title: 'Transfer Preferences',
      description: 'Configure stock transfer settings — approval requirements, notification preferences, and default transfer reasons.',
      tooltipPosition: 'top',
    },
  ],
};
