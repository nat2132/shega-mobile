import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Bell, Check, X, Clock } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { markRecurringAsPaid, markRecurringAsOverdue } from '@/database/db';
import { AppNumber, AppText } from '@/components/ui';
import * as Haptics from 'expo-haptics';
interface ExpenseReminderModalProps {
  visible: boolean;
  expense: any;
  onClose: () => void;
  onActionComplete: () => void;
}

const ExpenseReminderModal: React.FC<ExpenseReminderModalProps> = ({
  visible,
  expense,
  onClose,
  onActionComplete,
}) => {
  const { colors, t } = useSettings();

  const handleMarkAsPaid = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await markRecurringAsPaid(expense.id);
    onActionComplete();
    onClose();
  };

  const handleNotPaidYet = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await markRecurringAsOverdue(expense.id);
    onActionComplete();
    onClose();
  };

  if (!expense) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View entering={FadeInUp.duration(400)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
            <Bell size={32} color={colors.primary} />
          </View>

          {/* Title */}
          <AppText variant="title" weight="bold" numberOfLines={2} style={[styles.title, { color: colors.text }]}>{t('common.recurring_due')}</AppText>
          <AppText variant="body" weight="medium" numberOfLines={3} style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('common.scheduled_due')}
          </AppText>

          {/* Expense details */}
          <View style={[styles.detailBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.detailRow}>
              <AppText variant="caption" weight="bold" numberOfLines={1} style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('expense.name')}</AppText>
              <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.detailValue, { color: colors.text }]}>{expense.name}</AppText>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.detailRow}>
              <AppText variant="caption" weight="bold" numberOfLines={1} style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('expense.magnitude')}</AppText>
              <AppNumber value={typeof expense.amount === 'number' ? expense.amount : Number(expense.amount) || 0} size="body" showCurrency />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.detailRow}>
              <AppText variant="caption" weight="bold" numberOfLines={1} style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('expense.recurring')}</AppText>
              <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.detailValue, { color: colors.text }]}>{expense.frequency || t('common.none')}</AppText>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.detailRow}>
              <AppText variant="caption" weight="bold" numberOfLines={1} style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('dash.due_date')}</AppText>
              <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.detailValue, { color: colors.primary }]}>{expense.nextBillingDate || expense.date}</AppText>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success }]}
            onPress={handleMarkAsPaid}
            activeOpacity={0.8}
          >
            <Check size={20} color="#FFF" />
            <AppText variant="body" weight="bold" numberOfLines={1} style={styles.actionBtnText}>{t('common.mark_paid')}</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.error }]}
            onPress={handleNotPaidYet}
            activeOpacity={0.8}
          >
            <X size={20} color="#FFF" />
            <AppText variant="body" weight="bold" numberOfLines={1} style={styles.actionBtnText}>{t('common.not_paid')}</AppText>
          </TouchableOpacity>

          {/* Dismiss */}
          <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.7}>
            <Clock size={16} color={colors.textSecondary} />
            <AppText variant="caption" weight="medium" numberOfLines={1} style={[styles.dismissText, { color: colors.textSecondary }]}>{t('common.remind_later')}</AppText>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 28,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: Fonts.bold,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  detailBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontFamily: Fonts.medium,
  },
  detailValue: {
    fontFamily: Fonts.semibold,
    textAlign: 'right',
    maxWidth: '60%',
  },
  divider: {
    height: 1,
    opacity: 0.5,
  },
  actionBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  actionBtnText: {
    color: '#FFF',
    fontFamily: Fonts.bold,
  },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginTop: 4,
  },
  dismissText: {
    fontFamily: Fonts.medium,
  },
});

export default ExpenseReminderModal;