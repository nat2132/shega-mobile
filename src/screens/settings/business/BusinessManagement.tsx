import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { getSettingsGlass } from '../glass-settings';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { useDataChangedRefresh } from '@/hooks/useDataChangedRefresh';
import {
  getUsers, getDevices, getRegisters, getLocations, getCustomRoles, getCustomRole,
  addUser, addDevice, addRegister, approveDevice,
  setDeviceStatus, renameDevice, updateUserRole, replaceDevice,
  setUserActive, removeUser, transferOwnership, createCustomRole,
  assignDeviceToUser, updateUserAssignment,
  getBusinesses, getBusiness, setActiveBusiness, setCurrentUserId, getOwnerOfBusiness,
  setBusinessLogo, getBusinessLogo,
} from '@/services/businessService';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { useToast } from '@/context/ToastContext';
import { setComplianceSetting } from '@/database/db';
import { router } from 'expo-router';
import {
  BUILTIN_ROLES, BuiltinRoleKey, SURFACED_BUILTIN_ROLES, getBuiltinRole,
  PERMISSION_CATALOG, SCOPE_LABELS, PermissionScope, PermissionValue,
  Device,
} from '@shega/shared';
import {
  Users, Smartphone, Printer, KeyRound, ChevronRight,
  Plus, X, Crown, QrCode, ShieldCheck, ShieldX, Building2, Check, Link2,
} from 'lucide-react-native';
import {
  generateInvitation, getInvitations, revokeInvitation,
  canAddDevice, getActiveDeviceCount,
} from '@/services/invitationService';
import { wsSyncClient } from '@/services/wsSyncClient';
import { getDB } from '@/database/db';
import MemberApprovalModal from '@/components/MemberApprovalModal';
import { mobilePairingBeacon, getThisDeviceName } from '@/services/mobilePairingBeacon';
import { preassignJoinIdentity } from '@/services/mobileSyncServer';
import { RadarPulse } from '@/components/RadarPulse';
import { listPairingInvitations, decidePairing, revokePairing, listCloudDevices, manageDevice, removeCloudDevice, type CloudDeviceEntry } from '@/services/pairingService';

type Tab = 'overview' | 'people' | 'devices' | 'registers' | 'permissions' | 'ownership' | 'businesses';

interface Props {
  onClose: () => void;
}

function useGlass() {
  const { colors } = useSettings();
  return getSettingsGlass(colors);
}

export function BusinessManagement({ onClose }: Props) {
  const { t } = useSettings();
  const glass = useGlass();
  const auth = useBusinessAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const businessId = auth.business?.id;

  const people = businessId ? getUsers(businessId) : [];
  const devices = businessId ? getDevices(businessId) : [];
  const registers = businessId ? getRegisters(businessId) : [];
  const locations = businessId ? getLocations(businessId) : [];
  const businesses = getBusinesses();

  const handleSwitchBusiness = (targetId: string) => {
    const target = getBusiness(targetId);
    if (!target || target.id === businessId) return;
    const owner = getOwnerOfBusiness(target.id);
    setActiveBusiness(target.id);
    if (owner) {
      setCurrentUserId(owner.id);
      setComplianceSetting('user_role', owner.role || 'owner');
    }
    Haptics.selectionAsync();
    onClose();
    router.replace('/(tabs)/dashboard');
  };

  return (
    <View style={[styles.container, { backgroundColor: glass.bg }]}>
      <View style={[styles.header, { borderBottomColor: glass.border }]}>
        <View style={{ flex: 1 }}>
          <AppText variant="title" weight="bold" style={{ color: glass.fg }}>{t('business.title')}</AppText>
          <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>
            {auth.business?.name}{auth.isOwner ? t('business.owner_suffix') : ''}
          </AppText>
        </View>
        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onClose(); }} style={[styles.closeBtn, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
          <X size={18} color={glass.fg} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {tab === 'overview' && (
          <Overview
            businessName={auth.business?.name || ''}
            isOwner={auth.isOwner}
            peopleCount={people.length}
            deviceCount={devices.filter((d) => d.status === 'active').length}
            registerCount={registers.length}
            businessCount={businesses.length}
            businessId={businessId ?? undefined}
            onNav={setTab}
          />
        )}

        {tab === 'businesses' && (
          <BusinessesPanel businesses={businesses} currentId={businessId} onSwitch={handleSwitchBusiness} glass={glass} />
        )}

        {tab === 'people' && (
          <PeoplePanel businessId={businessId!} people={people} devices={devices} registers={registers} locations={locations} canManage={auth.can('team.manage')} glass={glass} />
        )}

        {tab === 'devices' && (
          <DevicesPanel businessId={businessId!} devices={devices} people={people} canManage={auth.can('devices.manage')} glass={glass} />
        )}

        {tab === 'registers' && (
          <RegistersPanel businessId={businessId!} registers={registers} locations={locations} canManage={auth.can('registers.manage')} glass={glass} />
        )}

        {tab === 'permissions' && (
          <PermissionsPanel businessId={businessId!} canManage={auth.can('team.assignRoles')} glass={glass} />
        )}

        {tab === 'ownership' && (
          <OwnershipPanel businessId={businessId!} canTransfer={auth.can('ownership.transfer')} glass={glass} />
        )}
      </ScrollView>
    </View>
  );
}

function Overview({ businessName, isOwner, peopleCount, deviceCount, registerCount, businessCount, businessId, onNav }: {
  businessName: string; isOwner: boolean; peopleCount: number; deviceCount: number; registerCount: number; businessCount: number;
  businessId?: string;
  onNav: (t: Tab) => void;
}) {
  const glass = useGlass();
  const { t } = useSettings();
  const { showToast } = useToast();
  const [logoUri, setLogoUri] = useState<string | null>(() => businessId ? getBusinessLogo(businessId) : null);
  const [savingLogo, setSavingLogo] = useState(false);

  const pickBusinessImage = async () => {
    if (!businessId) return;
    Haptics.selectionAsync();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast(t('business.photo_permission'), 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.length) return;
    setSavingLogo(true);
    const uri = result.assets[0].uri;
    const res = setBusinessLogo(businessId, uri);
    setSavingLogo(false);
    if (!res.ok) {
      showToast(res.error || t('business.image_owner_only'), 'error');
      return;
    }
    setLogoUri(uri);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(t('business.image_saved'), 'success');
  };

  const cards: { tab: Tab; icon: any; title: string; count: number }[] = [
    { tab: 'people', icon: Users, title: t('business.people'), count: peopleCount },
    { tab: 'devices', icon: Smartphone, title: t('business.active_devices'), count: deviceCount },
    { tab: 'registers', icon: Printer, title: t('business.registers'), count: registerCount },
    { tab: 'businesses', icon: Building2, title: t('business.businesses'), count: businessCount },
  ];
  return (
    <View>
      <View style={[styles.ownerBanner, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
        <TouchableOpacity
          disabled={!isOwner || savingLogo}
          onPress={pickBusinessImage}
          style={{ alignItems: 'center' }}
        >
          <View style={{
            width: 72, height: 72, borderRadius: 36, overflow: 'hidden',
            backgroundColor: glass.accentGlass, borderWidth: 1, borderColor: glass.border,
            alignItems: 'center', justifyContent: 'center', marginBottom: 8,
          }}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={{ width: 72, height: 72 }} resizeMode="cover" />
            ) : (
              <Crown size={36} color={glass.fg} />
            )}
          </View>
          {isOwner && (
            <AppText variant="micro" weight="bold" style={{ color: glass.accent }}>
              {savingLogo ? t('business.saving') : logoUri ? t('business.tap_change_image') : t('business.tap_add_image')}
            </AppText>
          )}
        </TouchableOpacity>
        <AppText variant="body" weight="bold" style={{ color: glass.fg, marginTop: 6 }}>
          {businessName}
        </AppText>
        <AppText variant="caption" weight="medium" style={{ color: glass.muted, textAlign: 'center', marginTop: 4 }}>
          {isOwner ? t('business.owner_permissions') : t('business.limited_access')}
        </AppText>
      </View>

      <View style={styles.cardRow}>
        {cards.map((c) => (
          <TouchableOpacity key={c.tab} onPress={() => { Haptics.selectionAsync(); onNav(c.tab); }}
            style={[styles.statCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
            <c.icon size={22} color={glass.fg} />
            <AppText variant="display" weight="bold" style={{ color: glass.fg, marginTop: 6 }}>{c.count}</AppText>
            <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted }}>{c.title}</AppText>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.menuGroup, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
        <MenuRow icon={Users} label={t('business.manage_people')} onPress={() => onNav('people')} />
        <MenuRow icon={Smartphone} label={t('business.manage_devices')} onPress={() => onNav('devices')} />
        <MenuRow icon={Printer} label={t('business.manage_registers')} onPress={() => onNav('registers')} />
        <MenuRow icon={KeyRound} label={t('business.permissions_roles')} onPress={() => onNav('permissions')} last />
      </View>
      {isOwner && (
        <MenuRow icon={Crown} label={t('business.transfer_ownership')} onPress={() => onNav('ownership')} />
      )}
    </View>
  );
}

// ---------- Multi-business switcher ----------

function BusinessesPanel({ businesses, currentId, onSwitch, glass }: {
  businesses: any[]; currentId?: string; onSwitch: (id: string) => void; glass: any;
}) {
  const { t } = useSettings();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const createNewBusiness = () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const { createBusiness, getThisDeviceId, getCurrentUserId, getUser, setCurrentUserId } = require('@/services/businessService');
      const deviceId = getThisDeviceId() ?? undefined;
      const uid = getCurrentUserId();
      const me = uid ? getUser(uid) : undefined;
      const biz = createBusiness({ name, ownerName: me?.name || name }, deviceId);
      // Carry the same Shega account into the new business as its Owner —
      // one user, separate per-business membership.
      if (me) setCurrentUserId(me.id);
      setCreating(false);
      setNewName('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSwitch(biz.id);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Could not create the business');
    }
  };

  return (
    <View>
      <SectionHeader
        icon={Building2}
        title={t('business.businesses')}
        actionLabel={t('business.new_business')}
        onAction={() => { setCreating(true); setNewName(''); }}
        glass={glass}
      />
      <AppText variant="caption" weight="medium" style={{ color: glass.muted, marginBottom: 10 }}>
        {t('business.businesses_hint')}
      </AppText>

      {creating && (
        <View style={[styles.listCard, { backgroundColor: glass.bgCard, borderColor: glass.accent, marginBottom: 10 }]}>
          <TextInput
            style={[styles.input, { borderColor: glass.border, color: glass.fg, backgroundColor: glass.bg }]}
            placeholder={t('business.new_business_name')}
            placeholderTextColor={glass.muted}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            onSubmitEditing={createNewBusiness}
          />
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setCreating(false)} style={[styles.smallBtn, { backgroundColor: glass.accentGlass }]}>
              <AppText variant="caption" weight="bold" style={{ color: glass.fg }}>{t('common.cancel')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={createNewBusiness} disabled={!newName.trim()} style={[styles.smallBtn, { backgroundColor: glass.fg, opacity: newName.trim() ? 1 : 0.4 }]}>
              <AppText variant="caption" weight="bold" style={{ color: glass.bg }}>{t('common.create')}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {businesses.length === 0 && !creating && <EmptyState text={t('business.no_businesses')} />}

      {businesses.map((b) => {
        const active = b.id === currentId;
        const handleLongPress = () => {
          Alert.alert(
            b.name,
            'Manage this business',
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: 'Rename Business',
                onPress: () => {
                  Alert.prompt(
                    'Rename Business',
                    'Enter new business name:',
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: t('common.save'),
                        onPress: (val?: string) => {
                          if (val && val.trim()) {
                            const { updateBusiness } = require('@/services/businessService');
                            updateBusiness(b.id, { name: val.trim() });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }
                        },
                      },
                    ],
                    'plain-text',
                    b.name
                  );
                },
              },
              {
                text: 'Delete Business',
                style: 'destructive',
                onPress: () => {
                  Alert.alert(
                    'Delete Business?',
                    `Are you sure you want to delete "${b.name}"? This action soft-deletes the business and its local data.`,
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: t('common.delete'),
                        style: 'destructive',
                        onPress: () => {
                          try {
                            const { deleteBusiness } = require('@/services/businessService');
                            const res = deleteBusiness(b.id);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            if (res.newActiveId) {
                              onSwitch(res.newActiveId);
                            }
                          } catch (err: any) {
                            Alert.alert('Cannot Delete', err?.message || 'Action failed.');
                          }
                        },
                      },
                    ]
                  );
                },
              },
            ]
          );
        };

        return (
          <TouchableOpacity
            key={b.id}
            disabled={active}
            onPress={() => { Haptics.selectionAsync(); onSwitch(b.id); }}
            onLongPress={handleLongPress}
            style={[styles.listCard, { backgroundColor: glass.bgCard, borderColor: active ? glass.accent : glass.border }]}
          >
            <View style={[styles.avatar, { backgroundColor: active ? glass.accentGlass : glass.accentGlass }]}>
              <Building2 size={18} color={glass.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{b.name}{b.is_default ? '  ★' : ''}</AppText>
              <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>
                {b.currency || 'ETB'}{active ? t('business.active_suffix') : ''} · Hold for options
              </AppText>
            </View>
            {active && <Check size={18} color={glass.accent} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MenuRow({ icon: Icon, label, onPress, last }: { icon: any; label: string; onPress: () => void; last?: boolean }) {
  const glass = useGlass();
  return (
    <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={[styles.menuRow, { borderBottomColor: glass.border }, last ? { borderBottomWidth: 0 } : null]}>
      <View style={[styles.iconBox, { backgroundColor: glass.accentGlass }]}><Icon size={18} color={glass.fg} /></View>
      <AppText variant="body" weight="bold" style={{ color: glass.fg, flex: 1 }}>{label}</AppText>
      <ChevronRight size={18} color={glass.muted} />
    </TouchableOpacity>
  );
}

// ---------- People ----------

function PeoplePanel({ businessId, people, devices, registers, locations, canManage, glass }: {
  businessId: string; people: any[]; devices: any[]; registers: any[]; locations: any[]; canManage: boolean; glass: any;
}) {
  const { t } = useSettings();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <View>
      <SectionHeader icon={Users} title={t('business.people')} actionLabel={canManage ? t('business.add_person') : undefined} onAction={() => canManage && setShowAdd(true)} glass={glass} />

      {canManage && <CloudPairingSection glass={glass} />}

      {people.length === 0 && <EmptyState text={t('business.add_team_members')} />}

      {people.map((p) => {
        const device = devices.find((d) => d.userId === p.id && d.status !== 'removed');
        const register = registers.find((r) => r.id === p.assignedRegisterId);
        const location = locations.find((l) => l.id === p.assignedLocationId);
        const assignment = [device?.name, register?.name, location?.name].filter(Boolean).join(' · ');
        return (
          <View key={p.id} style={[styles.listCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
            <View style={[styles.avatar, { backgroundColor: glass.accentGlass }]}>
              {p.isOwner ? <Crown size={18} color={glass.fg} /> : <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{p.name.slice(0, 1).toUpperCase()}</AppText>}
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{p.name}{p.isOwner ? '  👑' : ''}</AppText>
              <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>{p.roleName || getRoleLabel(p.role)}{p.isActive ? '' : t('business.disabled_suffix')}</AppText>
              {assignment && (
                <AppText variant="micro" weight="medium" style={{ color: glass.muted, marginTop: 2 }} numberOfLines={1}>
                  {device ? '📱 ' + device.name : ''}{device ? (register || location ? ' · ' : '') : ''}{register ? '🖨 ' + register.name : ''}{register && location ? ' · ' : ''}{location ? '📍 ' + location.name : ''}
                </AppText>
              )}
            </View>
            {canManage && !p.isOwner && (
              <TouchableOpacity onPress={() => showUserActions(p)} style={[styles.smallBtn, { backgroundColor: glass.accentGlass }]}>
                <AppText variant="caption" weight="bold" style={{ color: glass.fg }}>…</AppText>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {showAdd && (
        <AddPersonModal businessId={businessId} devices={devices} registers={registers} locations={locations} onClose={() => setShowAdd(false)} glass={glass} />
      )}
    </View>
  );

  function showUserActions(p: any) {
    const actions: { text: string; style?: 'destructive' | 'default' | 'cancel'; onPress?: () => void }[] = [
      { text: t('business.change_role'), onPress: () => changeRole(p) },
      { text: t('business.assign_device'), onPress: () => pickDevice(p) },
      { text: t('business.assign_register'), onPress: () => pickRegister(p) },
      { text: t('business.assign_location'), onPress: () => pickLocation(p) },
    ];
    if (p.isActive) {
      actions.push({
        text: t('business.deactivate'), style: 'destructive',
        onPress: () => {
          const confirm = () => { try { setUserActive(p.id, false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch (e: any) { Alert.alert('Cannot deactivate', e?.message || 'Unknown error'); } };
          if (p.isOwner) {
            Alert.alert('Deactivate Owner?', `${p.name} is an OWNER and will lose access on all their devices.`, [
              { text: t('common.cancel'), style: 'cancel' },
              { text: 'Deactivate', style: 'destructive', onPress: confirm },
            ]);
          } else confirm();
        },
      });
    } else {
      actions.push({ text: t('business.reactivate'), style: 'default', onPress: () => { setUserActive(p.id, true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } });
    }
    actions.push({
      text: t('business.remove_person'), style: 'destructive', onPress: () => {
        Alert.alert(t('business.remove_person_title', { name: p.name }), p.isOwner ? `${p.name} is an OWNER — removing them ends their owner access for every device they use.` : t('business.remove_person_msg'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('business.remove'), style: 'destructive',
            onPress: () => { try { removeUser(p.id); } catch (e: any) { Alert.alert('Cannot remove', e?.message || 'Unknown error'); } },
          },
        ]);
      },
    });
    actions.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(p.name, t('business.choose_action'), actions);
  }

  function pickDevice(p: any) {
    const opts = devices.filter((d) => d.status === 'active' || d.status === 'locked');
    if (opts.length === 0) { Alert.alert(t('business.no_devices'), t('business.add_device_first')); return; }
    const current = devices.find((d) => d.userId === p.id && d.status !== 'removed');
    const buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = opts.map((d) => ({
      text: d.name + (d.userId && d.userId !== p.id ? '  (' + getRoleLabel(d.role || '') + ')' : ''),
      onPress: () => { assignDeviceToUser(d.id, p.id); Haptics.selectionAsync(); },
    }));
    if (current) buttons.push({ text: t('business.unassign_device'), onPress: () => { assignDeviceToUser(current.id, null); } });
    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(t('business.assign_device'), t('business.pick_device_for', { name: p.name }), buttons);
  }

  function pickRegister(p: any) {
    Alert.alert(t('business.assign_register'), t('business.pin_register_for', { name: p.name }), [
      ...registers.map((r) => ({
        text: r.name,
        onPress: () => { updateUserAssignment(p.id, { registerId: r.id }); Haptics.selectionAsync(); },
      })),
      { text: t('business.clear_register'), onPress: () => { updateUserAssignment(p.id, { registerId: null }); } },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  function pickLocation(p: any) {
    Alert.alert(t('business.assign_location'), t('business.pin_location_for', { name: p.name }), [
      ...locations.map((l) => ({
        text: l.name,
        onPress: () => { updateUserAssignment(p.id, { locationId: l.id }); Haptics.selectionAsync(); },
      })),
      { text: t('business.clear_location'), onPress: () => { updateUserAssignment(p.id, { locationId: null }); } },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  function changeRole(p: any) {
    const labels = SURFACED_BUILTIN_ROLES.map((k) => ({ key: k, label: getBuiltinRole(k)?.name || k }));
    const custom = getCustomRoles(businessId).map((r) => ({ key: r.key, label: r.name }));
    Alert.alert(t('business.change_role'), t('business.select_role_for', { name: p.name }), [
      ...labels.map((r) => ({
        text: r.label,
        onPress: () => { updateUserRole(p.id, r.key); Haptics.selectionAsync(); },
      })),
      ...custom.map((r) => ({
        text: r.label,
        onPress: () => { updateUserRole(p.id, r.key); Haptics.selectionAsync(); },
      })),
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }
}

function AddPersonModal({ businessId, devices, registers, locations, onClose, glass }: {
  businessId: string; devices: any[]; registers: any[]; locations: any[]; onClose: () => void; glass: any;
}) {
  const { t } = useSettings();
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>('cashier');
  const [phone, setPhone] = useState('');
  const [registerId, setRegisterId] = useState('');
  const [locationId, setLocationId] = useState('');
  const customRoles = getCustomRoles(businessId);

  const submit = () => {
    if (!name.trim()) { Alert.alert(t('business.name_required')); return; }
    addUser({ businessId, name: name.trim(), role, phone, assignedRegisterId: registerId || undefined, assignedLocationId: locationId || undefined });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
          <AppText variant="title" weight="bold" style={{ color: glass.fg }}>{t('business.add_person')}</AppText>
          <AppText variant="caption" weight="medium" style={{ color: glass.muted, marginTop: 4 }}>{t('business.they_use_own_device')}</AppText>

          <TextInput style={[styles.input, { borderColor: glass.border, color: glass.fg }]} placeholder={t('business.name')} placeholderTextColor={glass.muted} value={name} onChangeText={setName} />
          <TextInput style={[styles.input, { borderColor: glass.border, color: glass.fg }]} placeholder={t('business.phone_optional')} placeholderTextColor={glass.muted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

          <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 12, marginBottom: 6 }}>{t('business.role')}</AppText>
          <View style={styles.roleWrap}>
            {SURFACED_BUILTIN_ROLES.filter((k) => k !== 'owner').map((k) => (
              <TouchableOpacity key={k} onPress={() => { Haptics.selectionAsync(); setRole(k); }}
                style={[styles.roleChip, { backgroundColor: role === k ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                <AppText variant="caption" weight="bold" style={{ color: role === k ? glass.bg : glass.fg }}>{getBuiltinRole(k)?.name}</AppText>
              </TouchableOpacity>
            ))}
            {customRoles.map((r) => (
              <TouchableOpacity key={r.key} onPress={() => { Haptics.selectionAsync(); setRole(r.key); }}
                style={[styles.roleChip, { backgroundColor: role === r.key ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                <AppText variant="caption" weight="bold" style={{ color: role === r.key ? glass.bg : glass.fg }}>{r.name}</AppText>
              </TouchableOpacity>
            ))}
          </View>

          {registers.length > 0 && (
            <>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 12, marginBottom: 6 }}>{t('business.register')}</AppText>
              <View style={styles.roleWrap}>
                <TouchableOpacity onPress={() => { setRegisterId(''); }}
                  style={[styles.roleChip, { backgroundColor: registerId === '' ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                  <AppText variant="caption" weight="bold" style={{ color: registerId === '' ? glass.bg : glass.fg }}>{t('common.none')}</AppText>
                </TouchableOpacity>
                {registers.map((r) => (
                  <TouchableOpacity key={r.id} onPress={() => { Haptics.selectionAsync(); setRegisterId(r.id); }}
                    style={[styles.roleChip, { backgroundColor: registerId === r.id ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                    <AppText variant="caption" weight="bold" style={{ color: registerId === r.id ? glass.bg : glass.fg }}>{r.name}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {locations.length > 0 && (
            <>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 12, marginBottom: 6 }}>{t('business.location')}</AppText>
              <View style={styles.roleWrap}>
                <TouchableOpacity onPress={() => { setLocationId(''); }}
                  style={[styles.roleChip, { backgroundColor: locationId === '' ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                  <AppText variant="caption" weight="bold" style={{ color: locationId === '' ? glass.bg : glass.fg }}>{t('common.none')}</AppText>
                </TouchableOpacity>
                {locations.map((l) => (
                  <TouchableOpacity key={l.id} onPress={() => { Haptics.selectionAsync(); setLocationId(l.id); }}
                    style={[styles.roleChip, { backgroundColor: locationId === l.id ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                    <AppText variant="caption" weight="bold" style={{ color: locationId === l.id ? glass.bg : glass.fg }}>{l.name}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={[styles.btn, { backgroundColor: glass.accentGlass }]}>
              <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{t('common.cancel')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} style={[styles.btn, styles.btnPrimary, { backgroundColor: glass.fg }]}>
              <AppText variant="body" weight="bold" style={{ color: glass.bg }}>{t('business.add_person')}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- Devices ----------

function DevicesPanel({ businessId, devices, people, canManage, glass }: {
  businessId: string; devices: Device[]; people: any[]; canManage: boolean; glass: any;
}) {
  const { t } = useSettings();
  const [showAdd, setShowAdd] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.headerTitle}>
          <View style={[styles.iconBox, { backgroundColor: glass.accentGlass }]}><Smartphone size={18} color={glass.fg} /></View>
          <AppText variant="title" weight="bold" style={{ color: glass.fg }}>{t('business.devices')}</AppText>
        </View>
        {canManage && (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push('/pairing-qr' as any)} style={[styles.smallBtn, { backgroundColor: glass.accentGlass }]}>
              <QrCode size={15} color={glass.fg} />
              <AppText variant="caption" weight="bold" style={{ color: glass.fg, marginLeft: 4 }}>{t('business.qr_pair')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowInvite(true)} style={[styles.smallBtn, { backgroundColor: glass.accentGlass }]}>
              <Link2 size={15} color={glass.fg} />
              <AppText variant="caption" weight="bold" style={{ color: glass.fg, marginLeft: 4 }}>{t('business.invite')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAdd(true)} style={[styles.smallBtn, { backgroundColor: glass.fg }]}>
              <Plus size={15} color={glass.bg} />
              <AppText variant="caption" weight="bold" style={{ color: glass.bg, marginLeft: 4 }}>{t('business.add_device_short')}</AppText>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {canManage && <JoinRequestsSection businessId={businessId} people={people} glass={glass} />}

      {devices.map((d) => (
        <View key={d.id} style={[styles.listCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
          <View style={[styles.statusDot, { backgroundColor: d.status === 'active' ? '#2ecc71' : d.status === 'pending' ? '#f1c40f' : '#e74c3c' }]} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{d.name}</AppText>
            <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>
              {statusLabel(d.status, t)} · {platformLabel(d.platform, t)}{d.userId ? ' · ' + (people.find((p) => p.id === d.userId)?.name || '') : ''}{d.role ? ' · ' + getRoleLabel(d.role) : ''}
            </AppText>
          </View>
          {canManage && (
            <TouchableOpacity onPress={() => deviceActions(d)} style={[styles.smallBtn, { backgroundColor: glass.accentGlass }]}>
              <AppText variant="caption" weight="bold" style={{ color: glass.fg }}>…</AppText>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {devices.filter((d) => d.status === 'pending').length > 0 && (
        <View style={[styles.warnCard, { backgroundColor: glass.accentGlass, borderColor: glass.border }]}>
          <AppText variant="body" weight="bold" style={{ color: glass.fg }}>
            {t('business.pending_devices', { count: String(devices.filter((d) => d.status === 'pending').length) })}
          </AppText>
        </View>
      )}

      {canManage && <CloudDevicesSection people={people} glass={glass} />}

      {showAdd && (
        <AddDeviceModal businessId={businessId} people={people} onClose={() => setShowAdd(false)} glass={glass} />
      )}
      {showInvite && (
        <InviteModal businessId={businessId} canAdd={canAddDevice(businessId)} activeCount={getActiveDeviceCount(businessId)} onClose={() => setShowInvite(false)} glass={glass} />
      )}
    </View>
  );

  function deviceActions(d: Device) {
    const opts: { text: string; style?: 'destructive'|'default'|'cancel'; onPress: () => void }[] = [];
    if (d.status === 'pending') opts.push({ text: t('business.approve'), onPress: () => approveLocal(d) });
    if (d.status === 'active') opts.push({ text: t('business.lock'), onPress: () => safeSetStatus(d, 'locked') });
    if (d.status === 'locked') opts.push({ text: t('business.unlock'), onPress: () => safeSetStatus(d, 'active') });
    if (d.status !== 'disabled') opts.push({ text: t('business.disable'), style: 'destructive', onPress: () => safeSetStatus(d, 'disabled') });
    if (d.status !== 'removed' && d.status !== 'disabled') opts.push({ text: t('business.replace'), onPress: () => replaceLocal(d) });
    opts.push({ text: t('business.rename'), onPress: () => renameLocal(d) });
    opts.push({ text: t('common.cancel'), style: 'cancel', onPress: () => {} });
    Alert.alert(d.name, t('business.device_actions'), opts);
  }

  function safeSetStatus(d: Device, status: Device['status']) {
    try {
      setDeviceStatus(d.id, status);
    } catch (e: any) {
      Alert.alert(t('business.cannot_change_status'), e?.message || t('business.unable_update_status'));
    }
  }

  function approveLocal(d: Device) {
    // Assign to a selected person if any; otherwise keep unassigned-active.
    // Owners are valid assignees too — any member may be linked to a device.
    const persons = people;
    if (persons.length === 1) approveDevice(d.id, persons[0].id, persons[0].role);
    else approveDevice(d.id, d.userId || '', d.role || 'cashier');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function renameLocal(d: Device) {
    Alert.prompt(t('business.rename_device'), t('business.new_name'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.save'), onPress: (v?: string) => v && renameDevice(d.id, v) },
    ]);
  }

  function replaceLocal(d: Device) {
    Alert.prompt(t('business.replace_device'), t('business.replacement_name'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('business.replace'), style: 'default',
        onPress: (v?: string) => {
          const name = v?.trim();
          if (!name) return;
          Alert.alert(
            t('business.confirm_replacement'),
            t('business.replace_prompt', { device: d.name || d.id, name }),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('business.replace'), style: 'destructive',
                onPress: () => {
                  try {
                    replaceDevice({
                      businessId,
                      oldDeviceId: d.id,
                      name,
                      platform: d.platform === 'desktop' ? 'desktop' : 'mobile',
                      setThisAsReplacement: true,
                    });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  } catch (e: any) {
                    Alert.alert(t('business.cannot_replace_device'), e?.message || t('business.unable_replace_device'));
                  }
                },
              },
            ],
          );
        },
      },
    ]);
  }
}

function statusLabel(s: string, t: (k: string) => string): string {
  if (s === 'active') return t('business.status_active');
  if (s === 'pending') return t('business.status_pending');
  if (s === 'locked') return t('business.status_locked');
  if (s === 'disabled') return t('business.status_disabled');
  if (s === 'removed') return t('business.status_removed');
  return s;
}

function platformLabel(s: string, t: (k: string) => string): string {
  if (s === 'mobile') return t('business.platform_mobile');
  if (s === 'desktop') return t('business.platform_desktop');
  return s;
}

function AddDeviceModal({ businessId, people, onClose, glass }: { businessId: string; people: any[]; onClose: () => void; glass: any }) {
  const { t } = useSettings();
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<'mobile' | 'desktop'>('mobile');
  const [userId, setUserId] = useState('');
  const [registers, setRegisters] = useState<{id:string;name:string}[]>([]);
  const [registerId, setRegisterId] = useState('');

  useEffect(() => { setRegisters(getRegisters(businessId)); }, [businessId]);

  const submit = () => {
    if (!name.trim()) { Alert.alert(t('business.name_required')); return; }
    const person = people.find((p) => p.id === userId);
    addDevice({ businessId, name: name.trim(), platform, userId: person?.id, role: person?.role, registerId: registerId || undefined }, '');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
          <AppText variant="title" weight="bold" style={{ color: glass.fg }}>{t('business.add_device')}</AppText>

          <TextInput style={[styles.input, { borderColor: glass.border, color: glass.fg }]} placeholder={t('business.device_name_placeholder')} placeholderTextColor={glass.muted} value={name} onChangeText={setName} />

          <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 12 }}>{t('business.platform')}</AppText>
          <View style={styles.roleWrap}>
            {(['mobile','desktop'] as const).map((pl) => (
              <TouchableOpacity key={pl} onPress={() => { Haptics.selectionAsync(); setPlatform(pl); }}
                style={[styles.roleChip, { backgroundColor: platform === pl ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                <AppText variant="caption" weight="bold" style={{ color: platform === pl ? glass.bg : glass.fg }}>{pl === 'mobile' ? t('business.platform_mobile') : t('business.platform_desktop')}</AppText>
              </TouchableOpacity>
            ))}
          </View>

          {people.length > 0 && (
            <>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 12 }}>{t('business.assigned_person')}</AppText>
              <View style={styles.roleWrap}>
                <TouchableOpacity onPress={() => { setUserId(''); }}
                  style={[styles.roleChip, { backgroundColor: userId === '' ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                  <AppText variant="caption" weight="bold" style={{ color: userId === '' ? glass.bg : glass.fg }}>{t('common.none')}</AppText>
                </TouchableOpacity>
                {people.map((p) => (
                  <TouchableOpacity key={p.id} onPress={() => { Haptics.selectionAsync(); setUserId(p.id); }}
                    style={[styles.roleChip, { backgroundColor: userId === p.id ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                    <AppText variant="caption" weight="bold" style={{ color: userId === p.id ? glass.bg : glass.fg }}>{p.name}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {registers.length > 0 && (
            <>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 12 }}>{t('business.register')}</AppText>
              <View style={styles.roleWrap}>
                <TouchableOpacity onPress={() => { setRegisterId(''); }}
                  style={[styles.roleChip, { backgroundColor: registerId === '' ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                  <AppText variant="caption" weight="bold" style={{ color: registerId === '' ? glass.bg : glass.fg }}>{t('common.none')}</AppText>
                </TouchableOpacity>
                {registers.map((r) => (
                  <TouchableOpacity key={r.id} onPress={() => { Haptics.selectionAsync(); setRegisterId(r.id); }}
                    style={[styles.roleChip, { backgroundColor: registerId === r.id ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                    <AppText variant="caption" weight="bold" style={{ color: registerId === r.id ? glass.bg : glass.fg }}>{r.name}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={[styles.btn, { backgroundColor: glass.accentGlass }]}>
              <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{t('common.cancel')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} style={[styles.btn, styles.btnPrimary, { backgroundColor: glass.fg }]}>
              <AppText variant="body" weight="bold" style={{ color: glass.bg }}>{t('business.add_device')}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- Invite + Join Requests ----------

function InviteModal({ businessId, canAdd, activeCount, onClose, glass }: {
  businessId: string; canAdd: boolean; activeCount: number; onClose: () => void; glass: any;
}) {
  const { t } = useSettings();
  const { showToast } = useToast();
  const [invite, setInvite] = useState<null | { id: string; code: string; expiresAt: string; qrUri: string }>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('cashier');
  const roles: BuiltinRoleKey[] = ['cashier', 'inventory', 'manager', 'reports', 'accountant'];
  // Nearby team devices in Joining Mode, shown so the owner can identify who
  // is waiting to join ("Team · device name").
  const [nearbyTeam, setNearbyTeam] = useState<Array<{ deviceId: string; deviceName: string; platform: string; role?: string }>>([]);
  // Discovery mode for as long as the Add-Team sheet is open: other devices
  // (joiners AND owners) see this device immediately — even before an invite
  // is generated — and we browse so team devices appear here by name.
  useEffect(() => {
    try { mobilePairingBeacon.setDiscoverable(true, 'Shega', 'owner'); } catch { /* ignore */ }
    try { mobilePairingBeacon.startBrowsing(); } catch { /* ignore */ }
    const refresh = () => {
      try {
        setNearbyTeam(mobilePairingBeacon.getNearbyOwners().map(({ beacon }) => ({
          deviceId: beacon.owner?.deviceId || beacon.businessId,
          deviceName: beacon.owner?.deviceName || 'Nearby device',
          platform: beacon.owner?.platform || 'mobile',
          role: beacon.role,
        })));
      } catch { /* ignore */ }
    };
    const sub = mobilePairingBeacon.onFound(refresh);
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      sub();
      clearInterval(timer);
      try { mobilePairingBeacon.stopBrowsing(); } catch { /* ignore */ }
      try { mobilePairingBeacon.setDiscoverable(false); } catch { /* ignore */ }
    };
  }, []);

  const create = () => {
    const generated = generateInvitation({ businessId, name: name.trim() || undefined, role, platform: 'mobile' });
    setInvite(generated);
    // Bluetooth-style discovery: advertise a beacon while this invite is open.
    mobilePairingBeacon.advertiseInvitation({ id: generated.id, code: generated.code, businessId, role, expiresAt: generated.expiresAt });
    if (wsSyncClient.isConnected) {
      wsSyncClient.publishInvitation({
        id: generated.id, businessId, code: generated.code, name: name.trim() || undefined,
        role, platform: 'mobile', expiresAt: generated.expiresAt,
      }).catch(() => {});
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
          <View style={styles.headerTitle}>
            <AppText variant="title" weight="bold" style={{ color: glass.fg }}>{t('business.invite_to_join')}</AppText>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={20} color={glass.muted} /></TouchableOpacity>
          </View>

          {invite ? (
            <View>
              <AppText variant="body" weight="medium" align="center" style={{ color: glass.muted, marginVertical: 8 }}>
                {name.trim() || t('business.new_member')} · {getRoleLabel(role)}
              </AppText>
              {/* Discovery radar: no code, no QR — tap the waiting device. */}
              <RadarPulse
                glass={glass}
                compact
                deviceName={getThisDeviceName()}
                tone={nearbyTeam.length > 0 ? 'found' : 'searching'}
                status={
                  nearbyTeam.length > 0
                    ? `${nearbyTeam.length} device(s) found`
                    : 'Searching for nearby devices…'
                }
                peers={nearbyTeam
                  .map((d) => ({
                    id: d.deviceId,
                    name: d.deviceName,
                    platform: d.platform,
                    detail: d.role === 'team' ? 'Waiting to join · tap to add' : 'Visible · tap to add',
                  }))}
                onPickPeer={(p) => {
                  preassignJoinIdentity(p.id, { name: name.trim() || undefined, role });
                  try {
                    mobilePairingBeacon.advertiseInvitation({ id: invite.id, code: invite.code, businessId, role, expiresAt: invite.expiresAt });
                  } catch { /* beacon unavailable */ }
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  showToast(`${name.trim() || p.name} joins as ${getRoleLabel(role)} as soon as they connect.`, 'success');
                }}
                emptyHint={t('business.ask_employee_code')}
              />
              {wsSyncClient.isConnected ? (
                <AppText variant="caption" weight="medium" align="center" style={{ color: '#2ecc71', marginTop: 6 }}>
                  {t('business.invite_published')}
                </AppText>
              ) : (
                <AppText variant="caption" weight="medium" align="center" style={{ color: '#f1c40f', marginTop: 6 }}>
                  {t('business.invite_not_connected')}
                </AppText>
              )}
              <TouchableOpacity onPress={() => { revokeInvitation(invite.id); mobilePairingBeacon.stopPublishing(); setInvite(null); }} style={[styles.btn, { backgroundColor: glass.accentGlass, marginTop: 16 }]}>
                <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{t('business.done_revoke')}</AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {!canAdd && (
                <View style={[styles.warnCard, { backgroundColor: glass.accentGlass, borderColor: glass.border }]}>
                  <AppText variant="caption" weight="bold" style={{ color: glass.fg }}>
                    {t('business.device_limit_reached', { count: String(activeCount) })}
                  </AppText>
                </View>
              )}
              {nearbyTeam.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted }}>
                    Nearby devices ({nearbyTeam.length})
                  </AppText>
                  {nearbyTeam.map((d, i) => (
                    <View key={`${d.deviceName}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: i < nearbyTeam.length - 1 ? 1 : 0, borderBottomColor: glass.border }}>
                      {d.platform === 'desktop'
                        ? <Building2 size={15} color={glass.accent} />
                        : <Smartphone size={15} color={glass.accent} />}
                      <AppText variant="body" weight="bold" style={{ color: glass.fg }} numberOfLines={1}>
                        {d.role === 'team' ? 'Team' : 'Owner'} · {d.deviceName}
                      </AppText>
                    </View>
                  ))}
                </View>
              )}
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 6 }}>{t('business.employee_name')}</AppText>
              <TextInput style={[styles.input, { borderColor: glass.border, color: glass.fg }]} placeholder="e.g. Hana" placeholderTextColor={glass.muted} value={name} onChangeText={setName} />
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 12 }}>{t('business.requested_role')}</AppText>
              <View style={styles.roleWrap}>
                {roles.map((r) => (
                  <TouchableOpacity key={r} onPress={() => { Haptics.selectionAsync(); setRole(r); }}
                    style={[styles.roleChip, { backgroundColor: role === r ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                    <AppText variant="caption" weight="bold" style={{ color: role === r ? glass.bg : glass.fg }}>{getBuiltinRole(r)?.name || r}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={onClose} style={[styles.btn, { backgroundColor: glass.accentGlass }]}>
                  <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{t('common.cancel')}</AppText>
                </TouchableOpacity>
                <TouchableOpacity onPress={create} style={[styles.btn, styles.btnPrimary, { backgroundColor: glass.fg }]}>
                  <AppText variant="body" weight="bold" style={{ color: glass.bg }}>{t('business.generate_invitation')}</AppText>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function JoinRequestsSection({ businessId, people, glass }: { businessId: string; people: any[]; glass: any }) {
  const { t } = useSettings();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [configuring, setConfiguring] = useState<{ request: any } | null>(null);

  const seenRequestsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    let pendingList: any[] = [];
    // When this phone IS the hub (no WS connection to another hub), read the
    // join requests staged locally by our own TCP join channel.
    if (!wsSyncClient.isConnected) {
      try {
        const db = getDB();
        const rows = db.getAllSync(
          `SELECT * FROM device_requests WHERE business_id = ?
           ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 100`,
          [businessId],
        ) as any[];
        const activeDevs = new Set(
          (db.getAllSync("SELECT id, uuid FROM devices WHERE status = 'active' AND is_deleted = 0") as any[])
            .map((d) => d.id || d.uuid)
        );
        pendingList = rows.filter((r) => r.status === 'pending' && !activeDevs.has(r.joiner_device_id)).map((r) => ({
          requestId: r.id,
          businessId: r.business_id,
          code: r.code,
          joinerDeviceId: r.joiner_device_id,
          joinerName: r.joiner_name,
          joinerModel: r.joiner_model,
          joinerUser: r.joiner_user,
          role: r.role,
          platform: r.platform,
          status: r.status,
        }));
      } catch { /* device_requests may not exist yet */ }
    } else {
      try {
        const list = await wsSyncClient.listDeviceJoinRequests(businessId);
        const db = getDB();
        const activeDevs = new Set(
          (db.getAllSync("SELECT id, uuid FROM devices WHERE status = 'active' AND is_deleted = 0") as any[])
            .map((d) => d.id || d.uuid)
        );
        pendingList = Array.isArray(list) ? list.filter((r) => r.status === 'pending' && !activeDevs.has(r.joinerDeviceId)) : [];
      } catch { /* not connected */ }
    }

    // Toast notification when a new join request arrives
    for (const r of pendingList) {
      if (!seenRequestsRef.current.has(r.requestId)) {
        if (seenRequestsRef.current.size > 0) {
          showToast(`New join request from ${r.joinerUser || r.joinerName || 'a new member'}`, 'info');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        seenRequestsRef.current.add(r.requestId);
      }
    }

    setRequests(pendingList);
    setLoaded(true);
  }, [businessId, showToast]);

  useEffect(() => { refresh(); }, [refresh]);
  useDataChangedRefresh(refresh);
  // Real-time-ish: poll for incoming join requests so the owner sees the
  // request promptly, wherever they are in the app (spec §4 modal trigger).
  useEffect(() => {
    if (!businessId) return;
    const timer = setInterval(refresh, 6000);
    return () => clearInterval(timer);
  }, [businessId, refresh]);

  const decide = async (re: any, approve: boolean, cfg?: { role?: string; permissions?: Record<string, unknown> }) => {
    setRefreshing(true);
    try {
      // The owner assigns ONLY a role at this stage — the joiner sets their own
      // name, profile picture and PIN on their device after approval. The
      // roster mirror below keeps a placeholder name until then.
      const assignedName = re.joinerUser || re.joinerName || t('business.new_member');
      const finalRole = cfg?.role || re.role || 'cashier';
      if (approve && wsSyncClient.isConnected) {
        wsSyncClient.decideDeviceJoinRequest({ requestId: re.requestId, businessId, joinerDeviceId: re.joinerDeviceId, decision: 'approved', decidedBy: people.find((p) => p.isOwner)?.id || '', assignedName, assignedRole: finalRole, assignedPermissions: cfg?.permissions }).catch(() => {});
      }
      // When this phone IS the hub, record the decision locally so the joiner's
      // STATUS poll (over TCP) sees it, the assigned role, and receives the
      // pairing credential.
      if (!wsSyncClient.isConnected) {
        try {
          const db = getDB();
          const sets: string[] = ['status = ?', 'decided_at = ?'];
          const vals: any[] = [approve ? 'approved' : 'rejected', new Date().toISOString()];
          if (approve) {
            if (cfg?.permissions) { sets.push('assigned_permissions = ?'); vals.push(JSON.stringify(cfg.permissions)); }
            if (finalRole) { sets.push('role = ?'); vals.push(finalRole); }
          }
          vals.push(re.requestId);
          try {
            db.runSync(`UPDATE device_requests SET ${sets.join(', ')} WHERE id = ?`, vals);
          } catch {
            db.runSync('ALTER TABLE device_requests ADD COLUMN assigned_name TEXT');
            db.runSync('ALTER TABLE device_requests ADD COLUMN assigned_avatar TEXT');
            db.runSync('ALTER TABLE device_requests ADD COLUMN assigned_permissions TEXT');
            db.runSync(`UPDATE device_requests SET ${sets.join(', ')} WHERE id = ?`, vals);
          }
          if (approve) {
            try { db.runSync("UPDATE invitations SET status = 'used' WHERE code = ?", [re.code]); } catch { /* best-effort */ }
          }
        } catch { /* best-effort */ }
      }
      // Mirror on this owner device: create the employee + an active device
      // with the assigned role. The joiner's own name/avatar/PIN arrive via
      // roster sync once they finish their own setup.
      if (approve) {
        const person = addUser({ businessId, name: assignedName, role: finalRole });
        if (cfg?.permissions) {
          try {
            const db = getDB();
            db.runSync('UPDATE users SET permissions = ?, updated_at = ? WHERE id = ?',
              [JSON.stringify(cfg.permissions), new Date().toISOString(), person.id]);
          } catch { /* best-effort */ }
        }
        // Use the REAL joiner device id so the hub-side roster row created at
        // submit and this local mirror coalesce on the same identity.
        addDevice({ businessId, name: re.joinerName || t('business.new_device'), platform: re.platform === 'desktop' ? 'desktop' : 'mobile', userId: person.id, role: finalRole }, re.joinerDeviceId ?? '');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType[approve ? 'Success' : 'Warning']);
      setRequests((prev) => prev.filter((x) => x.requestId !== re.requestId));
    } finally {
      setRefreshing(false);
    }
  };

  /** Spec §4 approval: role selector (Owner/Cashier/Custom) → Approve & Sync. */
  const decideWithRoleLocal = (re: any) => {
    // Role-assignment flow: the owner picks the member's role (Owner/Cashier/
    // Custom — for Custom, the exact permissions) before confirming. The member
    // sets their own name, picture and PIN after approval.
    setConfiguring({ request: re });
  };

  if (!loaded && wsSyncClient.isConnected) return null;
  if (requests.length === 0) return null;

  return (
    <View style={[styles.warnCard, { backgroundColor: glass.accentGlass, borderColor: glass.border, marginBottom: 12 }]}>
      <View style={styles.headerRow}>
        <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{t('business.join_requests')}</AppText>
        <TouchableOpacity onPress={refresh}><AppText variant="caption" weight="bold" style={{ color: glass.fg }}>{refreshing ? '…' : t('business.refresh')}</AppText></TouchableOpacity>
      </View>
      {requests.map((re) => (
        <View key={re.requestId} style={[styles.listCard, { backgroundColor: glass.bgCard, borderColor: glass.border, marginTop: 8 }]}>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{re.joinerUser || re.joinerName}</AppText>
            <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>{re.joinerName} · {getRoleLabel(re.role)} · {platformLabel(re.platform, t)}</AppText>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => decide(re, false)} style={[styles.smallBtn, { backgroundColor: '#e74c3c' }]}>
              <ShieldX size={15} color="#fff" /><AppText variant="caption" weight="bold" style={{ color: '#fff', marginLeft: 4 }}>{t('business.reject')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => decideWithRoleLocal(re)} style={[styles.smallBtn, { backgroundColor: '#2ecc71' }]}>
              <ShieldCheck size={15} color="#fff" /><AppText variant="caption" weight="bold" style={{ color: '#fff', marginLeft: 4 }}>Approve & Sync</AppText>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {configuring && (
        <MemberApprovalModal
          request={configuring.request}
          glass={glass}
          onClose={() => setConfiguring(null)}
          onConfirm={async (cfg) => {
            const re = configuring.request;
            setConfiguring(null);
            await decide(re, true, cfg);
            refresh();
          }}
        />
      )}
    </View>
  );
}

// ---------- Cloud device roster (backend-authorized devices) ----------

function CloudDevicesSection({ people, glass }: { people: any[]; glass: any }) {
  const { t } = useSettings();
  const [devices, setDevices] = useState<CloudDeviceEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const list = await listCloudDevices();
      setDevices(Array.isArray(list) ? list : []);
    } catch {
      setError(t('business.not_signed_in_devices'));
    }
  }, [t]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!error && devices.length === 0) return null;
  if (error && devices.length === 0) return null;

  const setStatus = async (d: CloudDeviceEntry, status: 'active' | 'locked' | 'disabled' | 'removed') => {
    setBusy(d.id);
    try {
      await manageDevice(d.id, { status });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
    } catch {
      Alert.alert(t('business.update_failed'), t('business.update_failed_msg'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (d: CloudDeviceEntry) => {
    Alert.alert(t('business.remove_device'), t('business.remove_device_prompt', { device: d.device_name, platform: platformLabel(d.platform, t) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('business.remove'), style: 'destructive', onPress: async () => {
        setBusy(d.id);
        try {
          await removeCloudDevice(d.id);
          await refresh();
        } catch {
          Alert.alert(t('business.remove_failed'), t('business.remove_failed_msg'));
        } finally {
          setBusy(null);
        }
      } },
    ]);
  };

  const actions = (d: CloudDeviceEntry) => {
    const opts: { text: string; style?: 'default' | 'destructive' | 'cancel'; onPress: () => void }[] = [];
    if (d.status === 'active') opts.push({ text: t('business.lock'), onPress: () => setStatus(d, 'locked') });
    if (d.status === 'locked') opts.push({ text: t('business.unlock'), onPress: () => setStatus(d, 'active') });
    if (d.status === 'active' || d.status === 'locked') opts.push({ text: t('business.disable'), style: 'destructive', onPress: () => setStatus(d, 'disabled') });
    opts.push({ text: t('business.remove'), style: 'destructive', onPress: () => remove(d) });
    opts.push({ text: t('common.cancel'), style: 'cancel', onPress: () => {} });
    Alert.alert(d.device_name, t('business.cloud_device_actions'), opts);
  };

  const dotColor = (s: string) => s === 'active' ? '#2ecc71' : s === 'pending' ? '#f1c40f' : '#e74c3c';
  const boundName = (d: CloudDeviceEntry) => d.bound_user_name || (d.bound_user_id ? t('business.member_id', { id: d.bound_user_id }) : t('business.unassigned'));

  return (
    <View style={[styles.warnCard, { backgroundColor: glass.accentGlass, borderColor: glass.border, marginTop: 12 }]}>
      <View style={styles.headerRow}>
        <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{t('business.cloud_devices')}</AppText>
        <TouchableOpacity onPress={refresh}><AppText variant="caption" weight="bold" style={{ color: glass.fg }}>{t('business.refresh')}</AppText></TouchableOpacity>
      </View>
      <AppText variant="caption" weight="medium" style={{ color: glass.muted, marginTop: 4, marginBottom: 8 }}>
        {t('business.cloud_devices_hint')}
      </AppText>

      {error && <AppText variant="caption" weight="medium" style={{ color: glass.muted, marginBottom: 6 }}>{error}</AppText>}

      {devices.map((d) => (
        <View key={d.id} style={[styles.listCard, { backgroundColor: glass.bgCard, borderColor: glass.border, marginTop: 8 }]}>
          <View style={[styles.statusDot, { backgroundColor: dotColor(d.status) }]} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: glass.fg }}>
              {d.device_name}{d.platform === 'desktop' ? '  💻' : '  📱'}
            </AppText>
            <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>
              {statusLabel(d.status, t)} · {boundName(d)}{d.role_key ? ' · ' + getRoleLabel(d.role_key) : ''}
            </AppText>
          </View>
          <TouchableOpacity disabled={busy === d.id} onPress={() => actions(d)} style={[styles.smallBtn, { backgroundColor: glass.accentGlass, opacity: busy === d.id ? 0.5 : 1 }]}>
            <AppText variant="caption" weight="bold" style={{ color: glass.fg }}>{busy === d.id ? '…' : '…'}</AppText>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ---------- Cloud pairing (backend QR invites) ----------

function CloudPairingSection({ glass }: { glass: any }) {
  const { t } = useSettings();
  const [invites, setInvites] = useState<any[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const list = await listPairingInvitations();
      setInvites(Array.isArray(list) ? list : []);
    } catch {
      setError(t('business.not_signed_in_pairing'));
    }
  }, [t]);

  useEffect(() => { refresh(); }, [refresh]);

  const pending = invites.filter((i) => i.status === 'used' && i.device_status === 'pending');
  const issued = invites.filter((i) => i.status === 'pending');

  const decide = async (id: string, approve: boolean, role?: string) => {
    setBusy(Number(id));
    try {
      await decidePairing(id, approve ? 'approve' : 'reject', role);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType[approve ? 'Success' : 'Warning']);
      await refresh();
    } catch {
      Alert.alert(approve ? t('business.approve_failed') : t('business.reject_failed'), t('business.update_pairing_failed'));
    } finally {
      setBusy(null);
    }
  };

  /** Approve with an explicitly chosen final role (spec §7). */
  const decideWithRole = (id: string, name: string) => {
    Alert.alert(
      'Assign role',
      `Choose ${name || "this member"}'s role in the business. Owner makes them an equal owner.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: '👑 Owner',
          onPress: () => decide(id, true, 'owner'),
        },
        {
          text: 'Cashier',
          onPress: () => decide(id, true, 'cashier'),
        },
        {
          text: 'Custom…',
          onPress: () =>
            Alert.prompt(
              'Custom role',
              'manager, inventory, accountant, reports, warehouse…',
              [
                { text: t('common.cancel'), style: 'cancel' },
                { text: 'Approve', onPress: (v?: string) => v && v.trim() && decide(id, true, v.trim().toLowerCase()) },
              ],
            ),
        },
      ],
    );
  };

  const revoke = async (id: string) => {
    setBusy(Number(id));
    try {
      await revokePairing(id);
      Haptics.selectionAsync();
      await refresh();
    } catch {
      Alert.alert(t('business.revoke_failed'), t('business.revoke_failed_msg'));
    } finally {
      setBusy(null);
    }
  };

  if (!error && pending.length === 0 && issued.length === 0) return null;

  return (
    <View style={[styles.warnCard, { backgroundColor: glass.accentGlass, borderColor: glass.border, marginBottom: 12 }]}>
      <View style={styles.headerRow}>
        <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{t('business.cloud_pairing')}</AppText>
        <TouchableOpacity onPress={refresh}><AppText variant="caption" weight="bold" style={{ color: glass.fg }}>{t('business.refresh')}</AppText></TouchableOpacity>
      </View>

      {error && (
        <AppText variant="caption" weight="medium" style={{ color: glass.muted, marginTop: 6 }}>{error}</AppText>
      )}

      {pending.map((inv) => (
        <View key={inv.id} style={[styles.listCard, { backgroundColor: glass.bgCard, borderColor: glass.border, marginTop: 8 }]}>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{inv.employee_name || t('business.new_employee')}</AppText>
            <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>
              {getRoleLabel(inv.role)}{inv.register ? ' · ' + inv.register : ''}{inv.location ? ' · ' + inv.location : ''}
            </AppText>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => decide(String(inv.id), false)} disabled={busy === Number(inv.id)} style={[styles.smallBtn, { backgroundColor: '#e74c3c' }]}>
              <ShieldX size={15} color="#fff" /><AppText variant="caption" weight="bold" style={{ color: '#fff', marginLeft: 4 }}>{t('business.reject')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => decideWithRole(String(inv.id), inv.employee_name)} disabled={busy === Number(inv.id)} style={[styles.smallBtn, { backgroundColor: '#2ecc71' }]}>
              <ShieldCheck size={15} color="#fff" /><AppText variant="caption" weight="bold" style={{ color: '#fff', marginLeft: 4 }}>{t('business.approve')}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {issued.map((inv) => (
        <View key={inv.id} style={[styles.listCard, { backgroundColor: glass.bgCard, borderColor: glass.border, marginTop: 8 }]}>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{inv.employee_name || t('business.invitation')}</AppText>
            <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>
              {getRoleLabel(inv.role)}{inv.register ? ' · ' + inv.register : ''} · {t('business.waiting_scanned')}
            </AppText>
          </View>
          <TouchableOpacity onPress={() => revoke(String(inv.id))} disabled={busy === Number(inv.id)} style={[styles.smallBtn, { backgroundColor: glass.accentGlass }]}>
            <AppText variant="caption" weight="bold" style={{ color: glass.fg }}>{t('business.revoke')}</AppText>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ---------- Registers ----------

function RegistersPanel({ businessId, registers, locations, canManage, glass }: {
  businessId: string; registers: any[]; locations: any[]; canManage: boolean; glass: any;
}) {
  const { t } = useSettings();
  const [name, setName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  return (
    <View>
      <SectionHeader icon={Printer} title={t('business.registers')} actionLabel={canManage ? t('business.add_register') : undefined} onAction={() => canManage && setShowAdd(true)} glass={glass} />
      {registers.map((r) => (
        <View key={r.id} style={[styles.listCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
          <View style={[styles.iconBox, { backgroundColor: glass.accentGlass }]}><Printer size={18} color={glass.fg} /></View>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{r.name}</AppText>
            <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>
              {r.deviceId ? t('business.connected_device') : t('business.no_device_assigned')} {r.has_drawer ? '· ' + t('business.drawer') : ''}
            </AppText>
          </View>
        </View>
      ))}

      {showAdd && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowAdd(false)}>
          <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.modalCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
              <AppText variant="title" weight="bold" style={{ color: glass.fg }}>{t('business.add_register')}</AppText>
              <TextInput style={[styles.input, { borderColor: glass.border, color: glass.fg }]} placeholder={t('business.register_name_placeholder')} placeholderTextColor={glass.muted} value={name} onChangeText={setName} />
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => setShowAdd(false)} style={[styles.btn, { backgroundColor: glass.accentGlass }]}>
                  <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{t('common.cancel')}</AppText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  if (!name.trim()) { Alert.alert(t('business.name_required')); return; }
                  addRegister(businessId, name.trim(), locations[0]?.id);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setShowAdd(false); setName('');
                }} style={[styles.btn, styles.btnPrimary, { backgroundColor: glass.fg }]}>
                  <AppText variant="body" weight="bold" style={{ color: glass.bg }}>{t('business.add_register')}</AppText>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

// ---------- Permissions ----------

function PermissionsPanel({ businessId, canManage, glass }: { businessId: string; canManage: boolean; glass: any }) {
  const { t } = useSettings();
  const [selectedRole, setSelectedRole] = useState<BuiltinRoleKey>('cashier');
  const role = getBuiltinRole(selectedRole)!;
  const [edits, setEdits] = useState<Record<string, PermissionValue>>({});

  const scopes = [...new Set(PERMISSION_CATALOG.map((p) => p.scope))];

  return (
    <View>
      <SectionHeader icon={KeyRound} title={t('business.permissions')} glass={glass} />
      {!canManage && <AppText variant="caption" weight="medium" style={{ color: glass.muted, marginBottom: 10 }}>{t('business.only_owner_change_perm')}</AppText>}

      <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginBottom: 6 }}>{t('business.role')}</AppText>
      <View style={styles.roleWrap}>
        {SURFACED_BUILTIN_ROLES.filter((k) => k !== 'owner').map((k) => (
          <TouchableOpacity key={k} onPress={() => { Haptics.selectionAsync(); setSelectedRole(k); setEdits({}); }}
            style={[styles.roleChip, { backgroundColor: selectedRole === k ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
            <AppText variant="caption" weight="bold" style={{ color: selectedRole === k ? glass.bg : glass.fg }}>{getBuiltinRole(k)?.name}</AppText>
          </TouchableOpacity>
        ))}
      </View>

      {scopes.map((scope) => {
        const defs = PERMISSION_CATALOG.filter((p) => p.scope === scope);
        const effectiveScope = scope as PermissionScope;
        const valueFor = (key: string): PermissionValue => edits[key] !== undefined ? edits[key] : role.permissions[key] ?? false;
        return (
          <View key={scope} style={[styles.listCard, { backgroundColor: glass.bgCard, borderColor: glass.border, marginTop: 12 }]}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.fg, marginBottom: 4 }}>{SCOPE_LABELS[effectiveScope]}</AppText>
            {defs.map((d) => {
              const v = valueFor(d.key);
              return (
                <View key={d.key} style={[styles.permRow, { borderBottomColor: glass.border }]}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{d.label}</AppText>
                    <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>{d.description}</AppText>
                  </View>
                  <TouchableOpacity disabled={!canManage} onPress={() => { Haptics.selectionAsync(); cycleValue(d.key); }}
                    style={[styles.permBadge, { backgroundColor: permColor(v), borderColor: glass.border }]}>
                    <AppText variant="caption" weight="bold" style={{ color: v ? '#fff' : glass.fg }}>{v === 'approval' ? t('business.perm_approval') : permLabel(v)}</AppText>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        );
      })}

      {canManage && Object.keys(edits).length > 0 && (
        <TouchableOpacity onPress={() => {
          const merged = { ...role.permissions, ...edits };
          createCustomRole(businessId, role.name + ' (custom)', merged, 'Customized copy of ' + role.name);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setEdits({});
        }} style={[styles.btn, styles.btnPrimary, { backgroundColor: glass.fg, marginTop: 16 }]}>
          <AppText variant="body" weight="bold" style={{ color: glass.bg }}>{t('business.save_custom_role')}</AppText>
        </TouchableOpacity>
      )}

      {canManage && Object.keys(edits).length > 0 && (
        <AppText variant="caption" weight="medium" style={{ color: glass.muted, marginTop: 6 }}>
          {t('business.custom_role_saved', { role: role.name })}
        </AppText>
      )}
    </View>
  );

  function cycleValue(key: string) {
    const order: PermissionValue[] = [true, false, 'approval'];
    const current = edits[key] !== undefined ? edits[key] : role.permissions[key] ?? false;
    const idx = order.indexOf(current as any);
    const next = order[(idx + 1) % order.length];
    setEdits((e) => ({ ...e, [key]: next }));
  }
}

function permColor(v: PermissionValue): string {
  if (v === true) return '#27ae60';
  if (v === 'approval') return '#f39c12';
  return '#e74c3c';
}
function permLabel(v: PermissionValue): string {
  if (v === true) return '✓';
  if (v === 'approval') return 'Appr';
  return '✕';
}

// ---------- Ownership ----------

function OwnershipPanel({ businessId, canTransfer, glass }: { businessId: string; canTransfer: boolean; glass: any }) {
  const { t } = useSettings();
  const people = getUsers(businessId).filter((p) => !p.isOwner);
  const [selectedId, setSelectedId] = useState('');

  return (
    <View>
      <SectionHeader icon={Crown} title={t('business.transfer_ownership')} glass={glass} />
      <View style={[styles.warnCard, { backgroundColor: glass.accentGlass, borderColor: glass.border }]}>
        <AppText variant="body" weight="bold" style={{ color: glass.fg }}>
          {t('business.transfer_hint')}
        </AppText>
      </View>

      {people.map((p) => (
        <TouchableOpacity key={p.id} onPress={() => { Haptics.selectionAsync(); setSelectedId(p.id); }}
          style={[styles.listCard, { backgroundColor: selectedId === p.id ? glass.accentGlass : glass.bgCard, borderColor: glass.border, marginTop: 8 }]}>
          <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{p.name}</AppText>
        </TouchableOpacity>
      ))}

      {people.length === 0 && <EmptyState text={t('business.add_person_first')} />}

      {selectedId && (
        <TouchableOpacity onPress={() => {
          Alert.alert(t('business.transfer_confirm_title'), t('business.transfer_confirm_msg'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('business.transfer'), style: 'destructive', onPress: () => {
                const current = getUsers(businessId).find((u) => u.isOwner);
                if (current) { transferOwnership(businessId, current.id, selectedId); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setSelectedId(''); }
            } },
          ]);
        }} style={[styles.btn, styles.btnPrimary, { backgroundColor: '#e74c3c', marginTop: 16 }]}>
          <AppText variant="body" weight="bold" style={{ color: '#fff' }}>{t('business.transfer_ownership')}</AppText>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------- shared bits ----------

function SectionHeader({ icon: Icon, title, actionLabel, onAction, glass }: {
  icon: any; title: string; actionLabel?: string; onAction?: () => void; glass: any;
}) {
  return (
    <View style={styles.sectionHead}>
      <Icon size={18} color={glass.fg} />
      <AppText variant="body" weight="bold" style={{ color: glass.fg, flex: 1 }}>{title}</AppText>
      {actionLabel && (
        <TouchableOpacity onPress={onAction} style={[styles.addBtn, { backgroundColor: glass.fg }]}>
          <Plus size={14} color={glass.bg} />
          <AppText variant="caption" weight="bold" style={{ color: glass.bg }}>{actionLabel}</AppText>
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  const glass = useGlass();
  return (
    <View style={[styles.emptyCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
      <AppText variant="body" weight="medium" style={{ color: glass.muted, textAlign: 'center' }}>{text}</AppText>
    </View>
  );
}

function getRoleLabel(role: string): string {
  return BUILTIN_ROLES.find((r) => r.key === role)?.name || getCustomRole(role)?.name || role;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  ownerBanner: { alignItems: 'center', padding: 24, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  cardRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1 },
  menuGroup: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeBox: { paddingVertical: 20, borderRadius: 14, borderWidth: 1, marginTop: 12, alignItems: 'center' },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  smallBtn: { minWidth: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  warnCard: { padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 8 },
  emptyCard: { padding: 24, borderRadius: 14, borderWidth: 1, marginTop: 8, alignItems: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 10 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  btn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, flex: 1 },
  btnPrimary: { marginLeft: 8 },
  actions: { flexDirection: 'row', marginTop: 20 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, marginTop: 12 },
  roleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginTop: 4 },
  permRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  permBadge: { minWidth: 44, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingBottom: 40 },
});
