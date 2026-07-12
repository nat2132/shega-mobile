import type { TutorialDefinition } from '../types';

export const debtDetailTutorial: TutorialDefinition = {
  id: 'debt-detail',
  screen: 'debt-detail',
  title: 'Debt Details',
  subtitle: 'Track credit and payments',
  steps: [
    {
      id: 'dd-intro',
      targetId: 'dd-header',
      title: 'Debt Overview',
      description: 'This screen shows the complete details of a debt or credit account — what was borrowed, payments made, and remaining balance.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'dd-summary',
      targetId: 'dd-summary',
      title: 'Balance Summary',
      description: 'View total debt, amount paid, and outstanding balance. The progress bar shows how much has been repaid.',
      tooltipPosition: 'top',
      fullContainer: true,
},
    {
      id: 'dd-info',
      targetId: 'dd-info',
      title: 'Debt Information',
      description: 'Details about the original transaction, interest rate (if any), due date, and the customer or vendor involved.',
      tooltipPosition: 'top',
    },
    {
      id: 'dd-payments',
      targetId: 'dd-payments',
      title: 'Payment History',
      description: 'Chronological list of all payments made against this debt, including dates, amounts, and payment methods.',
      tooltipPosition: 'top',
    },
    {
      id: 'dd-actions',
      targetId: 'dd-actions',
      title: 'Record Payment',
      description: 'Record a new payment against this debt, or mark it as fully settled.',
      tooltipPosition: 'top',
    },
  ],
};
