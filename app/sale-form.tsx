import { router, useLocalSearchParams } from 'expo-router';
import SaleFormScreen from '../src/screens/sales/sale-form';

export default function SaleFormPage() {
  const params = useLocalSearchParams<{ items?: string }>();
  let cart: any[] = [];
  try {
    if (params.items) {
      cart = JSON.parse(params.items);
    }
  } catch {}

  return (
    <SaleFormScreen
      cart={cart}
      onFinish={() => router.back()}
      onBack={() => router.back()}
    />
  );
}
