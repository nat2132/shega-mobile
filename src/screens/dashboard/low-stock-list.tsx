import React, { useCallback, useMemo } from 'react';
import { Fonts } from '@/constants/theme';
import {
  Package,
  Zap,
  ArrowDownRight,
} from 'lucide-react-native';
import {
  FlatList,
  StyleSheet,
  View,
} from 'react-native';
import { useSettings } from '@/context/SettingsContext';
import { getLowStockItems, ItemData } from '@/database/db';
import { AppNumber, AppText, AppListItem } from '@/components/ui';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getDashGlass } from './glass-dashboard';
import { useTutorial, TutorialTarget, TutorialButton } from '@/tutorials';
import { lowStockListTutorial } from '@/tutorials/definitions';
const LowStockRow = React.memo(({
  item,
  index,
}: {
  item: ItemData;
  index: number;
}) => {
  const { colors, t } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const isOut = item.totalBaseQuantity <= 0;
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(500)}
    >
      <View
        style={[styles.nodeCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
      >
        <AppListItem
          left={
            <View style={[styles.iconNode, { backgroundColor: isOut ? colors.primary + '15' : G.fg + '05' }]}>
              <Package size={22} color={isOut ? colors.primary : G.fg} />
              <View style={[styles.alertDot, { backgroundColor: isOut ? colors.primary : colors.warning }]} />
            </View>
          }
          title={item.name}
          subtitle={item.companyName || t('dash.general_source')}
          titleMaxLines={2}
          subtitleMaxLines={1}
          right={
            <View style={styles.statArea}>
              <View style={styles.qtyRow}>
                <ArrowDownRight size={14} color={isOut ? colors.primary : colors.warning} />
                <AppNumber value={item.totalBaseQuantity} size="body" color={G.fg} numberOfLines={1} />
                <AppText variant="caption" weight="medium" shrink={false} style={[styles.unitText, { color: G.fgSecondary }]} numberOfLines={1}>{item.baseUnit || 'pcs'}</AppText>
              </View>
              <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.statusLabel, { color: isOut ? colors.primary : colors.warning }]} numberOfLines={1}>
                {isOut ? t('dash.depleted') : t('dash.critical')}
              </AppText>
            </View>
          }
          noBorder
          padding={18}
        />
      </View>
    </Animated.View>
  );
});
LowStockRow.displayName = 'LowStockRow';

const LowStockItemsScreen = () => {
  const { colors, t } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const tutorial = useTutorial({ tutorial: lowStockListTutorial });
  const [data, setData] = React.useState<ItemData[]>([]);

  const loadData = async () => {
    const items = await getLowStockItems() as ItemData[];
    setData(items);
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const renderItem = useCallback(({ item, index }: { item: ItemData; index: number }) => (
    <LowStockRow item={item} index={index} />
  ), []);

  const keyExtractor = useCallback((item: ItemData) => String(item.id), []);

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={{ position: 'absolute', top: -80, left: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: G.mutedLight, opacity: 0.3 }} />
      <View style={{ position: 'absolute', bottom: -50, right: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: G.mutedLight, opacity: 0.2 }} />
      <TutorialTarget id="lsl-list">
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <TutorialTarget id="lsl-header">
          <View style={styles.headerRowContainer}>
            <View style={styles.headerNode}>
               <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: G.fgSecondary }]} numberOfLines={1}>{t('dash.inventory_health')}</AppText>
               <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{t('dash.deficit_intel')}</AppText>
            </View>
            <TutorialButton tutorialId="low-stock-list" screenName={t('screen.low_stock_items')} />
          </View>
          </TutorialTarget>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.success + '10' }]}>
               <Zap size={40} color={colors.success} />
            </View>
            <AppText variant="title" weight="bold" style={[styles.emptyTitle, { color: G.fg }]} numberOfLines={2}>{t('dash.optimal_stock')}</AppText>
            <AppText variant="body" weight="medium" style={[styles.emptySub, { color: G.fgSecondary }]} numberOfLines={3}>{t('dash.all_assets_meet')}</AppText>
          </View>
        }
      />
      </TutorialTarget>
    </View>
  );
};

const createStyles = (G: any) => StyleSheet.create({
  container: { flex: 1 },
  listContainer: { paddingHorizontal: 25, paddingBottom: 40, paddingTop: 20 },
  headerRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  headerNode: {
    flex: 1,
  },
  headerSub: {
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
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
    borderColor: G.fg,
  },
  infoArea: {
    flex: 1,
    marginLeft: 16,
  },
  itemName: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  itemSub: {
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
    fontFamily: Fonts.bold,
  },
  unitText: {
    fontFamily: Fonts.medium,
  },
  statusLabel: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
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
    fontFamily: Fonts.bold,
  },
  emptySub: {
    fontFamily: Fonts.medium,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default LowStockItemsScreen;