import type { TutorialDefinition } from '../types';

export const salesDetailsTutorial: TutorialDefinition = {
  id: 'sales-details',
  screen: 'sales-details',
  title: 'Sale Details',
  subtitle: 'Review a completed transaction',
  steps: [
    {
      id: 'sd-intro',
      targetId: 'sd-header',
      title: 'Transaction Details',
      description: 'This screen shows the full details of a sale transaction. Review items sold, pricing, payment, and customer information.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'sd-summary',
      targetId: 'sd-summary',
      title: 'Sale Summary',
      description: 'View the total amount, payment status, and transaction date at a glance. The header shows whether the sale is paid, pending, or on credit.',
      tooltipPosition: 'top',
    },
    {
      id: 'sd-items',
      targetId: 'sd-items',
      title: 'Items Sold',
      description: 'This list shows every item in the transaction, including quantity, unit price, and subtotal. Tap any item for more details.',
      tooltipPosition: 'top',
    },
    {
      id: 'sd-pricing',
      targetId: 'sd-pricing',
      title: 'Pricing Breakdown',
      description: 'See the subtotal, discounts applied, tax (VAT/TOT), and the grand total. This section helps with accounting and reconciliation.',
      tooltipPosition: 'top',
    },
    {
      id: 'sd-payment',
      targetId: 'sd-payment',
      title: 'Payment Method',
      description: 'The payment method used (cash or transfer) and the payment status. For credit sales, the remaining balance is shown.',
      tooltipPosition: 'top',
    },
    {
      id: 'sd-customer',
      targetId: 'sd-customer',
      title: 'Customer Info',
      description: 'Customer details including name and contact information. For credit sales, you can initiate payment collection from here.',
      tooltipPosition: 'top',
    },
  ],
};
