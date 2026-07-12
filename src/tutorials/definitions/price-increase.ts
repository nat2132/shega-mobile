import type { TutorialDefinition } from '../types';

export const priceIncreaseTutorial: TutorialDefinition = {
  id: 'price-increase',
  screen: 'price-increase',
  title: 'Increase Prices',
  subtitle: 'Adjust selling prices upward',
  steps: [
    {
      id: 'pi-intro',
      targetId: 'pi-header',
      title: 'Price Increase',
      description: 'Follow these steps to increase the selling price of an inventory item. This helps you adjust to market changes or cost increases.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pi-search',
      targetId: 'pi-search',
      title: 'Find Item',
      description: 'Search for the item whose price you want to increase. Type the item name or scan to locate it in your inventory.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pi-item',
      targetId: 'pi-item-select',
      title: 'Select Item',
      description: 'Select the item from the search results. Review the current price and stock information before adjusting.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pi-price',
      targetId: 'pi-new-price',
      title: 'New Selling Price',
      description: 'Enter the new selling price. The system will show the price difference and calculate the new profit margin.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pi-reason',
      targetId: 'pi-reason',
      title: 'Reason for Increase',
      description: 'Provide a reason for the price increase (e.g., supplier price change, market adjustment, inflation). This is recorded in the adjustment history.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pi-date',
      targetId: 'pi-date',
      title: 'Effective Date',
      description: 'Set the date when the new price takes effect. The change is logged in the price adjustment history for future reference.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'pi-commit',
      targetId: 'pi-commit-btn',
      title: 'Apply Increase',
      description: 'Review the details and confirm to apply the price increase. The item\'s selling price is updated immediately.',
      tooltipPosition: 'bottom',
    },
  ],
};
