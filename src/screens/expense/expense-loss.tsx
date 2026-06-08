import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Package, AlertCircle } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useFocusEffect } from 'expo-router';
import { getRecentAdjustments } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
const InventoryLoss = () => {
  const { colors, t } = useSettings();
  const [data, setData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadLossData = async () => {
    const rawAdjustments = await getRecentAdjustments('damaged', 50);
    
    const formattedData = rawAdjustments.map((adj: any) => {
      const unitPrice = adj.unitType === 'pack' ? (Number(adj.packPurchasePrice) || 0) : (Number(adj.basePurchasePrice) || 0);
      const quantity = Number(adj.quantity) || 0;
      const totalLoss = quantity * unitPrice;
      
      const baseUnit = adj.baseUnit || 'pieces';
      const unitLabel = t(`form.${String(baseUnit).toLowerCase()}`) || t('common.units');
      
      return {
        id: adj?.id ? String(adj.id) : Math.random().toString(),
        name: adj?.itemName || t('common.removed_item'),
        sku: `ADJ-${adj?.id || '???'}`,
        amount: `-${totalLoss.toLocaleString()} ${t('common.etb')}`,
        type: t('expense.damaged'),
        quantity: quantity,
        unit: adj?.unitType === 'pack' ? t('inventory.packs') : unitLabel
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

  const keyExtractor = useCallback((item: any) => item.id, []);
  const renderItem = useCallback(({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: colors.text }]}>
          <Package color={colors.background} size={24} />
        </View>
        <View>
          <AppText variant="body" weight="bold" style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>{item.name}</AppText>
          <AppText variant="caption" weight="medium" style={[styles.skuText, { color: colors.textSecondary }]} numberOfLines={1}>Ref: {item.sku} • {item.quantity} {item.unit}</AppText>
        </View>
      </View>
      
      <View style={{ alignItems: 'flex-end' }}>
        <View style={[styles.badge, { backgroundColor: '#FF3B30' }]}>
          <View style={styles.dot} />
          <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={styles.badgeText} numberOfLines={1}>{item.type}</AppText>
        </View>
        <AppText variant="body" weight="bold" shrink={false} style={[styles.amount, { color: colors.text }]} numberOfLines={1}>{item.amount}</AppText>
      </View>
    </View>
  ), [colors]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <AppText variant="title" weight="bold" style={[styles.title, { color: colors.text }]} numberOfLines={2}>{t('expense.loss_inventory')}</AppText>
        <AlertCircle size={24} color={colors.text} />
      </View>

      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <AppText variant="title" weight="bold" align="center" style={[styles.emptyText, { color: colors.textSecondary }]} numberOfLines={2}>{t('expense.no_loss')}</AppText>
          </View>
        }
        renderItem={renderItem}
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