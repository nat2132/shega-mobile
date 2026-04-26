import React, { useState } from 'react';
import { 
  View, 
  Text as RNText, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Platform,
  Dimensions,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  FadeIn,
  ScaleInCenter,
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
  Calendar,
  Zap,
  Tag,
  Boxes,
  Activity,
  Trash2
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { ItemData, updateItem, deleteItem } from '@/database/db';
import { formatDate } from '@/utils/date-utils';
import PremiumActionModal from '@/components/PremiumActionModal';
import BusinessSuccessModal from '@/components/BusinessSuccessModal';

const { width } = Dimensions.get('window');

const ItemDetailsScreen = ({ item, onClose }: { item: ItemData, onClose?: () => void }) => {
  const { colors, calendarType, language, t, theme } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(item);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState<'edit' | 'delete' | null>(null);

  if (!item) return null;

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const success = updateItem(item.id, editForm);
    if (success) {
      setIsEditing(false);
      setShowSuccess('edit');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('common.error'));
    }
  };

  const handleDelete = () => {
    const success = deleteItem(item.id);
    if (success) {
      setShowDeleteConfirm(false);
      setShowSuccess('delete');
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

         <Animated.View entering={ScaleInCenter} style={styles.heroContent}>
            <View style={[styles.assetIconBox, { backgroundColor: colors.text }]}>
               <Package size={32} color={colors.background} />
            </View>
            <RNText style={[styles.heroSub, { color: colors.textSecondary }]}>{t('detail.asset_blueprint')}</RNText>
            {isEditing ? (
              <TextInput
                style={[styles.heroInput, { color: colors.text }]}
                value={editForm.name}
                onChangeText={(t) => setEditForm(prev => ({ ...prev, name: t }))}
                placeholder={t('form.official_name')}
                placeholderTextColor={colors.textSecondary}
              />
            ) : (
              <RNText style={[styles.heroTitle, { color: colors.text }]}>{editForm.name}</RNText>
            )}
            <View style={[styles.statusBadge, { backgroundColor: editForm.totalBaseQuantity > 0 ? '#34C75915' : '#FF3B3015' }]}>
               <View style={[styles.statusDot, { backgroundColor: editForm.totalBaseQuantity > 0 ? '#34C759' : '#FF3B30' }]} />
               <RNText style={[styles.statusText, { color: editForm.totalBaseQuantity > 0 ? '#34C759' : '#FF3B30' }]}>
                  {editForm.totalBaseQuantity > 0 ? t('dashboard.stats.stable').toUpperCase() : t('inventory.out_of_stock').toUpperCase()}
               </RNText>
            </View>
         </Animated.View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Magnitude Cards */}
        <Animated.View entering={FadeInDown.delay(200)} layout={Layout} style={styles.row}>
           <View style={[styles.magnitudeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <RNText style={[styles.mLabel, { color: colors.textSecondary }]}>{t('detail.unit_margin')}</RNText>
              <RNText style={[styles.mValue, { color: profit >= 0 ? '#34C759' : '#FF3B30' }]}>{margin.toFixed(1)}%</RNText>
              <View style={styles.mFooter}>
                 <TrendingUp size={12} color={profit >= 0 ? '#34C759' : '#FF3B30'} />
                 <RNText style={[styles.mFooterText, { color: colors.textSecondary }]}>{profit.toFixed(2)} {t('common.etb')}</RNText>
              </View>
           </View>
           <View style={[styles.magnitudeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <RNText style={[styles.mLabel, { color: colors.textSecondary }]}>{t('detail.asset_value')}</RNText>
              <RNText style={[styles.mValue, { color: colors.text }]}>{(editForm.baseSellingPrice * editForm.totalBaseQuantity).toLocaleString()}</RNText>
              <View style={styles.mFooter}>
                 <DollarSign size={12} color={colors.textSecondary} />
                 <RNText style={[styles.mFooterText, { color: colors.textSecondary }]}>{t('detail.potential_rev')}</RNText>
              </View>
           </View>
        </Animated.View>

        {/* Intelligence Nodes */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
           <RNText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('detail.financial_core')}</RNText>
           <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Tag size={16} color={colors.textSecondary} />
                    <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('inventory.purchase_price')}</RNText>
                 </View>
                 {isEditing ? (
                   <TextInput 
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]} 
                     value={String(editForm.basePurchasePrice)}
                     onChangeText={(t) => setEditForm(prev => ({ ...prev, basePurchasePrice: Number(t) }))}
                     keyboardType="numeric"
                   />
                 ) : (
                   <RNText style={[styles.nodeValue, { color: colors.text }]}>{editForm.basePurchasePrice.toLocaleString()} <RNText style={styles.curr}>{t('common.etb')}</RNText></RNText>
                 )}
              </View>
              <View style={styles.nodeDivider} />
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Zap size={16} color={colors.textSecondary} />
                    <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('inventory.selling_price')}</RNText>
                 </View>
                 {isEditing ? (
                   <TextInput 
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]} 
                     value={String(editForm.baseSellingPrice)}
                     onChangeText={(t) => setEditForm(prev => ({ ...prev, baseSellingPrice: Number(t) }))}
                     keyboardType="numeric"
                   />
                 ) : (
                   <RNText style={[styles.nodeValue, { color: colors.text }]}>{editForm.baseSellingPrice.toLocaleString()} <RNText style={styles.curr}>{t('common.etb')}</RNText></RNText>
                 )}
              </View>
           </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
           <RNText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('detail.logistics_scale')}</RNText>
           <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Activity size={16} color={colors.textSecondary} />
                    <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('inventory.stock_status')}</RNText>
                 </View>
                 {isEditing ? (
                   <TextInput 
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]} 
                     value={String(editForm.totalBaseQuantity)}
                     onChangeText={(t) => setEditForm(prev => ({ ...prev, totalBaseQuantity: Number(t) }))}
                     keyboardType="numeric"
                   />
                 ) : (
                   <RNText style={[styles.nodeValue, { color: colors.text }]}>{editForm.totalBaseQuantity} <RNText style={styles.curr}>{editForm.baseUnit}</RNText></RNText>
                 )}
              </View>
              <View style={styles.nodeDivider} />
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <AlertCircle size={16} color={colors.textSecondary} />
                    <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('detail.low_threshold')}</RNText>
                 </View>
                 {isEditing ? (
                   <TextInput 
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]} 
                     value={String(editForm.lowStockThreshold || 0)}
                     onChangeText={(t) => setEditForm(prev => ({ ...prev, lowStockThreshold: Number(t) }))}
                     keyboardType="numeric"
                   />
                 ) : (
                   <RNText style={[styles.nodeValue, { color: colors.text }]}>{editForm.lowStockThreshold || 0} <RNText style={styles.curr}>{editForm.baseUnit}</RNText></RNText>
                 )}
              </View>
              {editForm.hasPacks && (
                <>
                  <View style={styles.nodeDivider} />
                  <View style={styles.node}>
                     <View style={styles.nodeInfo}>
                        <Boxes size={16} color={colors.textSecondary} />
                        <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('detail.pack_scale')}</RNText>
                     </View>
                     <RNText style={[styles.nodeValue, { color: colors.text }]}>{editForm.basePerPack} {editForm.baseUnit}/{t('form.pack')}</RNText>
                  </View>
                </>
              )}
           </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600)} style={styles.section}>
           <RNText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('detail.temporal_audit')}</RNText>
           <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Calendar size={16} color={colors.textSecondary} />
                    <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('inventory.expiring')}</RNText>
                 </View>
                 {isEditing ? (
                   <TextInput 
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]} 
                     value={editForm.expiryDate || ''}
                     placeholder="YYYY-MM-DD"
                     placeholderTextColor={colors.textSecondary}
                     onChangeText={(t) => setEditForm(prev => ({ ...prev, expiryDate: t }))}
                   />
                 ) : (
                   <RNText style={[styles.nodeValue, { color: colors.text }]}>
                     {editForm.expiryDate ? formatDate(new Date(editForm.expiryDate), calendarType, language) : t('common.none').toUpperCase()}
                   </RNText>
                 )}
              </View>
              <View style={styles.nodeDivider} />
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <History size={16} color={colors.textSecondary} />
                    <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('detail.committed_on')}</RNText>
                 </View>
                 <RNText style={[styles.nodeValue, { color: colors.text }]}>
                   {editForm.createdAt ? formatDate(new Date(editForm.createdAt), calendarType, language) : t('common.none').toUpperCase()}
                 </RNText>
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
            <RNText style={[styles.actionText, { color: colors.background }]}>
              {isEditing ? t('detail.commit_blueprint') : t('detail.modify_asset')}
            </RNText>
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

      <Modal visible={showSuccess !== null} transparent animationType="fade">
        <BusinessSuccessModal 
          details={{
            title: showSuccess === 'edit' ? t('detail.asset_updated') : t('detail.asset_extracted'),
            subtitle: showSuccess === 'edit' ? t('detail.modification_secured') : t('detail.erasure_complete'),
            mainLabel: t('inventory.header'),
            mainValue: item.name,
            iconType: showSuccess === 'edit' ? "expense" : "damaged"
          }}
          onClose={() => {
            setShowSuccess(null);
            if (onClose) onClose();
          }}
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