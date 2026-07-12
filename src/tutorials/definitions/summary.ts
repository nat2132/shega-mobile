import type { TutorialDefinition } from '../types';

export const summaryTutorial: TutorialDefinition = {
  id: 'summary',
  screen: 'summary',
  title: 'Summary',
  subtitle: 'Business performance insights',
  steps: [
    {
      id: 'sum-intro',
      targetId: 'sum-header',
      title: 'Business Summary',
      description: 'A comprehensive overview of your business performance. See financial summaries, operational metrics, and intelligence insights all in one dashboard.',
      tooltipPosition: 'bottom',

      actionType: 'none',
      fullContainer: true,
},
      {
      id: 'sum-financial',
      targetId: 'sum-financial',
      title: 'Financial Summary',
      description: 'Your key financial metrics: total revenue, items sold, expenses, and outstanding amounts. Compare performance trends at a glance.',
      tooltipPosition: 'bottom',
      actionType: 'none',
    },
    {
      id: 'sum-pulse',
      targetId: 'sum-pulse',
      title: 'Performance Pulse',
      description: 'The net pulse shows the difference between your sales inflow and operational outflow. A positive pulse means you\'re earning more than you\'re spending.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
    {
      id: 'sum-insights',
      targetId: 'sum-insights',
      title: 'Intelligence Insights',
      description: 'AI-powered insights about your business efficiency. Get recommendations on improving operations, reducing costs, and maximizing profits.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
    {
      id: 'sum-velocity',
      targetId: 'sum-velocity',
      title: 'Velocity Spotlight',
      description: 'Track price adjustments and net profit at a glance. The top card shows cumulative price changes, while the bottom card displays your overall net profit after all expenses and losses.',
      tooltipPosition: 'top',
      actionType: 'none',
    },
  ],
};
