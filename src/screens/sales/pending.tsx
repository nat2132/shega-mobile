import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Platform
} from 'react-native';
import { Fonts } from '@/constants/theme';
import {
  Package,
  Plus,
  Minus,
  X,
  Trash2,
  Repeat,
  ShoppingCart,
  ArrowRight,
  PlusCircle
} from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
const { width } = Dimensions.get('window');

const PendingRow = React.memo(({
  item,
  index,
  onUpdate,
  onRemove,
}: {
  item: any;
  index: number;
  onUpdate?: (id: string, updates: any) => void;
  onRemove?: (id: string) => void;
}) => {
  const { colors, t } = useSettings();
  const currentUnitPrice = item.unitType === 'pack' ? item.packSellingPrice : item.baseSellingPrice;
  const currentUnitLabel = item.unitType === 'pack' ? item.purchaseUnit : item.baseUnit;
  const lineTotal = (parseFloat(currentUnitPrice) || 0) * Math.max(0, item.quantity || 0);

  const decrement = useCallback(() => {
    if (item.quantity > 1) onUpdate?.(item.id, { quantity: Math.max(1, (item.quantity || 1) - 1) });
  }, [item, onUpdate]);

  const increment = useCallback(() => {
    const maxStock = item.unitType === 'pack'
      ? Math.floor(item.totalPackQuantity || 0)
      : Math.floor(item.totalBaseQuantity || 0);
    if ((item.quantity || 0) >= maxStock) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    onUpdate?.(item.id, { quantity: (item.quantity || 0) + 1 });
  }, [item, onUpdate]);

  const toggleUnit = useCallback(() => {
    if (item.allowSellByPackUnit && item.allowSellByBaseUnit) {
      onUpdate?.(item.id, { unitType: item.unitType === 'pack' ? 'base' : 'pack' });
    }
  }, [item, onUpdate]);

  const handleRemove = useCallback(() => onRemove?.(item.id), [item.id, onRemove]);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(500)}>
      <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: colors.text + '08' }]}>
            <Package size={20} color={colors.text} />
          </View>
          <View style={styles.nameArea}>
            <AppText variant="body" weight="bold" style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</AppText>
            <TouchableOpacity
              style={[styles.unitBadge, { backgroundColor: colors.primary + '15' }]}
              onPress={toggleUnit}
            >
              <Repeat size={10} color={colors.primary} style={{ marginRight: 4 }} />
              <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.unitBadgeText, { color: colors.primary }]} numberOfLines={1}>{currentUnitLabel}</AppText>
            </TouchableOpacity>
          </View>
          <View style={styles.costArea}>
            <AppText variant="body" weight="bold" shrink={false} style={[styles.linePrice, { color: colors.text }]} numberOfLines={1}>{lineTotal.toLocaleString()} <AppText variant="caption" weight="medium" shrink={false} style={styles.currency}> {t('common.etb')}</AppText></AppText>
            <AppText variant="caption" weight="medium" shrink={false} style={[styles.unitPrice, { color: colors.textSecondary }]} numberOfLines={1}>{(parseFloat(currentUnitPrice) || 0).toLocaleString()} / Unit</AppText>
          </View>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <View style={[styles.qtyControl, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.qtyBtn} onPress={decrement}>
              <Minus size={14} color={colors.text} />
            </TouchableOpacity>
            <AppText variant="body" weight="bold" shrink={false} style={[styles.qtyValue, { color: colors.text }]} numberOfLines={1}>{item.quantity}</AppText>
            <TouchableOpacity style={styles.qtyBtn} onPress={increment}>
              <Plus size={14} color={colors.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.removeBtn, { backgroundColor: '#FF3B3015' }]}
            onPress={handleRemove}
          >
            <Trash2 size={16} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});
PendingRow.displayName = 'PendingRow';

interface PendingSalesProps {
  items: any[];
  onUpdateItem?: (id: string, updates: any) => void;
  onRemoveItem?: (id: string) => void;
  onAddMore?: () => void;
  onFinish?: () => void;
}

const PendingSales: React.FC<PendingSalesProps> = ({ items, onUpdateItem, onRemoveItem, onAddMore, onFinish }) => {
  const { colors, t, theme } = useSettings();
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const totalAmount = useMemo(
    () => safeItems.reduce((sum, item) => {
      const price = item.unitType === 'pack' ? (parseFloat(item.packSellingPrice) || 0) : (parseFloat(item.baseSellingPrice) || 0);
      const qty = Math.max(0, item.quantity || 0);
      return sum + price * qty;
    }, 0),
    [safeItems],
  );

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <PendingRow
      item={item}
      index={index}
      onUpdate={onUpdateItem}
      onRemove={onRemoveItem}
    />
  ), [onUpdateItem, onRemoveItem]);

  const keyExtractor = useCallback((item: any) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <View>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.active_transaction')}</AppText>
          <AppText variant="title" weight="bold" style={[styles.header, { color: colors.text }]} numberOfLines={2}>{t('sale.orchestration_ledger')}</AppText>
        </View>
        <View style={[styles.badgeNode, { backgroundColor: colors.text + '08' }]}>
           <AppText variant="caption" weight="bold" shrink={false} style={[styles.itemCount, { color: colors.text }]} numberOfLines={1}>{safeItems.length} Units</AppText>
        </View>
      </View>
      
      <Animated.FlatList
        data={safeItems}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        itemLayoutAnimation={Layout.springify()}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.text + '05' }]}>
               <ShoppingCart size={48} color={colors.border} strokeWidth={1} />
            </View>
            <AppText variant="title" weight="bold" align="center" style={[styles.emptyTitle, { color: colors.text }]} numberOfLines={2}>{t('sale.ledger_is_empty')}</AppText>
            <AppText variant="body" weight="medium" align="center" style={[styles.emptySub, { color: colors.textSecondary }]} numberOfLines={3}>{t('sale.add_assets_begin')}</AppText>
            <TouchableOpacity style={[styles.addInitialBtn, { backgroundColor: colors.text }]} onPress={onAddMore}>
               <PlusCircle size={18} color={colors.background} />
               <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.addInitialBtnText, { color: colors.background }]} numberOfLines={1}>{t('sale.begin_search')}</AppText>
            </TouchableOpacity>
          </View>
        )}
      />

      {safeItems.length > 0 && (
        <View style={[styles.checkoutAnchor, { borderTopColor: colors.border }]}>
          <BlurView intensity={80} tint={theme !== 'light' ? 'dark' : 'light'} style={styles.checkoutBlur}>
            <View style={styles.summaryBox}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.summaryLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.total_settlement')}</AppText>
                <AppText variant="title" weight="bold" shrink={false} style={[styles.totalAmount, { color: colors.text }]} adjustsFontSizeToFit numberOfLines={1}>{totalAmount.toLocaleString()} <AppText variant="caption" weight="medium" shrink={false} style={styles.totalCurrency}> {t('common.etb')}</AppText></AppText>
              </View>

              <View style={styles.actionCluster}>
                 <TouchableOpacity style={[styles.moreBtn, { borderColor: colors.border }]} onPress={onAddMore}>
                   <Plus size={22} color={colors.text} />
                 </TouchableOpacity>
                 <TouchableOpacity style={[styles.checkoutBtn, { backgroundColor: colors.text }]} onPress={onFinish}>
                   <AppText variant="body" weight="bold" shrink={false} style={[styles.checkoutBtnText, { color: colors.background }]} numberOfLines={1}>{t('sale.commit')}</AppText>
                   <ArrowRight size={18} color={colors.background} />
                 </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 25, 
    paddingTop: 20,
    marginBottom: 20 
  },
  headerSub: {
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  header: { 
    fontFamily: Fonts.bold,
  },
  badgeNode: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  itemCount: { 
    fontFamily: Fonts.bold, 
  },
  listContent: { 
    paddingHorizontal: 25,
    paddingBottom: 160,
  },
  itemCard: { 
    borderWidth: 1, 
    borderRadius: 24, 
    padding: 16, 
    marginBottom: 16,
  },
  cardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  iconBox: { 
    width: 48, 
    height: 48, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  nameArea: { 
    flex: 1, 
    marginLeft: 14 
  },
  itemName: { 
    fontFamily: Fonts.bold, 
    marginBottom: 4 
  },
  unitBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    alignSelf: 'flex-start', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  unitBadgeText: { 
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },
  costArea: { 
    alignItems: 'flex-end' 
  },
  linePrice: { 
    fontFamily: Fonts.bold, 
  },
  currency: {
    opacity: 0.6,
  },
  unitPrice: { 
    fontFamily: Fonts.medium, 
    marginTop: 2 
  },
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 16, 
    paddingTop: 16, 
    borderTopWidth: 1 
  },
  qtyControl: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 12, 
    borderWidth: 1 
  },
  qtyBtn: { 
    padding: 10 
  },
  qtyValue: { 
    width: 36, 
    textAlign: 'center', 
    fontFamily: Fonts.bold, 
  },
  removeBtn: { 
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  emptyContainer: { 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 100 
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { 
    fontFamily: Fonts.bold, 
  },
  emptySub: { 
    fontFamily: Fonts.medium, 
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  addInitialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 25,
    gap: 8,
  },
  addInitialBtnText: {
    fontFamily: Fonts.bold,
  },

  checkoutAnchor: { 
    position: 'absolute',
    bottom: 0,
    width: '100%',
    borderTopWidth: 1,
  },
  checkoutBlur: {
    paddingHorizontal: 25,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
  },
  summaryBox: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  summaryLabel: { 
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  totalAmount: { 
    fontFamily: Fonts.bold, 
  },
  totalCurrency: {
    opacity: 0.6,
  },
  actionCluster: { 
    flexDirection: 'row', 
    gap: 12 
  },
  moreBtn: { 
    width: 60, 
    height: 60, 
    borderWidth: 1.5, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  checkoutBtn: { 
    flexDirection: 'row',
    height: 60, 
    paddingHorizontal: 25,
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
    gap: 10,
  },
  checkoutBtnText: { 
    fontFamily: Fonts.bold, 
  },
});

export default PendingSales;