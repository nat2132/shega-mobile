import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { getItemById } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import ItemDetailsScreen from '@/screens/inventory/item-details';

export default function ItemDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useSettings();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const itemId = Number(id);
    if (!itemId || Number.isNaN(itemId)) {
      setLoading(false);
      return;
    }
    const found = getItemById(itemId);
    setItem(found);
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

  if (!item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ItemDetailsScreen
        item={item}
        onClose={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/inventory' as any);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
