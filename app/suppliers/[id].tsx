import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSettings } from '@/context/SettingsContext';
import SupplierDetails from '@/screens/suppliers/supplier-details';
import PremiumFeatureGate from '@/components/PremiumFeatureGate';

export default function SupplierDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useSettings();
  const supplierId = Number(id);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/suppliers' as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      {!Number.isNaN(supplierId) && supplierId > 0 ? (
        <PremiumFeatureGate feature="supplier_management">
          <SupplierDetails supplierId={supplierId} onClose={close} />
        </PremiumFeatureGate>
      ) : null}
    </View>
  );
}
