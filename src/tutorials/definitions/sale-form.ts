import type { TutorialDefinition } from '../types';

export const saleFormTutorial: TutorialDefinition = {
  id: 'sale-form',
  screen: 'sale-form',
  title: 'Record a Sale',
  subtitle: 'Complete a transaction step by step',
  steps: [
    {
      id: 'sf-intro',
      targetId: 'sf-header',
      title: 'Recording a Sale',
      description: 'Follow these steps to record a complete sale. You\'ll select items, set quantities, apply pricing, and choose payment method.',
      tooltipPosition: 'bottom',
      actionType: 'none',
    },
    {
      id: 'sf-pricing',
      targetId: 'sf-pricing',
      title: 'Pricing & Discounts',
      description: 'Set unit prices, apply discounts, and configure VAT/tax if applicable. The system calculates the subtotal and total automatically.',
      tooltipPosition: 'right',
      actionType: 'none',
    },
    {
      id: 'sf-payment',
      targetId: 'sf-payment',
      title: 'Payment Method',
      description: 'Choose how the customer pays — cash or digital bank. For credit sales, enter customer details and the amount will be tracked as receivable.',
      tooltipPosition: 'right',
      actionType: 'none',
    },
    {
      id: 'sf-customer',
      targetId: 'sf-customer-info',
      title: 'Customer Information',
      description: 'For credit sales, customer name and phone are required. For cash sales, this is optional but recommended for record keeping.',
      tooltipPosition: 'right',
      actionType: 'none',
    },
    {
      id: 'sf-commit',
      targetId: 'sf-commit-btn',
      title: 'Complete Transaction',
      description: 'Review the summary and tap "Authorize Settlement" to finalize the sale. The transaction is recorded permanently in the sales ledger.',
      tooltipPosition: 'left',
      actionType: 'none',
    },
  ],
};
