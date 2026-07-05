import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Package, AlertCircle } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useFocusEffect } from 'expo-router';
import { getRecentAdjustments } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import { AppNumber, AppText } from '@/components/ui';
import { getExpenseGlass } from './glass-expense';
const InventoryLoss = () => {
  const { colors, t } = useSettings();
  const G = getExpenseGlass(colors);
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
        amount: totalLoss,
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

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Ambient glow washes */}
      <View style={{ position: 'absolute', top: -60, left: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: G.mutedLight, opacity: 0.10 }} />
      <View style={{ position: 'absolute', bottom: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: G.mutedLight, opacity: 0.08 }} />
      <View style={styles.header}>
        <AppText variant="title" weight="bold" style={[styles.title, { color: G.fg }]} numberOfLines={2}>{t('expense.loss_inventory')}</AppText>
        <AlertCircle size={24} color={G.fg} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <AppText variant="title" weight="bold" align="center" style={[styles.emptyText, { color: G.fgSecondary }]} numberOfLines={2}>{t('expense.no_loss')}</AppText>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border, overflow: 'hidden' }]}>
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: G.bgCard }]}>
                <Package color={G.fg} size={24} />
              </View>
              <View>
                <AppText variant="body" weight="bold" style={[styles.itemName, { color: G.fg }]} numberOfLines={2}>{item.name}</AppText>
                <AppText variant="caption" weight="medium" style={[styles.skuText, { color: G.fgSecondary }]} numberOfLines={1}>Ref: {item.sku} • {item.quantity} {item.unit}</AppText>
              </View>
            </View>
            
            <View style={{ alignItems: 'flex-end' }}>
              <View style={[styles.badge, { backgroundColor: colors.error }]}>
                <View style={[styles.dot, { backgroundColor: G.bg }]} />
                <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.badgeText, { color: G.fg }]} numberOfLines={1}>{item.type}</AppText>
              </View>
              <AppNumber value={-item.amount} size="body" prefix={t('common.etb') + ' '} style={styles.amount} />
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontFamily: Fonts.bold, fontWeight: 'bold', marginRight: 10 },
  card: { padding: 15, borderRadius: 15, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { padding: 12, borderRadius: 12, marginRight: 15 },
  itemName: { fontSize: 18, fontFamily: Fonts.bold, fontWeight: 'bold' },
  skuText: { fontSize: 13, marginTop: 2 },
  amount: { fontSize: 20, fontFamily: Fonts.extrabold, fontWeight: '800', marginTop: 5 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#FFF', fontSize: 10, fontFamily: Fonts.bold, fontWeight: 'bold' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontFamily: Fonts.medium, fontSize: 16 }
});

export default InventoryLoss;