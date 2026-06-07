import { Tabs } from 'expo-router';
import { CustomTabBar } from '../../src/components/CustomTabBar';
import { useSettings } from '../../src/context/SettingsContext';

export default function TabsLayout() {
  const { t } = useSettings();
  return (
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
    </Tabs>
  );
}