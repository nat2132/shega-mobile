import SalesDashboard from '../../src/screens/sales/sales';
import CashierPOS from '../../src/screens/sales/cashier-pos';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { View } from 'react-native';
import { useSettings } from '@/context/SettingsContext';

export default function SalesScreen() {
  const auth = useBusinessAuth();
  const { colors } = useSettings();

  // Cashiers (and any custom role without catalog/inventory powers) get the
  // focused POS surface; management roles keep the full sales dashboard.
  const isCashierExperience =
    auth.role === 'cashier' ||
    (!auth.can('products.edit') && !auth.can('inventory.adjust') && !auth.can('reports.viewAll'));

  if (isCashierExperience) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <CashierPOS />
      </View>
    );
  }

  return <SalesDashboard />;
}
