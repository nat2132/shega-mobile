import type { TutorialDefinition } from '../types';

export const priceDecreaseTutorial: TutorialDefinition = {
  id: 'price-decrease',
  screen: 'price-decrease',
  title: 'Decrease Prices',
  subtitle: 'Adjust selling prices downward',
  steps: [
    {
      id: 'pd-intro',
      targetId: 'pd-header',
      title: 'Price Decrease',
      description: 'Follow these steps to decrease the selling price of an inventory item. Use this for promotions, clearance, or competitive pricing.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pd-search',
      targetId: 'pd-search',
      title: 'Find Item',
      description: 'Search for the item whose price you want to decrease. Type the item name to locate it in your inventory.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pd-item',
      targetId: 'pd-item-select',
      title: 'Select Item',
      description: 'Select the item from the search results. Check the current price and margin before reducing.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pd-price',
      targetId: 'pd-new-price',
      title: 'New Selling Price',
      description: 'Enter the reduced selling price. The system shows the discount amount and updated profit margin.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pd-reason',
      targetId: 'pd-reason',
      title: 'Reason for Decrease',
      description: 'Enter a reason (e.g., promotion, clearance, competitive match). This is logged in the adjustment history.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pd-date',
      targetId: 'pd-date',
      title: 'Effective Date',
      description: 'Set the date for the new price. The adjustment is recorded in your price history.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pd-commit',
      targetId: 'pd-commit-btn',
      title: 'Apply Decrease',
      description: 'Review and confirm to apply the price decrease. The selling price updates immediately in your inventory.',
      tooltipPosition: 'bottom',
    },
  ],
};
