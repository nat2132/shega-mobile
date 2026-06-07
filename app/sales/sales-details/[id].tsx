import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { getSaleById } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import SaleDetailsScreen from '@/screens/sales/sales-details';

export default function SaleDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useSettings();
  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saleId = Number(id);
    if (!saleId || Number.isNaN(saleId)) {
      setLoading(false);
      return;
    }
    const found = getSaleById(saleId);
    setSale(found);
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!sale) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SaleDetailsScreen
        sale={sale}
        onClose={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/sales-hub' as any);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
