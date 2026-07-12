import type { TutorialDefinition } from '../types';

export const activityLedgerTutorial: TutorialDefinition = {
  id: 'activity-ledger',
  screen: 'activity-ledger',
  title: 'Activity Ledger',
  subtitle: 'View all business activity',
  steps: [
    {
      id: 'al-intro',
      targetId: 'al-header',
      title: 'Activity Ledger',
      description: 'This is your business activity feed — every transaction, adjustment, and event recorded in chronological order.',
      tooltipPosition: 'bottom',
      fullContainer: true,
},
    {
      id: 'al-feed',
      targetId: 'al-feed',
      title: 'Activity Feed',
      description: 'Every action is listed here: sales, expenses, inventory changes, price adjustments, and payments received.',
      tooltipPosition: 'top',
      fullContainer: true,
},
    {
      id: 'al-filter',
      targetId: 'al-filter',
      title: 'Filter Activity',
      description: 'Filter by activity type (sales, expenses, inventory, payments) or date range to find specific events.',
      tooltipPosition: 'top',
    },
  ],
};
