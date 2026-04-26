import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { EyeOff, Eye, Shield, Lock, Trash2 } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';

const SecuritySettings = () => {
  const { pin, setPin, colors, t } = useSettings();

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);

  const hasPin = !!pin;

  const handleUpdatePin = () => {
    if (hasPin && currentPin !== pin) {
      Alert.alert(t('common.error'), t('security.pin_invalid') || t('security.enter_current_pin'));
      return;
    }
    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      Alert.alert(t('common.error'), t('settings.pin_invalid'));
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert(t('common.error'), t('settings.pin_mismatch'));
      return;
    }
    setPin(newPin);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    Alert.alert(t('common.success'), t('settings.pin_success'));
  };

  const handleRemovePin = () => {
    Alert.alert(
      t('settings.remove_pin'),
      t('security.remove_desc') || 'Are you sure you want to remove your security PIN?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: () => {
            if (currentPin !== pin) {
              Alert.alert(t('common.error'), t('security.enter_current_pin'));
              return;
            }
            setPin(null);
            setCurrentPin('');
            Alert.alert(t('common.success'), t('settings.remove_pin'));
          }
        }
      ]
    );
  };

  const PinInput = ({ label, value, onChange, show, onToggle }: any) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputWrapper, { borderColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChange}
          placeholder="● ● ● ●"
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.textSecondary }]}>{t('settings.security_settings')}</Text>
      <Text style={[styles.subHeader, { color: colors.text }]}>{hasPin ? t('settings.security') : t('security.change_pin')}</Text>

      {/* Status Badge */}
      <View style={[styles.statusBadge, hasPin ? [styles.statusActive, { borderColor: '#2ECC71' }] : [styles.statusInactive, { borderColor: colors.border, backgroundColor: colors.card }]]}>
        <Shield size={16} color={hasPin ? '#2ECC71' : colors.textSecondary} />
        <Text style={[styles.statusText, { color: hasPin ? '#2ECC71' : colors.textSecondary }]}>
          {hasPin ? t('settings.pin_protection') : t('settings.no_pin')}
        </Text>
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
          <Text style={[styles.updateButtonText, { color: colors.background }]}>{hasPin ? t('common.edit') : t('common.save')}</Text>
        </TouchableOpacity>
      </View>

      {hasPin && (
        <View style={styles.removeSection}>
          <Text style={[styles.removeHeader, { color: colors.text }]}>{t('settings.remove_pin')}</Text>
          <Text style={[styles.removeDescription, { color: colors.textSecondary }]}>
            {t('settings.remove_desc')}
          </Text>
          <TouchableOpacity style={styles.removeButton} onPress={handleRemovePin}>
            <Trash2 size={18} color="#FFF" />
            <Text style={styles.removeButtonText}>{t('settings.remove_pin')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 25 },
  header: { fontSize: 12, fontFamily: Fonts.bold, fontWeight: '700', letterSpacing: 1.5, marginTop: 20, color: '#888' },
  subHeader: { fontSize: 26, fontFamily: Fonts.bold, fontWeight: '700', marginTop: 8, marginBottom: 16 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, marginBottom: 20, borderWidth: 1,
  },
  statusActive: { backgroundColor: '#F0FFF4', borderColor: '#2ECC71' },
  statusInactive: { backgroundColor: '#F8F8F8', borderColor: '#E0E0E0' },
  statusText: { fontSize: 13, fontFamily: Fonts.bold, fontWeight: '700' },
  formCard: { borderWidth: 1, borderColor: '#F2F2F7', borderRadius: 20, padding: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontFamily: Fonts.semibold, fontWeight: '600', marginBottom: 8, color: '#2C2C2E', fontSize: 13 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E5EA', borderRadius: 14, paddingHorizontal: 15 },
  input: { flex: 1, paddingVertical: 14, fontSize: 20, letterSpacing: 8, fontFamily: Fonts.bold },
  eyeBtn: { padding: 8 },
  updateButton: { flexDirection: 'row', gap: 8, backgroundColor: '#000', padding: 16, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  updateButtonText: { color: '#FFF', fontSize: 16, fontFamily: Fonts.bold, fontWeight: '700' },
  removeSection: { marginTop: 35 },
  removeHeader: { fontSize: 20, fontFamily: Fonts.bold, fontWeight: '700', marginBottom: 8 },
  removeDescription: { color: '#8E8E93', lineHeight: 20, marginBottom: 20, fontSize: 13, fontFamily: Fonts.medium },
  removeButton: { flexDirection: 'row', gap: 8, backgroundColor: '#FF3B30', padding: 16, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  removeButtonText: { color: '#FFF', fontSize: 16, fontFamily: Fonts.bold, fontWeight: '700' },
});

export default SecuritySettings;