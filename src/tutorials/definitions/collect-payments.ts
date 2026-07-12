import type { TutorialDefinition } from '../types';

export const collectPaymentsTutorial: TutorialDefinition = {
  id: 'collect-payments',
  screen: 'collect-payments',
  title: 'Collect Payments',
  subtitle: 'Receive payments from customers',
  steps: [
    {
      id: 'cp-intro',
      targetId: 'cp-header',
      title: 'Collect Payment',
      description: 'Use this screen to receive payments from customers for credit sales or orders. Follow the steps to record a payment.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'cp-customer',
      targetId: 'cp-customer-search',
      title: 'Select Customer',
      description: 'Search for the customer making the payment. Select them to see their outstanding balance and due items.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'cp-items',
      targetId: 'cp-items',
      title: 'Select Items to Pay',
      description: 'Choose which items or invoices the customer is paying for. You can pay partially or in full for each item.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'cp-amount',
      targetId: 'cp-amount',
      title: 'Payment Amount',
      description: 'Enter the amount being paid. The system shows the remaining balance after this payment.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'cp-method',
      targetId: 'cp-method',
      title: 'Payment Method',
      description: 'Select how the customer is paying — cash or digital bank transfer. The payment method is recorded for reconciliation.',
      tooltipPosition: 'bottom',
    },
    {
      id: 'cp-commit',
      targetId: 'cp-commit-btn',
      title: 'Complete Payment',
      description: 'Review the payment details and confirm. The customer\'s balance is updated and the transaction is recorded.',
      tooltipPosition: 'bottom',
    },
  ],
};
