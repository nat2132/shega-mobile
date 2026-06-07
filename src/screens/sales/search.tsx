import React, { useCallback, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Fonts } from '@/constants/theme';
import { Search, X, Package, Box, ChevronRight, Zap } from 'lucide-react-native';
import { searchInventory } from '@/database/db';
import { useFocusEffect } from 'expo-router';
import { useSettings } from '@/context/SettingsContext';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { useDebounce } from '@/hooks/useDebounce';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
const { width } = Dimensions.get('window');

const SearchResultRow = React.memo(({
  item,
  index,
  onPress,
}: {
  item: any;
  index: number;
  onPress?: (i: any) => void;
}) => {
  const { colors, t } = useSettings();
  const isOutOfStock = item.totalBaseQuantity <= 0;
  const hasPackPricing = !!(item.allowSellByPackUnit && item.packSellingPrice > 0);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 50).duration(500)}>
      <TouchableOpacity
        style={[
          styles.resultCard,
          isOutOfStock && { opacity: 0.6 },
          { backgroundColor: colors.card, borderColor: colors.border }
        ]}
        activeOpacity={0.7}
        onPress={() => !isOutOfStock && onPress?.(item)}
        disabled={isOutOfStock}
      >
        <View style={styles.cardMain}>
          <View style={[styles.iconNode, { backgroundColor: colors.text + '08' }]}>
            <Package size={22} color={isOutOfStock ? colors.textSecondary : colors.text} />
            {item.totalBaseQuantity > 100 && (
               <View style={[styles.trendBadge, { backgroundColor: colors.primary }]}>
                  <Zap size={10} color="#FFF" />
               </View>
            )}
          </View>

          <View style={styles.infoArea}>
            <AppText variant="body" weight="bold" style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</AppText>
            <AppText variant="body-sm" weight="medium" style={[styles.itemDetail, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.companyName || (item.categoryName ? (t('category.' + item.categoryName.toLowerCase()) !== 'category.' + item.categoryName.toLowerCase() ? t('category.' + item.categoryName.toLowerCase()) : item.categoryName) : t('common.general'))}
            </AppText>
          </View>

          <View style={styles.priceArea}>
            <AppText variant="body" weight="bold" shrink={false} style={[styles.mainPrice, { color: colors.text }]} numberOfLines={1}>
              {item.baseSellingPrice.toLocaleString()} <AppText variant="caption" weight="medium" shrink={false} style={styles.currency}>{t('common.etb')}</AppText>
            </AppText>
            <AppText variant="caption" weight="medium" shrink={false} style={[styles.unitLabel, { color: colors.textSecondary }]} numberOfLines={1}>
              per {item.baseUnit}
            </AppText>
          </View>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <View style={styles.footerLeft}>
            <AppText variant="caption" weight="semibold" style={[styles.stockStatus, { color: isOutOfStock ? colors.primary : colors.textSecondary }]} numberOfLines={1}>
              {isOutOfStock ? t('dash.depleted') : `${item.totalBaseQuantity} ${t('form.' + (item.baseUnit || 'pieces').toLowerCase())} ${t('notif.pulse_nominal').toLowerCase()}`}
            </AppText>
          </View>
          <ChevronRight size={18} color={colors.border} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});
SearchResultRow.displayName = 'SearchResultRow';

interface SearchScreenProps {
  onSelectItem?: (item: any) => void;
}

const SearchScreen: React.FC<SearchScreenProps> = ({ onSelectItem }) => {
  const { colors, t, theme } = useSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const debouncedQuery = useDebounce(query, 250);

  useFocusEffect(
    React.useCallback(() => {
      const trimmed = debouncedQuery.trim();
      const data = searchInventory(trimmed);
      setResults(data);
    }, [debouncedQuery])
  );

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <SearchResultRow
      item={item}
      index={index}
      onPress={onSelectItem}
    />
  ), [onSelectItem]);

  const keyExtractor = useCallback((item: any) => item.id.toString(), []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background Ambience */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgWash, { top: -100, left: -50, backgroundColor: colors.primary, opacity: 0.05 }]} />
      </View>

      <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
        <View style={styles.headerArea}>
           <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inventory.header')}</AppText>
           <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('sale.global_retrieval')}</AppText>
        </View>
        
        <View style={styles.searchWrapper}>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Search size={20} color={colors.textSecondary} />
            <TextInput 
              style={[styles.input, { color: colors.text }]} 
              placeholder={t('common.search_placeholder') || "Search assets..."} 
              placeholderTextColor={colors.textSecondary} 
              value={query}
              onChangeText={setQuery}
              autoFocus
              selectionColor={colors.primary}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Animated.FlatList
          data={results}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          itemLayoutAnimation={Layout.springify()}
          renderItem={renderItem}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={true}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
               <Box size={60} color={colors.border} strokeWidth={1} />
               <AppText variant="title" weight="bold" align="center" style={[styles.emptyTitle, { color: colors.text }]} numberOfLines={2}>{t('sales.no_records_found')}</AppText>
               <AppText variant="body" weight="medium" align="center" style={[styles.emptySub, { color: colors.textSecondary }]} numberOfLines={3}>{t('sale.refine_search')}</AppText>
            </View>
          )}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgWash: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  headerArea: {
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerLabel: {
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
  },
  searchWrapper: {
    paddingHorizontal: 25,
    marginBottom: 20,
  },
  searchBar: { 
    flexDirection: 'row', 
    borderRadius: 20, 
    paddingHorizontal: 16, 
    height: 56, 
    alignItems: 'center', 
    borderWidth: 1,
  },
  input: { 
    flex: 1, 
    marginLeft: 12, 
    fontFamily: Fonts.medium,
  },
  clearBtn: {
    padding: 8,
  },
  listContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  resultCard: { 
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
  trendBadge: {
     position: 'absolute',
     top: -4,
     right: -4,
     width: 18,
     height: 18,
     borderRadius: 9,
     justifyContent: 'center',
     alignItems: 'center',
     borderWidth: 2,
     borderColor: '#FFF', 
  },
  infoArea: {
    flex: 1,
    marginLeft: 16,
  },
  itemName: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  itemDetail: {
    fontFamily: Fonts.medium,
  },
  priceArea: {
    alignItems: 'flex-end',
  },
  mainPrice: {
    fontFamily: Fonts.bold,
  },
  currency: {
    opacity: 0.6,
  },
  unitLabel: {
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockStatus: {
    fontFamily: Fonts.semibold,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyTitle: {
    fontFamily: Fonts.bold,
    marginTop: 20,
  },
  emptySub: {
    fontFamily: Fonts.medium,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default SearchScreen;