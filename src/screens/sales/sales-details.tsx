import React, { useState } from 'react';
import { 
  View, 
  Text as RNText, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Dimensions,
  Platform,
  Modal
} from 'react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  ScaleInCenter,
  Layout
} from 'react-native-reanimated';
import { 
  Edit2, 
  Check, 
  X, 
  Package, 
  ChevronLeft,
  Banknote,
  CreditCard,
  User,
  Phone,
  Calendar,
  ShieldCheck,
  Tag,
  DollarSign,
  TrendingUp,
  History,
  Info,
  BadgeCheck,
  LayoutGrid,
  Zap,
  Trash2
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { updateSale, deleteSale } from '@/database/db';
import { formatDate } from '@/utils/date-utils';
import PremiumActionModal from '@/components/PremiumActionModal';
import BusinessSuccessModal from '@/components/BusinessSuccessModal';

const { width } = Dimensions.get('window');

const SaleDetailsScreen = ({ sale, onClose }: { sale: any, onClose?: () => void }) => {
  const { colors, calendarType, language, t, theme } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(sale);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState<'edit' | 'delete' | null>(null);

  if (!sale) return null;

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const success = updateSale(sale.id, editForm);
    if (success) {
      setIsEditing(false);
      setShowSuccess('edit');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('common.error'));
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditForm(sale);
    setIsEditing(false);
  };

  const handleDelete = () => {
    const success = deleteSale(sale.id);
    if (success) {
      setShowDeleteConfirm(false);
      setShowSuccess('delete');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('common.error'));
    }
  };

  const unitPrice = (editForm.totalPrice + (editForm.discount || 0)) / (editForm.quantity || 1);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Transaction Insight Header */}
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
                   <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setIsEditing(true); }} style={[styles.circleBtn, { backgroundColor: colors.background + '80' }]}>
                      <Edit2 size={18} color={colors.text} />
                   </TouchableOpacity>
                 </View>
               )}
            </View>
         </View>

         <Animated.View entering={ScaleInCenter} style={styles.heroContent}>
            <View style={[styles.badgeContainer, { backgroundColor: editForm.paymentStatus === 'Paid' ? '#34C75915' : '#FF950015' }]}>
               <BadgeCheck size={24} color={editForm.paymentStatus === 'Paid' ? '#34C759' : '#FF9500'} />
            </View>
            <RNText style={[styles.heroSub, { color: colors.textSecondary }]}>{t('sale.transaction_insight')}</RNText>
            {isEditing ? (
              <View style={styles.priceEditRow}>
                 <TextInput
                   style={[styles.heroInput, { color: colors.text }]}
                   value={String(editForm.totalPrice)}
                   keyboardType="numeric"
                   onChangeText={(t) => setEditForm(prev => ({ ...prev, totalPrice: Number(t) }))}
                 />
                 <RNText style={[styles.heroTitle, { color: colors.textSecondary }]}> {t('common.etb')}</RNText>
              </View>
            ) : (
              <RNText style={[styles.heroTitle, { color: colors.text }]}>{editForm.totalPrice.toLocaleString()} <RNText style={{ fontSize: 24, opacity: 0.6 }}>{t('common.etb')}</RNText></RNText>
            )}
            <RNText style={[styles.heroMeta, { color: colors.textSecondary }]}>
               {editForm.createdAt ? formatDate(new Date(editForm.createdAt), calendarType, language) : t('common.loading')}
            </RNText>
         </Animated.View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Settlement Intelligence */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
           <RNText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('sale.settlement_modality')}</RNText>
           <View style={styles.row}>
              <View style={[styles.modalityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                 <View style={styles.mIconBox}>
                    {editForm.paymentMethod === 'Cash' ? <Banknote size={18} color={colors.primary} /> : <CreditCard size={18} color={colors.primary} />}
                 </View>
                 <RNText style={[styles.mLabel, { color: colors.textSecondary }]}>{t('sale.method')}</RNText>
                 <RNText style={[styles.mValue, { color: colors.text }]}>{editForm.paymentMethod === 'Cash' ? t('sale.physical_cash') : t('sale.digital_bank')}</RNText>
              </View>
              <View style={[styles.modalityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                 <View style={styles.mIconBox}>
                    <ShieldCheck size={18} color={editForm.paymentStatus === 'Paid' ? '#34C759' : '#FF9500'} />
                 </View>
                 <RNText style={[styles.mLabel, { color: colors.textSecondary }]}>{t('sale.status')}</RNText>
                 <RNText style={[styles.mValue, { color: editForm.paymentStatus === 'Paid' ? '#34C759' : '#FF9500' }]}>
                    {editForm.paymentStatus === 'Paid' ? t('sale.settled') : t('sale.credit')}
                 </RNText>
              </View>
           </View>
        </Animated.View>

        {/* Intelligence Nodes */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
           <RNText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('sale.asset_metrics')}</RNText>
           <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Package size={16} color={colors.textSecondary} />
                    <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('sale.asset_name')}</RNText>
                 </View>
                 <RNText style={[styles.nodeValue, { color: colors.text }]}>{editForm.itemName}</RNText>
              </View>
              <View style={styles.nodeDivider} />
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <LayoutGrid size={16} color={colors.textSecondary} />
                    <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('form.quantity')}</RNText>
                 </View>
                 {isEditing ? (
                   <TextInput 
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]} 
                     value={String(editForm.quantity)}
                     keyboardType="numeric"
                     onChangeText={(t) => setEditForm(prev => ({ ...prev, quantity: Number(t) }))}
                   />
                 ) : (
                   <RNText style={[styles.nodeValue, { color: colors.text }]}>{editForm.quantity} <RNText style={styles.curr}>{editForm.unit}</RNText></RNText>
                 )}
              </View>
              <View style={styles.nodeDivider} />
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Zap size={16} color={colors.textSecondary} />
                    <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('sale.calculated_unit_price')}</RNText>
                 </View>
                 <RNText style={[styles.nodeValue, { color: colors.text }]}>{unitPrice.toFixed(2)} <RNText style={styles.curr}>{t('common.etb')}</RNText></RNText>
              </View>
              <View style={styles.nodeDivider} />
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Tag size={16} color={colors.textSecondary} />
                    <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('sale.adjusted_discount')}</RNText>
                 </View>
                 {isEditing ? (
                   <TextInput 
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]} 
                     value={String(editForm.discount || 0)}
                     keyboardType="numeric"
                     onChangeText={(t) => setEditForm(prev => ({ ...prev, discount: Number(t) }))}
                   />
                 ) : (
                   <RNText style={[styles.nodeValue, { color: colors.text }]}>{editForm.discount || 0} <RNText style={styles.curr}>{t('common.etb')}</RNText></RNText>
                 )}
              </View>
           </View>
        </Animated.View>

        {editForm.paymentStatus === 'Debt' && (
           <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
              <RNText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('sale.customer_identity')}</RNText>
              <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
                 <View style={styles.node}>
                    <View style={styles.nodeInfo}>
                       <User size={16} color={colors.textSecondary} />
                       <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('sale.legal_name')}</RNText>
                    </View>
                    {isEditing ? (
                       <TextInput 
                         style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]} 
                         value={editForm.customerName || ''}
                         onChangeText={(t) => setEditForm(prev => ({ ...prev, customerName: t }))}
                       />
                    ) : (
                       <RNText style={[styles.nodeValue, { color: colors.text }]}>{editForm.customerName || t('common.none')}</RNText>
                    )}
                 </View>
                 <View style={styles.nodeDivider} />
                 <View style={styles.node}>
                    <View style={styles.nodeInfo}>
                       <Phone size={16} color={colors.textSecondary} />
                       <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('sale.contact_string')}</RNText>
                    </View>
                    {isEditing ? (
                       <TextInput 
                         style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]} 
                         value={editForm.customerPhone || ''}
                         keyboardType="phone-pad"
                         onChangeText={(t) => setEditForm(prev => ({ ...prev, customerPhone: t }))}
                       />
                    ) : (
                       <RNText style={[styles.nodeValue, { color: colors.text }]}>{editForm.customerPhone || 'N/A'}</RNText>
                    )}
                 </View>
              </View>
           </Animated.View>
        )}

        <View style={{ height: 120 }} />
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
              {isEditing ? t('sale.commit_settlement') : t('sale.modify_transaction')}
            </RNText>
         </TouchableOpacity>
      </BlurView>

      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <PremiumActionModal
          title={t('sale.delete_ledger')}
          subtitle={t('sale.delete_confirm', { amount: editForm.totalPrice })}
          actionText={t('sale.nullify_transaction')}
          cancelText={t('common.cancel')}
          iconType="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </Modal>

      <Modal visible={showSuccess !== null} transparent animationType="fade">
        <BusinessSuccessModal 
          details={{
            title: showSuccess === 'edit' ? t('sale.modified_success') : t('sale.nullified_success'),
            subtitle: showSuccess === 'edit' ? t('sale.ledger_updated') : t('sale.record_expunged'),
            mainLabel: t('sales.total_amount'),
            mainValue: `${editForm.totalPrice} ${t('common.etb')}`,
            iconType: showSuccess === 'edit' ? "price_up" : "price_down"
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
  badgeContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  heroSub: { fontSize: 13, fontFamily: Fonts.bold, letterSpacing: 1.5, marginBottom: 5 },
  heroTitle: { fontSize: 44, fontFamily: Fonts.bold, letterSpacing: -2, textAlign: 'center' },
  priceEditRow: { flexDirection: 'row', alignItems: 'baseline' },
  heroInput: { fontSize: 32, fontFamily: Fonts.bold, textAlign: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', borderRadius: 12, paddingHorizontal: 20, minWidth: 150 },
  heroMeta: { fontSize: 13, fontFamily: Fonts.bold, marginTop: 10, opacity: 0.6 },
  scrollContent: { padding: 25 },
  section: { marginBottom: 35 },
  sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15, marginLeft: 5 },
  row: { flexDirection: 'row', gap: 15 },
  modalityCard: { flex: 1, borderRadius: 24, padding: 20, borderWidth: 1, alignItems: 'center' },
  mIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.03)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  mLabel: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.5, marginBottom: 4 },
  mValue: { fontSize: 16, fontFamily: Fonts.bold },
  intelligenceBlock: { borderRadius: 28, padding: 20, borderWidth: 1 },
  node: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  nodeInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nodeLabel: { fontSize: 11, fontFamily: Fonts.bold },
  nodeValue: { fontSize: 15, fontFamily: Fonts.bold },
  nodeInput: { fontSize: 14, fontFamily: Fonts.bold, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, minWidth: 100, textAlign: 'right' },
  curr: { fontSize: 10, fontFamily: Fonts.medium, opacity: 0.6 },
  nodeDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 4 },
  actionFloat: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 25, paddingTop: 20, paddingBottom: 40 },
  primaryAction: { height: 65, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  actionText: { fontSize: 16, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  editActions: { flexDirection: 'row', alignItems: 'center' }
});

export default SaleDetailsScreen;