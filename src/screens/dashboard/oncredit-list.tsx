import React, { useState } from 'react';
import { Fonts } from '@/constants/theme';
import { 
  Building2, 
  MapPin,
  Clock,
  Phone,
  Check, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpRight,
  ShieldAlert,
  BarChart3,
  AlertTriangle,
  Calendar,
  ShieldCheck
} from 'lucide-react-native';
import {
  StyleSheet,
  Text as RNText,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert
} from 'react-native';
import { useSettings } from '@/context/SettingsContext';
import { getOnCreditItems, ItemData, settleItemCredit } from '@/database/db';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const CreditItemDetail = ({ item, onBack }: { item: ItemData, onBack: () => void }) => {
  const { colors, theme, t } = useSettings();
  
  return (
    <View style={[styles.detailContainer, { backgroundColor: colors.background }]}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtnCircle}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <RNText style={[styles.headerSub, { color: colors.textSecondary }]}>{t('dash.sourcing')}</RNText>
          <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('dash.asset_origin')}</RNText>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)}>
          {/* Main Blueprint Card */}
          <View style={[styles.blueprintCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.blueprintHeader}>
              <View style={[styles.iconBox, { backgroundColor: colors.text + '08' }]}>
                <Building2 size={28} color={colors.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <RNText style={[styles.blueprintName, { color: colors.text }]}>{item.name}</RNText>
                <RNText style={[styles.blueprintPhone, { color: colors.textSecondary }]}>
                  {t('dash.asset_origin')}: {item.companyName || t('dash.unregistered_source')}
                </RNText>
              </View>
              <View style={[styles.statusNode, { backgroundColor: colors.primary + '15' }]}>
                 <ShieldAlert size={14} color={colors.primary} />
                 <RNText style={[styles.statusNodeText, { color: colors.primary }]}>{t('dash.on_credit')}</RNText>
              </View>
            </View>

            <View style={[styles.blueprintDivider, { backgroundColor: colors.border }]} />

            <RNText style={[styles.listHeader, { color: colors.textSecondary }]}>{t('dash.purchase_arch')}</RNText>
            
            <View style={styles.blueprintRow}>
               <View style={styles.rowLeft}>
                  <MapPin size={14} color={colors.textSecondary} />
                  <RNText style={[styles.rowItemLabel, { color: colors.textSecondary }]}>{t('dash.purchase_unit')}</RNText>
               </View>
               <RNText style={[styles.rowItemValue, { color: colors.text }]}>{item.purchaseUnit}</RNText>
            </View>

            <View style={styles.blueprintRow}>
               <View style={styles.rowLeft}>
                  <BarChart3 size={14} color={colors.textSecondary} />
                  <RNText style={[styles.rowItemLabel, { color: colors.textSecondary }]}>{t('dash.pack_purchase_price')}</RNText>
               </View>
               <RNText style={[styles.rowItemValue, { color: colors.text }]}>{item.packPurchasePrice.toLocaleString()} ETB</RNText>
            </View>

            <View style={styles.blueprintRow}>
               <View style={styles.rowLeft}>
                  <Clock size={14} color={colors.textSecondary} />
                  <RNText style={[styles.rowItemLabel, { color: colors.textSecondary }]}>{t('dash.base_purchase_price')}</RNText>
               </View>
               <RNText style={[styles.rowItemValue, { color: colors.text }]}>{item.basePurchasePrice.toLocaleString()} ETB</RNText>
            </View>

            <View style={[styles.blueprintDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity 
              style={[styles.settleActionBtn, { backgroundColor: colors.success }]}
              onPress={async () => {
                Alert.alert(
                  t('dash.mark_as_paid'),
                  t('dash.settle_confirm') || 'Confirm that you have paid the supplier for this item?',
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    { 
                      text: t('common.confirm'), 
                      onPress: async () => {
                        const success = await settleItemCredit(item.id);
                        if (success) {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          onBack();
                        }
                      }
                    }
                  ]
                );
              }}
            >
              <ShieldCheck size={20} color="#FFF" />
              <RNText style={[styles.settleActionText, { color: '#FFF' }]}>{t('dash.mark_as_paid')}</RNText>
            </TouchableOpacity>

            <View style={styles.blueprintFooter}>
              <View>
                <RNText style={[styles.totalLabel, { color: colors.textSecondary }]}>{t('dash.supplier_interface')}</RNText>
                <RNText style={[styles.totalValue, { color: colors.text }]}>
                   {item.supplierPhone || 'N/A'}
                </RNText>
              </View>
              <TouchableOpacity 
                style={[styles.contactBtn, { backgroundColor: colors.text }]} 
              >
                <Phone size={18} color={colors.background} />
                <RNText style={[styles.contactBtnText, { color: colors.background }]}>{t('dash.call')}</RNText>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const OnCreditItemsScreen = () => {
  const { colors, t } = useSettings();
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
  const [items, setItems] = useState<ItemData[]>([]);

  const loadData = async () => {
    const data = await getOnCreditItems();
    setItems(data);
  };

  React.useEffect(() => {
    loadData();
  }, []);

  if (selectedItem) {
    return <CreditItemDetail item={selectedItem} onBack={() => setSelectedItem(null)} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerNode}>
           <RNText style={[styles.headerSub, { color: colors.textSecondary }]}>{t('dash.supply_intel')}</RNText>
           <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('dash.credit_inventory')}</RNText>
        </View>

        {items.map((item, idx) => (
          <Animated.View key={idx} entering={FadeInDown.delay(idx * 50).duration(500)}>
            <TouchableOpacity 
              style={[styles.nodeCard, { backgroundColor: colors.card, borderColor: colors.border }]} 
              activeOpacity={0.7} 
              onPress={() => setSelectedItem(item)}
            >
              <View style={styles.cardMain}>
                <View style={[styles.iconNode, { backgroundColor: colors.text + '05' }]}>
                  <Building2 size={22} color={colors.text} />
                </View>
                <View style={styles.infoArea}>
                  <RNText style={[styles.itemName, { color: colors.text }]}>{item.name}</RNText>
                  <RNText style={[styles.itemSub, { color: colors.textSecondary }]}>
                    {item.companyName || t('dash.general_source')}
                  </RNText>
                </View>
                <View style={styles.statArea}>
                   <RNText style={[styles.qtyText, { color: colors.text }]}>
                     {item.totalBaseQuantity} <RNText style={styles.unitSmall}>{t('form.' + (item.baseUnit || 'pieces').toLowerCase())}</RNText>
                   </RNText>
                   {new Date() > new Date(new Date(item.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000) ? (
                     <View style={[styles.overdueBadgeSmall, { backgroundColor: colors.error + '15' }]}>
                        <AlertTriangle size={10} color={colors.error} />
                        <RNText style={[styles.overdueBadgeText, { color: colors.error }]}>{t('dash.overdue')}</RNText>
                     </View>
                   ) : (
                     <View style={[styles.statusBadgeSmall, { backgroundColor: colors.primary + '15' }]}>
                        <ShieldAlert size={10} color={colors.primary} />
                        <RNText style={[styles.statusBadgeText, { color: colors.primary }]}>{t('dash.on_credit')}</RNText>
                     </View>
                   )}
                </View>
              </View>

              <View style={[styles.cardFooter, { backgroundColor: colors.text + '03' }]}>
                 <RNText style={[styles.footerText, { color: colors.textSecondary }]}>
                   Asset originated via partial credit orchestration
                 </RNText>
                 <ChevronRight size={16} color={colors.border} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}

        {items.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.success + '10' }]}>
               <Check size={40} color={colors.success} />
            </View>
            <RNText style={[styles.emptyTitle, { color: colors.text }]}>{t('dash.zero_credit')}</RNText>
            <RNText style={[styles.emptySub, { color: colors.textSecondary }]}>{t('dash.all_assets_settled')}</RNText>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

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
  qtyText: { fontSize: 16, fontFamily: Fonts.bold },
  unitSmall: { fontSize: 11, opacity: 0.6 },
  statusBadgeSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4, gap: 4 },
  statusBadgeText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  footerText: { fontSize: 11, fontFamily: Fonts.medium, fontStyle: 'italic' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontFamily: Fonts.bold },
  emptySub: { fontSize: 14, fontFamily: Fonts.medium, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },

  // Detail View
  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 60, paddingBottom: 20, gap: 16 },
  backBtnCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flex: 1, paddingHorizontal: 25 },
  blueprintCard: { borderRadius: 30, borderWidth: 1, padding: 22, marginBottom: 20 },
  blueprintHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  blueprintName: { fontSize: 20, fontFamily: Fonts.bold },
  blueprintPhone: { fontSize: 13, fontFamily: Fonts.medium, marginTop: 2 },
  statusNode: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, gap: 4 },
  statusNodeText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  blueprintDivider: { height: 1, marginVertical: 20 },
  listHeader: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1, marginBottom: 15 },
  blueprintRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowItemLabel: { fontSize: 14, fontFamily: Fonts.medium },
  rowItemValue: { fontSize: 15, fontFamily: Fonts.bold },
  blueprintFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  totalLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: 4 },
  totalValue: { fontSize: 22, fontFamily: Fonts.bold },
  contactBtn: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, gap: 8, alignItems: 'center' },
  contactBtnText: { fontSize: 14, fontFamily: Fonts.bold },

  // New Styles
  settleActionBtn: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20
  },
  settleActionText: { fontSize: 15, fontFamily: Fonts.bold },
  overdueBadgeSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4, gap: 4 },
  overdueBadgeText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
});

export default OnCreditItemsScreen;