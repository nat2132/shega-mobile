import type { TutorialDefinition } from '../types';

export const addOrderItemTutorial: TutorialDefinition = {
  id: 'add-order-item',
  screen: 'add-order-item',
  title: 'Add Order Item',
  subtitle: 'Add products to a purchase order',
  steps: [
    {
      id: 'aoi-intro',
      targetId: 'aoi-header',
      title: 'Adding an Order Item',
      description: 'Follow these steps to add a product to your purchase order. You can search for existing inventory items or enter custom details.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'aoi-name',
      targetId: 'aoi-name',
      title: 'Item Name',
      description: 'Enter the name of the product you want to order. If it exists in inventory, it will auto-fill details.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'aoi-company',
      targetId: 'aoi-company',
      title: 'Supplier / Company',
      description: 'Enter the supplier or company name for this item. This is useful for tracking which vendor supplies the product.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'aoi-quantity',
      targetId: 'aoi-quantity',
      title: 'Order Quantity',
      description: 'Enter the quantity you want to order. This will be added to the order summary and tracked against the supplier.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'aoi-commit',
      targetId: 'aoi-commit-btn',
      title: 'Add to Order',
      description: 'Tap to add this item to your purchase order. You can add multiple items before submitting the complete order.',
      tooltipPosition: 'bottom',
    },
  ],
};
