import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Fonts } from '@/constants/theme';
import { Package } from 'lucide-react-native';
import { ItemData } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import { SwipeableItem } from '@/components/SwipeableItem';
import { formatDate } from '@/utils/date-utils';
import { AppText, AppNumber} from '@/components/ui';
interface RecentItemCardProps {
  item: ItemData;
  onPress?: () => void;
  onDelete?: () => void;
}

const RecentItemCard: React.FC<RecentItemCardProps> = React.memo(({ item, onPress, onDelete }) => {
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
          <AppText variant="body" weight="bold" style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</AppText>
          <AppText variant="caption" weight="medium" style={[styles.itemSub, { color: colors.textSecondary }]} numberOfLines={2}>
            {(item.categoryName ? (item.categoryName.startsWith('category.') ? t(item.categoryName) : item.categoryName) : t('common.uncategorized'))} • {t('common.added')} {getTimeAgo(item.createdAt)}
          </AppText>
        </View>
        <View style={[styles.stockBadge, isOutOfStock ? { backgroundColor: '#FF3B30' } : { backgroundColor: colors.border }]}>
          <View style={[styles.stockDot, { backgroundColor: isOutOfStock ? '#FFF' : colors.text }]} />
          <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.stockText, { color: isOutOfStock ? '#FFF' : colors.text }]} numberOfLines={1}>{isOutOfStock ? t('inventory.out_of_stock') : t('dashboard.stats.stable')}</AppText>
        </View>
      </View>

      <View style={[styles.itemFooter, { borderTopColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" weight="medium" style={[styles.footerLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('common.quantity')}</AppText>
          <AppText variant="body-sm" weight="bold" style={[styles.footerValue, { color: colors.text }]} numberOfLines={1}>
            <AppNumber value={item.totalBaseQuantity || 0} size="body-sm" /> {item.baseUnit || 'items'}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" weight="medium" style={[styles.footerLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inventory.base_cost')}</AppText>
          <AppText variant="body-sm" weight="bold" style={[styles.footerValue, { color: colors.text }]} numberOfLines={1}>
            <AppNumber value={item.basePurchasePrice} size="body-sm" showCurrency decimals={2} />
          </AppText>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <AppText variant="caption" weight="medium" style={[styles.footerLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inventory.base_price')}</AppText>
          <AppText variant="body-sm" weight="bold" style={[styles.footerValue, { color: colors.text }]} numberOfLines={1}>
            <AppNumber value={item.baseSellingPrice} size="body-sm" showCurrency decimals={2} />
          </AppText>
        </View>
      </View>
      </Pressable>
    </SwipeableItem>
  );
});

RecentItemCard.displayName = 'RecentItemCard';

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
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  itemSub: {
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
    fontFamily: Fonts.medium,
    marginBottom: 4,
  },
  footerValue: {
    fontFamily: Fonts.bold,
  },
});

export default RecentItemCard;