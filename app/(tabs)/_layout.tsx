import { useEffect, useState } from 'react';
import { Tabs, useRootNavigationState, router } from 'expo-router';
import { CustomTabBar } from '@/components/CustomTabBar';
import { HidScannerCapture } from '@/components/HidScannerCapture';
import { RemotePeripheralListener } from '@/components/RemotePeripheralListener';
import RemoteLockListener from '@/components/RemoteLockListener';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useWarehouse } from '@/context/WarehouseContext';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import WarehouseSelectorModal from '../../src/screens/settings/warehouse-selector';

type NavKey = 'dashboard' | 'sales-hub' | 'inventory' | 'settings' | 'summary' | 'suppliers';

/**
 * Map each tab to the permission(s) that unlock it. A user sees a tab when any
 * of its permission keys is effectively granted in the shared business model.
 * The same catalog drives the dashboard quick-actions and the sidebar.
 */
/**
 * The "cashier experience": cashiers and any custom role that can sell but
 * holds no catalog/inventory/full-report powers. Those users get the focused
 * POS surface and a two-button bottom bar (Sales + Settings).
 */
function isCashierExperience(auth: ReturnType<typeof useBusinessAuth>): boolean {
  return (
    auth.role === 'cashier' ||
    (!auth.can('products.edit') && !auth.can('inventory.adjust') && !auth.can('reports.viewAll'))
  );
}

function tabPermission(can: (key: string) => boolean, key: NavKey): boolean {
  switch (key) {
    case 'dashboard':
    case 'settings':
      return true;
    case 'sales-hub':
      return can('sales.create') || can('sales.viewAll') || can('sales.refund');
    case 'inventory':
      return can('inventory.receive') || can('inventory.adjust') || can('inventory.count') || can('inventory.transfer') || can('inventory.suppliers');
    case 'summary':
      return can('reports.viewOwn') || can('reports.viewAll');
    case 'suppliers':
      return can('inventory.suppliers');
  }
}

/** Any of these unlocks a tab. Settings stays visible (its sections are gated individually). */
function settingsPermission(can: (key: string) => boolean): boolean {
  return true;
}

export default function TabsLayout() {
  const { t, featureFlags } = useSettings();
  const { isAuthenticated } = useAuth();
  const { warehouses, activeWarehouseId } = useWarehouse();
  const auth = useBusinessAuth();
  const navigationState = useRootNavigationState();
  const [showWarehouseSelector, setShowWarehouseSelector] = useState(false);
  const cashierMode = isCashierExperience(auth);

  useEffect(() => {
    if (!navigationState?.key) return;
    if (!isAuthenticated) {
      router.replace('/verify-pin');
      return;
    }
    if (cashierMode) {
      const activeRouteName = navigationState?.routes?.[navigationState.index]?.name;
      if (activeRouteName === 'dashboard' || activeRouteName === 'inventory' || activeRouteName === 'suppliers' || activeRouteName === 'summary') {
        router.replace('/(tabs)/sales-hub');
      }
    }
  }, [isAuthenticated, navigationState?.key, cashierMode]);

  useEffect(() => {
    if (!featureFlags.warehousesEnabled) {
      setShowWarehouseSelector(false);
      return;
    }
    if (warehouses.length > 0 && !activeWarehouseId) {
      setShowWarehouseSelector(true);
    } else if (warehouses.length === 0) {
      setShowWarehouseSelector(true);
    } else {
      setShowWarehouseSelector(false);
    }
  }, [featureFlags.warehousesEnabled, warehouses, activeWarehouseId]);

  const visible = (key: NavKey) => {
    // Cashier bottom bar: only Sales + Settings.
    if (cashierMode && key !== 'sales-hub' && key !== 'settings') return false;
    return key === 'settings' ? settingsPermission(auth.can) : tabPermission(auth.can, key);
  };

  return (
    <>
      <Tabs 
        tabBar={props => <CustomTabBar {...props} />}
        initialRouteName={cashierMode ? 'sales-hub' : 'dashboard'}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: t('tabs.dashboard'),
            href: visible('dashboard') ? undefined : null,
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
          name="summary"
          options={{
            href: visible('summary') ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="suppliers"
          options={{
            href: visible('suppliers') ? undefined : null,
          }}
        />
      </Tabs>

      <WarehouseSelectorModal
        visible={showWarehouseSelector}
        onComplete={() => setShowWarehouseSelector(false)}
      />

      {/* Captures hardware scanner key events across all POS tabs */}
      <HidScannerCapture />

      {/* Lets a connected desktop use this phone as scanner / camera */}
      <RemotePeripheralListener />
      <RemoteLockListener />
    </>
  );
}