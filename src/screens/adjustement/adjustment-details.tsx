import React, { useState } from 'react';
import { View, Text as RNText, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Trash2, Edit2, ShieldCheck, AlignLeft, Info, Calendar, Box, Activity, ChevronRight, Hash, DollarSign, Package, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSettings } from '@/context/SettingsContext';
import { updateAdjustment, deleteAdjustment } from '@/database/db';
import PremiumActionModal from '@/components/PremiumActionModal';
import BusinessSuccessModal, { BusinessSuccessDetails } from '@/components/BusinessSuccessModal';
import { Fonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

interface AdjustmentDetailsProps {
  adjustment: any;
  onClose: () => void;
  onRefresh: () => void;
}

const AdjustmentDetailsScreen: React.FC<AdjustmentDetailsProps> = ({ adjustment, onClose, onRefresh }) => {
  const { colors, t } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [successDetails, setSuccessDetails] = useState<BusinessSuccessDetails | null>(null);

  // Editable fields
  const [quantity, setQuantity] = useState(adjustment.quantity?.toString() || '');
  const [newValue, setNewValue] = useState(adjustment.newValue?.toString() || '');
  const [reason, setReason] = useState(adjustment.reason || '');

  const isDamaged = adjustment.type === 'damaged';
  const isUp = adjustment.type === 'price_up';
  
  const getStatusConfig = () => {
    if (isDamaged) return { icon: AlertTriangle, color: '#FF9500', bg: '#FF950015', label: t('adjustment.damaged') };
    if (isUp) return { icon: TrendingUp, color: '#34C759', bg: '#34C75915', label: t('adjustment.price_increase') };
    return { icon: TrendingDown, color: '#FF3B30', bg: '#FF3B3015', label: t('adjustment.price_decrease') };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const handleUpdate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updates: any = {};
    if (isDamaged && quantity) updates.quantity = Number(quantity);
    if (!isDamaged && newValue) updates.newValue = Number(newValue);
    updates.reason = reason;

    updateAdjustment(adjustment.id, updates);
    setIsEditing(false);
    onRefresh();
    
    setSuccessDetails({
      title: t('adj.edited_success') || 'Adjustment Updated',
      subtitle: t('adj.edited_sub') || 'Calibration record modified successfully',
      primaryValue: isDamaged ? `-${quantity} Units` : `${newValue} ETB`,
      secondaryValue: t('common.edited') || 'Edited',
      accentColor: colors.primary
    });
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deleteAdjustment(adjustment.id);
    setShowDeleteConfirm(false);
    onRefresh();
    
    setSuccessDetails({
      title: t('adj.deleted_success') || 'Record Deleted',
      subtitle: t('adj.deleted_sub') || 'Calibration record removed securely',
      primaryValue: t('common.deleted') || 'Deleted',
      secondaryValue: '',
      accentColor: '#FF3B30'
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header Block */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.headerBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.headerTop}>
            <View style={[styles.typeBadge, { backgroundColor: config.bg }]}>
              <Icon size={14} color={config.color} style={{ marginRight: 6 }} />
              <RNText style={[styles.typeText, { color: config.color }]}>{config.label}</RNText>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setIsEditing(!isEditing); }} style={[styles.actionBtn, { backgroundColor: colors.border }]}>
                 <Edit2 size={16} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={[styles.actionBtn, { backgroundColor: '#FF3B3015' }]}>
                 <Trash2 size={16} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.mainInfo}>
            <View style={[styles.iconBox, { backgroundColor: colors.border }]}>
              <Package size={28} color={colors.text} />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <RNText style={[styles.itemName, { color: colors.text }]}>{adjustment.itemName}</RNText>
              <RNText style={[styles.itemId, { color: colors.textSecondary }]}>
                {t('adj.item_id') || 'Item ID'}: #{adjustment.itemId}
              </RNText>
            </View>
          </View>
        </Animated.View>

        {/* Mutable Fields Block */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.sectionBlock}>
          <RNText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('adj.details') || 'Adjustment Details'}</RNText>

          {isDamaged ? (
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: isEditing ? colors.primary : colors.border }]}>
              <View style={[styles.inputIcon, { backgroundColor: colors.border }]}>
                <Hash size={18} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <RNText style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('form.quantity')}</RNText>
                {isEditing ? (
                  <TextInput
                    style={[styles.inputField, { color: colors.text }]}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                  />
                ) : (
                  <RNText style={[styles.valText, { color: colors.text }]}>{quantity} {adjustment.unitType}</RNText>
                )}
              </View>
            </View>
          ) : (
            <>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.inputIcon, { backgroundColor: colors.border }]}>
                  <DollarSign size={18} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <RNText style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('adj.previous_price') || 'Previous Price'}</RNText>
                  <RNText style={[styles.valText, { color: colors.textSecondary }]}>{adjustment.oldValue} {t('common.etb') || 'ETB'}</RNText>
                </View>
              </View>

              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: isEditing ? colors.primary : colors.border }]}>
                <View style={[styles.inputIcon, { backgroundColor: colors.border }]}>
                  <TrendingUp size={18} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <RNText style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('adj.new_price') || 'New Price'}</RNText>
                  {isEditing ? (
                    <TextInput
                      style={[styles.inputField, { color: colors.text }]}
                      value={newValue}
                      onChangeText={setNewValue}
                      keyboardType="numeric"
                    />
                  ) : (
                    <RNText style={[styles.valText, { color: colors.text }]}>{newValue} {t('common.etb') || 'ETB'}</RNText>
                  )}
                </View>
              </View>
            </>
          )}

          <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: isEditing ? colors.primary : colors.border }]}>
            <View style={[styles.inputIcon, { backgroundColor: colors.border }]}>
              <AlignLeft size={18} color={colors.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <RNText style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('common.reason') || t('adj.reason')}</RNText>
              {isEditing ? (
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  value={reason}
                  onChangeText={setReason}
                  placeholder={t('expense.desc_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <RNText style={[styles.valText, { color: colors.text }]}>{reason || t('adj.manual_correction')}</RNText>
              )}
            </View>
          </View>
        </Animated.View>

        {isEditing && (
          <Animated.View entering={FadeInDown} style={{ paddingHorizontal: 25, marginTop: 10 }}>
            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: colors.text }]} 
              onPress={handleUpdate}
            >
              <RNText style={[styles.saveBtnText, { color: colors.background }]}>{t('adj.save_changes') || 'Save Changes'}</RNText>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <PremiumActionModal
          title={t('adj.delete_confirm') || 'Delete Calibration?'}
          subtitle={t('adj.delete_desc') || "This action removes the record. Damaged quantities will be refunded to inventory. It cannot be undone."}
          actionText={t('common.delete') || 'Delete'}
          cancelText={t('common.cancel')}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          iconType="danger"
        />
      </Modal>

      {successDetails && (
        <BusinessSuccessModal
          visible={!!successDetails}
          details={successDetails}
          onClose={() => {
            setSuccessDetails(null);
            onClose();
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  headerBlock: {
    margin: 25,
    marginTop: 10,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  typeText: { fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  actionBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  mainInfo: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 20, fontFamily: Fonts.bold, marginBottom: 4 },
  itemId: { fontSize: 13, fontFamily: Fonts.medium },
  sectionBlock: { paddingHorizontal: 25, gap: 12 },
  sectionTitle: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', marginBottom: 5, marginLeft: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, borderWidth: 1 },
  inputIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  inputLabel: { fontSize: 11, fontFamily: Fonts.semibold, textTransform: 'uppercase', marginBottom: 2 },
  valText: { fontSize: 16, fontFamily: Fonts.bold },
  inputField: { fontSize: 16, fontFamily: Fonts.bold, padding: 0, margin: 0 },
  saveBtn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontFamily: Fonts.bold },
});

export default AdjustmentDetailsScreen;
