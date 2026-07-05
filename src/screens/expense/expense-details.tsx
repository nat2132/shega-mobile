import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal
} from 'react-native';
import Animated, { 
  FadeInDown, 
  ZoomIn
} from 'react-native-reanimated';
import { 
  Repeat, 
  Tag, 
  Edit2, 
  Check, 
  X,
  ChevronLeft,
  TrendingDown,
  ShieldCheck,
  Zap,
  Trash2
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { playNice} from '@/services/soundService';
import { Fonts } from '@/constants/theme';
import { updateExpense, deleteExpense } from '@/database/db';
import { notifyExpenseEdited, notifyExpenseDeleted } from '@/services/notificationService';
import { useSettings } from '@/context/SettingsContext';
import { formatDate } from '@/utils/date-utils';
import { AppNumber, AppText } from '@/components/ui';
import PremiumActionModal from '@/components/PremiumActionModal';
import { getExpenseGlass } from './glass-expense';

const ExpenseDetails = ({ expense, onClose }: { expense: any, onClose?: () => void }) => {
  const { colors, calendarType, language, t } = useSettings();
  const G = getExpenseGlass(colors);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(expense);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!expense || !expense.id) return null;

  const validateEditForm = () => {
    const amountNum = Number(editForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('expense.validation_amount') || 'Please enter a valid amount greater than zero');
      return false;
    }
    if (!editForm.name || !editForm.name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('expense.validation_name') || 'Please enter a description');
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!validateEditForm()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playNice();
    const success = updateExpense(expense.id, editForm);
    if (success) {
      notifyExpenseEdited({
        id: expense.id,
        name: editForm.name || expense.name,
        amount: Number(editForm.amount) || expense.amount,
        category: editForm.category || expense.category,
        oldAmount: expense.amount,
      });
      setIsEditing(false);
      if (onClose) onClose();
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
    if (!expense || !expense.id) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('common.error'));
      return;
    }
    const deletedName = expense.name;
    const deletedAmount = expense.amount;
    const deletedCategory = expense.category;
    const success = deleteExpense(expense.id);
    if (success) {
      notifyExpenseDeleted({
        name: deletedName,
        amount: deletedAmount,
        category: deletedCategory,
      });
      setShowDeleteConfirm(false);
      if (onClose) onClose();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('common.error'));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Ambient glow washes */}
      <View style={{ position: 'absolute', top: -120, left: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: G.mutedLight, opacity: 0.15 }} />
      <View style={{ position: 'absolute', bottom: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: G.mutedLight, opacity: 0.10 }} />
      {/* Capital Drill-down Header */}
      <View style={styles.heroContainer}>
          <View style={[styles.heroWash, { backgroundColor: colors.error + '08' }]} />
         <View style={styles.topActions}>
            <TouchableOpacity onPress={onClose} style={[styles.circleBtn, { backgroundColor: G.bgCard }]}>
               <ChevronLeft size={20} color={G.fg} />
            </TouchableOpacity>
            <View style={styles.row}>
               {isEditing ? (
                 <View style={styles.editActions}>
                    <TouchableOpacity onPress={handleCancel} style={[styles.circleBtn, { backgroundColor: colors.error + '15', marginRight: 10 }]}>
                       <X size={20} color={colors.error} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSave} style={[styles.circleBtn, { backgroundColor: colors.success + '15' }]}>
                       <Check size={20} color={colors.success} />
                    </TouchableOpacity>
                 </View>
               ) : (
                 <View style={styles.editActions}>
                    <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={[styles.circleBtn, { backgroundColor: colors.error + '15', marginRight: 10 }]}>
                       <Trash2 size={18} color={colors.error} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setIsEditing(true); }} style={[styles.circleBtn, { backgroundColor: G.bgCard }]}>
                        <Edit2 size={18} color={G.fg} />
                    </TouchableOpacity>
                 </View>
               )}
            </View>
         </View>

         <Animated.View entering={ZoomIn} style={styles.heroContent}>
            <View style={[styles.badgeContainer, { backgroundColor: colors.error + '15' }]}>
               <TrendingDown size={28} color={colors.error} />
            </View>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.heroSub, { color: G.fgSecondary }]} numberOfLines={1}>{t('expense.capital_management')}</AppText>
{isEditing ? (
               <View style={styles.priceEditRow}>
                 <TextInput
                   style={[styles.heroInput, { color: G.fg, borderColor: G.border }]}
                   value={String(editForm.amount)}
                   keyboardType="numeric"
                   onChangeText={(text) => {
                     const num = Number(text);
                     setEditForm((prev: any) => ({ ...prev, amount: isNaN(num) ? 0 : num }));
                   }}
                 />
                 <AppText variant="heading" weight="bold" style={[styles.heroTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('common.etb')}</AppText>
               </View>
            ) : (
                <View style={styles.heroTitleRow}>
                  <AppNumber value={editForm.amount} size="display" prefix={t('common.etb') + ' '} />
                </View>
            )}
            <AppText variant="body-sm" weight="bold" style={[styles.heroMeta, { color: G.fgSecondary }]} numberOfLines={1}>
               {editForm.date ? formatDate(new Date(editForm.date), calendarType, language) : t('common.loading')}
            </AppText>
         </Animated.View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Magnitude & Context */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
           <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('expense.outflow_identity')}</AppText>
            <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border, overflow: 'hidden' }]}>
               <View style={styles.node}>
                  <View style={styles.nodeInfo}>
                     <Zap size={16} color={G.fgSecondary} />
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('common.description')}</AppText>
                 </View>
                 {isEditing ? (
                   <TextInput 
                     style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]} 
                     value={editForm.name}
                     onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, name: t }))}
                   />
                 ) : (
                   <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: G.fg }]} numberOfLines={2}>{editForm.name}</AppText>
                 )}
              </View>
               <View style={[styles.nodeDivider, { backgroundColor: G.border }]} />
               <View style={styles.node}>
                  <View style={styles.nodeInfo}>
                     <Tag size={16} color={G.fgSecondary} />
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('common.category')}</AppText>
                 </View>
                 {isEditing ? (
                   <TextInput 
                     style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]} 
                     value={editForm.category || ''}
                     onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, category: t }))}
                   />
                 ) : (
                    <View style={[styles.miniBadge, { backgroundColor: G.accentGlass }]}>
                       <AppText variant="caption" weight="bold" transform="uppercase" shrink={false} style={[styles.badgeText, { color: G.fgSecondary }]} numberOfLines={1}>{editForm.category || t('common.none')}</AppText>
                   </View>
                 )}
              </View>
           </View>
        </Animated.View>

        {/* Orchestration Block (Recurring) */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('expense.orchestration_nodes')}</AppText>
           <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border, overflow: 'hidden' }]}>
             <View style={styles.node}>
               <View style={styles.nodeInfo}>
                 <Repeat size={18} color={editForm.isRecurring ? colors.primary : G.fgSecondary} />
                <View>
                  <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: G.fg }]} numberOfLines={1}>{editForm.isRecurring ? t('expense.automated') : t('expense.one_time')}</AppText>
                  <AppText variant="caption" weight="medium" style={[styles.nodeSub, { color: G.fgSecondary }]} numberOfLines={2}>{editForm.isRecurring ? t('expense.repeats_every', { frequency: t(`expense.${(editForm.frequency || 'Monthly').toLowerCase()}`) }) : t('expense.no_pulse')}</AppText>
                </View>
              </View>
            </View>
            {editForm.isRecurring && (
              <View style={styles.dateNodes}>
                <View style={[styles.dNode, { backgroundColor: G.bg, borderColor: G.border, overflow: 'hidden' }]}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.dLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('expense.committed')}</AppText>
                  <AppText variant="body-sm" weight="bold" style={[styles.dValue, { color: G.fg }]} numberOfLines={1}>{editForm.date ? formatDate(new Date(editForm.date), calendarType, language) : 'N/A'}</AppText>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.dLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('expense.next_drill')}</AppText>
                  <AppText variant="body-sm" weight="bold" style={[styles.dValue, { color: colors.primary }]} numberOfLines={1}>{editForm.nextBillingDate ? formatDate(new Date(editForm.nextBillingDate), calendarType, language) : 'N/A'}</AppText>
                </View>
              </View>
            )}
          </View>
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Float */}
      <View style={[styles.actionFloat, { backgroundColor: colors.background }]}>
         <TouchableOpacity 
            style={[styles.primaryAction, { backgroundColor: G.fg, shadowColor: G.fg }]}
           onPress={isEditing ? handleSave : () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsEditing(true); }}
         >
            {isEditing ? (
              <ShieldCheck size={20} color={G.bg} />
            ) : (
              <Edit2 size={18} color={G.bg} />
            )}
            <AppText variant="body" weight="bold" style={[styles.actionText, { color: G.bg }]} numberOfLines={1}>
              {isEditing ? t('expense.commit_ledger') : t('expense.modify_outflow')}
            </AppText>
         </TouchableOpacity>
      </View>

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
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
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