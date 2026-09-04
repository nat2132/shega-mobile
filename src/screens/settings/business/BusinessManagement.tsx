import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { getSettingsGlass } from '../glass-settings';
import {
  useBusinessAuth,
} from '@/hooks/useBusinessAuth';
import {
  getUsers, getDevices, getRegisters, getLocations, getCustomRoles,
  addUser, addDevice, addRegister, approveDevice,
  setDeviceStatus, renameDevice, updateUserRole,
  setUserActive, removeUser, transferOwnership, createCustomRole,
} from '@/services/businessService';
import {
  BUILTIN_ROLES, BuiltinRoleKey, ROLE_ORDER, getBuiltinRole,
  PERMISSION_CATALOG, SCOPE_LABELS, PermissionScope, PermissionValue,
  Device,
} from '@shega/shared';
import {
  Users, Smartphone, Printer, KeyRound, ChevronRight,
  Plus, X, Crown, QrCode, ShieldCheck, ShieldX,
} from 'lucide-react-native';
import {
  generateInvitation, getInvitations, revokeInvitation,
  canAddDevice, getActiveDeviceCount,
} from '@/services/invitationService';
import { wsSyncClient } from '@/services/wsSyncClient';

type Tab = 'overview' | 'people' | 'devices' | 'registers' | 'permissions' | 'ownership';

interface Props {
  onClose: () => void;
}

function useGlass() {
  const { colors } = useSettings();
  return getSettingsGlass(colors);
}

export function BusinessManagement({ onClose }: Props) {
  const glass = useGlass();
  const auth = useBusinessAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const businessId = auth.business?.id;

  const people = businessId ? getUsers(businessId) : [];
  const devices = businessId ? getDevices(businessId) : [];
  const registers = businessId ? getRegisters(businessId) : [];
  const locations = businessId ? getLocations(businessId) : [];

  return (
    <View style={[styles.container, { backgroundColor: glass.bg }]}>
      <View style={[styles.header, { borderBottomColor: glass.border }]}>
        <View style={{ flex: 1 }}>
          <AppText variant="title" weight="bold" style={{ color: glass.fg }}>Business</AppText>
          <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>
            {auth.business?.name}{auth.isOwner ? '  ·  👑 Owner' : ''}
          </AppText>
        </View>
        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onClose(); }} style={[styles.closeBtn, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
          <X size={18} color={glass.fg} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {tab === 'overview' && (
          <Overview
            businessName={auth.business?.name || ''}
            isOwner={auth.isOwner}
            peopleCount={people.length}
            deviceCount={devices.filter((d) => d.status === 'active').length}
            registerCount={registers.length}
            onNav={setTab}
          />
        )}

        {tab === 'people' && (
          <PeoplePanel businessId={businessId!} people={people} canManage={auth.can('team.manage')} glass={glass} />
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

function Overview({ businessName, isOwner, peopleCount, deviceCount, registerCount, onNav }: {
  businessName: string; isOwner: boolean; peopleCount: number; deviceCount: number; registerCount: number;
  onNav: (t: Tab) => void;
}) {
  const glass = useGlass();
  const cards: { tab: Tab; icon: any; title: string; count: number }[] = [
    { tab: 'people', icon: Users, title: 'People', count: peopleCount },
    { tab: 'devices', icon: Smartphone, title: 'Active Devices', count: deviceCount },
    { tab: 'registers', icon: Printer, title: 'Registers', count: registerCount },
  ];
  return (
    <View>
      <View style={[styles.ownerBanner, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
        <Crown size={40} color={glass.fg} />
        <AppText variant="body" weight="bold" style={{ color: glass.fg, marginTop: 8 }}>
          {isOwner ? 'You are the Owner' : businessName}
        </AppText>
        <AppText variant="caption" weight="medium" style={{ color: glass.muted, textAlign: 'center', marginTop: 4 }}>
          {isOwner ? 'Full business management permissions' : 'Limited access — ask your owner for changes'}
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
        <MenuRow icon={Users} label="Manage People" onPress={() => onNav('people')} />
        <MenuRow icon={Smartphone} label="Manage Devices" onPress={() => onNav('devices')} />
        <MenuRow icon={Printer} label="Manage Registers" onPress={() => onNav('registers')} />
        <MenuRow icon={KeyRound} label="Permissions & Roles" onPress={() => onNav('permissions')} last />
      </View>
      {isOwner && (
        <MenuRow icon={Crown} label="Transfer Ownership" onPress={() => onNav('ownership')} />
      )}
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

function PeoplePanel({ businessId, people, canManage, glass }: { businessId: string; people: any[]; canManage: boolean; glass: any }) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <View>
      <SectionHeader icon={Users} title="People" actionLabel={canManage ? 'Add Person' : undefined} onAction={() => canManage && setShowAdd(true)} glass={glass} />

      {people.length === 0 && <EmptyState text="Add your team members to assign roles." />}

      {people.map((p) => (
        <View key={p.id} style={[styles.listCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
          <View style={[styles.avatar, { backgroundColor: glass.accentGlass }]}>
            {p.isOwner ? <Crown size={18} color={glass.fg} /> : <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{p.name.slice(0, 1).toUpperCase()}</AppText>}
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{p.name}{p.isOwner ? '  👑' : ''}</AppText>
            <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>{p.roleName || getRoleLabel(p.role)}</AppText>
          </View>
          {canManage && !p.isOwner && (
            <TouchableOpacity onPress={() => showUserActions(p)} style={[styles.smallBtn, { backgroundColor: glass.accentGlass }]}>
              <AppText variant="caption" weight="bold" style={{ color: glass.fg }}>…</AppText>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {showAdd && (
        <AddPersonModal businessId={businessId} onClose={() => setShowAdd(false)} glass={glass} />
      )}
    </View>
  );

  function showUserActions(p: any) {
    Alert.alert(p.name, 'Choose an action', [
      { text: 'Change Role', onPress: () => changeRole(p) },
      { text: 'Deactivate', style: 'destructive', onPress: () => { setUserActive(p.id, false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
      { text: 'Remove Person', style: 'destructive', onPress: () => {
          Alert.alert('Remove ' + p.name + '?', 'Access is disabled and their devices disabled. Historical sales and audit trail are preserved.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => { removeUser(p.id); } },
          ]);
      } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function changeRole(p: any) {
    const labels = ROLE_ORDER.map((k) => ({ key: k, label: getBuiltinRole(k)?.name || k }));
    Alert.alert('Change Role', 'Select a new role for ' + p.name, [
      ...labels.map((r) => ({
        text: r.label,
        onPress: () => { updateUserRole(p.id, r.key); Haptics.selectionAsync(); },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
}

function AddPersonModal({ businessId, onClose, glass }: { businessId: string; onClose: () => void; glass: any }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<BuiltinRoleKey>('cashier');
  const [phone, setPhone] = useState('');

  const submit = () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    addUser({ businessId, name: name.trim(), role, phone });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
          <AppText variant="title" weight="bold" style={{ color: glass.fg }}>Add Person</AppText>
          <AppText variant="caption" weight="medium" style={{ color: glass.muted, marginTop: 4 }}>They'll use their own device under this role.</AppText>

          <TextInput style={[styles.input, { borderColor: glass.border, color: glass.fg }]} placeholder="Name" placeholderTextColor={glass.muted} value={name} onChangeText={setName} />
          <TextInput style={[styles.input, { borderColor: glass.border, color: glass.fg }]} placeholder="Phone (optional)" placeholderTextColor={glass.muted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

          <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 12, marginBottom: 6 }}>Role</AppText>
          <View style={styles.roleWrap}>
            {ROLE_ORDER.filter((k) => k !== 'owner').map((k) => (
              <TouchableOpacity key={k} onPress={() => { Haptics.selectionAsync(); setRole(k); }}
                style={[styles.roleChip, { backgroundColor: role === k ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                <AppText variant="caption" weight="bold" style={{ color: role === k ? glass.bg : glass.fg }}>{getBuiltinRole(k)?.name}</AppText>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={[styles.btn, { backgroundColor: glass.accentGlass }]}>
              <AppText variant="body" weight="bold" style={{ color: glass.fg }}>Cancel</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} style={[styles.btn, styles.btnPrimary, { backgroundColor: glass.fg }]}>
              <AppText variant="body" weight="bold" style={{ color: glass.bg }}>Add Person</AppText>
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
  const [showAdd, setShowAdd] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.headerTitle}>
          <View style={[styles.iconBox, { backgroundColor: glass.accentGlass }]}><Smartphone size={18} color={glass.fg} /></View>
          <AppText variant="title" weight="bold" style={{ color: glass.fg }}>Devices</AppText>
        </View>
        {canManage && (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setShowInvite(true)} style={[styles.smallBtn, { backgroundColor: glass.accentGlass }]}>
              <QrCode size={15} color={glass.fg} />
              <AppText variant="caption" weight="bold" style={{ color: glass.fg, marginLeft: 4 }}>Invite</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAdd(true)} style={[styles.smallBtn, { backgroundColor: glass.fg }]}>
              <Plus size={15} color={glass.bg} />
              <AppText variant="caption" weight="bold" style={{ color: glass.bg, marginLeft: 4 }}>Add</AppText>
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
              {d.status} · {d.platform}{d.userId ? ' · ' + (people.find((p) => p.id === d.userId)?.name || '') : ''}{d.role ? ' · ' + getRoleLabel(d.role) : ''}
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
            {devices.filter((d) => d.status === 'pending').length} device(s) awaiting approval
          </AppText>
        </View>
      )}

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
    if (d.status === 'pending') opts.push({ text: 'Approve', onPress: () => approveLocal(d) });
    if (d.status === 'active') opts.push({ text: 'Lock', onPress: () => setDeviceStatus(d.id, 'locked') });
    if (d.status === 'locked') opts.push({ text: 'Unlock', onPress: () => setDeviceStatus(d.id, 'active') });
    if (d.status !== 'disabled') opts.push({ text: 'Disable', style: 'destructive', onPress: () => setDeviceStatus(d.id, 'disabled') });
    opts.push({ text: 'Rename', onPress: () => renameLocal(d) });
    opts.push({ text: 'Cancel', style: 'cancel', onPress: () => {} });
    Alert.alert(d.name, 'Device actions', opts);
  }

  function approveLocal(d: Device) {
    // Assign to a selected person if any; otherwise keep unassigned-active.
    const persons = people.filter((p) => !p.isOwner);
    if (persons.length === 1) approveDevice(d.id, persons[0].id, persons[0].role);
    else approveDevice(d.id, d.userId || '', d.role || 'cashier');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function renameLocal(d: Device) {
    Alert.prompt('Rename device', 'New name', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: (v?: string) => v && renameDevice(d.id, v) },
    ]);
  }
}

function AddDeviceModal({ businessId, people, onClose, glass }: { businessId: string; people: any[]; onClose: () => void; glass: any }) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<'mobile' | 'desktop'>('mobile');
  const [userId, setUserId] = useState('');
  const [registers, setRegisters] = useState<{id:string;name:string}[]>([]);
  const [registerId, setRegisterId] = useState('');

  useEffect(() => { setRegisters(getRegisters(businessId)); }, [businessId]);

  const submit = () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    const person = people.find((p) => p.id === userId);
    addDevice({ businessId, name: name.trim(), platform, userId: person?.id, role: person?.role, registerId: registerId || undefined }, '');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
          <AppText variant="title" weight="bold" style={{ color: glass.fg }}>Add Device</AppText>

          <TextInput style={[styles.input, { borderColor: glass.border, color: glass.fg }]} placeholder="Device name (e.g. Samsung A55)" placeholderTextColor={glass.muted} value={name} onChangeText={setName} />

          <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 12 }}>Platform</AppText>
          <View style={styles.roleWrap}>
            {(['mobile','desktop'] as const).map((pl) => (
              <TouchableOpacity key={pl} onPress={() => { Haptics.selectionAsync(); setPlatform(pl); }}
                style={[styles.roleChip, { backgroundColor: platform === pl ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                <AppText variant="caption" weight="bold" style={{ color: platform === pl ? glass.bg : glass.fg }}>{pl === 'mobile' ? '📱 Mobile' : '💻 Desktop'}</AppText>
              </TouchableOpacity>
            ))}
          </View>

          {people.filter((p) => !p.isOwner).length > 0 && (
            <>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 12 }}>Assigned Person</AppText>
              <View style={styles.roleWrap}>
                <TouchableOpacity onPress={() => { setUserId(''); }}
                  style={[styles.roleChip, { backgroundColor: userId === '' ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                  <AppText variant="caption" weight="bold" style={{ color: userId === '' ? glass.bg : glass.fg }}>None</AppText>
                </TouchableOpacity>
                {people.filter((p) => !p.isOwner).map((p) => (
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
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 12 }}>Register</AppText>
              <View style={styles.roleWrap}>
                <TouchableOpacity onPress={() => { setRegisterId(''); }}
                  style={[styles.roleChip, { backgroundColor: registerId === '' ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                  <AppText variant="caption" weight="bold" style={{ color: registerId === '' ? glass.bg : glass.fg }}>None</AppText>
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
              <AppText variant="body" weight="bold" style={{ color: glass.fg }}>Cancel</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} style={[styles.btn, styles.btnPrimary, { backgroundColor: glass.fg }]}>
              <AppText variant="body" weight="bold" style={{ color: glass.bg }}>Add Device</AppText>
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
  const [invite, setInvite] = useState<null | { id: string; code: string; expiresAt: string; qrUri: string }>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('cashier');
  const roles = ['cashier', 'inventory', 'manager', 'reports', 'accountant'];

  const create = () => {
    const generated = generateInvitation({ businessId, name: name.trim() || undefined, role, platform: 'mobile' });
    setInvite(generated);
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
            <AppText variant="title" weight="bold" style={{ color: glass.fg }}>Invite to Join</AppText>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={20} color={glass.muted} /></TouchableOpacity>
          </View>

          {invite ? (
            <View>
              <AppText variant="body" weight="medium" align="center" style={{ color: glass.muted, marginVertical: 8 }}>
                {name.trim() || 'New Member'} · {role}
              </AppText>
              <View style={[styles.codeBox, { backgroundColor: glass.accentGlass, borderColor: glass.border }]}>
                <AppText variant="heading-lg" weight="bold" align="center" style={{ color: glass.fg, letterSpacing: 3 }}>{invite.code}</AppText>
              </View>
              <AppText variant="caption" weight="medium" align="center" style={{ color: glass.muted, marginTop: 8 }}>
                Ask the employee to enter this code in <AppText variant="caption" weight="bold" style={{ color: glass.fg }}>Join Existing Business</AppText>.
              </AppText>
              {wsSyncClient.isConnected ? (
                <AppText variant="caption" weight="medium" align="center" style={{ color: '#2ecc71', marginTop: 6 }}>
                  🟢 Published — requests arrive below
                </AppText>
              ) : (
                <AppText variant="caption" weight="medium" align="center" style={{ color: '#f1c40f', marginTop: 6 }}>
                  🟡 Not connected to LAN — share the code so the employee can connect first
                </AppText>
              )}
              <TouchableOpacity onPress={() => { revokeInvitation(invite.id); setInvite(null); }} style={[styles.btn, { backgroundColor: glass.accentGlass, marginTop: 16 }]}>
                <AppText variant="body" weight="bold" style={{ color: glass.fg }}>Done / Revoke</AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {!canAdd && (
                <View style={[styles.warnCard, { backgroundColor: glass.accentGlass, borderColor: glass.border }]}>
                  <AppText variant="caption" weight="bold" style={{ color: glass.fg }}>
                    Device limit reached ({activeCount} active). Check your subscription before adding more.
                  </AppText>
                </View>
              )}
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 6 }}>Employee name</AppText>
              <TextInput style={[styles.input, { borderColor: glass.border, color: glass.fg }]} placeholder="e.g. Hana" placeholderTextColor={glass.muted} value={name} onChangeText={setName} />
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginTop: 12 }}>Requested role</AppText>
              <View style={styles.roleWrap}>
                {roles.map((r) => (
                  <TouchableOpacity key={r} onPress={() => { Haptics.selectionAsync(); setRole(r); }}
                    style={[styles.roleChip, { backgroundColor: role === r ? glass.fg : glass.accentGlass, borderColor: glass.border }]}>
                    <AppText variant="caption" weight="bold" style={{ color: role === r ? glass.bg : glass.fg }}>{r}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={onClose} style={[styles.btn, { backgroundColor: glass.accentGlass }]}>
                  <AppText variant="body" weight="bold" style={{ color: glass.fg }}>Cancel</AppText>
                </TouchableOpacity>
                <TouchableOpacity onPress={create} style={[styles.btn, styles.btnPrimary, { backgroundColor: glass.fg }]}>
                  <AppText variant="body" weight="bold" style={{ color: glass.bg }}>Generate Invitation</AppText>
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
  const [requests, setRequests] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!wsSyncClient.isConnected) return;
    try {
      const list = await wsSyncClient.listDeviceJoinRequests(businessId);
      setRequests(Array.isArray(list) ? list.filter((r) => r.status === 'pending') : []);
      setLoaded(true);
    } catch { /* not connected */ }
  }, [businessId]);

  useEffect(() => { refresh(); }, [refresh]);

  const decide = async (re: any, approve: boolean) => {
    setRefreshing(true);
    try {
      if (approve && wsSyncClient.isConnected) {
        wsSyncClient.decideDeviceJoinRequest({ requestId: re.requestId, businessId, joinerDeviceId: re.joinerDeviceId, decision: 'approved', decidedBy: people.find((p) => p.isOwner)?.id || '' }).catch(() => {});
      }
      // Mirror on this owner device: create the employee + an active device.
      if (approve) {
        const person = addUser({ businessId, name: re.joinerUser || re.joinerName || 'New Member', role: re.role || 'cashier' });
        addDevice({ businessId, name: re.joinerName || 'New Device', platform: re.platform === 'desktop' ? 'desktop' : 'mobile', userId: person.id, role: re.role || 'cashier' }, '');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType[approve ? 'Success' : 'Warning']);
      setRequests((prev) => prev.filter((x) => x.requestId !== re.requestId));
    } finally {
      setRefreshing(false);
    }
  };

  if (!loaded && wsSyncClient.isConnected) return null;
  if (requests.length === 0) return null;

  return (
    <View style={[styles.warnCard, { backgroundColor: glass.accentGlass, borderColor: glass.border, marginBottom: 12 }]}>
      <View style={styles.headerRow}>
        <AppText variant="body" weight="bold" style={{ color: glass.fg }}>✋ Join Requests</AppText>
        <TouchableOpacity onPress={refresh}><AppText variant="caption" weight="bold" style={{ color: glass.fg }}>{refreshing ? '…' : 'Refresh'}</AppText></TouchableOpacity>
      </View>
      {requests.map((re) => (
        <View key={re.requestId} style={[styles.listCard, { backgroundColor: glass.bgCard, borderColor: glass.border, marginTop: 8 }]}>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{re.joinerUser || re.joinerName}</AppText>
            <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>{re.joinerName} · {re.role} · {re.platform}</AppText>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => decide(re, false)} style={[styles.smallBtn, { backgroundColor: '#e74c3c' }]}>
              <ShieldX size={15} color="#fff" /><AppText variant="caption" weight="bold" style={{ color: '#fff', marginLeft: 4 }}>Reject</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => decide(re, true)} style={[styles.smallBtn, { backgroundColor: '#2ecc71' }]}>
              <ShieldCheck size={15} color="#fff" /><AppText variant="caption" weight="bold" style={{ color: '#fff', marginLeft: 4 }}>Approve</AppText>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------- Registers ----------

function RegistersPanel({ businessId, registers, locations, canManage, glass }: {
  businessId: string; registers: any[]; locations: any[]; canManage: boolean; glass: any;
}) {
  const [name, setName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  return (
    <View>
      <SectionHeader icon={Printer} title="Registers" actionLabel={canManage ? 'Add Register' : undefined} onAction={() => canManage && setShowAdd(true)} glass={glass} />
      {registers.map((r) => (
        <View key={r.id} style={[styles.listCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
          <View style={[styles.iconBox, { backgroundColor: glass.accentGlass }]}><Printer size={18} color={glass.fg} /></View>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{r.name}</AppText>
            <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>
              {r.deviceId ? 'Connected device' : 'No device assigned'} {r.has_drawer ? '· Drawer' : ''}
            </AppText>
          </View>
        </View>
      ))}

      {showAdd && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowAdd(false)}>
          <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.modalCard, { backgroundColor: glass.bgCard, borderColor: glass.border }]}>
              <AppText variant="title" weight="bold" style={{ color: glass.fg }}>Add Register</AppText>
              <TextInput style={[styles.input, { borderColor: glass.border, color: glass.fg }]} placeholder="Register name (e.g. Main Counter)" placeholderTextColor={glass.muted} value={name} onChangeText={setName} />
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => setShowAdd(false)} style={[styles.btn, { backgroundColor: glass.accentGlass }]}>
                  <AppText variant="body" weight="bold" style={{ color: glass.fg }}>Cancel</AppText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  if (!name.trim()) { Alert.alert('Name required'); return; }
                  addRegister(businessId, name.trim(), locations[0]?.id);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setShowAdd(false); setName('');
                }} style={[styles.btn, styles.btnPrimary, { backgroundColor: glass.fg }]}>
                  <AppText variant="body" weight="bold" style={{ color: glass.bg }}>Add Register</AppText>
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
  const [selectedRole, setSelectedRole] = useState<BuiltinRoleKey>('cashier');
  const role = getBuiltinRole(selectedRole)!;
  const [edits, setEdits] = useState<Record<string, PermissionValue>>({});

  const scopes = [...new Set(PERMISSION_CATALOG.map((p) => p.scope))];

  return (
    <View>
      <SectionHeader icon={KeyRound} title="Permissions" glass={glass} />
      {!canManage && <AppText variant="caption" weight="medium" style={{ color: glass.muted, marginBottom: 10 }}>Only the owner or an authorized manager can change permissions.</AppText>}

      <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: glass.muted, marginBottom: 6 }}>Role</AppText>
      <View style={styles.roleWrap}>
        {ROLE_ORDER.filter((k) => k !== 'owner').map((k) => (
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
                    <AppText variant="caption" weight="bold" style={{ color: v ? '#fff' : glass.fg }}>{permLabel(v)}</AppText>
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
          <AppText variant="body" weight="bold" style={{ color: glass.bg }}>Save as a custom role</AppText>
        </TouchableOpacity>
      )}

      {canManage && Object.keys(edits).length > 0 && (
        <AppText variant="caption" weight="medium" style={{ color: glass.muted, marginTop: 6 }}>
          Saved as “{role.name} (custom)” so the built-in default stays intact.
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
  const people = getUsers(businessId).filter((p) => !p.isOwner);
  const [selectedId, setSelectedId] = useState('');

  return (
    <View>
      <SectionHeader icon={Crown} title="Transfer Ownership" glass={glass} />
      <View style={[styles.warnCard, { backgroundColor: glass.accentGlass, borderColor: glass.border }]}>
        <AppText variant="body" weight="bold" style={{ color: glass.fg }}>
          This gives the new owner full control of the business. Requires confirmation.
        </AppText>
      </View>

      {people.map((p) => (
        <TouchableOpacity key={p.id} onPress={() => { Haptics.selectionAsync(); setSelectedId(p.id); }}
          style={[styles.listCard, { backgroundColor: selectedId === p.id ? glass.accentGlass : glass.bgCard, borderColor: glass.border, marginTop: 8 }]}>
          <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{p.name}</AppText>
        </TouchableOpacity>
      ))}

      {people.length === 0 && <EmptyState text="Add a person first to transfer ownership." />}

      {selectedId && (
        <TouchableOpacity onPress={() => {
          Alert.alert('Transfer ownership?', 'The selected person will become the new owner with full control. This is permanent.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Transfer', style: 'destructive', onPress: () => {
                const current = getUsers(businessId).find((u) => u.isOwner);
                if (current) { transferOwnership(businessId, current.id, selectedId); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setSelectedId(''); }
            } },
          ]);
        }} style={[styles.btn, styles.btnPrimary, { backgroundColor: '#e74c3c', marginTop: 16 }]}>
          <AppText variant="body" weight="bold" style={{ color: '#fff' }}>Transfer Ownership</AppText>
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
  return BUILTIN_ROLES.find((r) => r.key === role)?.name || role;
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
