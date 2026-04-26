import React, { useState, useCallback } from 'react';
import { View, RNText as Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Package, AlertCircle } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useFocusEffect } from 'expo-router';
import { getRecentAdjustments } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';

const InventoryLoss = () => {
  const { colors, t } = useSettings();
  const [data, setData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadLossData = async () => {
    const rawAdjustments = await getRecentAdjustments('damaged', 50);
    
    const formattedData = rawAdjustments.map((adj: any) => {
      const unitPrice = adj.unitType === 'pack' ? (adj.packPurchasePrice || 0) : (adj.basePurchasePrice || 0);
      const totalLoss = adj.quantity * unitPrice;
      
      return {
        id: adj.id.toString(),
        name: adj.itemName || t('common.removed_item'),
        sku: `ADJ-${adj.id}`,
        amount: `-${totalLoss.toLocaleString()} ${t('common.etb')}`,
        type: t('expense.damaged'),
        quantity: adj.quantity,
        unit: adj.unitType === 'pack' ? t('inventory.packs') : (t(`form.${adj.baseUnit.toLowerCase()}`) || t('common.units'))
      };
    });

    setData(formattedData);
  };

  useFocusEffect(
    useCallback(() => {
      loadLossData();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLossData();
    setRefreshing(false);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('expense.loss_inventory')}</Text>
        <AlertCircle size={24} color={colors.text} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('expense.no_loss')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: colors.text }]}>
                <Package color={colors.background} size={24} />
              </View>
              <View>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.skuText, { color: colors.textSecondary }]}>Ref: {item.sku} • {item.quantity} {item.unit}</Text>
              </View>
            </View>
            
            <View style={{ alignItems: 'flex-end' }}>
              <View style={[styles.badge, { backgroundColor: '#FF3B30' }]}>
                <View style={styles.dot} />
                <Text style={styles.badgeText}>{item.type}</Text>
              </View>
              <Text style={[styles.amount, { color: colors.text }]}>{item.amount}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontFamily: Fonts.bold, fontWeight: 'bold', marginRight: 10 },
  card: { backgroundColor: '#F9F9F9', padding: 15, borderRadius: 15, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, borderWidth: 1, borderColor: '#EEE' },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { backgroundColor: '#000', padding: 12, borderRadius: 12, marginRight: 15 },
  itemName: { fontSize: 18, fontFamily: Fonts.bold, fontWeight: 'bold' },
  skuText: { color: '#666', fontSize: 13, marginTop: 2 },
  amount: { fontSize: 20, fontFamily: Fonts.extrabold, fontWeight: '800', marginTop: 5 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#FFF', fontSize: 10, fontFamily: Fonts.bold, fontWeight: 'bold' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF', marginRight: 5 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontFamily: Fonts.medium, color: '#666', fontSize: 16 }
});

export default InventoryLoss;