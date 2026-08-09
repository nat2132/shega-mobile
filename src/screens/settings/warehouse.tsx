import { Fonts } from '@/constants/theme';
import { useDialog } from '@/context/DialogContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useSettings } from '@/context/SettingsContext';
import { useWarehouse } from '@/context/WarehouseContext';
import { deleteWarehouse, insertWarehouse, updateWarehouse } from '@/database/db';
import * as Haptics from 'expo-haptics';
import { Building2, Check, Plus, Trash2, Warehouse } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  View
} from 'react-native';

import { AppText } from '@/components/ui';
import { getSettingsGlass } from './glass-settings';
import { useTutorial, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { warehouseSettingsTutorial } from '@/tutorials/definitions';

interface WarehouseSettingsScreenProps {
  onClose?: () => void;
}

const WarehouseSettingsScreen: React.FC<WarehouseSettingsScreenProps> = ({ onClose }) => {
  const { colors, t } = useSettings();
  const { isReadOnly } = useSubscription();
  const { activeWarehouseId, setActiveWarehouseId, warehouses, refreshWarehouses } = useWarehouse();
  const G = getSettingsGlass(colors);
  const dialog = useDialog();
  const tutorial = useTutorial({ tutorial: warehouseSettingsTutorial });
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleSave = async () => {
    if (isReadOnly) {
      await dialog.alert({ title: t('common.read_only_mode'), message: t('common.read_only_mode'), iconType: 'warning' });
      return;
    }
    if (!formName.trim()) {
      await dialog.alert({ title: t('common.required'), message: t('inv.wh_name_required'), iconType: 'warning' });
      return;
    }
    if (editingId) {
      await updateWarehouse(editingId, {
        name: formName.trim(),
        location: formLocation,
        contactPerson: formContact,
        phone: formPhone,
        notes: formNotes,
      });
    } else {
      const id = insertWarehouse({
        name: formName.trim(),
        location: formLocation,
        contactPerson: formContact,
        phone: formPhone,
        notes: formNotes,
      });
      if (id && warehouses.length === 0) {
        await setActiveWarehouseId(Number(id));
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetForm();
    await refreshWarehouses();
  };

  const handleEdit = (wh: any) => {
    setEditingId(wh.id);
    setFormName(wh.name);
    setFormLocation(wh.location || '');
    setFormContact(wh.contactPerson || '');
    setFormPhone(wh.phone || '');
    setFormNotes(wh.notes || '');
    setShowForm(true);
  };

  const handleDelete = async (wh: any) => {
    const ok = await dialog.confirm({
      title: t('inv.delete_warehouse_title'),
      message: t('inv.delete_warehouse_msg', { name: wh.name }),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      iconType: 'danger',
      destructive: true,
    });
    if (ok) {
      await deleteWarehouse(wh.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (activeWarehouseId === wh.id) await setActiveWarehouseId(null);
      await refreshWarehouses();
    }
  };

  const handleSelect = async (id: number | null) => {
    await setActiveWarehouseId(id);
    Haptics.selectionAsync();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormName('');
    setFormLocation('');
    setFormContact('');
    setFormPhone('');
    setFormNotes('');
  };

  return (
    <><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TutorialScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TutorialTarget id="ws-header">
          <View style={styles.headerRow}>
            <Warehouse size={20} color={G.fg} />
            <AppText variant="title" weight="bold" style={[styles.title, { color: G.fg, marginLeft: 10 }]} numberOfLines={2}>{t('inv.warehouses_title')}</AppText>
            <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); } } style={[styles.addBtn, { backgroundColor: colors.primary + '15' }]}>
              <Plus size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </TutorialTarget>

        {!showForm ? (
          <View style={styles.whList}>
            <TutorialTarget id="ws-default">
              {/* All Warehouses option */}
              <TouchableOpacity
                style={[styles.whItem, { backgroundColor: G.bgCard, borderColor: !activeWarehouseId ? colors.primary : G.border, borderWidth: !activeWarehouseId ? 2 : 1 }]}
                onPress={() => handleSelect(null)}
              >
                <View style={[styles.whIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Warehouse size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="bold" style={[styles.whName, { color: G.fg }]} numberOfLines={1}>{t('inv.all_warehouses')}</AppText>
                  <AppText variant="caption" weight="medium" style={[styles.whSub, { color: G.fgSecondary }]} numberOfLines={2}>{t('inv.all_warehouses_sub')}</AppText>
                </View>
                {!activeWarehouseId && <Check size={18} color={colors.primary} />}
              </TouchableOpacity>
            </TutorialTarget>

            <TutorialTarget id="ws-list">
              {warehouses.map((wh) => (
                <TouchableOpacity
                  key={wh.id}
                  style={[styles.whItem, { backgroundColor: G.bgCard, borderColor: activeWarehouseId === wh.id ? colors.success : G.border, borderWidth: activeWarehouseId === wh.id ? 2 : 1 }]}
                  onPress={() => handleSelect(wh.id)}
                >
                  <View style={[styles.whIcon, { backgroundColor: colors.success + '15' }]}>
                    <Building2 size={16} color={colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" weight="bold" style={[styles.whName, { color: G.fg }]} numberOfLines={1}>{wh.name}</AppText>
                    {wh.location && <AppText variant="caption" weight="medium" style={[styles.whSub, { color: G.fgSecondary }]} numberOfLines={1}>{wh.location}</AppText>}
                  </View>
                  <TouchableOpacity onPress={() => handleEdit(wh)} style={styles.actionBtn}>
                    <Building2 size={14} color={G.fgSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(wh)} style={styles.actionBtn}>
                    <Trash2 size={14} color={colors.error} />
                  </TouchableOpacity>
                  {activeWarehouseId === wh.id && <Check size={18} color={colors.success} style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
              ))}
            </TutorialTarget>

            {warehouses.length === 0 && (
              <View style={styles.emptyContainer}>
                <AppText variant="title" weight="bold" align="center" style={[styles.emptyText, { color: G.fgSecondary }]} numberOfLines={2}>{t('inv.no_warehouses')}</AppText>
                <AppText variant="body-sm" weight="medium" align="center" style={[styles.emptySubtext, { color: G.fgSecondary }]} numberOfLines={3}>{t('inv.no_warehouses_sub')}</AppText>
              </View>
            )}
          </View>
        ) : (
          <TutorialTarget id="ws-prefs">
            <View style={styles.formSection}>
              <AppText variant="title" weight="bold" style={[styles.formTitle, { color: G.fg }]} numberOfLines={2}>
                {t(editingId ? 'inv.edit_warehouse' : 'inv.new_warehouse')}
              </AppText>

              <View style={styles.inputGroup}>
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.wh_name_label')}</AppText>
                <TextInput
                  style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder={t('inv.warehouse_name_ph')}
                  placeholderTextColor={G.fgSecondary} />
              </View>

              <View style={styles.inputGroup}>
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.wh_location_label')}</AppText>
                <TextInput
                  style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
                  value={formLocation}
                  onChangeText={setFormLocation}
                  placeholder={t('inv.location_ph')}
                  placeholderTextColor={G.fgSecondary} />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.wh_contact_label')}</AppText>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
                    value={formContact}
                    onChangeText={setFormContact}
                    placeholder={t('inv.name_ph')}
                    placeholderTextColor={G.fgSecondary} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.wh_phone_label')}</AppText>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
                    value={formPhone}
                    onChangeText={setFormPhone}
                    placeholder={t('inv.phone_ph')}
                    placeholderTextColor={G.fgSecondary}
                    keyboardType="phone-pad" />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.wh_notes_label')}</AppText>
                <TextInput
                  style={[styles.input, styles.textArea, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
                  value={formNotes}
                  onChangeText={setFormNotes}
                  placeholder={t('inv.notes_ph')}
                  placeholderTextColor={G.fgSecondary}
                  multiline
                  numberOfLines={3} />
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity onPress={resetForm} style={[styles.formBtn, { backgroundColor: G.bgCard, borderColor: G.border, borderWidth: 1 }]}>
                  <AppText variant="body" weight="bold" shrink={false} style={[styles.formBtnText, { color: G.fg }]} numberOfLines={1}>{t('common.cancel')}</AppText>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={[styles.formBtn, { backgroundColor: G.fg }]}>
                  <Check size={16} color={G.bg} />
                  <AppText variant="body" weight="bold" shrink={false} style={[styles.formBtnText, { color: G.bg, marginLeft: 6 }]} numberOfLines={1}>
                    {t(editingId ? 'inv.update_warehouse_btn' : 'inv.save_warehouse_btn')}
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>
          </TutorialTarget>
        )}
      </TutorialScrollView>
    </KeyboardAvoidingView><View style={{ position: 'absolute', top: 50, right: 20, zIndex: 100 }}>
        <TutorialButton tutorialId="warehouse-settings" screenName={t('inv.warehouses_title')} />
      </View></>
  );
};

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  title: { flex: 1, fontSize: 20, fontFamily: Fonts.bold },
  addBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  whList: { flex: 1 },
  whItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 10, gap: 10, overflow: 'hidden' },
  whIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  whName: { fontSize: 15, fontFamily: Fonts.bold },
  whSub: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 2 },
  actionBtn: { padding: 6 },
  emptyContainer: { alignItems: 'center', paddingTop: 50, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: Fonts.bold },
  emptySubtext: { fontSize: 12, fontFamily: Fonts.medium, textAlign: 'center' },
  formSection: { paddingBottom: 30, gap: 14 },
  formTitle: { fontSize: 18, fontFamily: Fonts.bold },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  input: { height: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, fontFamily: Fonts.medium },
  inputRow: { flexDirection: 'row' },
  textArea: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  formBtn: { flex: 1, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', overflow: 'hidden' },
  formBtnText: { fontSize: 15, fontFamily: Fonts.bold },
});

export default WarehouseSettingsScreen;
