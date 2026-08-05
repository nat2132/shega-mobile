import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, User, Phone, Bookmark, FileText, Building2, CreditCard } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { playNice, playBad } from '@/services/soundService';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import { getSuppliersGlass } from './glass-suppliers';
import { Fonts } from '@/constants/theme';
import { insertSupplier, updateSupplier } from '@/database/db';
import { AppText } from '@/components/ui';

const SUPPLIER_CATEGORIES = ['Product Supplier', 'Raw Material Supplier', 'Packaging Supplier'];
const PAYMENT_TYPES = ['cash', 'credit', 'partial'] as const;

interface SupplierFormProps {
  supplier?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function SupplierForm({ supplier, onClose, onSaved }: SupplierFormProps) {
  const { colors, t } = useSettings();
  const G = getSuppliersGlass(colors);
  const dialog = useDialog();
  const isEditing = !!supplier;

  const [fullName, setFullName] = useState(supplier?.fullName || '');
  const [companyName, setCompanyName] = useState(supplier?.companyName || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [alternatePhone, setAlternatePhone] = useState(supplier?.alternatePhone || '');
  const [email, setEmail] = useState(supplier?.email || '');
  const [supplierCategory, setSupplierCategory] = useState(supplier?.supplierCategory || '');
  const [tin, setTin] = useState(supplier?.tin || '');
  const [address, setAddress] = useState(supplier?.address || '');
  const [accountNumber, setAccountNumber] = useState(supplier?.accountNumber || '');
  const [notes, setNotes] = useState(supplier?.notes || '');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'partial'>(supplier?.paymentType || 'cash');
  const [isActive, setIsActive] = useState(supplier?.isActive !== 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) {
      playBad();
      await dialog.alert({ title: t('common.error'), message: t('suppliers.form_name_required'), iconType: 'danger' });
      return;
    }

    setSaving(true);
    try {
      const data = {
        fullName: fullName.trim(),
        companyName: companyName.trim() || undefined,
        phone: phone.trim() || undefined,
        alternatePhone: alternatePhone.trim() || undefined,
        email: email.trim() || undefined,
        supplierCategory: supplierCategory || undefined,
        tin: tin.trim() || undefined,
        address: address.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentType,
        isActive,
      };

      if (isEditing) {
        await updateSupplier(supplier.id, data);
      } else {
        await insertSupplier(data);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playNice();
      onSaved();
    } catch {
      playBad();
      await dialog.alert({ title: t('common.error'), message: t('suppliers.form_save_error'), iconType: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: -80, left: -60, width: 200, height: 200, borderRadius: 100 }]} />
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, bottom: -40, right: -30, width: 160, height: 160, borderRadius: 80 }]} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={[styles.headerBtn, { borderColor: G.border }]}>
          <X size={22} color={G.fg} />
        </TouchableOpacity>
        <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>
          {t(isEditing ? 'suppliers.form_edit_title' : 'suppliers.form_new_title')}
        </AppText>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.headerBtn, { backgroundColor: colors.primary }]}
        >
          <Check size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* ── Section: Basic Info ── */}
          <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.muted }]} numberOfLines={2}>
            {t('suppliers.section_basic')}
          </AppText>

          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('suppliers.form_full_name_label')}</AppText>
            <View style={[styles.inputWrapper, { borderColor: G.border, backgroundColor: G.bgCard }]}>
              <User size={18} color={G.fgSecondary} />
              <TextInput
                style={[styles.input, { color: G.fg }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder={t('suppliers.full_name_ph')}
                placeholderTextColor={G.fgSecondary}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('suppliers.form_company_label')}</AppText>
            <View style={[styles.inputWrapper, { borderColor: G.border, backgroundColor: G.bgCard }]}>
              <Building2 size={18} color={G.fgSecondary} />
              <TextInput
                style={[styles.input, { color: G.fg }]}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder={t('suppliers.company_ph')}
                placeholderTextColor={G.fgSecondary}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('suppliers.form_phone_label')}</AppText>
            <View style={[styles.inputWrapper, { borderColor: G.border, backgroundColor: G.bgCard }]}>
              <Phone size={18} color={G.fgSecondary} />
              <TextInput
                style={[styles.input, { color: G.fg }]}
                value={phone}
                onChangeText={setPhone}
                placeholder={t('suppliers.phone_ph')}
                placeholderTextColor={G.fgSecondary}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('suppliers.form_alt_phone_label')}</AppText>
            <View style={[styles.inputWrapper, { borderColor: G.border, backgroundColor: G.bgCard }]}>
              <Phone size={18} color={G.fgSecondary} />
              <TextInput
                style={[styles.input, { color: G.fg }]}
                value={alternatePhone}
                onChangeText={setAlternatePhone}
                placeholder={t('suppliers.alt_phone_ph')}
                placeholderTextColor={G.fgSecondary}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('suppliers.form_email_label')}</AppText>
            <View style={[styles.inputWrapper, { borderColor: G.border, backgroundColor: G.bgCard }]}>
              <FileText size={18} color={G.fgSecondary} />
              <TextInput
                style={[styles.input, { color: G.fg }]}
                value={email}
                onChangeText={setEmail}
                placeholder={t('suppliers.email_ph')}
                placeholderTextColor={G.fgSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* ── Section: Business Info ── */}
          <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.muted }]} numberOfLines={2}>
            {t('suppliers.section_business')}
          </AppText>

          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('suppliers.form_category_label')}</AppText>
            <View style={styles.chipRow}>
              {SUPPLIER_CATEGORIES.map((cat) => {
                const isSelected = supplierCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => { Haptics.selectionAsync(); setSupplierCategory(isSelected ? '' : cat); }}
                    style={[styles.chip, {
                      backgroundColor: isSelected ? colors.primary : G.bgCard,
                      borderColor: isSelected ? colors.primary : G.border,
                    }]}
                    activeOpacity={0.75}
                  >
                    <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.chipLabel, { color: isSelected ? colors.background : G.muted }]} numberOfLines={1}>
                      {cat}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('suppliers.form_tin_label')}</AppText>
            <View style={[styles.inputWrapper, { borderColor: G.border, backgroundColor: G.bgCard }]}>
              <Bookmark size={18} color={G.fgSecondary} />
              <TextInput
                style={[styles.input, { color: G.fg }]}
                value={tin}
                onChangeText={setTin}
                placeholder={t('suppliers.tin_ph')}
                placeholderTextColor={G.fgSecondary}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('suppliers.form_address_label')}</AppText>
            <View style={[styles.inputWrapper, { borderColor: G.border, backgroundColor: G.bgCard }]}>
              <Building2 size={18} color={G.fgSecondary} />
              <TextInput
                style={[styles.input, { color: G.fg }]}
                value={address}
                onChangeText={setAddress}
                placeholder={t('suppliers.address_ph')}
                placeholderTextColor={G.fgSecondary}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('suppliers.form_account_label')}</AppText>
            <View style={[styles.inputWrapper, { borderColor: G.border, backgroundColor: G.bgCard }]}>
              <CreditCard size={18} color={G.fgSecondary} />
              <TextInput
                style={[styles.input, { color: G.fg }]}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder={t('suppliers.account_ph')}
                placeholderTextColor={G.fgSecondary}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('suppliers.form_notes_label')}</AppText>
            <View style={[styles.inputWrapper, { borderColor: G.border, backgroundColor: G.bgCard }]}>
              <FileText size={18} color={G.fgSecondary} />
              <TextInput
                style={[styles.input, { color: G.fg }]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('suppliers.notes_ph')}
                placeholderTextColor={G.fgSecondary}
                multiline
              />
            </View>
          </View>

          {/* ── Section: Payment Info ── */}
          <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.muted }]} numberOfLines={2}>
            {t('suppliers.section_payment')}
          </AppText>

          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('suppliers.form_payment_type_label')}</AppText>
            <View style={styles.chipRow}>
              {PAYMENT_TYPES.map((pt) => {
                const isSelected = paymentType === pt;
                return (
                  <TouchableOpacity
                    key={pt}
                    onPress={() => { Haptics.selectionAsync(); setPaymentType(pt); }}
                    style={[styles.chip, {
                      backgroundColor: isSelected ? colors.primary : G.bgCard,
                      borderColor: isSelected ? colors.primary : G.border,
                    }]}
                    activeOpacity={0.75}
                  >
                    <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.chipLabel, { color: isSelected ? colors.background : G.muted }]} numberOfLines={1}>
                      {t('suppliers.payment_' + pt)}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]} numberOfLines={2}>{t('suppliers.form_status_label')}</AppText>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); setIsActive(true); }}
                style={[styles.statusChip, {
                  backgroundColor: isActive ? colors.success : G.bgCard,
                  borderColor: isActive ? colors.success : G.border,
                }]}
                activeOpacity={0.75}
              >
                <Check size={16} color={isActive ? colors.background : G.muted} />
                <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.chipLabel, { color: isActive ? colors.background : G.muted }]} numberOfLines={1}>
                  {t('suppliers.status_active')}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); setIsActive(false); }}
                style={[styles.statusChip, {
                  backgroundColor: !isActive ? colors.warning : G.bgCard,
                  borderColor: !isActive ? colors.warning : G.border,
                }]}
                activeOpacity={0.75}
              >
                <X size={16} color={!isActive ? colors.background : G.muted} />
                <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.chipLabel, { color: !isActive ? colors.background : G.muted }]} numberOfLines={1}>
                  {t('suppliers.status_inactive')}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  glowWash: { position: 'absolute' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.extrabold,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 10,
  },

  content: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },

  sectionTitle: {
    fontFamily: Fonts.bold,
    letterSpacing: 1.1,
    marginTop: 22,
    marginBottom: 8,
  },

  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: Fonts.bold,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 15,
    paddingVertical: 12,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1,
    gap: 6,
  },
  chipLabel: {
    fontFamily: Fonts.semibold,
  },

  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 7,
  },
});
