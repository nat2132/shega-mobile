import React, { useCallback, useState } from 'react';
import { Fonts } from '@/constants/theme';
import {
  User,
  Check,
  ChevronLeft,
  ArrowUpRight,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Calendar,
  AlertTriangle,
} from 'lucide-react-native';
import {
  FlatList,
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert
} from 'react-native';
import { useSettings } from '@/context/SettingsContext';
import { getDebtCustomers, getDebtSales, processDebtPayment, markDebtAsLoss } from '@/database/db';
import { AppText, AppListItem, AppRow, AppCard, AppButton } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
const { width } = Dimensions.get('window');

const DebtDetailView = ({ customer, onBack }: { customer: any, onBack: () => void }) => {
  const { colors, t } = useSettings();
  const [debtSales, setDebtSales] = useState<any[]>([]);

  React.useEffect(() => {
    const sales = getDebtSales(customer.customerName);
    setDebtSales(sales);
  }, [customer]);

  return (
    <View style={[styles.detailContainer, { backgroundColor: colors.background }]}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtnCircle}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {t('dash.intelligence')}
          </AppText>
          <AppText variant="heading-lg" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>
            {t('dash.settlement_bp')}
          </AppText>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)}>
          {/* Main Card */}
          <View style={[styles.blueprintCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.blueprintHeader}>
              <View style={[styles.userIconBox, { backgroundColor: colors.text + '08' }]}>
                <User size={28} color={colors.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <AppText variant="title" weight="bold" style={[styles.blueprintName, { color: colors.text }]} numberOfLines={2}>
                  {customer.customerName}
                </AppText>
                <AppText variant="body-sm" weight="medium" style={[styles.blueprintPhone, { color: colors.textSecondary }]} numberOfLines={1}>
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

            <View style={[styles.blueprintDivider, { backgroundColor: colors.border }]} />

            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.listHeader, { color: colors.textSecondary }]} numberOfLines={1}>
              {t('dash.trans_history')}
            </AppText>
            {debtSales.map((sale, idx) => (
              <AppRow
                key={idx}
                label={`${sale.itemName} × ${sale.quantity}`}
                value={`${sale.totalPrice.toLocaleString()} ${t('common.etb')}`}
                valueVariant="body"
                valueWeight="bold"
                valueMaxLines={1}
                labelMaxLines={2}
                style={{ marginBottom: Spacing.sm }}
              >
                <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, width: '100%' }} numberOfLines={1}>
                  {new Date(sale.createdAt).toLocaleDateString()}
                </AppText>
              </AppRow>
            ))}

            <View style={[styles.blueprintDivider, { backgroundColor: colors.border }]} />

            <View style={styles.blueprintFooter}>
              <View>
                <AppText variant="caption" weight="medium" style={[styles.totalLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t('dash.outstanding_balance')}
                </AppText>
                <AppText variant="display" weight="extrabold" shrink={false} style={[styles.totalValue, { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {customer.oweAmount.toLocaleString()} {t('common.etb')}
                </AppText>
              </View>
            </View>
          </View>

          {/* Stats Cluster */}
          <View style={styles.statsCluster}>
            <AppCard padding={Spacing.md} background={colors.card} bordered style={{ flex: 1, borderColor: colors.border, borderRadius: BorderRadius.lg }}>
              <AppText variant="micro" weight="medium" style={[styles.statNodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {t('dash.history')}
              </AppText>
              <AppText variant="title-sm" weight="bold" style={[styles.statNodeValue, { color: colors.text }]} numberOfLines={2}>
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {t('dash.financial_health')}
            </AppText>
            <AppText variant="heading-lg" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>
              {t('dash.liability_ledger')}
            </AppText>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.success + '10' }]}>
              <ShieldCheck size={40} color={colors.success} />
            </View>
            <AppText variant="title" weight="bold" style={[styles.emptyTitle, { color: colors.text }]} numberOfLines={2}>
              {t('dash.liability_free')}
            </AppText>
            <AppText variant="body" weight="medium" style={[styles.emptySub, { color: colors.textSecondary }]} numberOfLines={3}>
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
  const isOverdue = React.useMemo(
    () => new Date() > new Date(new Date(item.lastBorrowed).getTime() + 30 * 24 * 60 * 60 * 1000),
    [item.lastBorrowed],
  );
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(500)}>
      <AppListItem
        left={
          <View style={[styles.iconNode, { backgroundColor: colors.text + '05' }]}>
            <User size={22} color={colors.text} />
          </View>
        }
        title={item.customerName}
        subtitle={t('dash.records_count', { count: item.totalDebts.toString() })}
        titleMaxLines={2}
        subtitleMaxLines={1}
        right={
          <View style={styles.statArea}>
            <AppText variant="title-sm" weight="bold" shrink={false} style={[styles.debtPrice, { color: colors.primary }]} numberOfLines={1}>
              {item.oweAmount.toLocaleString()} {t('common.etb')}
            </AppText>
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
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: BorderRadius.lg,
          marginBottom: Spacing.md,
        }}
      />
    </Animated.View>
  );
});
DebtCustomerRow.displayName = 'DebtCustomerRow';

const styles = StyleSheet.create({
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
  backBtnCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flex: 1, paddingHorizontal: 25 },
  blueprintCard: { borderRadius: 30, borderWidth: 1, padding: 22, marginBottom: 20 },
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