import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import * as SecureStore from 'expo-secure-store';
import { Eye, EyeOff, Lock, Shield, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { AppText, AppCard, AppButton, AppListItem, AppRow } from '@/components/ui';
import { getCurrentUserId, getUser, setUserPin, verifyUserPin } from '@/services/businessService';
import { verifyPinHash, storePinHash } from '@/services/crypto';

const SecuritySettings = () => {
  const { pin, setPin, colors, t } = useSettings();
  const dialog = useDialog();

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);

  const [resolvedPin, setResolvedPin] = useState<string | null>(pin);
  const [loading, setLoading] = useState(true);

  const currentUserId = getCurrentUserId();
  const currentUser = currentUserId ? getUser(currentUserId) : null;

  useEffect(() => {
    (async () => {
      let storedPin = pin;
      if (!storedPin) {
        storedPin = await SecureStore.getItemAsync('settings_pin');
      }
      const userPinHash = (currentUser as any)?.pin_hash || (currentUser as any)?.pinHash;
      setResolvedPin(storedPin ?? (userPinHash ? '******' : null));
      setLoading(false);
    })();
  }, [currentUser, pin]);

  const hasPin = !!resolvedPin || !!(currentUser as any)?.pin_hash || !!(currentUser as any)?.pinHash;

  const handleUpdatePin = async () => {
    const trimmedCurrent = currentPin.trim();
    const trimmedNew = newPin.trim();
    const trimmedConfirm = confirmPin.trim();

    if (hasPin && currentUserId) {
      const validCurrent = await verifyUserPin(currentUserId, trimmedCurrent) || await verifyPinHash(trimmedCurrent);
      if (!validCurrent) {
        await dialog.alert({ title: t('common.error'), message: t('security.enter_current_pin'), iconType: 'danger' });
        return;
      }
    }

    if (trimmedNew.length !== 6 || isNaN(Number(trimmedNew))) {
      await dialog.alert({ title: t('common.error'), message: 'PIN must be exactly 6 digits.', iconType: 'danger' });
      return;
    }
    if (trimmedNew !== trimmedConfirm) {
      await dialog.alert({ title: t('common.error'), message: t('settings.pin_mismatch'), iconType: 'danger' });
      return;
    }

    if (currentUserId) {
      setUserPin(currentUserId, trimmedNew);
    }
    await storePinHash(trimmedNew);
    setPin(trimmedNew);
    setResolvedPin(trimmedNew);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    await dialog.alert({ title: t('common.success'), message: t('settings.pin_success'), iconType: 'success' });
  };

  const handleRemovePin = async () => {
    if (currentUserId && !(await verifyUserPin(currentUserId, currentPin.trim()) || await verifyPinHash(currentPin.trim()))) {
      await dialog.alert({ title: t('common.error'), message: t('security.enter_current_pin'), iconType: 'danger' });
      return;
    }
    const ok = await dialog.confirm({
      title: t('settings.remove_pin'),
      message: t('security.remove_desc') || 'Are you sure you want to remove your security PIN?',
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
      iconType: 'danger',
    });
    if (ok) {
      setPin(null);
      setResolvedPin(null);
      setCurrentPin('');
      await dialog.alert({ title: t('common.success'), message: t('settings.remove_pin'), iconType: 'success' });
    }
  };

  const PinInput = ({ label, value, onChange, show, onToggle }: any) => (
    <View style={styles.inputGroup}>
      <AppText variant="caption" weight="bold" style={[styles.label, { color: colors.text }]} numberOfLines={1}>{label}</AppText>
      <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChange}
          placeholder="* * * * * *"
          secureTextEntry={!show}
          keyboardType="number-pad"
          maxLength={6}
          placeholderTextColor={colors.textSecondary}
        />
        <TouchableOpacity onPress={onToggle} style={styles.eyeBtn}>
          {show ? <Eye color={colors.textSecondary} size={20} /> : <EyeOff color={colors.textSecondary} size={20} />}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.header, { color: colors.textSecondary }]} numberOfLines={2}>{t('settings.security_settings')}</AppText>
      <AppText variant="display" weight="bold" style={[styles.subHeader, { color: colors.text }]} numberOfLines={2}>{hasPin ? t('security.change_pin') : t('settings.security')}</AppText>

      {/* Status Badge */}
      <View style={[
        styles.statusBadge,
        hasPin
          ? { borderColor: '#2ECC71', backgroundColor: '#2ECC7110' }
          : { borderColor: colors.border, backgroundColor: colors.card },
      ]}>
        <Shield size={16} color={hasPin ? '#2ECC71' : colors.textSecondary} />
        <AppText variant="body" weight="bold" style={[styles.statusText, { color: hasPin ? '#2ECC71' : colors.textSecondary }]} numberOfLines={1}>
          {hasPin ? t('settings.pin_protection') : t('settings.no_pin')}
        </AppText>
      </View>

      <View style={[styles.formCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
        {hasPin && (
          <PinInput
            label={t('security.current_pin')}
            value={currentPin}
            onChange={setCurrentPin}
            show={showCurrent}
            onToggle={() => setShowCurrent(p => !p)}
          />
        )}
        <PinInput
          label={t('security.new_pin')}
          value={newPin}
          onChange={setNewPin}
          show={showNew}
          onToggle={() => setShowNew(p => !p)}
        />
        <PinInput
          label={t('security.confirm_pin')}
          value={confirmPin}
          onChange={setConfirmPin}
          show={showConfirm}
          onToggle={() => setShowConfirm(p => !p)}
        />

        <TouchableOpacity style={[styles.updateButton, { backgroundColor: colors.text }]} onPress={handleUpdatePin}>
          <Lock size={18} color={colors.background} />
          <AppText variant="body" weight="bold" style={[styles.updateButtonText, { color: colors.background }]} numberOfLines={1}>
            {hasPin ? t('security.change_pin') : t('common.save')}
          </AppText>
        </TouchableOpacity>
      </View>

      {hasPin && (
        <View style={styles.removeSection}>
          <AppText variant="title" weight="bold" style={[styles.removeHeader, { color: colors.text }]} numberOfLines={2}>{t('settings.remove_pin')}</AppText>
          <AppText variant="body-sm" weight="medium" style={[styles.removeDescription, { color: colors.textSecondary }]} numberOfLines={3}>
            {t('settings.remove_desc')}
          </AppText>
          <TouchableOpacity style={styles.removeButton} onPress={handleRemovePin}>
            <Trash2 size={18} color="#FFF" />
            <AppText variant="body" weight="bold" style={styles.removeButtonText} numberOfLines={1}>{t('settings.remove_pin')}</AppText>
          </TouchableOpacity>
        </View>
      )}
      <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 100 }}>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  subHeader: {
    fontSize: 24,
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  statusText: {
    fontSize: 13,
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
    marginBottom: 24,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    fontFamily: Fonts.medium,
  },
  eyeBtn: {
    padding: 8,
  },
  updateButton: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  updateButtonText: {
    fontSize: 15,
  },
  removeSection: {
    marginTop: 10,
    gap: 8,
  },
  removeHeader: {
    fontSize: 18,
  },
  removeDescription: {
    fontSize: 13,
    marginBottom: 8,
  },
  removeButton: {
    height: 48,
    backgroundColor: '#E74C3C',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  removeButtonText: {
    color: '#FFF',
    fontSize: 15,
  },
});

export default SecuritySettings;
