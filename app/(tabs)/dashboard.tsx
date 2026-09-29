import React from 'react';
import Dashboard from '../../src/screens/dashboard/dashboard';

// Mobile has no roles, so the dashboard no longer redirects a "cashier" to the
// sales tab: every local account sees the full dashboard.
export default function DashboardScreen() {
  return <Dashboard />;
}
