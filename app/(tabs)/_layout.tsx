import { Tabs } from 'expo-router';
import { CustomTabBar } from '../../src/components/CustomTabBar';

export default function TabsLayout() {
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
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="sales-hub"
        options={{
          title: 'Sales',
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
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
    </Tabs>
  );
}