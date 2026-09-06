import { useEffect, useState } from 'react';
import { Tabs, useRootNavigationState, router } from 'expo-router';
import { CustomTabBar } from '@/components/CustomTabBar';
import { HidScannerCapture } from '@/components/HidScannerCapture';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useWarehouse } from '@/context/WarehouseContext';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import WarehouseSelectorModal from '../../src/screens/settings/warehouse-selector';

type NavKey = 'dashboard' | 'sales-hub' | 'inventory' | 'settings' | 'expense' | 'adjustment' | 'summary' | 'contacts' | 'suppliers' | 'budget';

/**
 * Map each tab to the permission(s) that unlock it. A user sees a tab when any
 * of its permission keys is effectively granted in the shared business model.
 * The same catalog drives the dashboard quick-actions and the sidebar.
 */
function tabPermission(can: (key: string) => boolean, key: NavKey): boolean {
  switch (key) {
    case 'dashboard':
    case 'settings':
      return true;
    case 'sales-hub':
      return can('sales.create') || can('sales.viewAll') || can('sales.refund');
    case 'inventory':
      return can('inventory.receive') || can('inventory.adjust') || can('inventory.count') || can('inventory.transfer') || can('inventory.suppliers');
    case 'expense':
    case 'budget':
      return can('payments.manageExpenses');
    case 'adjustment':
      return can('inventory.adjust');
    case 'summary':
      return can('reports.viewOwn') || can('reports.viewAll');
    case 'contacts':
      return can('customers.view');
    case 'suppliers':
      return can('inventory.suppliers');
  }
}

/** Any of these unlocks a tab. Settings stays visible (its sections are gated individually). */
function settingsPermission(can: (key: string) => boolean): boolean {
  return true;
}

export default function TabsLayout() {
  const { t } = useSettings();
  const { isAuthenticated } = useAuth();
  const { warehouses, activeWarehouseId } = useWarehouse();
  const auth = useBusinessAuth();
  const navigationState = useRootNavigationState();
  const [showWarehouseSelector, setShowWarehouseSelector] = useState(false);

  useEffect(() => {
    if (!navigationState?.key) return;
    if (!isAuthenticated) {
      router.replace('/verify-pin');
      return;
    }
  }, [isAuthenticated, navigationState?.key]);

  useEffect(() => {
    if (warehouses.length > 0 && !activeWarehouseId) {
      setShowWarehouseSelector(true);
    } else if (warehouses.length === 0) {
      setShowWarehouseSelector(true);
    } else {
      setShowWarehouseSelector(false);
    }
  }, [warehouses, activeWarehouseId]);

  const visible = (key: NavKey) => (key === 'settings' ? settingsPermission(auth.can) : tabPermission(auth.can, key));

  return (
    <>
      <Tabs 
        tabBar={props => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: t('tabs.dashboard'),
          }}
        />
        <Tabs.Screen
          name="sales-hub"
          options={{
            title: t('tabs.sales'),
            href: visible('sales-hub') ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: t('tabs.inventory'),
            href: visible('inventory') ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings'),
            href: visible('settings') ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="expense"
          options={{
            href: visible('expense') ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="adjustment"
          options={{
            href: visible('adjustment') ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="summary"
          options={{
            href: visible('summary') ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="contacts"
          options={{
            href: visible('contacts') ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="suppliers"
          options={{
            href: visible('suppliers') ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="budget"
          options={{
            href: visible('budget') ? undefined : null,
          }}
        />
      </Tabs>

      <WarehouseSelectorModal
        visible={showWarehouseSelector}
        onComplete={() => setShowWarehouseSelector(false)}
      />

      {/* Captures hardware scanner key events across all POS tabs */}
      <HidScannerCapture />
    </>
  );
}