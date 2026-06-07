import React, { useState } from 'react';
import { 
  View, 
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
  ZoomIn,
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
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
import PremiumActionModal from '@/components/PremiumActionModal';
const { width } = Dimensions.get('window');

const ExpenseDetails = ({ expense, onClose }: { expense: any, onClose?: () => void }) => {
  const { colors, calendarType, language, t, theme } = useSettings();
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
    const success = updateExpense(expense.id, editForm);
    if (success) {
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
    const success = deleteExpense(expense.id);
    if (success) {
      setShowDeleteConfirm(false);
      if (onClose) onClose();
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

         <Animated.View entering={ZoomIn} style={styles.heroContent}>
            <View style={[styles.badgeContainer, { backgroundColor: '#FF3B3015' }]}>
               <TrendingDown size={28} color="#FF3B30" />
            </View>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.heroSub, { color: colors.textSecondary }]} numberOfLines={1}>{t('expense.capital_management')}</AppText>
{isEditing ? (
               <View style={styles.priceEditRow}>
                 <TextInput
                   style={[styles.heroInput, { color: colors.text }]}
                   value={String(editForm.amount)}
                   keyboardType="numeric"
                   onChangeText={(text) => {
                     const num = Number(text);
                     setEditForm((prev: any) => ({ ...prev, amount: isNaN(num) ? 0 : num }));
                   }}
                 />
                 <AppText variant="heading" weight="bold" style={[styles.heroTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('common.etb')}</AppText>
               </View>
            ) : (
               <View style={styles.heroTitleRow}>
                 <AppText variant="display" weight="bold" style={[styles.heroTitle, { color: colors.text }]} numberOfLines={1}>{typeof editForm.amount === 'number' ? editForm.amount.toLocaleString() : 0}</AppText>
                 <AppText variant="heading" weight="medium" style={{ opacity: 0.6, color: colors.text, marginLeft: 8 }} numberOfLines={1}>{t('common.etb')}</AppText>
               </View>
            )}
            <AppText variant="body-sm" weight="bold" style={[styles.heroMeta, { color: colors.textSecondary }]} numberOfLines={1}>
               {editForm.date ? formatDate(new Date(editForm.date), calendarType, language) : t('common.loading')}
            </AppText>
         </Animated.View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Magnitude & Context */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
           <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('expense.outflow_identity')}</AppText>
           <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Zap size={16} color={colors.textSecondary} />
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('common.description')}</AppText>
                 </View>
                 {isEditing ? (
                   <TextInput 
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]} 
                     value={editForm.name}
                     onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, name: t }))}
                   />
                 ) : (
                   <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: colors.text }]} numberOfLines={2}>{editForm.name}</AppText>
                 )}
              </View>
              <View style={styles.nodeDivider} />
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Tag size={16} color={colors.textSecondary} />
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('common.category')}</AppText>
                 </View>
                 {isEditing ? (
                   <TextInput 
                     style={[styles.nodeInput, { color: colors.text, borderColor: colors.border }]} 
                     value={editForm.category || ''}
                     onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, category: t }))}
                   />
                 ) : (
                   <View style={[styles.miniBadge, { backgroundColor: colors.text + '08' }]}>
                      <AppText variant="caption" weight="bold" transform="uppercase" shrink={false} style={[styles.badgeText, { color: colors.textSecondary }]} numberOfLines={1}>{editForm.category || t('common.none')}</AppText>
                   </View>
                 )}
              </View>
           </View>
        </Animated.View>

        {/* Orchestration Block (Recurring) */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('expense.orchestration_nodes')}</AppText>
          <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.node}>
              <View style={styles.nodeInfo}>
                <Repeat size={18} color={editForm.isRecurring ? colors.primary : colors.textSecondary} />
                <View>
                  <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: colors.text }]} numberOfLines={1}>{editForm.isRecurring ? t('expense.automated') : t('expense.one_time')}</AppText>
                  <AppText variant="caption" weight="medium" style={[styles.nodeSub, { color: colors.textSecondary }]} numberOfLines={2}>{editForm.isRecurring ? t('expense.repeats_every', { frequency: t(`expense.${(editForm.frequency || 'Monthly').toLowerCase()}`) }) : t('expense.no_pulse')}</AppText>
                </View>
              </View>
            </View>
            {editForm.isRecurring && (
              <View style={styles.dateNodes}>
                <View style={[styles.dNode, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.dLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('expense.committed')}</AppText>
                  <AppText variant="body-sm" weight="bold" style={[styles.dValue, { color: colors.text }]} numberOfLines={1}>{editForm.date ? formatDate(new Date(editForm.date), calendarType, language) : 'N/A'}</AppText>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.dLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('expense.next_drill')}</AppText>
                  <AppText variant="body-sm" weight="bold" style={[styles.dValue, { color: colors.primary }]} numberOfLines={1}>{editForm.nextBillingDate ? formatDate(new Date(editForm.nextBillingDate), calendarType, language) : 'N/A'}</AppText>
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
            <AppText variant="body" weight="bold" style={[styles.actionText, { color: colors.background }]} numberOfLines={1}>
              {isEditing ? t('expense.commit_ledger') : t('expense.modify_outflow')}
            </AppText>
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