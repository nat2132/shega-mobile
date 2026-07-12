import type { TutorialDefinition } from '../types';

export const salesRecordsTutorial: TutorialDefinition = {
  id: 'sales-records',
  screen: 'sales-records',
  title: 'Sales Records',
  subtitle: 'Browse all transactions',
  steps: [
    {
      id: 'sr-intro',
      targetId: 'sr-header',
      title: 'Sales Records',
      description: 'This screen lists all your sales transactions. Browse, search, and filter through your complete sales history.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'sr-summary',
      targetId: 'sr-summary',
      title: 'Period Summary',
      description: 'See total sales, transaction count, and average per sale for the selected period at a glance.',
      tooltipPosition: 'top',
      fullContainer: true,
},
    {
      id: 'sr-filter',
      targetId: 'sr-filter',
      title: 'Filter & Search',
      description: 'Filter transactions by date range, payment status, or customer. Search by transaction ID or customer name.',
      tooltipPosition: 'top',
    },
    {
      id: 'sr-list',
      targetId: 'sr-list',
      title: 'Transaction List',
      description: 'Each entry shows the date, customer, item count, total amount, and payment status. Tap any entry for full details.',
      tooltipPosition: 'top',
    },
    {
      id: 'sr-export',
      targetId: 'sr-export',
      title: 'Export Records',
      description: 'Export your sales data as a PDF or CSV report for accounting and record-keeping purposes.',
      tooltipPosition: 'top',
    },
  ],
};
