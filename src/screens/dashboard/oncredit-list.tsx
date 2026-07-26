import React, { useCallback, useMemo, useState } from 'react';
import { Fonts , BorderRadius, Spacing } from '@/constants/theme';
import {
  Building2,
  ShieldAlert,
  ShieldCheck,
  CreditCard,
} from 'lucide-react-native';
import {
  FlatList,
  StyleSheet,
  View,
} from 'react-native';
import { useSettings } from '@/context/SettingsContext';
import { getOnCreditItems, ItemData } from '@/database/db';
import { AppNumber, AppText, AppListItem, AppCard} from '@/components/ui';

import Animated, { FadeInDown } from 'react-native-reanimated';
import { getDashGlass } from './glass-dashboard';
import { useTutorial, TutorialTarget, TutorialButton } from '@/tutorials';
import { oncreditListTutorial } from '@/tutorials/definitions';
const OnCreditRow = React.memo(({
  item,
  index,
}: {
  item: ItemData;
  index: number;
}) => {
  const { colors, t } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const creditAmount = React.useMemo(() => {
    if (item.packPurchasePrice && item.totalPackQuantity) {
      return item.packPurchasePrice * item.totalPackQuantity;
    }
    if (item.basePurchasePrice && item.totalBaseQuantity) {
      return item.basePurchasePrice * item.totalBaseQuantity;
    }
    return item.packPurchasePrice || item.basePurchasePrice || 0;
  }, [item]);

  return (
    <Animated.View key={index} entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(500)}>
      <AppCard
        padding={Spacing.md}
        gap={Spacing.md}
        background={G.bgCard}
        bordered
        style={{
          borderColor: G.border,
          borderRadius: BorderRadius.lg,
          marginBottom: Spacing.md,
          overflow: 'hidden',
        }}
      >
        <AppListItem
          left={
            <View style={[styles.iconNode, { backgroundColor: G.fg + '05' }]}>
              <Building2 size={22} color={G.fg} />
            </View>
          }
          title={item.name}
          subtitle={item.companyName || t('dash.general_source')}
          titleMaxLines={2}
          subtitleMaxLines={1}
          right={
            <View style={styles.statArea}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <AppNumber value={item.totalBaseQuantity} size="title-sm" color={G.fg} numberOfLines={1} />
                <AppText variant="caption" weight="medium" style={styles.unitSmall}>{item.baseUnit || 'pcs'}</AppText>
              </View>
              <View style={[styles.statusBadgeSmall, { backgroundColor: colors.primary + '15' }]}>
                <ShieldAlert size={10} color={colors.primary} />
                <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.statusBadgeText, { color: colors.primary }]} numberOfLines={1}>
                  {t('dash.on_credit')}
                </AppText>
              </View>
            </View>
          }
          noBorder
          padding={0}
        />
        <View style={[styles.creditFooter, { borderTopColor: G.border }]}>
          <View style={styles.creditRow}>
            <CreditCard size={14} color={G.fgSecondary} />
            <AppText variant="caption" weight="medium" style={[styles.creditLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('dash.total_credit')}</AppText>
            <AppNumber value={creditAmount} size="body" showCurrency color={colors.error} numberOfLines={1} />
          </View>
        </View>
      </AppCard>
    </Animated.View>
  );
});
OnCreditRow.displayName = 'OnCreditRow';

const OnCreditItemsScreen = () => {
  const { colors, t } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const tutorial = useTutorial({ tutorial: oncreditListTutorial });
  const [items, setItems] = useState<ItemData[]>([]);

  const loadData = async () => {
    const data = await getOnCreditItems() as ItemData[];
    setItems(data);
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const renderItem = useCallback(({ item, index }: { item: ItemData; index: number }) => (
    <OnCreditRow item={item} index={index} />
  ), []);

  const keyExtractor = useCallback((item: ItemData, index: number) => `oc-${item.id}-${index}`, []);

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={{ position: 'absolute', top: -80, left: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: G.mutedLight, opacity: 0.3 }} />
      <View style={{ position: 'absolute', bottom: -50, right: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: G.mutedLight, opacity: 0.2 }} />
      <TutorialTarget id="ocl-list">
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <TutorialTarget id="ocl-header">
          <View style={styles.headerNode}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: G.fgSecondary }]} numberOfLines={1}>
              {t('dash.supply_intel')}
            </AppText>
            <AppText variant="heading-lg" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>
              {t('dash.credit_inventory')}
            </AppText>
            <TutorialButton tutorialId="oncredit-list" screenName={t('screen.on_credit_list')} />
          </View>
          </TutorialTarget>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.success + '10' }]}>
              <ShieldCheck size={40} color={colors.success} />
            </View>
            <AppText variant="title" weight="bold" style={[styles.emptyTitle, { color: G.fg }]} numberOfLines={2}>
              {t('dash.zero_credit')}
            </AppText>
            <AppText variant="body" weight="medium" style={[styles.emptySub, { color: G.fgSecondary }]} numberOfLines={3}>
              {t('dash.all_assets_settled')}
            </AppText>
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
  headerNode: { marginBottom: 25 },
  headerSub: { fontSize: 11, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { fontSize: 24, fontFamily: Fonts.bold },
  nodeCard: { borderRadius: 24, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  iconNode: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  infoArea: { flex: 1, marginLeft: 16 },
  itemName: { fontSize: 17, fontFamily: Fonts.bold, marginBottom: 2 },
  itemSub: { fontSize: 13, fontFamily: Fonts.medium },
  statArea: { alignItems: 'flex-end' },
  qtyText: { fontSize: 16, fontFamily: Fonts.bold },
  unitSmall: { fontSize: 11, opacity: 0.6 },
  statusBadgeSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4, gap: 4 },
  statusBadgeText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  creditFooter: { borderTopWidth: 1, paddingHorizontal: 18, paddingVertical: 12 },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  creditLabel: { flex: 1, fontSize: 12, fontFamily: Fonts.medium },
  creditAmount: { fontSize: 15, fontFamily: Fonts.bold },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontFamily: Fonts.bold },
  emptySub: { fontSize: 14, fontFamily: Fonts.medium, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
});

export default OnCreditItemsScreen;