import React from 'react';
import { Fonts } from '@/constants/theme';
import { 
  Package, 
  AlertTriangle, 
  ChevronRight, 
  Zap, 
  Box,
  ArrowDownRight
} from 'lucide-react-native';
import {
  StyleSheet,
  Text as RNText,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { useSettings } from '@/context/SettingsContext';
import { getLowStockItems, ItemData, deleteItem } from '@/database/db';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const LowStockItemsScreen = () => {
  const { colors, t, theme } = useSettings();
  const [data, setData] = React.useState<ItemData[]>([]);

  const loadData = async () => {
    const items = await getLowStockItems();
    setData(items);
  };

  React.useEffect(() => {
    loadData();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      >
        <View style={styles.headerNode}>
           <RNText style={[styles.headerSub, { color: colors.textSecondary }]}>{t('dash.inventory_health')}</RNText>
           <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('dash.deficit_intel')}</RNText>
        </View>

        {data.map((item, index) => {
          const isOut = item.totalBaseQuantity <= 0;
          return (
            <Animated.View 
              key={item.id} 
              entering={FadeInDown.delay(index * 50).duration(500)}
            >
              <TouchableOpacity 
                style={[styles.nodeCard, { backgroundColor: colors.card, borderColor: colors.border }]} 
                activeOpacity={0.7}
              >
                <View style={styles.cardMain}>
                  <View style={[styles.iconNode, { backgroundColor: isOut ? colors.primary + '15' : colors.text + '05' }]}>
                    <Package size={22} color={isOut ? colors.primary : colors.text} />
                    <View style={[styles.alertDot, { backgroundColor: isOut ? colors.primary : '#FF9500' }]} />
                  </View>
                  
                  <View style={styles.infoArea}>
                    <RNText style={[styles.itemName, { color: colors.text }]}>{item.name}</RNText>
                    <RNText style={[styles.itemSub, { color: colors.textSecondary }]}>
                      {item.companyName || t('dash.general_source')}
                    </RNText>
                  </View>

                  <View style={styles.statArea}>
                    <View style={styles.qtyRow}>
                       <ArrowDownRight size={14} color={isOut ? colors.primary : '#FF9500'} />
                       <RNText style={[styles.qtyText, { color: colors.text }]}>{item.totalBaseQuantity}</RNText>
                       <RNText style={[styles.unitText, { color: colors.textSecondary }]}>{t('form.' + (item.baseUnit || 'pieces').toLowerCase())}</RNText>
                    </View>
                    <RNText style={[styles.statusLabel, { color: isOut ? colors.primary : '#FF9500' }]}>
                      {isOut ? t('dash.depleted') : t('dash.critical')}
                    </RNText>
                  </View>
                </View>

                <View style={[styles.cardFooter, { backgroundColor: colors.text + '03' }]}>
                   <RNText style={[styles.footerText, { color: colors.textSecondary }]}>
                     {t('dash.restock_required')}
                   </RNText>
                   <ChevronRight size={16} color={colors.border} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {data.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.success + '10' }]}>
               <Zap size={40} color={colors.success} />
            </View>
            <RNText style={[styles.emptyTitle, { color: colors.text }]}>{t('dash.optimal_stock')}</RNText>
            <RNText style={[styles.emptySub, { color: colors.textSecondary }]}>{t('dash.all_assets_meet')}</RNText>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContainer: { paddingHorizontal: 25, paddingBottom: 40, paddingTop: 20 },
  headerNode: {
    marginBottom: 25,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
  },
  nodeCard: { 
    borderRadius: 24, 
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  iconNode: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  alertDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  infoArea: {
    flex: 1,
    marginLeft: 16,
  },
  itemName: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  statArea: {
    alignItems: 'flex-end',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  qtyText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  unitText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  statusLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
});

export default LowStockItemsScreen;