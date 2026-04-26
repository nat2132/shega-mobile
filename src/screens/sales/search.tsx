import React, { useState } from 'react';
import { 
  View, 
  Text as RNText, 
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

const { width } = Dimensions.get('window');

interface SearchScreenProps {
  onSelectItem?: (item: any) => void;
}

const SearchScreen: React.FC<SearchScreenProps> = ({ onSelectItem }) => {
  const { colors, t, theme } = useSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      const data = searchInventory(query);
      setResults(data);
    }, [query])
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background Ambience */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgWash, { top: -100, left: -50, backgroundColor: colors.primary, opacity: 0.05 }]} />
      </View>

      <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
        <View style={styles.headerArea}>
           <RNText style={[styles.headerLabel, { color: colors.textSecondary }]}>{t('inventory.header')}</RNText>
           <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('sale.global_retrieval')}</RNText>
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

        <FlatList
          data={results}
          keyExtractor={item => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          itemLayoutAnimation={Layout.springify()}
          renderItem={({ item, index }) => {
            const isOutOfStock = item.totalBaseQuantity <= 0;
            const hasPackPricing = !!(item.allowSellByPackUnit && item.packSellingPrice > 0);
            
            return (
              <Animated.View entering={FadeInDown.delay(index * 50).duration(500)}>
                <TouchableOpacity 
                  style={[
                    styles.resultCard, 
                    isOutOfStock && { opacity: 0.6 }, 
                    { backgroundColor: colors.card, borderColor: colors.border }
                  ]} 
                  activeOpacity={0.7}
                  onPress={() => !isOutOfStock && onSelectItem?.(item)}
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
                      <RNText style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</RNText>
                      <RNText style={[styles.itemDetail, { color: colors.textSecondary }]}>
                        {item.companyName || (item.categoryName ? (t('category.' + item.categoryName.toLowerCase()) !== 'category.' + item.categoryName.toLowerCase() ? t('category.' + item.categoryName.toLowerCase()) : item.categoryName) : t('common.general'))}
                      </RNText>
                    </View>

                    <View style={styles.priceArea}>
                      <RNText style={[styles.mainPrice, { color: colors.text }]}>
                        {item.baseSellingPrice.toLocaleString()} <RNText style={styles.currency}>ETB</RNText>
                      </RNText>
                      <RNText style={[styles.unitLabel, { color: colors.textSecondary }]}>
                        per {item.baseUnit}
                      </RNText>
                    </View>
                  </View>

                  <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <View style={styles.footerLeft}>
                      <RNText style={[styles.stockStatus, { color: isOutOfStock ? colors.primary : colors.textSecondary }]}>
                        {isOutOfStock ? t('dash.depleted') : `${item.totalBaseQuantity} ${t('form.' + (item.baseUnit || 'pieces').toLowerCase())} ${t('notif.pulse_nominal').toLowerCase()}`}
                      </RNText>
                    </View>
                    <ChevronRight size={18} color={colors.border} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
               <Box size={60} color={colors.border} strokeWidth={1} />
               <RNText style={[styles.emptyTitle, { color: colors.text }]}>{t('sales.no_records_found')}</RNText>
               <RNText style={[styles.emptySub, { color: colors.textSecondary }]}>{t('sale.refine_search')}</RNText>
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
    fontSize: 12,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
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
    fontSize: 16, 
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
    fontSize: 17,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  itemDetail: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  priceArea: {
    alignItems: 'flex-end',
  },
  mainPrice: {
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  currency: {
    fontSize: 11,
    opacity: 0.6,
  },
  unitLabel: {
    fontSize: 11,
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
    fontSize: 12,
    fontFamily: Fonts.semibold,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginTop: 20,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default SearchScreen;