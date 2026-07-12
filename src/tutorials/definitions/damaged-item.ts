import type { TutorialDefinition } from '../types';

export const damagedItemTutorial: TutorialDefinition = {
  id: 'damaged-item',
  screen: 'damaged-item',
  title: 'Log Damaged Item',
  subtitle: 'Record inventory damage or loss',
  steps: [
    {
      id: 'di-intro',
      targetId: 'di-header',
      title: 'Damaged Item Log',
      description: 'Follow these steps to record damaged, expired, or lost inventory items. This keeps your stock counts accurate.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'di-search',
      targetId: 'di-search',
      title: 'Find Item',
      description: 'Search for the damaged or lost item. Type its name to locate it in your inventory records.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'di-item',
      targetId: 'di-item-select',
      title: 'Select Item',
      description: 'Select the item from search results. Review the current stock level before recording the loss.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'di-quantity',
      targetId: 'di-quantity',
      title: 'Damaged Quantity',
      description: 'Enter the quantity of items that are damaged or lost. Specify whether this is in base units or packs.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'di-unit',
      targetId: 'di-unit-type',
      title: 'Unit Type',
      description: 'Choose the unit type — base unit or pack. Make sure this matches the quantity you entered.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'di-reason',
      targetId: 'di-reason',
      title: 'Reason',
      description: 'Select the reason for the loss (damaged, expired, broken, stolen, or other). This helps track loss patterns.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'di-date',
      targetId: 'di-date',
      title: 'Date of Loss',
      description: 'Set the date when the damage or loss was discovered. This is recorded in your adjustment history.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'di-commit',
      targetId: 'di-commit-btn',
      title: 'Record Loss',
      description: 'Review the details and confirm to record the damaged item. Your inventory count is adjusted immediately.',
      tooltipPosition: 'bottom',
    },
  ],
};
