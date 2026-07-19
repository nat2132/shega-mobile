import { Fonts } from '@/constants/theme';
import { useDialog } from '@/context/DialogContext';
import { useSettings } from '@/context/SettingsContext';
import { deleteWarehouse, getWarehouses, insertWarehouse, updateWarehouse } from '@/database/db';
import * as Haptics from 'expo-haptics';
import { Building2, Check, Plus, Trash2, Warehouse } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { AppText } from '@/components/ui';
import { getInventoryGlass } from './glass-inventory';
import { useTutorial, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { warehouseManagerTutorial } from '@/tutorials/definitions';
interface WarehouseManagerProps {
  visible: boolean;
  onClose: () => void;
  selectedWarehouseId: number | null;
  onSelectWarehouse: (id: number | null) => void;
}

const WarehouseManagerModal: React.FC<WarehouseManagerProps> = ({ visible, onClose, selectedWarehouseId, onSelectWarehouse }) => {
  const { colors, t } = useSettings();
  const G = getInventoryGlass(colors);
  const dialog = useDialog();
  const tutorial = useTutorial({ tutorial: warehouseManagerTutorial });
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    if (visible) loadWarehouses();
  }, [visible]);

  const loadWarehouses = () => {
    const data = getWarehouses();
    setWarehouses(data);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      await dialog.alert({ title: t('common.required'), message: t('inv.wh_name_required'), iconType: 'warning' });
      return;
    }
    if (editingId) {
      updateWarehouse(editingId, {
        name: formName.trim(),
        location: formLocation,
        contactPerson: formContact,
        phone: formPhone,
        notes: formNotes,
      });
    } else {
      insertWarehouse({
        name: formName.trim(),
        location: formLocation,
        contactPerson: formContact,
        phone: formPhone,
        notes: formNotes,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetForm();
    loadWarehouses();
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
      deleteWarehouse(wh.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (selectedWarehouseId === wh.id) onSelectWarehouse(null);
      loadWarehouses();
    }
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
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: G.bg }]}>
          <TutorialTarget id="wm-header">
          <View style={styles.headerRow}>
            <Warehouse size={20} color={G.fg} />
            <AppText variant="title" weight="bold" style={[styles.title, { color: G.fg, marginLeft: 10 }]} numberOfLines={2}>{t('inv.warehouses_title')}</AppText>
            <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={[styles.addBtn, { backgroundColor: colors.primary + '15' }]}>
              <Plus size={18} color={colors.primary} />
            </TouchableOpacity>
            <TutorialButton tutorialId="warehouse-manager" screenName={t('screen.warehouse_manager')} />
          </View>
          </TutorialTarget>

          <View style={{ flex: 1 }}>
            {!showForm ? (
              <TutorialTarget id="wm-list">
              <TutorialScrollView style={styles.whList} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.whItem, { backgroundColor: G.bgCard, borderColor: !selectedWarehouseId ? colors.primary : G.border, borderWidth: !selectedWarehouseId ? 2 : 1 }]}
                  onPress={() => { onSelectWarehouse(null); onClose(); }}
                >
                  <View style={[styles.whIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Warehouse size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" weight="bold" style={[styles.whName, { color: G.fg }]} numberOfLines={1}>{t('inv.all_warehouses')}</AppText>
                    <AppText variant="caption" weight="medium" style={[styles.whSub, { color: G.fgSecondary }]} numberOfLines={2}>{t('inv.all_warehouses_sub')}</AppText>
                  </View>
                  {!selectedWarehouseId && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>

                {warehouses.map((wh) => (
                  <TouchableOpacity
                    key={wh.id}
                    style={[styles.whItem, { backgroundColor: G.bgCard, borderColor: selectedWarehouseId === wh.id ? colors.success : G.border, borderWidth: selectedWarehouseId === wh.id ? 2 : 1 }]}
                    onPress={() => { onSelectWarehouse(wh.id); onClose(); }}
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
                    {selectedWarehouseId === wh.id && <Check size={18} color={colors.success} style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>
                ))}
                {warehouses.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <AppText variant="title" weight="bold" align="center" style={[styles.emptyText, { color: G.fgSecondary }]} numberOfLines={2}>{t('inv.no_warehouses')}</AppText>
                    <AppText variant="body-sm" weight="medium" align="center" style={[styles.emptySubtext, { color: G.fgSecondary }]} numberOfLines={3}>{t('inv.no_warehouses_sub')}</AppText>
                  </View>
                )}
              </TutorialScrollView>
              </TutorialTarget>
            ) : (
              <TutorialScrollView style={styles.whList} showsVerticalScrollIndicator={false}>
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
                      placeholderTextColor={G.fgSecondary}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.wh_location_label')}</AppText>
                    <TextInput
                      style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
                      value={formLocation}
                      onChangeText={setFormLocation}
                      placeholder={t('inv.location_ph')}
                      placeholderTextColor={G.fgSecondary}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.wh_contact_label')}</AppText>
                      <TextInput
                        style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
                        value={formContact}
                        onChangeText={setFormContact}
                        placeholder={t('inv.name_ph')}
                        placeholderTextColor={G.fgSecondary}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.wh_phone_label')}</AppText>
                      <TextInput
                        style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
                        value={formPhone}
                        onChangeText={setFormPhone}
                        placeholder={t('inv.phone_ph')}
                        placeholderTextColor={G.fgSecondary}
                        keyboardType="phone-pad"
                      />
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
                      numberOfLines={3}
                    />
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
              </TutorialScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', paddingTop: 20 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40, height: Dimensions.get('window').height * 0.85, overflow: 'hidden', marginTop: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  title: { flex: 1, fontSize: 20, fontFamily: Fonts.bold },
  addBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  whList: { paddingHorizontal: 20, flex: 1 },
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
  glowWash1: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.5,
  },
  glowWash2: {
    position: 'absolute',
    top: 120,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.4,
  },
  glowWash3: {
    position: 'absolute',
    bottom: 100,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.35,
  },
});

export default WarehouseManagerModal;