import { useEffect, useState } from 'react';
import { Tabs, useRootNavigationState, router } from 'expo-router';
import { CustomTabBar } from '@/components/CustomTabBar';
import { HidScannerCapture } from '@/components/HidScannerCapture';
import { RemotePeripheralListener } from '@/components/RemotePeripheralListener';
import RemoteLockListener from '@/components/RemoteLockListener';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useWarehouse } from '@/context/WarehouseContext';
import WarehouseSelectorModal from '../../src/screens/settings/warehouse-selector';

type NavKey = 'dashboard' | 'sales-hub' | 'inventory' | 'settings' | 'summary' | 'suppliers';

/**
 * Map each tab to the permission(s) that unlock it. A user sees a tab when any
 * of its permission keys is effectively granted in the shared business model.
 * The same catalog drives the dashboard quick-actions and the sidebar.
 */
/**
 * Tab visibility.
 *
 * Mobile has no roles: every account on a device is a full local account, so
 * every tab is visible. Premium/feature gates still apply inside the screens
 * (PremiumFeatureGate), which is where plan differences belong.
 */
function tabVisible(_key: NavKey): boolean {
  return true;
}

export default function TabsLayout() {
  const { t, featureFlags } = useSettings();
  const { isAuthenticated } = useAuth();
  const { warehouses, activeWarehouseId } = useWarehouse();
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

  const visible = (key: NavKey) => tabVisible(key);

  return (
    <>
      <Tabs 
        tabBar={props => <CustomTabBar {...props} />}
        initialRouteName="dashboard"
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