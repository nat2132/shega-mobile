import { Skeleton } from '@/components/Skeleton';
import { AppNumber, AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { searchInventory } from '@/database/db';
import { useDebounce } from '@/hooks/useDebounce';
import { useFocusEffect } from 'expo-router';
import { AlertCircle, ChevronRight, Package, Search, X, Zap } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { getSalesGlass, SALES_SPRING } from './glass-sales';

// ── Segment Highlighted Text ───────────────────────────────
const HighlightedText = React.memo(({
  text,
  query,
  highlightColor,
  textColor,
  variant = 'body',
  weight = 'bold',
  numberOfLines = 1,
  style,
}: {
  text: string;
  query: string;
  highlightColor: string;
  textColor: string;
  variant?: any;
  weight?: any;
  numberOfLines?: number;
  style?: any;
}) => {
  if (!query.trim()) {
    return (
      <AppText variant={variant} weight={weight} color={textColor} numberOfLines={numberOfLines} style={style}>
        {text}
      </AppText>
    );
  }

  const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

  return (
    <AppText variant={variant} weight={weight} color={textColor} numberOfLines={numberOfLines} style={style}>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === query.toLowerCase();
        return isMatch ? (
          <AppText
            key={index}
            variant={variant}
            weight="extrabold"
            color={highlightColor}
          >
            {part}
          </AppText>
        ) : (
          part
        );
      })}
    </AppText>
  );
});
HighlightedText.displayName = 'HighlightedText';

// ── Search Result Skeleton Row ───────────────────────────────
const SearchResultSkeleton = React.memo(() => {
  const { colors } = useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);

  return (
    <View style={[styles.resultCard, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border, opacity: 0.6 }]}>
      <View style={styles.cardMain}>
        <Skeleton width={48} height={48} borderRadius={14} />
        
        <View style={[styles.infoArea, { gap: 6 }]}>
          <Skeleton width="65%" height={15} borderRadius={4} />
          <Skeleton width="40%" height={11} borderRadius={4} />
        </View>

        <View style={[styles.priceArea, { gap: 6, alignItems: 'flex-end' }]}>
          <Skeleton width={60} height={15} borderRadius={4} />
          <Skeleton width={40} height={9} borderRadius={4} />
        </View>
      </View>
      <View style={[styles.cardFooter, { borderTopColor: SALES_GLASS.border, backgroundColor: SALES_GLASS.bgCard + '30', justifyContent: 'space-between' }]}>
        <Skeleton width={110} height={11} borderRadius={4} />
        <Skeleton width={16} height={11} borderRadius={4} />
      </View>
    </View>
  );
});
SearchResultSkeleton.displayName = 'SearchResultSkeleton';

// ── Search Result Row Card ───────────────────────────────────
const SearchResultRow = React.memo(({
  item,
  index,
  query,
  onPress,
}: {
  item: any;
  index: number;
  query: string;
  onPress?: (i: any) => void;
}) => {
  const { colors, t } = useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);
  const isOutOfStock = item.totalBaseQuantity <= 0;
  const isLowStock = !isOutOfStock && item.totalBaseQuantity < 10;

  const scale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, SALES_SPRING.pressIn);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SALES_SPRING.pressOut);
  };

  const stockConfig = useMemo(() => {
    if (isOutOfStock) {
      return {
        bg: colors.error + '12',
        border: colors.error + '30',
        text: colors.error,
        label: t('search.out_of_stock'),
      };
    }
    if (isLowStock) {
      return {
        bg: colors.warning + '12',
        border: colors.warning + '30',
        text: colors.warning,
        label: `${item.totalBaseQuantity} ${t('form.' + (item.baseUnit || 'pieces').toLowerCase()) || item.baseUnit} ${t('search.left')}`,
      };
    }
    return {
      bg: colors.success + '12',
      border: colors.success + '30',
      text: colors.success,
      label: `${item.totalBaseQuantity} ${t('form.' + (item.baseUnit || 'pieces').toLowerCase()) || item.baseUnit} ${t('search.available')}`,
    };
  }, [isOutOfStock, isLowStock, item.totalBaseQuantity, item.baseUnit, colors, t]);

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 45).duration(300).springify().damping(22)}
      style={pressStyle}
    >
      <TouchableWithoutFeedback
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => !isOutOfStock && onPress?.(item)}
        disabled={isOutOfStock}
      >
        <View
          style={[
            styles.resultCard,
            isOutOfStock && { opacity: 0.65 },
            { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }
          ]}
        >
          <View style={styles.cardMain}>
            <View style={[styles.iconNode, { backgroundColor: stockConfig.bg }]}>
              <Package size={20} color={stockConfig.text} />
              {item.totalBaseQuantity > 100 && (
                <View style={[styles.trendBadge, { backgroundColor: colors.primary, borderColor: SALES_GLASS.bgCard }]}>
                  <Zap size={9} color={colors.background} />
                </View>
              )}
            </View>

            <View style={styles.infoArea}>
              <HighlightedText
                text={item.name}
                query={query}
                highlightColor={colors.primary}
                textColor={SALES_GLASS.fg}
                variant="body"
                weight="bold"
                style={styles.itemName}
              />
              <AppText variant="body-sm" weight="medium" style={[styles.itemDetail, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>
                {item.companyName || (item.categoryName ? (t('category.' + item.categoryName.toLowerCase()) !== 'category.' + item.categoryName.toLowerCase() ? t('category.' + item.categoryName.toLowerCase()) : item.categoryName) : t('common.general'))}
              </AppText>
            </View>

            <View style={styles.priceArea}>
              <AppNumber value={item.baseSellingPrice} size="body" weight="bold" prefix={t('common.etb') + ' '} color={SALES_GLASS.fg} style={styles.mainPrice} />
              <AppText variant="caption" weight="medium" shrink={false} style={[styles.unitLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>
                {t('search.per')} {item.baseUnit}
              </AppText>
            </View>
          </View>

          <View style={[styles.cardFooter, { borderTopColor: SALES_GLASS.border, backgroundColor: SALES_GLASS.bgCard + '30' }]}>
            <View style={[styles.stockBadge, { backgroundColor: stockConfig.bg, borderColor: stockConfig.border }]}>
              <View style={[styles.stockDot, { backgroundColor: stockConfig.text }]} />
              <AppText variant="caption" weight="semibold" style={{ color: stockConfig.text }} numberOfLines={1}>
                {stockConfig.label}
              </AppText>
            </View>
            <ChevronRight size={16} color={SALES_GLASS.border} />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
});
SearchResultRow.displayName = 'SearchResultRow';

// ── Filter Bar Component ─────────────────────────────────────
const FilterBar = React.memo(({
  selectedFilter,
  onSelectFilter,
}: {
  selectedFilter: string;
  onSelectFilter: (f: string) => void;
}) => {
  const { colors, t } = useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);

  const filters = useMemo(() => [
    { id: 'all', label: t('common.all') },
    { id: 'in_stock', label: t('search.in_stock') },
    { id: 'low_stock', label: t('search.low_stock') },
    { id: 'out_of_stock', label: t('search.out_of_stock') },
  ], [t]);

  return (
    <View style={[styles.filterBarContainer, { borderBottomColor: SALES_GLASS.border }]}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {filters.map((filter) => {
          const isActive = selectedFilter === filter.id;
          return (
            <TouchableOpacity
              key={filter.id}
              activeOpacity={0.7}
              onPress={() => onSelectFilter(filter.id)}
              style={[
                styles.filterPill,
                isActive 
                  ? { backgroundColor: colors.primary, borderColor: colors.primary } 
                  : { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
              ]}
            >
              <AppText
                variant="caption"
                weight={isActive ? 'bold' : 'semibold'}
                style={{ color: isActive ? colors.background : SALES_GLASS.fgSecondary }}
              >
                {filter.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
});
FilterBar.displayName = 'FilterBar';

// ── Empty State Component ────────────────────────────────────
const EmptyState = React.memo(({
  onSelectTag,
}: {
  onSelectTag: (text: string, filterId?: string) => void;
}) => {
  const { colors, t } = useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);

  const suggestionTags = useMemo(() => [
    { label: t('search.in_stock'), filterId: 'in_stock', text: '' },
    { label: t('search.out_of_stock'), filterId: 'out_of_stock', text: '' },
    { label: t('search.low_stock'), filterId: 'low_stock', text: '' },
    { label: 'Water', text: 'Water' },
    { label: 'Soda', text: 'Soda' },
    { label: 'Oil', text: 'Oil' },
    { label: 'Snacks', text: 'Snacks' },
  ], [t]);

  return (
    <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.emptyRoot}>
      <View style={[styles.emptyHeaderCard, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
        <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '10' }]}>
          <Search size={28} color={colors.primary} />
        </View>
        <AppText variant="title" weight="bold" align="center" style={{ color: SALES_GLASS.fg, marginTop: 16 }}>
          {t('sale.refine_search') || 'Inventory Search'}
        </AppText>
        <AppText variant="body-sm" weight="medium" align="center" style={{ color: SALES_GLASS.fgSecondary, marginTop: 6, paddingHorizontal: 16 }}>
          {t('search.description')}
        </AppText>
      </View>

      <View style={styles.suggestionsSection}>
        <AppText variant="caption" weight="bold" transform="uppercase" style={{ color: SALES_GLASS.fgSecondary, letterSpacing: 1.2, marginBottom: 12 }}>
          {t('search.suggested')}
        </AppText>
        <View style={styles.suggestionsGrid}>
          {suggestionTags.map((tag, idx) => (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.7}
              onPress={() => onSelectTag(tag.text, tag.filterId)}
              style={[styles.suggestionTag, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}
            >
              <AppText variant="caption" weight="semibold" style={{ color: SALES_GLASS.fg }}>
                {tag.label}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Animated.View>
  );
});
EmptyState.displayName = 'EmptyState';

// ── No Results State Component ───────────────────────────────
const NoResultsState = React.memo(({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) => {
  const { colors, t } = useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);

  return (
    <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.noResultsRoot}>
      <View style={[styles.noResultsIconBox, { backgroundColor: colors.error + '10', borderColor: colors.error + '25' }]}>
        <AlertCircle size={32} color={colors.error} />
      </View>
      <AppText variant="title" weight="bold" align="center" style={{ color: SALES_GLASS.fg, marginTop: 16 }}>
        {t('sales.no_records_found')}
      </AppText>
      <AppText variant="body-sm" weight="medium" align="center" style={{ color: SALES_GLASS.fgSecondary, marginTop: 6, paddingHorizontal: 30 }}>
        {t('search.no_results_msg', { query })}
      </AppText>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onClear}
        style={[styles.resetBtn, { backgroundColor: colors.primary }]}
      >
        <AppText variant="body-sm" weight="bold" style={{ color: colors.background }}>
          {t('search.clear')}
        </AppText>
      </TouchableOpacity>
    </Animated.View>
  );
});
NoResultsState.displayName = 'NoResultsState';

// ── Main Search Screen ───────────────────────────────────────
interface SearchScreenProps {
  onSelectItem?: (item: any) => void;
}

const SearchScreen: React.FC<SearchScreenProps> = ({ onSelectItem }) => {
  const { colors, t } = useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [results, setResults] = useState<any[]>([]);
  const debouncedQuery = useDebounce(query, 250);
  const inputRef = useRef<TextInput>(null);

  useFocusEffect(
    React.useCallback(() => {
      const trimmed = debouncedQuery.trim();
      let data = searchInventory(trimmed);

      if (selectedFilter === 'in_stock') {
        data = data.filter((item: any) => item.totalBaseQuantity > 0);
      } else if (selectedFilter === 'low_stock') {
        data = data.filter((item: any) => item.totalBaseQuantity > 0 && item.totalBaseQuantity < 10);
      } else if (selectedFilter === 'out_of_stock') {
        data = data.filter((item: any) => item.totalBaseQuantity <= 0);
      }

      setResults(data);
    }, [debouncedQuery, selectedFilter])
  );

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <SearchResultRow
      item={item}
      index={index}
      query={debouncedQuery}
      onPress={onSelectItem}
    />
  ), [onSelectItem, debouncedQuery]);

  const keyExtractor = useCallback((item: any) => item.id.toString(), []);

  // ── Animation Setup ─────────────────────────────────────────
  const [isFocused, setIsFocused] = useState(false);
  const headerHeight = useSharedValue(76);
  const headerOpacity = useSharedValue(1);
  const headerTranslateY = useSharedValue(0);
  const cancelOpacity = useSharedValue(0);

  const animateFocus = (focused: boolean) => {
    setIsFocused(focused);
    if (focused) {
      headerHeight.value = withSpring(0, SALES_SPRING.gentle);
      headerOpacity.value = withTiming(0, { duration: 150 });
      headerTranslateY.value = withSpring(-15, SALES_SPRING.gentle);
      cancelOpacity.value = withTiming(1, { duration: 180 });
    } else {
      headerHeight.value = withSpring(76, SALES_SPRING.gentle);
      headerOpacity.value = withTiming(1, { duration: 200 });
      headerTranslateY.value = withSpring(0, SALES_SPRING.gentle);
      cancelOpacity.value = withTiming(0, { duration: 120 });
    }
  };

  const handleCancel = () => {
    setQuery('');
    setSelectedFilter('all');
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  React.useEffect(() => {
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      inputRef.current?.blur();
      animateFocus(false);
    });
    const hideSubAndroid = Keyboard.addListener('keyboardDidHide', () => {
      if (Platform.OS === 'android') {
        inputRef.current?.blur();
        animateFocus(false);
      }
    });

    return () => {
      hideSub.remove();
      hideSubAndroid.remove();
    };
  }, []);

  const headerAnimStyle = useAnimatedStyle(() => ({
    height: headerHeight.value,
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
    overflow: 'hidden',
  }));

  const cancelAnimStyle = useAnimatedStyle(() => ({
    opacity: cancelOpacity.value,
  }));

  const isDebouncing = query.trim() !== debouncedQuery.trim() && query.trim().length > 0;

  const renderContent = () => {
    if (query.trim() === '') {
      return (
        <EmptyState
          onSelectTag={(text, filterId) => {
            if (filterId) {
              setSelectedFilter(filterId);
            } else {
              setSelectedFilter('all');
            }
            if (text) {
              setQuery(text);
            }
            inputRef.current?.focus();
            animateFocus(true);
          }}
        />
      );
    }

    if (isDebouncing) {
      return (
        <View style={{ flex: 1 }}>
          <FilterBar selectedFilter={selectedFilter} onSelectFilter={setSelectedFilter} />
          <Animated.View entering={FadeIn.duration(200)} style={styles.listContainer}>
            <View style={styles.listContent}>
              {Array.from({ length: 4 }).map((_, idx) => (
                <SearchResultSkeleton key={idx} />
              ))}
            </View>
          </Animated.View>
        </View>
      );
    }

    if (results.length === 0) {
      return (
        <View style={{ flex: 1 }}>
          <FilterBar selectedFilter={selectedFilter} onSelectFilter={setSelectedFilter} />
          <NoResultsState query={query} onClear={handleCancel} />
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <FilterBar selectedFilter={selectedFilter} onSelectFilter={setSelectedFilter} />
        <Animated.FlatList
          data={results}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          itemLayoutAnimation={Layout.springify()}
          renderItem={renderItem}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: SALES_GLASS.bg }]}
      enabled={false}
    >
      {/* Background Ambience */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.bgWash, { top: -100, left: -50, backgroundColor: SALES_GLASS.mutedLight }]} />
        <View style={[styles.bgWash, { bottom: -80, right: -40, backgroundColor: SALES_GLASS.glow }]} />
      </View>

      {/* Sticky Header and Search Input Row */}
      <View style={[styles.stickyHeader, { borderBottomColor: SALES_GLASS.border }]}>
        <Animated.View style={[styles.headerArea, headerAnimStyle]}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: SALES_GLASS.fgSecondary }]} numberOfLines={1}>
            {t('inventory.header')}
          </AppText>
          <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: SALES_GLASS.fg }]} numberOfLines={1}>
            {t('sale.global_retrieval')}
          </AppText>
        </Animated.View>

        <View style={styles.searchRow}>
          <Animated.View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: isFocused ? colors.primary : SALES_GLASS.border }]}>
            <Search size={18} color={isFocused ? colors.primary : SALES_GLASS.fgSecondary} />
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: SALES_GLASS.fg }]}
              placeholder={t('common.search_placeholder') || "Search assets..."}
              placeholderTextColor={SALES_GLASS.fgSecondary}
              value={query}
              onChangeText={setQuery}
              onFocus={() => animateFocus(true)}
              selectionColor={colors.primary}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn} activeOpacity={0.6}>
                <X size={16} color={SALES_GLASS.fgSecondary} />
              </TouchableOpacity>
            )}
          </Animated.View>

          <Animated.View style={[cancelAnimStyle, { overflow: 'hidden', justifyContent: 'center' }]}>
            <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn} activeOpacity={0.6}>
              <AppText variant="body" weight="bold" color={colors.primary} numberOfLines={1} style={{ width: 60 }}>
                {t('search.cancel')}
              </AppText>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* Dynamic Results & States Content */}
      <View style={{ flex: 1 }}>
        {renderContent()}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgWash: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  stickyHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerArea: {
    marginTop: 12,
  },
  headerLabel: {
    fontFamily: Fonts.semibold,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    alignItems: 'center',
    borderWidth: 1,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontFamily: Fonts.medium,
    fontSize: 15,
    paddingVertical: 8,
  },
  clearBtn: {
    padding: 6,
  },
  cancelBtn: {
    paddingLeft: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  filterBarContainer: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  resultCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconNode: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  trendBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  infoArea: {
    flex: 1,
    marginLeft: 14,
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
  unitLabel: {
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  emptyRoot: {
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 40,
  },
  emptyHeaderCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsSection: {
    marginTop: 24,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  noResultsRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  noResultsIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  resetBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
});

export default SearchScreen;
