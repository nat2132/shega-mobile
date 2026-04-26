import React from 'react';
import { View, Text as RNText, StyleSheet, Pressable } from 'react-native';
import { Fonts } from '@/constants/theme';
import { Package } from 'lucide-react-native';
import { ItemData } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import { SwipeableItem } from '@/components/SwipeableItem';
import { formatDate } from '@/utils/date-utils';

interface RecentItemCardProps {
  item: ItemData;
  onPress?: () => void;
  onDelete?: () => void;
}

const RecentItemCard: React.FC<RecentItemCardProps> = ({ item, onPress, onDelete }) => {
  const { colors, calendarType, language, t } = useSettings();
  const getTimeAgo = (dateString: string) => {
    if (!dateString) return t('common.recently');
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return t('common.just_now');
    if (diffHours < 24) return t('common.hr_ago', { count: diffHours.toString() });
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return t('common.d_ago', { count: diffDays.toString() });
    return formatDate(date, calendarType, language);
  };

  const formatPrice = (price: any) => {
    const val = Number(price) || 0;
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const quantityString = `${item.totalBaseQuantity || 0} ${item.baseUnit || 'items'}`;
  const isOutOfStock = (item.totalBaseQuantity || 0) <= 0;

  return (
    <SwipeableItem 
      enabled={!!onDelete} 
      onDelete={onDelete || (() => {})} 
      itemTitle={item.name}
    >
      <Pressable 
        style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]} 
        onPress={onPress}
      >
        <View style={styles.itemHeader}>
        <View style={[styles.itemIcon, { backgroundColor: colors.text }]}>
          <Package size={22} color={colors.background} />
        </View>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <RNText style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</RNText>
          <RNText style={[styles.itemSub, { color: colors.textSecondary }]}>
            {(item.categoryName ? t(item.categoryName.toLowerCase().startsWith('category.') ? item.categoryName.toLowerCase() : 'category.' + item.categoryName.toLowerCase()) : t('common.uncategorized'))} • {t('common.added')} {getTimeAgo(item.createdAt)}
          </RNText>
        </View>
        <View style={[styles.stockBadge, isOutOfStock ? { backgroundColor: '#FF3B30' } : { backgroundColor: colors.border }]}>
          <View style={[styles.stockDot, { backgroundColor: isOutOfStock ? '#FFF' : colors.text }]} />
          <RNText style={[styles.stockText, { color: isOutOfStock ? '#FFF' : colors.text }]}>{isOutOfStock ? t('inventory.out_of_stock') : t('dashboard.stats.stable')}</RNText>
        </View>
      </View>

      <View style={[styles.itemFooter, { borderTopColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <RNText style={[styles.footerLabel, { color: colors.textSecondary }]}>{t('inventory.low_stock')}</RNText>
          <RNText style={[styles.footerValue, { color: colors.text }]}>{quantityString}</RNText>
        </View>
        <View style={{ flex: 1 }}>
          <RNText style={[styles.footerLabel, { color: colors.textSecondary }]}>{t('inventory.base_cost')}</RNText>
          <RNText style={[styles.footerValue, { color: colors.text }]}>{formatPrice(item.basePurchasePrice)} {t('common.etb')}</RNText>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <RNText style={[styles.footerLabel, { color: colors.textSecondary }]}>{t('inventory.base_price')}</RNText>
          <RNText style={[styles.footerValue, { color: colors.text }]}>{formatPrice(item.baseSellingPrice)} {t('common.etb')}</RNText>
        </View>
      </View>
      </Pressable>
    </SwipeableItem>
  );
};

const styles = StyleSheet.create({
  itemCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 15,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  itemSub: {
    fontSize: 10,
    fontFamily: Fonts.medium,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  stockText: {
    fontSize: 10,
    fontFamily: Fonts.medium,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    borderTopWidth: 1,
    paddingTop: 15,
  },
  footerLabel: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    marginBottom: 4,
  },
  footerValue: {
    fontSize: 12,
    fontFamily: Fonts.bold,
  },
});

export default RecentItemCard;
