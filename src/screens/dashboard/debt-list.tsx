import React, { useCallback, useMemo, useState } from 'react';
import { Fonts , BorderRadius, Spacing } from '@/constants/theme';
import {
  User,
  ChevronLeft,
  AlertCircle,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react-native';
import {
  FlatList,
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,} from 'react-native';
import { useSettings } from '@/context/SettingsContext';
import { getDebtCustomers, getDebtSales} from '@/database/db';
import { AppNumber, AppText, AppListItem, AppCard} from '@/components/ui';

import Animated, { FadeInDown } from 'react-native-reanimated';
import { getDashGlass } from './glass-dashboard';

const DebtDetailView = ({ customer, onBack }: { customer: any, onBack: () => void }) => {
  const { colors, t } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const [debtSales, setDebtSales] = useState<any[]>([]);

  React.useEffect(() => {
    const sales = getDebtSales(customer.customerName);
    setDebtSales(sales);
  }, [customer]);

  return (
    <View style={[styles.detailContainer, { backgroundColor: G.bg }]}>
      <View style={{ position: 'absolute', top: -60, left: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: G.mutedLight, opacity: 0.25 }} />
      <View style={{ position: 'absolute', bottom: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: G.mutedLight, opacity: 0.15 }} />
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtnCircle}>
          <ChevronLeft size={24} color={G.fg} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: G.fgSecondary }]} numberOfLines={1}>
            {t('dash.intelligence')}
          </AppText>
          <AppText variant="heading-lg" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>
            {t('dash.settlement_bp')}
          </AppText>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)}>
          {/* Main Card */}
          <View style={[styles.blueprintCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.blueprintHeader}>
              <View style={[styles.userIconBox, { backgroundColor: G.fg + '08' }]}>
                <User size={28} color={G.fg} />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <AppText variant="title" weight="bold" style={[styles.blueprintName, { color: G.fg }]} numberOfLines={2}>
                  {customer.customerName}
                </AppText>
                <AppText variant="body-sm" weight="medium" style={[styles.blueprintPhone, { color: G.fgSecondary }]} numberOfLines={1}>
                  {t('dash.customer_id', { id: customer.customerPhone || t('dash.unregistered') })}
                </AppText>
              </View>
              <View style={[styles.statusNode, { backgroundColor: colors.primary + '15' }]}>
                <AlertCircle size={14} color={colors.primary} />
                <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.statusNodeText, { color: colors.primary }]} numberOfLines={1}>
                  {t('dash.active_debt')}
                </AppText>
              </View>
            </View>

            <View style={[styles.blueprintDivider, { backgroundColor: G.border }]} />

            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.listHeader, { color: G.fgSecondary }]} numberOfLines={1}>
              {t('dash.trans_history')}
            </AppText>
            {debtSales.map((sale, idx) => (
              <View
                key={idx}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: Spacing.sm,
                }}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={2}>
                    {`${sale.itemName} × ${sale.quantity}`}
                  </AppText>
                  <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>
                    {new Date(sale.createdAt).toLocaleDateString()}
                  </AppText>
                </View>
                <AppNumber value={sale.totalPrice} size="body" prefix="ETB " numberOfLines={1} />
              </View>
            ))}

            <View style={[styles.blueprintDivider, { backgroundColor: G.border }]} />

            <View style={styles.blueprintFooter}>
              <View>
                <AppText variant="caption" weight="medium" style={[styles.totalLabel, { color: G.fgSecondary }]} numberOfLines={1}>
                  {t('dash.outstanding_balance')}
                </AppText>
                <AppNumber value={customer.oweAmount} size="heading-lg" prefix="ETB " color={colors.primary} numberOfLines={1} />
              </View>
            </View>
          </View>

          {/* Stats Cluster */}
          <View style={styles.statsCluster}>
            <AppCard padding={Spacing.md} background={G.bgCard} bordered style={{ flex: 1, borderColor: G.border, borderRadius: BorderRadius.lg }}>
              <AppText variant="micro" weight="medium" style={[styles.statNodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>
                {t('dash.history')}
              </AppText>
              <AppText variant="title-sm" weight="bold" style={[styles.statNodeValue, { color: G.fg }]} numberOfLines={2}>
                {t('dash.records_count', { count: String(customer.totalDebts) })}
              </AppText>
            </AppCard>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const OnCreditCustomersScreen = () => {
  const { colors, t } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);

  React.useEffect(() => {
    const loadData = async () => {
      const data = await getDebtCustomers();
      setCustomers(data);
    };
    loadData();
  }, []);

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <DebtCustomerRow
      item={item}
      index={index}
      onPress={setSelectedCustomer}
    />
  ), []);

  const keyExtractor = useCallback((item: any) => `${item.customerName}-${item.customerPhone || ''}`, []);

  if (selectedCustomer) {
    return <DebtDetailView customer={selectedCustomer} onBack={() => setSelectedCustomer(null)} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={{ position: 'absolute', top: -80, left: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: G.mutedLight, opacity: 0.3 }} />
      <View style={{ position: 'absolute', bottom: -50, right: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: G.mutedLight, opacity: 0.2 }} />
      <FlatList
        data={customers}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <View style={styles.headerNode}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: G.fgSecondary }]} numberOfLines={1}>
              {t('dash.financial_health')}
            </AppText>
            <AppText variant="heading-lg" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>
              {t('dash.liability_ledger')}
            </AppText>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.success + '10' }]}>
              <ShieldCheck size={40} color={colors.success} />
            </View>
            <AppText variant="title" weight="bold" style={[styles.emptyTitle, { color: G.fg }]} numberOfLines={2}>
              {t('dash.liability_free')}
            </AppText>
            <AppText variant="body" weight="medium" style={[styles.emptySub, { color: G.fgSecondary }]} numberOfLines={3}>
              {t('dash.no_credit_detected')}
            </AppText>
          </View>
        }
      />
    </View>
  );
};

const DebtCustomerRow = React.memo(({
  item,
  index,
  onPress,
}: {
  item: any;
  index: number;
  onPress: (i: any) => void;
}) => {
  const { colors, t } = useSettings();
  const G = getDashGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const isOverdue = React.useMemo(
    () => new Date() > new Date(new Date(item.lastBorrowed).getTime() + 30 * 24 * 60 * 60 * 1000),
    [item.lastBorrowed],
  );
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(500)}>
      <AppListItem
        left={
          <View style={[styles.iconNode, { backgroundColor: G.fg + '05' }]}>
            <User size={22} color={G.fg} />
          </View>
        }
        title={item.customerName}
        subtitle={t('dash.records_count', { count: item.totalDebts.toString() })}
        titleMaxLines={2}
        subtitleMaxLines={1}
        right={
          <View style={styles.statArea}>
            <AppNumber value={item.oweAmount} size="title-sm" prefix="ETB " color={colors.primary} numberOfLines={1} />
            {isOverdue ? (
              <View style={[styles.overdueBadge, { backgroundColor: colors.error + '15' }]}>
                <AlertTriangle size={10} color={colors.error} />
                <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.overdueText, { color: colors.error }]} numberOfLines={1}>
                  {t('dash.overdue')}
                </AppText>
              </View>
            ) : (
              <View style={[styles.statusBadgeSmall, { backgroundColor: colors.primary + '15' }]}>
                <AlertCircle size={10} color={colors.primary} />
                <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.statusBadgeText, { color: colors.primary }]} numberOfLines={1}>
                  {t('dash.pending')}
                </AppText>
              </View>
            )}
          </View>
        }
        onPress={() => onPress(item)}
        padding={Spacing.md}
        style={{
          backgroundColor: G.bgCard,
          borderColor: G.border,
          borderWidth: 1,
          borderRadius: BorderRadius.lg,
          marginBottom: Spacing.md,
          overflow: 'hidden',
        }}
      />
    </Animated.View>
  );
});
DebtCustomerRow.displayName = 'DebtCustomerRow';

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
  debtPrice: { fontSize: 16, fontFamily: Fonts.bold },
  statusBadgeSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4, gap: 4 },
  statusBadgeText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontFamily: Fonts.bold },
  emptySub: { fontSize: 14, fontFamily: Fonts.medium, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 60, paddingBottom: 20, gap: 16 },
  backBtnCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: G.bgCard, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flex: 1, paddingHorizontal: 25 },
  blueprintCard: { borderRadius: 30, borderWidth: 1, padding: 22, marginBottom: 20, overflow: 'hidden' },
  blueprintHeader: { flexDirection: 'row', alignItems: 'center' },
  userIconBox: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  blueprintName: { fontSize: 20, fontFamily: Fonts.bold },
  blueprintPhone: { fontSize: 13, fontFamily: Fonts.medium, marginTop: 2 },
  statusNode: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, gap: 4 },
  statusNodeText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  blueprintDivider: { height: 1, marginVertical: 20 },
  listHeader: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1, marginBottom: 15 },
  blueprintRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowItemLabel: { fontSize: 15, fontFamily: Fonts.medium },
  rowItemValue: { fontSize: 15, fontFamily: Fonts.bold },
  blueprintFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  totalLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: 4 },
  totalValue: { fontSize: 26, fontFamily: Fonts.bold },
  statsCluster: { flexDirection: 'row', gap: 12, marginBottom: 40 },
  statNode: { flex: 1, borderRadius: 20, borderWidth: 1, padding: 18 },
  statNodeLabel: { fontSize: 11, fontFamily: Fonts.medium, marginBottom: 4 },
  statNodeValue: { fontSize: 16, fontFamily: Fonts.bold },
  saleMeta: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 2, opacity: 0.7 },
  overdueBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 5 },
  overdueText: { fontSize: 9, fontFamily: Fonts.bold, textTransform: 'uppercase' },
});

export default OnCreditCustomersScreen;