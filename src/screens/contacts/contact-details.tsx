import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Phone, Edit2, Trash2, User, Bookmark, FileText, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import { Fonts } from '@/constants/theme';
import { deleteContact } from '@/database/db';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
const { width } = Dimensions.get('window');

const CATEGORY_ICONS: Record<string, { labelKey: string; color: string }> = {
  supplier:         { labelKey: 'contacts.cat_supplier',  color: '#34C759' },
  worker:           { labelKey: 'contacts.cat_worker',    color: '#FF9500' },
  service_provider: { labelKey: 'contacts.cat_service',   color: '#FF3B30' },
  other:            { labelKey: 'contacts.cat_other',     color: '#AF52DE' },
};

// Same mapping as contacts-list.tsx / contact-form.tsx — turns the
// stored subCategory string into the i18n key suffix used in the
// `contacts.sub_*` translations.
const subCatKey = (s: string) => {
  const map: Record<string, string> = {
    'Plumber / Pipe Worker': 'plumber',
  };
  return map[s] || s.toLowerCase().replace(/[\s\/]+/g, '_');
};

interface ContactDetailsProps {
  contact: any;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}

export default function ContactDetails({ contact, onClose, onEdit, onDeleted }: ContactDetailsProps) {
  const { colors, t } = useSettings();
  const dialog = useDialog();

  const handleCall = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title: t('contacts.delete_title'),
      message: t('contacts.delete_msg', { name: contact.fullName }),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      iconType: 'danger',
      destructive: true,
    });
    if (ok) {
      deleteContact(contact.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDeleted();
    }
  };

  const catInfo = CATEGORY_ICONS[contact.category] || CATEGORY_ICONS.other;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={[styles.headerBtn, { borderColor: colors.border }]}>
          <X size={22} color={colors.text} />
        </TouchableOpacity>
        <AppText variant="title" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('contacts.details_title')}</AppText>
        <TouchableOpacity onPress={onEdit} style={[styles.headerBtn, { backgroundColor: colors.primary }]}>
          <Edit2 size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={[styles.avatarLarge, { backgroundColor: catInfo.color + '20' }]}>
            <User size={40} color={catInfo.color} />
          </View>
          <AppText variant="heading" weight="bold" align="center" style={[styles.nameText, { color: colors.text }]} numberOfLines={2}>{contact.fullName}</AppText>
          <View style={[styles.categoryBadge, { backgroundColor: catInfo.color + '20', borderColor: catInfo.color }]}>
            <AppText variant="caption" weight="bold" shrink={false} style={[styles.categoryBadgeText, { color: catInfo.color }]} numberOfLines={1}>{t(catInfo.labelKey)}</AppText>
          </View>
          {contact.subCategory && (
            <AppText variant="body" weight="medium" align="center" style={[styles.subText, { color: colors.textSecondary }]} numberOfLines={2}>{t('contacts.sub_' + subCatKey(contact.subCategory))}</AppText>
          )}
        </View>

        {/* Action Buttons */}
        {contact.phone && (
          <TouchableOpacity
            style={[styles.callBtn, { backgroundColor: '#34C759' }]}
            onPress={() => handleCall(contact.phone)}
          >
            <Phone size={22} color="#FFF" />
            <AppText variant="title" weight="bold" shrink={false} style={styles.callBtnText} numberOfLines={1}>{t('contacts.details_call', { phone: contact.phone })}</AppText>
          </TouchableOpacity>
        )}

        {/* Details Card */}
        <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {contact.phone && (
            <View style={styles.detailRow}>
              <Phone size={18} color={colors.textSecondary} />
              <View style={styles.detailContent}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.detailLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('contacts.details_phone')}</AppText>
                <AppText variant="body" weight="medium" style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>{contact.phone}</AppText>
              </View>
            </View>
          )}

          {contact.alternatePhone && (
            <View style={styles.detailRow}>
              <Phone size={18} color={colors.textSecondary} />
              <View style={styles.detailContent}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.detailLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('contacts.details_alt_phone')}</AppText>
                <AppText variant="body" weight="medium" style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>{contact.alternatePhone}</AppText>
              </View>
            </View>
          )}

          {contact.accountNumber && (
            <View style={styles.detailRow}>
              <Bookmark size={18} color={colors.textSecondary} />
              <View style={styles.detailContent}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.detailLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('contacts.details_account')}</AppText>
                <AppText variant="body" weight="medium" style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>{contact.accountNumber}</AppText>
              </View>
            </View>
          )}

          {contact.notes && (
            <View style={styles.detailRow}>
              <FileText size={18} color={colors.textSecondary} />
              <View style={styles.detailContent}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.detailLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('contacts.details_notes')}</AppText>
                <AppText variant="body" weight="medium" style={[styles.detailValue, { color: colors.text }]} numberOfLines={6}>{contact.notes}</AppText>
              </View>
            </View>
          )}
        </View>

        {/* Delete Button */}
        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: '#FF3B3020', borderColor: '#FF3B30' }]}
          onPress={handleDelete}
        >
          <Trash2 size={20} color="#FF3B30" />
          <AppText variant="body" weight="bold" shrink={false} style={[styles.deleteBtnText, { color: '#FF3B30' }]} numberOfLines={1}>{t('contacts.details_delete_btn')}</AppText>
        </TouchableOpacity>
      </ScrollView>
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
  content: { padding: 25, paddingBottom: 100 },
  profileSection: { alignItems: 'center', marginBottom: 30 },
  avatarLarge: {
    width: 90,
    height: 90,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  nameText: { fontSize: 26, fontFamily: Fonts.bold, marginBottom: 8, textAlign: 'center' },
  categoryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  categoryBadgeText: { fontSize: 13, fontFamily: Fonts.bold },
  subText: { fontSize: 14, fontFamily: Fonts.medium },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 18,
    gap: 12,
    marginBottom: 25,
  },
  callBtnText: { fontSize: 18, fontFamily: Fonts.bold, color: '#FFF' },
  detailsCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 20,
    marginBottom: 25,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  detailValue: { fontSize: 16, fontFamily: Fonts.medium },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  deleteBtnText: { fontSize: 16, fontFamily: Fonts.bold },
});