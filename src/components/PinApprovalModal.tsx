// PinApprovalModal — the themed second-factor prompt for spec §15. When a
// lower-privilege user attempts a sensitive action (refund, stock adjustment,
// price override, …) whose permission value is `'approval'`, the actor must
// enter a manager/owner PIN. This modal captures the PIN and hands it back to
// `usePinApproval`, which verifies it against the approver's salted hash.
//
// It is a controlled presentational component, styled like `CustomDialog` so
// the approval flow feels native and consistent.

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from './AppText';

export interface PinApprovalModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  approverName?: string;
  error?: string | null;
  verifying?: boolean;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
}

const MAX_PIN_LENGTH = 8;

const PinApprovalModal: React.FC<PinApprovalModalProps> = ({
  visible,
  title,
  message,
  approverName,
  error,
  verifying,
  onConfirm,
  onCancel,
}) => {
  const { colors, t } = useSettings();
  const [pin, setPin] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setPin('');
      const id = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(id);
    }
  }, [visible]);

  const submit = () => {
    if (pin.length > 0 && !verifying) onConfirm(pin);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          onPress={() => {}}
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '1F' }]}>
            <ShieldCheck size={28} color={colors.primary} />
          </View>

          {title ? (
            <AppText
              variant="title"
              weight="bold"
              numberOfLines={2}
              style={[styles.title, { color: colors.text }]}
            >
              {title}
            </AppText>
          ) : null}

          {message ? (
            <AppText
              variant="body"
              weight="medium"
              numberOfLines={4}
              style={[styles.message, { color: colors.textSecondary }]}
            >
              {message}
            </AppText>
          ) : null}

          <TextInput
            ref={inputRef}
            value={pin}
            onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, MAX_PIN_LENGTH))}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
            maxLength={MAX_PIN_LENGTH}
            editable={!verifying}
            placeholder={t('auth.enter_manager_pin') || 'Manager PIN'}
            placeholderTextColor={colors.secondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: error ? colors.error : colors.border,
                color: colors.text,
              },
            ]}
          />

          {approverName ? (
            <AppText
              variant="caption"
              weight="regular"
              numberOfLines={1}
                style={[styles.approver, { color: colors.secondary }]}
            >
              {t('auth.pin_approver', { name: approverName }) || `Approved by ${approverName}`}
            </AppText>
          ) : null}

          {error ? (
            <AppText
              variant="caption"
              weight="bold"
              numberOfLines={2}
              style={[styles.error, { color: colors.error }]}
            >
              {error}
            </AppText>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={verifying}
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                styles.btnFlex,
                {
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.background : 'transparent',
                  opacity: verifying ? 0.5 : 1,
                },
              ]}
            >
              <AppText variant="label" weight="bold" numberOfLines={1} color={colors.text}>
                {t('common.cancel')}
              </AppText>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={verifying || pin.length === 0}
              style={({ pressed }) => [
                styles.btn,
                styles.btnFlex,
                {
                  backgroundColor: colors.primary,
                  opacity: pin.length === 0 || verifying ? 0.55 : pressed ? 0.9 : 1,
                },
              ]}
            >
              <AppText variant="label" weight="bold" numberOfLines={1} color={colors.background}>
                {verifying ? t('common.verifying') || 'Verifying…' : t('common.approve') || 'Approve'}
              </AppText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

PinApprovalModal.displayName = 'PinApprovalModal';

export default PinApprovalModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.xs,
    fontFamily: Fonts.bold,
  },
  message: {
    textAlign: 'center',
    marginBottom: Spacing.md,
    fontFamily: Fonts.regular,
  },
  input: {
    width: '100%',
    minHeight: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontFamily: Fonts.bold,
    marginBottom: Spacing.xs,
  },
  approver: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontFamily: Fonts.regular,
  },
  error: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontFamily: Fonts.regular,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  btn: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    borderWidth: 1,
  },
  btnFlex: {
    flex: 1,
  },
});
