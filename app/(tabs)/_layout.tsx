import { useEffect, useState } from 'react';
import { Tabs, useRootNavigationState, router } from 'expo-router';
import { CustomTabBar } from '@/components/CustomTabBar';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useWarehouse } from '@/context/WarehouseContext';
import WarehouseSelectorModal from '../../src/screens/settings/warehouse-selector';

export default function TabsLayout() {
  const { t } = useSettings();
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
    if (warehouses.length > 0 && !activeWarehouseId) {
      setShowWarehouseSelector(true);
    } else if (warehouses.length === 0) {
      setShowWarehouseSelector(true);
    } else {
      setShowWarehouseSelector(false);
    }
  }, [warehouses, activeWarehouseId]);

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
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: t('tabs.inventory'),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings'),
          }}
        />
        <Tabs.Screen
          name="expense"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="adjustment"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="summary"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="contacts"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="budget"
          options={{
            href: null,
          }}
        />
      </Tabs>

      <WarehouseSelectorModal
        visible={showWarehouseSelector}
        onComplete={() => setShowWarehouseSelector(false)}
      />
    </>
  );
}
