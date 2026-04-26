import React, { useState } from 'react';
import { 
  View, 
  Text as RNText, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
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
  Repeat, 
  Tag, 
  Calendar, 
  Info, 
  Edit2, 
  Check, 
  X,
  ChevronLeft,
  DollarSign,
  TrendingDown,
  ShieldCheck,
  Zap,
  History,
  Bell,
  Clock,
  ArrowRight,
  Package,
  LayoutGrid,
  Trash2
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Fonts } from '@/constants/theme';
import { updateExpense, deleteExpense } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import { formatDate } from '@/utils/date-utils';
import PremiumActionModal from '@/components/PremiumActionModal';
import BusinessSuccessModal from '@/components/BusinessSuccessModal';

const { width } = Dimensions.get('window');

const ExpenseDetails = ({ expense, onClose }: { expense: any, onClose?: () => void }) => {
  const { colors, calendarType, language, t, theme } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(expense);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState<'edit' | 'delete' | null>(null);

  if (!expense) return null;

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const success = updateExpense(expense.id, editForm);
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
    setEditForm(expense);
    setIsEditing(false);
  };

  const handleDelete = () => {
    const success = deleteExpense(expense.id);
    if (success) {
      setShowDeleteConfirm(false);
      setShowSuccess('delete');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('common.error'));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Capital Drill-down Header */}
      <View style={styles.heroContainer}>
         <View style={[styles.heroWash, { backgroundColor: '#FF3B3008' }]} />
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
            <View style={[styles.badgeContainer, { backgroundColor: '#FF3B3015' }]}>
               <TrendingDown size={28} color="#FF3B30" />
            </View>
            <RNText style={[styles.heroSub, { color: colors.textSecondary }]}>{t('expense.capital_management')}</RNText>
            {isEditing ? (
              <View style={styles.priceEditRow}>
                <TextInput
                  style={[styles.heroInput, { color: colors.text }]}
                  value={String(editForm.amount)}
                  keyboardType="numeric"
                  onChangeText={(t) => setEditForm(prev => ({ ...prev, amount: Number(t) }))}
                />
                <RNText style={[styles.heroTitle, { color: colors.textSecondary }]}>{t('common.etb')}</RNText>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <RNText style={[styles.heroTitle, { color: colors.text }]}>{editForm.amount.toLocaleString()}</RNText>
                <RNText style={{ fontSize: 24, opacity: 0.6, color: colors.text, marginLeft: 8 }}>{t('common.etb')}</RNText>
              </View>
            )}
            <RNText style={[styles.heroMeta, { color: colors.textSecondary }]}>
               {editForm.date ? formatDate(new Date(editForm.date), calendarType, language) : t('common.loading')}
            </RNText>
         </Animated.View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Magnitude & Context */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
           <RNText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('expense.outflow_identity')}</RNText>
           <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Zap size={16} color={colors.textSecondary} />
                    <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('common.description')}</RNText>
                 </View>
                 {isEditing ? (
                   <TextInput 
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]} 
                     value={editForm.name}
                     onChangeText={(t) => setEditForm(prev => ({ ...prev, name: t }))}
                   />
                 ) : (
                   <RNText style={[styles.nodeValue, { color: colors.text }]}>{editForm.name}</RNText>
                 )}
              </View>
              <View style={styles.nodeDivider} />
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Tag size={16} color={colors.textSecondary} />
                    <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('common.category')}</RNText>
                 </View>
                 {isEditing ? (
                   <TextInput 
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]} 
                     value={editForm.category || ''}
                     onChangeText={(t) => setEditForm(prev => ({ ...prev, category: t }))}
                   />
                 ) : (
                   <View style={[styles.miniBadge, { backgroundColor: colors.text + '08' }]}>
                      <RNText style={[styles.badgeText, { color: colors.textSecondary }]}>{editForm.category || t('common.none')}</RNText>
                   </View>
                 )}
              </View>
           </View>
        </Animated.View>

        {/* Orchestration Block (Recurring) */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <RNText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('expense.orchestration_nodes')}</RNText>
          <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.node}>
              <View style={styles.nodeInfo}>
                <Repeat size={18} color={editForm.isRecurring ? colors.primary : colors.textSecondary} />
                <View>
                  <RNText style={[styles.nodeValue, { color: colors.text }]}>{editForm.isRecurring ? t('expense.automated') : t('expense.one_time')}</RNText>
                  <RNText style={[styles.nodeSub, { color: colors.textSecondary }]}>{editForm.isRecurring ? t('expense.repeats_every', { frequency: t(`expense.${(editForm.frequency || 'Monthly').toLowerCase()}`) }) : t('expense.no_pulse')}</RNText>
                </View>
              </View>
            </View>
            {editForm.isRecurring && (
              <View style={styles.dateNodes}>
                <View style={[styles.dNode, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <RNText style={[styles.dLabel, { color: colors.textSecondary }]}>{t('expense.committed')}</RNText>
                  <RNText style={[styles.dValue, { color: colors.text }]}>{editForm.date ? formatDate(new Date(editForm.date), calendarType, language) : 'N/A'}</RNText>
                </View>
                <View style={[styles.dNode, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <RNText style={[styles.dLabel, { color: colors.textSecondary }]}>{t('expense.next_drill')}</RNText>
                  <RNText style={[styles.dValue, { color: colors.primary }]}>{editForm.nextBillingDate ? formatDate(new Date(editForm.nextBillingDate), calendarType, language) : 'N/A'}</RNText>
                </View>
              </View>
            )}
          </View>
        </Animated.View>

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
              {isEditing ? t('expense.commit_ledger') : t('expense.modify_outflow')}
            </RNText>
         </TouchableOpacity>
      </BlurView>

      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <PremiumActionModal
          title={t('detail.delete_title')}
          subtitle={t('detail.delete_confirm')}
          actionText={t('expense.erase_outflow')}
          cancelText={t('common.cancel')}
          iconType="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </Modal>

      <Modal visible={showSuccess !== null} transparent animationType="fade">
        <BusinessSuccessModal 
          details={{
            title: showSuccess === 'edit' ? t('expense.modified_success') : t('expense.erased_success'),
            subtitle: showSuccess === 'edit' ? t('expense.record_updated') : t('expense.funds_recovered'),
            mainLabel: t('expense.capital_magnitude'),
            mainValue: `${editForm.amount} ${t('common.etb')}`,
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
  badgeContainer: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  heroSub: { fontSize: 13, fontFamily: Fonts.bold, letterSpacing: 1.5, marginBottom: 5 },
  heroTitle: { fontSize: 44, fontFamily: Fonts.bold, letterSpacing: -2, textAlign: 'center' },
  priceEditRow: { flexDirection: 'row', alignItems: 'baseline' },
  heroInput: { fontSize: 32, fontFamily: Fonts.bold, textAlign: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', borderRadius: 12, paddingHorizontal: 20, minWidth: 150 },
  heroMeta: { fontSize: 13, fontFamily: Fonts.bold, marginTop: 10, opacity: 0.6 },
  scrollContent: { padding: 25 },
  section: { marginBottom: 35 },
  sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15, marginLeft: 5 },
  row: { flexDirection: 'row', gap: 15 },
  intelligenceBlock: { borderRadius: 32, padding: 20, borderWidth: 1 },
  node: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  nodeInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nodeLabel: { fontSize: 11, fontFamily: Fonts.bold },
  nodeValue: { fontSize: 16, fontFamily: Fonts.bold },
  nodeSub: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 2 },
  nodeInput: { fontSize: 15, fontFamily: Fonts.bold, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, minWidth: 140, textAlign: 'right' },
  nodeDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 4 },
  miniBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: Fonts.bold },
  dateNodes: { flexDirection: 'row', gap: 10, marginTop: 15 },
  dNode: { flex: 1, borderRadius: 18, padding: 15, borderWidth: 1 },
  dLabel: { fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 0.5, marginBottom: 4 },
  dValue: { fontSize: 13, fontFamily: Fonts.bold },
  actionFloat: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 25, paddingTop: 20, paddingBottom: 40 },
  primaryAction: { height: 65, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  actionText: { fontSize: 16, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  editActions: { flexDirection: 'row', alignItems: 'center' }
});

export default ExpenseDetails;