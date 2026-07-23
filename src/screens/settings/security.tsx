import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import * as SecureStore from 'expo-secure-store';
import { Eye, EyeOff, Lock, Shield, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { AppText, AppCard, AppButton, AppListItem, AppRow } from '@/components/ui';
import { useTutorial, TutorialTarget, TutorialButton } from '@/tutorials';
import { securitySettingsTutorial } from '@/tutorials/definitions';
const SecuritySettings = () => {
  const { pin, setPin, colors, t } = useSettings();
  const dialog = useDialog();

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);

  // Read PIN directly from SecureStore so we always have the latest value
  // even if the context hasn't finished its async load yet.
  const [resolvedPin, setResolvedPin] = useState<string | null>(pin);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync('settings_pin').then((stored) => {
      setResolvedPin(stored ?? null);
      setLoading(false);
    });
  }, []);

  // Keep in sync when context updates (e.g. after setPin is called)
  useEffect(() => {
    setResolvedPin(pin);
  }, [pin]);

  const tutorial = useTutorial({ tutorial: securitySettingsTutorial });

  const hasPin = !!resolvedPin;

  const handleUpdatePin = async () => {
    const trimmedCurrent = currentPin.trim();
    const trimmedNew = newPin.trim();
    const trimmedConfirm = confirmPin.trim();
    if (hasPin && trimmedCurrent !== resolvedPin) {
      await dialog.alert({ title: t('common.error'), message: t('security.enter_current_pin'), iconType: 'danger' });
      return;
    }
    if (trimmedNew.length !== 4 || isNaN(Number(trimmedNew))) {
      await dialog.alert({ title: t('common.error'), message: t('settings.pin_invalid'), iconType: 'danger' });
      return;
    }
    if (trimmedNew !== trimmedConfirm) {
      await dialog.alert({ title: t('common.error'), message: t('settings.pin_mismatch'), iconType: 'danger' });
      return;
    }
    setPin(trimmedNew);
    setResolvedPin(trimmedNew);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    await dialog.alert({ title: t('common.success'), message: t('settings.pin_success'), iconType: 'success' });
  };

  const handleRemovePin = async () => {
    if (currentPin !== resolvedPin) {
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
          placeholder="* * * *"
          secureTextEntry={!show}
          keyboardType="number-pad"
          maxLength={4}
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TutorialTarget id="sec-header">
      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.header, { color: colors.textSecondary }]} numberOfLines={2}>{t('settings.security_settings')}</AppText>
      <AppText variant="display" weight="bold" style={[styles.subHeader, { color: colors.text }]} numberOfLines={2}>{hasPin ? t('security.change_pin') : t('settings.security')}</AppText>
      </TutorialTarget>

      <TutorialTarget id="sec-biometric">
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
      </TutorialTarget>

      <TutorialTarget id="sec-pin">
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
      </TutorialTarget>

      <TutorialTarget id="sec-recovery">
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
      </TutorialTarget>
      <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 100 }}>
        <TutorialButton tutorialId="security-settings" screenName={t('settings.security_settings')} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25 },
  header: { fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 1.5, marginTop: 20 },
  subHeader: { fontSize: 26, fontFamily: Fonts.bold, marginTop: 8, marginBottom: 16 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, marginBottom: 20, borderWidth: 1,
  },
  statusText: { fontSize: 13, fontFamily: Fonts.bold },
  formCard: { borderWidth: 1, borderRadius: 20, padding: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontFamily: Fonts.semibold, marginBottom: 8, fontSize: 13 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 15 },
  input: { flex: 1, paddingVertical: 14, fontSize: 20, letterSpacing: 8, fontFamily: Fonts.bold },
  eyeBtn: { padding: 8 },
  updateButton: { flexDirection: 'row', gap: 8, padding: 16, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  updateButtonText: { fontSize: 16, fontFamily: Fonts.bold },
  removeSection: { marginTop: 35 },
  removeHeader: { fontSize: 20, fontFamily: Fonts.bold, marginBottom: 8 },
  removeDescription: { lineHeight: 20, marginBottom: 20, fontSize: 13, fontFamily: Fonts.medium },
  removeButton: { flexDirection: 'row', gap: 8, backgroundColor: '#FF3B30', padding: 16, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  removeButtonText: { color: '#FFF', fontSize: 16, fontFamily: Fonts.bold },
});

export default SecuritySettings;
