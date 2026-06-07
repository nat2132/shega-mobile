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
import { X, Check, User, Phone, Bookmark, FileText } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import { Fonts } from '@/constants/theme';
import { insertContact, updateContact } from '@/database/db';
import { AppText } from '@/components/ui';
const subCatKey = (s: string) => {
  const map: Record<string, string> = {
    'Plumber / Pipe Worker': 'plumber',
  };
  return map[s] || s.toLowerCase().replace(/[\s\/]+/g, '_');
};

const CATEGORIES = [
  { key: 'supplier' },
  { key: 'worker' },
  { key: 'service_provider' },
  { key: 'other' },
];

const SUB_CATEGORIES: Record<string, string[]> = {
  supplier: ['Product Supplier', 'Raw Material Supplier', 'Packaging Supplier'],
  worker: ['General Worker', 'Technician', 'Cleaner', 'Driver'],
  service_provider: ['Electrician', 'Plumber', 'Carpenter', 'Delivery Provider'],
  other: [],
};

interface ContactFormProps {
  contact?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function ContactForm({ contact, onClose, onSaved }: ContactFormProps) {
  const { colors, t } = useSettings();
  const dialog = useDialog();
  const isEditing = !!contact;

  const [fullName, setFullName] = useState(contact?.fullName || '');
  const [category, setCategory] = useState(contact?.category || 'supplier');
  const [subCategory, setSubCategory] = useState(contact?.subCategory || '');
  const [phone, setPhone] = useState(contact?.phone || '');
  const [alternatePhone, setAlternatePhone] = useState(contact?.alternatePhone || '');
  const [accountNumber, setAccountNumber] = useState(contact?.accountNumber || '');
  const [notes, setNotes] = useState(contact?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) {
      await dialog.alert({ title: t('common.error'), message: t('contacts.form_name_required'), iconType: 'danger' });
      return;
    }

    setSaving(true);
    try {
      const data = {
        fullName: fullName.trim(),
        category,
        subCategory: subCategory || undefined,
        phone: phone.trim() || undefined,
        alternatePhone: alternatePhone.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (isEditing) {
        await updateContact(contact.id, data);
      } else {
        await insertContact(data as any);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
    } catch (error) {
      await dialog.alert({ title: t('common.error'), message: t('contacts.form_save_error'), iconType: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const currentSubCategories = SUB_CATEGORIES[category] || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={[styles.headerBtn, { borderColor: colors.border }]}>
          <X size={22} color={colors.text} />
        </TouchableOpacity>
        <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>
          {t(isEditing ? 'contacts.form_edit_title' : 'contacts.form_new_title')}
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
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={2}>{t('contacts.form_full_name_label')}</AppText>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <User size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder={t('contacts.full_name_ph')}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          {/* Category */}
          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={2}>{t('contacts.form_category_label')}</AppText>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => {
                    setCategory(cat.key);
                    setSubCategory('');
                  }}
                  style={[
                    styles.categoryBtn,
                    {
                      backgroundColor: category === cat.key ? colors.primary + '20' : colors.card,
                      borderColor: category === cat.key ? colors.primary : colors.border,
                    }
                  ]}
                >
                  <AppText
                    style={[
                      styles.categoryBtnText,
                      { color: category === cat.key ? colors.primary : colors.textSecondary }
                    ]}
                  >
                    {t('contacts.cat_' + cat.key)}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sub Category */}
          {currentSubCategories.length > 0 && (
            <View style={styles.fieldGroup}>
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={2}>{t('contacts.form_sub_category_label')}</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {currentSubCategories.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => setSubCategory(sub === subCategory ? '' : sub)}
                    style={[
                      styles.subChip,
                      {
                        backgroundColor: subCategory === sub ? colors.primary + '20' : colors.card,
                        borderColor: subCategory === sub ? colors.primary : colors.border,
                      }
                    ]}
                  >
                    <AppText
                      style={[
                        styles.subChipText,
                        { color: subCategory === sub ? colors.primary : colors.textSecondary }
                      ]}
                    >
                      {t('contacts.sub_' + subCatKey(sub))}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={2}>{t('contacts.form_phone_label')}</AppText>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Phone size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={phone}
                onChangeText={setPhone}
                placeholder={t('contacts.phone_ph')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Alternate Phone */}
          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={2}>{t('contacts.form_alt_phone_label')}</AppText>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Phone size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={alternatePhone}
                onChangeText={setAlternatePhone}
                placeholder={t('contacts.alt_phone_ph')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Account Number */}
          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={2}>{t('contacts.form_account_label')}</AppText>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Bookmark size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder={t('contacts.account_ph')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={2}>{t('contacts.form_notes_label')}</AppText>
            <View style={[styles.textAreaWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <FileText size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.textArea, { color: colors.text }]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('contacts.notes_ph')}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 15,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: Fonts.bold },
  content: { padding: 25, gap: 22, paddingBottom: 100 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 5 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  input: { flex: 1, fontSize: 16, fontFamily: Fonts.medium },
  textAreaWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    minHeight: 90,
  },
  textArea: { flex: 1, fontSize: 16, fontFamily: Fonts.medium },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  categoryBtnText: { fontSize: 14, fontFamily: Fonts.semibold },
  subChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  subChipText: { fontSize: 13, fontFamily: Fonts.medium },
});
