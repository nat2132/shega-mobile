import { Fonts } from '@/constants/theme';
import { useDialog } from '@/context/DialogContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useSettings } from '@/context/SettingsContext';
import { useWarehouse } from '@/context/WarehouseContext';
import { getWarehouses, insertWarehouse } from '@/database/db';
import { translateWarehouseName, translateWarehouseLocation } from '@/utils/warehouse-labels';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Building2, Check, Plus, Warehouse } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { getSettingsGlass } from './glass-settings';

interface WarehouseSelectorProps {
  visible: boolean;
  onComplete: () => void;
}

const WarehouseSelectorModal: React.FC<WarehouseSelectorProps> = ({ visible, onComplete }) => {
  const { colors, t } = useSettings();
  const { isReadOnly } = useSubscription();
  const { activeWarehouseId, setActiveWarehouseId, warehouses, refreshWarehouses } = useWarehouse();
  const G = getSettingsGlass(colors);
  const dialog = useDialog();
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    if (visible) refreshWarehouses();
  }, [visible]);

  const handleCreateAndSelect = async () => {
    if (isReadOnly) {
      await dialog.alert({ title: t('common.read_only_mode'), message: t('common.read_only_mode'), iconType: 'warning' });
      return;
    }
    if (!formName.trim()) {
      await dialog.alert({ title: t('common.required'), message: t('inv.wh_name_required'), iconType: 'warning' });
      return;
    }
    const id = insertWarehouse({ name: formName.trim(), location: formLocation, contactPerson: formContact.trim(), phone: formPhone.trim(), notes: formNotes.trim() });
    if (id) {
      await setActiveWarehouseId(Number(id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    }
  };

  const handleSelect = async (id: number) => {
    await setActiveWarehouseId(id);
    Haptics.selectionAsync();
    onComplete();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onComplete}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.overlay}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
          <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
              <Warehouse size={32} color={colors.primary} />
            </View>

            <AppText variant="title" weight="bold" style={[styles.title, { color: G.fg }]} numberOfLines={2}>
              {warehouses.length === 0 ? t('inv.no_warehouses') : t('inv.warehouses_title')}
            </AppText>
            <AppText variant="body-sm" weight="medium" style={[styles.subtitle, { color: G.fgSecondary }]} numberOfLines={3}>
              {warehouses.length === 0 ? t('inv.no_warehouses_sub') : t('inv.all_warehouses_sub')}
            </AppText>

            {!showForm ? (
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {warehouses.map((wh, idx) => (
                  <Animated.View key={wh.id} entering={FadeInDown.delay(idx * 60).duration(400)}>
                    <TouchableOpacity
                      style={[styles.whItem, { backgroundColor: G.bg, borderColor: activeWarehouseId === wh.id ? colors.success : G.border, borderWidth: activeWarehouseId === wh.id ? 2 : 1 }]}
                      onPress={() => handleSelect(wh.id)}
                    >
                      <View style={[styles.whIcon, { backgroundColor: colors.success + '15' }]}>
                        <Building2 size={18} color={colors.success} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="body" weight="bold" style={[styles.whName, { color: G.fg }]} numberOfLines={1}>{translateWarehouseName(t, wh.name)}</AppText>
                        {wh.location && <AppText variant="caption" weight="medium" style={[styles.whSub, { color: G.fgSecondary }]} numberOfLines={1}>{translateWarehouseLocation(t, wh.location)}</AppText>}
                      </View>
                      <Check size={18} color={colors.success} />
                    </TouchableOpacity>
                  </Animated.View>
                ))}
                <TouchableOpacity
                  style={[styles.createBtn, { borderColor: G.border }]}
                  onPress={() => setShowForm(true)}
                >
                  <Plus size={18} color={colors.primary} />
                  <AppText variant="body" weight="bold" style={[styles.createBtnText, { color: colors.primary }]} numberOfLines={1}>{t('inv.new_warehouse')}</AppText>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.formSection}>
                <AppText variant="body" weight="bold" style={[styles.formTitle, { color: G.fg }]} numberOfLines={1}>{t('inv.new_warehouse')}</AppText>

                <View style={styles.inputGroup}>
                  <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.wh_name_label')}</AppText>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder={t('inv.warehouse_name_ph')}
                    placeholderTextColor={G.fgSecondary}
                    autoFocus
                  />
                </View>

                <View style={styles.inputGroup}>
                  <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.wh_location_label')}</AppText>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
                    value={formLocation}
                    onChangeText={setFormLocation}
                    placeholder={t('inv.location_ph')}
                    placeholderTextColor={G.fgSecondary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.wh_contact_label')}</AppText>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
                    value={formContact}
                    onChangeText={setFormContact}
                    placeholder={t('inv.contact_ph')}
                    placeholderTextColor={G.fgSecondary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.wh_phone_label')}</AppText>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
                    value={formPhone}
                    onChangeText={setFormPhone}
                    placeholder={t('inv.phone_ph')}
                    placeholderTextColor={G.fgSecondary}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.inputLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inv.wh_notes_label')}</AppText>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
                    value={formNotes}
                    onChangeText={setFormNotes}
                    placeholder={t('inv.notes_ph')}
                    placeholderTextColor={G.fgSecondary}
                    multiline
                  />
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity onPress={() => { setShowForm(false); setFormName(''); setFormLocation(''); setFormContact(''); setFormPhone(''); setFormNotes(''); }} style={[styles.formBtn, { backgroundColor: G.bg, borderColor: G.border, borderWidth: 1 }]}>
                    <AppText variant="body" weight="bold" shrink={false} style={[styles.formBtnText, { color: G.fg }]} numberOfLines={1}>{t('common.cancel')}</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCreateAndSelect} style={[styles.formBtn, { backgroundColor: G.fg }]}>
                    <Check size={16} color={G.bg} />
                    <AppText variant="body" weight="bold" shrink={false} style={[styles.formBtnText, { color: G.bg, marginLeft: 6 }]} numberOfLines={1}>{t('common.save')}</AppText>
                  </TouchableOpacity>
                </View>
              </View>
              </ScrollView>
            )}
          </View>
        </Animated.View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxHeight: Dimensions.get('window').height * 0.75,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  list: {
    width: '100%',
    maxHeight: 300,
  },
  whItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    gap: 12,
  },
  whIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whName: {
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  whSub: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 4,
  },
  createBtnText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  formSection: {
    width: '100%',
    gap: 14,
  },
  formTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: Fonts.bold,
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  formBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  formBtnText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
});

export default WarehouseSelectorModal;
