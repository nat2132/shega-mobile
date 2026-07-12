import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Plus, X, Sparkles, Minus } from 'lucide-react-native';

import * as Haptics from 'expo-haptics';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { AppText, AppNumber } from '@/components/ui';
import { useTutorial, TutorialTarget, TutorialButton } from '@/tutorials';
import { addOrderItemTutorial } from '@/tutorials/definitions';

interface AddOrderItemModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, companyName: string, orderQty: number) => void;
}

export const AddOrderItemModal: React.FC<AddOrderItemModalProps> = ({ visible, onClose, onAdd }) => {
  const { colors, t } = useSettings();
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [orderQty, setOrderQty] = useState(10);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const tutorial = useTutorial({ tutorial: addOrderItemTutorial });

  const validateForm = () => {
    let currentErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      currentErrors.name = t('form.error_name_required') || 'Product name is required';
    } else if (name.trim().length < 2) {
      currentErrors.name = t('form.error_name_min') || 'Product name must be at least 2 characters';
    }
    
    if (orderQty <= 0) {
      currentErrors.orderQty = t('form.error_quantity_positive') || 'Quantity must be greater than 0';
    }
    
    if (!companyName.trim()) {
      currentErrors.companyName = t('form.error_company_required') || 'Company name is required';
    }
    
    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  };

  const handleAdd = () => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAdd(name.trim(), companyName.trim(), orderQty);
    setName('');
    setCompanyName('');
    setOrderQty(10);
    onClose();
  };

  const handleClose = () => {
    setName('');
    setCompanyName('');
    setOrderQty(10);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.50)' }]} activeOpacity={1} onPress={handleClose} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            entering={SlideInDown.springify().damping(28).stiffness(250)}
            style={[styles.sheet, { backgroundColor: colors.background, borderTopColor: colors.border }]}
          >
            <View style={{ position: 'absolute', top: 16, right: 70, zIndex: 100 }}>
              <TutorialButton tutorialId="add-order-item" screenName={t('common.add')} />
            </View>
            <TutorialTarget id="aoi-header">
            <View style={styles.header}>
              <View style={styles.headerIndicator}>
                <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
              </View>
              <View style={styles.headerTitleRow}>
                <View style={[styles.titleIconBox, { backgroundColor: colors.primary + '15' }]}>
                  <Sparkles size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="title" weight="bold" numberOfLines={2} style={[styles.titleText, { color: colors.text }]}>{t('common.add')}</AppText>
                  <AppText variant="body" weight="medium" numberOfLines={3} style={[styles.subtitleText, { color: colors.textSecondary }]}>
                    {t('modal.add_product_desc')}
                  </AppText>
                </View>
                <TouchableOpacity
                  style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={handleClose}
                >
                  <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            </TutorialTarget>

            <View style={styles.formBody}>
              <TutorialTarget id="aoi-name">
              <View style={styles.inputGroup}>
                <AppText variant="caption" weight="bold" numberOfLines={1} transform="uppercase" style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('common.product_name')} *</AppText>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: errors.name ? '#FF3B30' : colors.border, color: colors.text }]}
                  placeholder={t('modal.product_name_placeholder')}
                  placeholderTextColor={colors.textSecondary + '60'}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                  }}
                  autoFocus
                />
                {errors.name && <AppText variant="body" weight="medium" numberOfLines={3} style={styles.errorText}>{errors.name}</AppText>}
              </View>
              </TutorialTarget>

              <TutorialTarget id="aoi-company">
              <View style={styles.inputGroup}>
                <AppText variant="caption" weight="bold" numberOfLines={1} transform="uppercase" style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('common.company_brand')}</AppText>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: errors.companyName ? '#FF3B30' : colors.border, color: colors.text }]}
                  placeholder={t('modal.company_placeholder')}
                  placeholderTextColor={colors.textSecondary + '60'}
                  value={companyName}
                  onChangeText={(text) => {
                    setCompanyName(text);
                    if (errors.companyName) setErrors(prev => ({ ...prev, companyName: '' }));
                  }}
                />
                {errors.companyName && <AppText variant="body" weight="medium" numberOfLines={3} style={styles.errorText}>{errors.companyName}</AppText>}
              </View>
              </TutorialTarget>

              <TutorialTarget id="aoi-quantity">
              <View style={styles.inputGroup}>
                <AppText variant="caption" weight="bold" numberOfLines={1} transform="uppercase" style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('common.order_quantity')}</AppText>
                <View style={styles.qtyStepperRow}>
                  <TouchableOpacity
                    style={[styles.qtyBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setOrderQty(Math.max(1, orderQty - 1));
                      if (errors.orderQty) setErrors(prev => ({ ...prev, orderQty: '' }));
                    }}
                    activeOpacity={0.7}
                  >
                    <Minus size={18} color={colors.text} />
                  </TouchableOpacity>
                  <View style={[styles.qtyValueBox, { backgroundColor: colors.card, borderColor: errors.orderQty ? '#FF3B30' : colors.border }]}>
                    <AppNumber value={orderQty} size="body" style={[styles.qtyValue, { color: colors.text }]} />
                  </View>
                  <TouchableOpacity
                    style={[styles.qtyBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setOrderQty(orderQty + 1);
                      if (errors.orderQty) setErrors(prev => ({ ...prev, orderQty: '' }));
                    }}
                    activeOpacity={0.7}
                  >
                    <Plus size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
                {errors.orderQty && <AppText variant="body" weight="medium" numberOfLines={3} style={styles.errorText}>{errors.orderQty}</AppText>}
              </View>
              </TutorialTarget>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.8}
                onPress={handleClose}
              >
                <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.actionBtnText, { color: colors.text }]}>{t('common.cancel')}</AppText>
              </TouchableOpacity>
              <TutorialTarget id="aoi-commit-btn">
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  styles.addBtn,
                  { backgroundColor: Object.keys(errors).length === 0 && name.trim() && companyName.trim() && orderQty > 0 ? colors.text : colors.textSecondary + '40' }
                ]}
                activeOpacity={0.8}
                onPress={handleAdd}
              >
                <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.actionBtnText, { color: colors.background }]}>{t('common.add_to_order')}</AppText>
              </TouchableOpacity>
              </TutorialTarget>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 44 : 30,
    elevation: 8,
  },
  header: {
    paddingHorizontal: 25,
    paddingTop: 15,
    paddingBottom: 10,
  },
  headerIndicator: {
    alignItems: 'center',
    marginBottom: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  titleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    fontFamily: Fonts.bold,
    lineHeight: 24,
  },
  subtitleText: {
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formBody: {
    paddingHorizontal: 25,
    paddingTop: 15,
    gap: 18,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontFamily: Fonts.medium,
  },
  qtyStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyValueBox: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyValue: {
    fontFamily: Fonts.bold,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 25,
    marginTop: 25,
    gap: 15,
  },
  actionBtn: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    borderWidth: 0,
  },
  actionBtnText: {
    fontFamily: Fonts.bold,
  },
  errorText: {
    fontFamily: Fonts.semibold,
    color: '#FF3B30',
    marginTop: 4,
    marginLeft: 5,
  },
});