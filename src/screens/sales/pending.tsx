import React from 'react';
import { 
  View, 
  Text as RNText, 
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
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

interface PendingSalesProps {
  items: any[];
  onUpdateItem?: (id: string, updates: any) => void;
  onRemoveItem?: (id: string) => void;
  onAddMore?: () => void;
  onFinish?: () => void;
}

const PendingSales: React.FC<PendingSalesProps> = ({ items, onUpdateItem, onRemoveItem, onAddMore, onFinish }) => {
  const { colors, t, theme } = useSettings();
  const totalAmount = items.reduce((sum, item) => sum + (item.unitType === 'pack' ? item.packSellingPrice : item.baseSellingPrice) * item.quantity, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <View>
          <RNText style={[styles.headerSub, { color: colors.textSecondary }]}>{t('sale.active_transaction')}</RNText>
          <RNText style={[styles.header, { color: colors.text }]}>{t('sale.orchestration_ledger')}</RNText>
        </View>
        <View style={[styles.badgeNode, { backgroundColor: colors.text + '08' }]}>
           <RNText style={[styles.itemCount, { color: colors.text }]}>{items.length} Units</RNText>
        </View>
      </View>
      
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        itemLayoutAnimation={Layout.springify()}
        renderItem={({ item, index }) => {
          const currentUnitPrice = item.unitType === 'pack' ? item.packSellingPrice : item.baseSellingPrice;
          const currentUnitLabel = item.unitType === 'pack' ? item.purchaseUnit : item.baseUnit;
          const lineTotal = currentUnitPrice * item.quantity;
          
          return (
            <Animated.View entering={FadeInDown.delay(index * 50).duration(500)}>
              <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: colors.text + '08' }]}>
                    <Package size={20} color={colors.text} />
                  </View>
                  <View style={styles.nameArea}>
                    <RNText style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</RNText>
                    <TouchableOpacity 
                      style={[styles.unitBadge, { backgroundColor: colors.primary + '15' }]} 
                      onPress={() => {
                        if (item.allowSellByPackUnit && item.allowSellByBaseUnit) {
                          onUpdateItem?.(item.id, { unitType: item.unitType === 'pack' ? 'base' : 'pack' });
                        }
                      }}
                    >
                      <Repeat size={10} color={colors.primary} style={{ marginRight: 4 }} />
                      <RNText style={[styles.unitBadgeText, { color: colors.primary }]}>{currentUnitLabel}</RNText>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.costArea}>
                    <RNText style={[styles.linePrice, { color: colors.text }]}>{lineTotal.toLocaleString()} <RNText style={styles.currency}>ETB</RNText></RNText>
                    <RNText style={[styles.unitPrice, { color: colors.textSecondary }]}>{currentUnitPrice} / Unit</RNText>
                  </View>
                </View>

                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <View style={[styles.qtyControl, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={() => {
                        if (item.quantity > 1) onUpdateItem?.(item.id, { quantity: item.quantity - 1 });
                      }}
                    >
                      <Minus size={14} color={colors.text} />
                    </TouchableOpacity>
                    <RNText style={[styles.qtyValue, { color: colors.text }]}>{item.quantity}</RNText>
                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={() => onUpdateItem?.(item.id, { quantity: item.quantity + 1 })}
                    >
                      <Plus size={14} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity 
                    style={[styles.removeBtn, { backgroundColor: '#FF3B3015' }]} 
                    onPress={() => onRemoveItem?.(item.id)}
                  >
                    <Trash2 size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.text + '05' }]}>
               <ShoppingCart size={48} color={colors.border} strokeWidth={1} />
            </View>
            <RNText style={[styles.emptyTitle, { color: colors.text }]}>{t('sale.ledger_is_empty')}</RNText>
            <RNText style={[styles.emptySub, { color: colors.textSecondary }]}>{t('sale.add_assets_begin')}</RNText>
            <TouchableOpacity style={[styles.addInitialBtn, { backgroundColor: colors.text }]} onPress={onAddMore}>
               <PlusCircle size={18} color={colors.background} />
               <RNText style={[styles.addInitialBtnText, { color: colors.background }]}>{t('sale.begin_search')}</RNText>
            </TouchableOpacity>
          </View>
        )}
      />

      {items.length > 0 && (
        <View style={[styles.checkoutAnchor, { borderTopColor: colors.border }]}>
          <BlurView intensity={80} tint={theme !== 'light' ? 'dark' : 'light'} style={styles.checkoutBlur}>
            <View style={styles.summaryBox}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <RNText style={[styles.summaryLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('sale.total_settlement')}</RNText>
                <RNText style={[styles.totalAmount, { color: colors.text }]} adjustsFontSizeToFit numberOfLines={1}>{totalAmount.toLocaleString()} <RNText style={styles.totalCurrency}>ETB</RNText></RNText>
              </View>
              
              <View style={styles.actionCluster}>
                 <TouchableOpacity style={[styles.moreBtn, { borderColor: colors.border }]} onPress={onAddMore}>
                   <Plus size={22} color={colors.text} />
                 </TouchableOpacity>
                 <TouchableOpacity style={[styles.checkoutBtn, { backgroundColor: colors.text }]} onPress={onFinish}>
                   <RNText style={[styles.checkoutBtnText, { color: colors.background }]}>{t('sale.commit')}</RNText>
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
    fontSize: 11,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  header: { 
    fontSize: 22, 
    fontFamily: Fonts.bold,
  },
  badgeNode: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  itemCount: { 
    fontSize: 12, 
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
    fontSize: 16, 
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
    fontSize: 10, 
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },
  costArea: { 
    alignItems: 'flex-end' 
  },
  linePrice: { 
    fontFamily: Fonts.bold, 
    fontSize: 16 
  },
  currency: {
    fontSize: 11,
    opacity: 0.6,
  },
  unitPrice: { 
    fontSize: 11, 
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
    fontSize: 15 
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
    fontSize: 20, 
    fontFamily: Fonts.bold, 
  },
  emptySub: { 
    fontSize: 14, 
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
    fontSize: 14,
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
    fontSize: 12, 
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  totalAmount: { 
    fontSize: 26, 
    fontFamily: Fonts.bold, 
  },
  totalCurrency: {
    fontSize: 14,
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
    fontSize: 16 
  },
});

export default PendingSales;