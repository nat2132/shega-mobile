import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Dimensions,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  FadeIn,
  ZoomIn,
  Layout
} from 'react-native-reanimated';
import {
  Edit2,
  Check,
  X,
  Package,
  TrendingUp,
  DollarSign,
  History,
  AlertCircle,
  Truck,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Zap,
  Tag,
  Boxes,
  Activity,
  Trash2,
  PhoneCall,
  Phone
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import { ItemData, updateItem, deleteItem } from '@/database/db';
import { formatDate } from '@/utils/date-utils';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
import PremiumActionModal from '@/components/PremiumActionModal';
const { width } = Dimensions.get('window');

const ItemDetailsScreen = ({ item, onClose }: { item: ItemData, onClose?: () => void }) => {
  const { colors, calendarType, language, t, theme } = useSettings();
  const dialog = useDialog();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(item);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!item) return null;

  const handleSave = () => {
    // Validate all editable fields before saving
    if (!editForm.name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('form.error_name_required'));
      return;
    }
    if (isNaN(editForm.basePurchasePrice) || editForm.basePurchasePrice < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('form.error_price_invalid'));
      return;
    }
    if (isNaN(editForm.baseSellingPrice) || editForm.baseSellingPrice <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('form.error_price_positive'));
      return;
    }
    if (isNaN(editForm.totalBaseQuantity) || editForm.totalBaseQuantity < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('form.error_quantity_positive'));
      return;
    }
    if (isNaN(editForm.lowStockThreshold ?? 0) || (editForm.lowStockThreshold ?? 0) < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('form.error_quantity_positive'));
      return;
    }
    if (editForm.expiryDate && editForm.expiryDate.trim()) {
      const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(editForm.expiryDate.trim()) && !isoRegex.test(editForm.expiryDate.trim())) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        alert(t('form.error_date_format'));
        return;
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const success = updateItem(item.id, editForm);
    if (success) {
      setIsEditing(false);
      if (onClose) onClose();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('common.error'));
    }
  };

  const handleDelete = () => {
    const success = deleteItem(item.id);
    if (success) {
      setShowDeleteConfirm(false);
      if (onClose) onClose();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('common.error'));
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditForm(item);
    setIsEditing(false);
  };

  const toggleEdit = () => {
    Haptics.selectionAsync();
    setIsEditing(true);
  };

  const profit = (editForm.baseSellingPrice - editForm.basePurchasePrice);
  const totalPotentialProfit = profit * editForm.totalBaseQuantity;
  const margin = editForm.basePurchasePrice > 0 ? (profit / editForm.basePurchasePrice) * 100 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero Header */}
      <View style={styles.heroContainer}>
         <View style={[styles.heroWash, { backgroundColor: colors.text + '05' }]} />
         <View style={styles.topActions}>
            <TouchableOpacity onPress={onClose} style={[styles.circleBtn, { backgroundColor: colors.background + '80' }]}>
               <ChevronLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.row}>
               {isEditing ? (
                 <View style={styles.editActions}>
                    <TouchableOpacity onPress={handleCancel} style={[styles.circleBtn, { backgroundColor: '#FF3B3015', marginRight: 10 }]}>
                       <X size={20} color="#FF3B30" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSave} style={[styles.circleBtn, { backgroundColor: '#34C75915' }]}>
                       <Check size={20} color="#34C759" />
                    </TouchableOpacity>
                 </View>
               ) : (
                 <View style={styles.editActions}>
                   <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={[styles.circleBtn, { backgroundColor: '#FF3B3015', marginRight: 10 }]}>
                      <Trash2 size={18} color="#FF3B30" />
                   </TouchableOpacity>
                   <TouchableOpacity onPress={toggleEdit} style={[styles.circleBtn, { backgroundColor: colors.background + '80' }]}>
                      <Edit2 size={18} color={colors.text} />
                   </TouchableOpacity>
                 </View>
               )}
            </View>
         </View>

         <Animated.View entering={ZoomIn} style={styles.heroContent}>
            <View style={[styles.assetIconBox, { backgroundColor: colors.text }]}>
               <Package size={32} color={colors.background} />
            </View>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.heroSub, { color: colors.textSecondary }]} numberOfLines={1}>{t('detail.asset_blueprint')}</AppText>
            {isEditing ? (
              <TextInput
                style={[styles.heroInput, { color: colors.text }]}
                value={editForm.name}
                onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, name: t }))}
                placeholder={t('form.official_name')}
                placeholderTextColor={colors.textSecondary}
              />
            ) : (
              <AppText variant="display" weight="bold" align="center" style={[styles.heroTitle, { color: colors.text }]} numberOfLines={3}>{editForm.name}</AppText>
            )}
            <View style={[styles.statusBadge, { backgroundColor: editForm.totalBaseQuantity > 0 ? '#34C75915' : '#FF3B3015' }]}>
               <View style={[styles.statusDot, { backgroundColor: editForm.totalBaseQuantity > 0 ? '#34C759' : '#FF3B30' }]} />
               <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.statusText, { color: editForm.totalBaseQuantity > 0 ? '#34C759' : '#FF3B30' }]} numberOfLines={1}>
                  {editForm.totalBaseQuantity > 0 ? t('dashboard.stats.stable').toUpperCase() : t('inventory.out_of_stock').toUpperCase()}
               </AppText>
            </View>
         </Animated.View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Supplier Call Card — only shown when supplierCallEnabled is on */}
        {editForm.supplierCallEnabled && (
          <Animated.View entering={FadeInDown.delay(180)} style={styles.section}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={async () => {
                const phone = (editForm.supplierPhone || '').toString().replace(/[^0-9+]/g, '');
                if (!phone) {
                  await dialog.alert({ title: t('common.error'), message: t('detail.no_supplier_phone'), iconType: 'danger' });
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Linking.openURL(`tel:${phone}`).catch(async () => {
                  await dialog.alert({ title: t('common.error'), message: t('detail.could_not_call'), iconType: 'danger' });
                });
              }}
              style={{
                backgroundColor: colors.text,
                borderRadius: 24,
                padding: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.background + '20', justifyContent: 'center', alignItems: 'center' }}>
                <PhoneCall size={22} color={colors.background} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="body-sm" weight="bold" style={{ color: colors.background }} numberOfLines={2}>
                  {t('detail.call_supplier_cta')}
                </AppText>
                <AppText variant="caption" weight="medium" style={{ color: colors.background + 'B0', marginTop: 2 }} numberOfLines={1}>
                  {editForm.supplierPhone || t('detail.no_phone_set')}
                </AppText>
              </View>
              <ChevronRight size={18} color={colors.background + '90'} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Magnitude Cards */}
        <Animated.View entering={FadeInDown.delay(200)} layout={Layout} style={styles.row}>
           <View style={[styles.magnitudeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.mLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('detail.unit_margin')}</AppText>
              <AppText variant="heading" weight="bold" style={[styles.mValue, { color: profit >= 0 ? '#34C759' : '#FF3B30' }]} numberOfLines={1}>{margin.toFixed(1)}%</AppText>
              <View style={styles.mFooter}>
                 <TrendingUp size={12} color={profit >= 0 ? '#34C759' : '#FF3B30'} />
                 <AppText variant="micro" weight="medium" style={[styles.mFooterText, { color: colors.textSecondary }]} numberOfLines={1}>{profit.toFixed(2)} {t('common.etb')}</AppText>
              </View>
           </View>
           <View style={[styles.magnitudeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.mLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('detail.asset_value')}</AppText>
              <AppText variant="title" weight="bold" style={[styles.mValue, { color: colors.text }]} numberOfLines={1}>{(editForm.baseSellingPrice * editForm.totalBaseQuantity).toLocaleString()}</AppText>
              <View style={styles.mFooter}>
                 <DollarSign size={12} color={colors.textSecondary} />
                 <AppText variant="micro" weight="medium" style={[styles.mFooterText, { color: colors.textSecondary }]} numberOfLines={1}>{t('detail.potential_rev')}</AppText>
              </View>
           </View>
        </Animated.View>

        {/* Intelligence Nodes */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
           <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('detail.financial_core')}</AppText>
           <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Tag size={16} color={colors.textSecondary} />
                    <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inventory.purchase_price')}</AppText>
                 </View>
                 {isEditing ? (
                   <TextInput
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]}
                     value={String(editForm.basePurchasePrice)}
                     onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, basePurchasePrice: Number(t) }))}
                     keyboardType="numeric"
                   />
                 ) : (
                   <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.nodeValue, { color: colors.text }]} numberOfLines={1}>{editForm.basePurchasePrice.toLocaleString()} <AppText variant="micro" weight="medium" shrink={false} style={styles.curr}>{t('common.etb')}</AppText></AppText>
                 )}
              </View>
              <View style={styles.nodeDivider} />
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Zap size={16} color={colors.textSecondary} />
                    <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inventory.selling_price')}</AppText>
                 </View>
                 {isEditing ? (
                   <TextInput
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]}
                     value={String(editForm.baseSellingPrice)}
                     onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, baseSellingPrice: Number(t) }))}
                     keyboardType="numeric"
                   />
                 ) : (
                   <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.nodeValue, { color: colors.text }]} numberOfLines={1}>{editForm.baseSellingPrice.toLocaleString()} <AppText variant="micro" weight="medium" shrink={false} style={styles.curr}>{t('common.etb')}</AppText></AppText>
                 )}
              </View>
           </View>
         </Animated.View>

         <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
           <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('detail.logistics_scale')}</AppText>
           <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Activity size={16} color={colors.textSecondary} />
                    <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inventory.stock_status')}</AppText>
                 </View>
                 {isEditing ? (
                   <TextInput
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]}
                     value={String(editForm.totalBaseQuantity)}
                     onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, totalBaseQuantity: Number(t) }))}
                     keyboardType="numeric"
                   />
                 ) : (
                   <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.nodeValue, { color: colors.text }]} numberOfLines={1}>{editForm.totalBaseQuantity} <AppText variant="micro" weight="medium" shrink={false} style={styles.curr}>{editForm.baseUnit}</AppText></AppText>
                 )}
              </View>
              <View style={styles.nodeDivider} />
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <AlertCircle size={16} color={colors.textSecondary} />
                    <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('detail.low_threshold')}</AppText>
                 </View>
                 {isEditing ? (
                   <TextInput
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]}
                     value={String(editForm.lowStockThreshold || 0)}
                     onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, lowStockThreshold: Number(t) }))}
                     keyboardType="numeric"
                   />
                 ) : (
                   <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.nodeValue, { color: colors.text }]} numberOfLines={1}>{editForm.lowStockThreshold || 0} <AppText variant="micro" weight="medium" shrink={false} style={styles.curr}>{editForm.baseUnit}</AppText></AppText>
                 )}
              </View>
              {editForm.hasPacks && (
                <>
                  <View style={styles.nodeDivider} />
                  <View style={styles.node}>
                     <View style={styles.nodeInfo}>
                        <Boxes size={16} color={colors.textSecondary} />
                        <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('detail.pack_scale')}</AppText>
                     </View>
                     <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: colors.text }]} numberOfLines={1}>{editForm.basePerPack} {editForm.baseUnit}/{t('form.pack')}</AppText>
                  </View>
                </>
              )}
           </View>
         </Animated.View>

         <Animated.View entering={FadeInDown.delay(600)} style={styles.section}>
           <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('detail.temporal_audit')}</AppText>
           <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Calendar size={16} color={colors.textSecondary} />
                    <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('inventory.expiring')}</AppText>
                 </View>
                 {isEditing ? (
                   <TextInput
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]}
                     value={editForm.expiryDate || ''}
                     placeholder={t('inv.date_format_iso')}
                     placeholderTextColor={colors.textSecondary}
                     onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, expiryDate: t }))}
                   />
                 ) : (
                   <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: colors.text }]} numberOfLines={1}>
                     {editForm.expiryDate ? formatDate(new Date(editForm.expiryDate), calendarType, language) : t('common.none').toUpperCase()}
                   </AppText>
                 )}
              </View>
              <View style={styles.nodeDivider} />
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <History size={16} color={colors.textSecondary} />
                    <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('detail.committed_on')}</AppText>
                 </View>
                 <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: colors.text }]} numberOfLines={1}>
                   {editForm.createdAt ? formatDate(new Date(editForm.createdAt), calendarType, language) : t('common.none').toUpperCase()}
                 </AppText>
              </View>
           </View>
         </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action Float */}
      <BlurView intensity={theme === 'dark' ? 40 : 80} tint={theme === 'dark' ? 'dark' : 'light'} style={styles.actionFloat}>
         <TouchableOpacity 
           style={[styles.primaryAction, { backgroundColor: colors.text }]}
           onPress={isEditing ? handleSave : () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsEditing(true); }}
         >
            {isEditing ? (
              <ShieldCheck size={20} color={colors.background} />
            ) : (
              <Edit2 size={18} color={colors.background} />
            )}
            <AppText variant="body" weight="bold" shrink={false} style={[styles.actionText, { color: colors.background }]} numberOfLines={1}>
              {isEditing ? t('detail.commit_blueprint') : t('detail.modify_asset')}
            </AppText>
         </TouchableOpacity>
      </BlurView>

      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <PremiumActionModal
          title={t('detail.delete_title')}
          subtitle={t('detail.delete_confirm')}
          actionText={t('common.delete')}
          cancelText={t('common.cancel')}
          iconType="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroContainer: { height: 320, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 25, position: 'relative' },
  heroWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 260, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  topActions: { position: 'absolute', top: 50, left: 25, right: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  circleBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  heroContent: { alignItems: 'center' },
  assetIconBox: { width: 70, height: 70, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  heroSub: { fontSize: 13, fontFamily: Fonts.bold, letterSpacing: 1.5, marginBottom: 5 },
  heroTitle: { fontSize: 32, fontFamily: Fonts.bold, letterSpacing: -1, textAlign: 'center' },
  heroInput: { fontSize: 24, fontFamily: Fonts.bold, textAlign: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', borderRadius: 12, paddingHorizontal: 20, minWidth: 200 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: Fonts.bold },
  scrollContent: { padding: 25 },
  row: { flexDirection: 'row', gap: 15 },
  magnitudeCard: { flex: 1, borderRadius: 24, padding: 20, borderWidth: 1, marginBottom: 30 },
  mLabel: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.5, marginBottom: 8 },
  mValue: { fontSize: 22, fontFamily: Fonts.bold },
  mFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  mFooterText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 5 },
  intelligenceBlock: { borderRadius: 28, padding: 20, borderWidth: 1 },
  node: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  nodeInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nodeLabel: { fontSize: 13, fontFamily: Fonts.bold },
  nodeValue: { fontSize: 16, fontFamily: Fonts.bold },
  nodeInput: { fontSize: 15, fontFamily: Fonts.bold, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, minWidth: 100, textAlign: 'right' },
  curr: { fontSize: 11, fontFamily: Fonts.medium, opacity: 0.6 },
  nodeDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 4 },
  actionFloat: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 25, paddingTop: 20, paddingBottom: 40 },
  primaryAction: { height: 65, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  actionText: { fontSize: 16, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  editActions: { flexDirection: 'row', alignItems: 'center' }
});

export default ItemDetailsScreen;