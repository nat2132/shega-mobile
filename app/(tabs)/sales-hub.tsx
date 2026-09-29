import SalesDashboard from '../../src/screens/sales/sales';

/**
 * Sales tab. This used to fork on the user's role — a cashier (or any custom
 * role without catalog/inventory powers) got a stripped-down POS surface and
 * everyone else the full sales dashboard. Mobile no longer has roles: every
 * account on a device is a full local account, so there is one surface.
 */
export default function SalesScreen() {
  return <SalesDashboard />;
}
