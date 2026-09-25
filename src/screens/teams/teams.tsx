import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Crown,
  Mail,
  Phone,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  User,
  UserPlus,
  Users as UsersIcon,
  X,
} from 'lucide-react-native';

import { AppText } from '@/components/ui';
import { Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { useDataChangedRefresh } from '@/hooks/useDataChangedRefresh';
import {
  addUser,
  effectivePermissions,
  getCustomRoles,
  getUsers,
  getUser,
  removeUser,
  setUserActive,
  updateUserPermissions,
  updateUserRole,
  updateUserMemberDetails,
} from '@/services/businessService';
import {
  BUILTIN_ROLES,
  PERMISSION_CATALOG,
  type BuiltinRoleKey,
  type PermissionScope,
  type PermissionValue,
} from '@shega/shared';

const BUILTIN_ROLE_KEYS = ['owner', 'manager', 'cashier', 'inventory', 'accountant', 'reports', 'warehouse'];
const isBuiltinRole = (key: string): boolean => (BUILTIN_ROLE_KEYS as readonly string[]).includes(key);

function timeAgo(dateOrTs?: string | number | null): string {
  if (!dateOrTs) return 'Offline';
  const ts = typeof dateOrTs === 'number' ? dateOrTs : Date.parse(String(dateOrTs));
  if (!ts || isNaN(ts)) return 'Offline';
  const diff = Date.now() - ts;
  if (diff < 30_000) return 'Just now';
  if (diff < 60_000) return '1 min ago';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(ts).toLocaleDateString();
}

/**
 * Teams — staff management for owners/managers.
 *
 * Gated by the shared permission catalog: the screen itself requires
 * `team.view`; every mutating action checks `team.manage` / `team.assignRoles`
 * through useBusinessAuth().can so the UI never offers an action the domain
 * layer would refuse.
 */

interface Props {
  onClose?: () => void;
}

type RoleOption = { key: string; label: string; isSystem: boolean };

export default function TeamsScreen({ onClose }: Props) {
  const router = useRouter();
  const { colors, t } = useSettings();
  const { showToast } = useToast();
  const auth = useBusinessAuth();

  const G = {
    bg: colors.background,
    fg: colors.text,
    muted: colors.textSecondary,
    card: colors.card,
    border: colors.border,
    accent: colors.primary,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
  };

  const businessId = auth.business?.id ?? null;
  const canView = auth.can('team.view');
  const canManage = auth.can('team.manage');
  const canAssignRoles = auth.can('team.assignRoles');

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // user id whose permissions sheet is open
  const [deviceStatuses, setDeviceStatuses] = useState<any[]>([]);
  const prevStatusesRef = React.useRef<Map<string, string>>(new Map());

  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useDataChangedRefresh(triggerRefresh);

  const people = useMemo(() => {
    if (!businessId) return [];
    const list = getUsers(businessId);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.phone ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.username ?? '').toLowerCase().includes(q),
    );
  }, [businessId, search, refreshKey]);

  const pollPresence = React.useCallback(async () => {
    try {
      const { getDeviceStatusList } = require('@/services/syncService');
      const list = getDeviceStatusList() || [];
      setDeviceStatuses(list);

      if (people.length > 0) {
        for (const p of people) {
          const dev = list.find(
            (d: any) => d.user_id === p.id || d.user_name?.toLowerCase() === p.name.toLowerCase()
          );
          if (!dev) continue;
          const currentStatus = dev.status === 'active' || dev.status === 'online' || dev.online
            ? 'online'
            : dev.status === 'connecting' || dev.status === 'reconnecting'
              ? dev.status
              : 'offline';

          const prev = prevStatusesRef.current.get(p.id);
          if (prev !== undefined && prev !== currentStatus) {
            if (prev === 'offline' && currentStatus === 'online') {
              showToast(`${p.name}'s device came online`, 'success');
            } else if ((prev === 'connecting' || prev === 'reconnecting') && currentStatus === 'online') {
              showToast(`${p.name}'s device reconnected`, 'success');
            } else if (prev === 'online' && currentStatus === 'offline') {
              showToast(`${p.name}'s device went offline`, 'info');
            }
          }
          prevStatusesRef.current.set(p.id, currentStatus);
        }
      }
    } catch { /* best effort */ }
  }, [people, showToast]);

  React.useEffect(() => {
    pollPresence();
    const timer = setInterval(pollPresence, 3000);
    return () => clearInterval(timer);
  }, [pollPresence]);

  const roleOptions = useMemo<RoleOption[]>(() => {
    const builtins = BUILTIN_ROLES.map((r) => ({
      key: r.key,
      label: r.name,
      isSystem: true,
    }));
    const custom = businessId
      ? getCustomRoles(businessId).map((r) => ({
          key: r.key,
          label: r.name,
          isSystem: false,
        }))
      : [];
    return [...builtins, ...custom];
  }, [businessId, refreshKey]);

  const permLabel = (d: { key: string; label: string }) => {
    const k = `teams.perm_${d.key}`;
    const v = t(k);
    return v === k ? d.label : v;
  };

  const permDesc = (d: { key: string; description: string }) => {
    const k = `teams.perm_${d.key}_desc`;
    const v = t(k);
    return v === k ? d.description : v;
  };

  const roleLabel = (roleKey: string) => {
    const found = roleOptions.find((r) => r.key === roleKey);
    if (!found) return roleKey;
    return found.isSystem && isBuiltinRole(found.key) ? t(`teams.role_${found.key}`) : found.label;
  };

  const handleAddMember = () => {
    if (!canManage) return;
    setShowAdd(true);
  };

  const handleToggleActive = (userId: string, next: boolean) => {
    if (!canManage) return;
    const apply = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        setUserActive(userId, next);
        triggerRefresh();
      } catch (e: any) {
        Alert.alert(t('teams.error_status'), e?.message || t('teams.error_unknown'));
      }
    };
    const target = getUser(userId);
    if (!next && (!!target?.isOwner || target?.role === 'owner')) {
      Alert.alert(
        t('teams.deactivate_owner_title'),
        t('teams.deactivate_owner_msg', { name: target?.name ?? t('teams.this_member') }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('teams.deactivate_confirm'), style: 'destructive', onPress: apply },
        ],
      );
      return;
    }
    apply();
  };

  const handleRemove = (userId: string, name: string) => {
    if (!canManage) return;
    const target = getUser(userId);
    const isOwner = !!target?.isOwner || target?.role === 'owner';
    Alert.alert(
      t('teams.remove_title'),
      isOwner ? t('teams.remove_owner_msg', { name }) : t('teams.remove_msg', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            try {
              removeUser(userId);
              triggerRefresh();
            } catch (e: any) {
              Alert.alert(t('teams.error_remove'), e?.message || t('teams.error_unknown'));
            }
          },
        },
      ],
    );
  };

  const handleRoleChange = (userId: string, roleKey: string) => {
    if (!canAssignRoles) return;
    const apply = () => {
      Haptics.selectionAsync();
      try {
        updateUserRole(userId, roleKey);
        triggerRefresh();
      } catch (e: any) {
        Alert.alert(t('teams.error_role'), e?.message || t('teams.error_unknown'));
      }
    };
    const target = getUser(userId);
    const wasOwner = !!target?.isOwner || target?.role === 'owner';
    if (roleKey === 'owner' && !wasOwner) {
      Alert.alert(
        t('teams.grant_owner_title'),
        t('teams.grant_owner_msg', { name: target?.name ?? t('teams.this_member') }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('teams.grant_owner_confirm'), style: 'destructive', onPress: apply },
        ],
      );
      return;
    }
    if (wasOwner && roleKey !== 'owner') {
      Alert.alert(
        t('teams.remove_owner_title'),
        t('teams.remove_owner_msg', { name: target?.name ?? t('teams.this_member') }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('teams.remove_owner_confirm'), style: 'destructive', onPress: apply },
        ],
      );
      return;
    }
    apply();
  };

  const handlePermissionChange = (
    userId: string,
    key: string,
    current: PermissionValue,
  ) => {
    if (!canAssignRoles) return;
    Haptics.selectionAsync();
    const next: PermissionValue = current === true ? false : true;
    try {
      updateUserPermissions(userId, { [key]: next });
      triggerRefresh();
    } catch (e: any) {
      Alert.alert(t('teams.error_permission'), e?.message || t('teams.error_unknown'));
    }
  };

  const editingUser = editing ? getUser(editing) : null;

  if (!canView) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose || (() => router.back())}
            style={[styles.backBtn, { backgroundColor: G.card }]}
          >
            <ChevronLeft size={20} color={G.fg} />
          </TouchableOpacity>
          <AppText variant="title" weight="bold" style={{ color: G.fg }}>
            {t('teams.title')}
          </AppText>
        </View>
        <View style={styles.noAccess}>
          <Shield size={48} color={G.muted} />
          <AppText variant="title" weight="bold" style={{ color: G.fg, marginTop: 12 }}>
            {t('teams.no_access_title')}
          </AppText>
          <AppText variant="body-sm" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 4 }}>
            {t('teams.no_access_msg')}
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: G.border }]}>
        <TouchableOpacity
          onPress={onClose || (() => router.back())}
          style={[styles.backBtn, { backgroundColor: G.card }]}
        >
          <ChevronLeft size={20} color={G.fg} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText variant="title" weight="bold" style={{ color: G.fg }}>
            {t('teams.title')}
          </AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
            {people.length} {t('teams.members_count')}
          </AppText>
        </View>
        {canManage && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: G.accent }]}
            onPress={handleAddMember}
          >
            <UserPlus size={16} color="#FFFFFF" />
            <AppText variant="caption" weight="bold" style={{ color: '#FFFFFF' }}>
              {t('teams.add_member')}
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: G.card, borderColor: G.border }]}>
          <Search size={16} color={G.muted} />
          <TextInput
            style={[styles.searchInput, { color: G.fg }]}
            placeholder={t('teams.search_placeholder')}
            placeholderTextColor={G.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={G.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {people.length === 0 ? (
          <View style={styles.empty}>
            <UsersIcon size={44} color={G.muted} />
            <AppText variant="body" weight="semibold" style={{ color: G.muted, marginTop: 8 }}>
              {search.trim() ? t('teams.no_members_found') : t('teams.no_members')}
            </AppText>
          </View>
        ) : (
          people.map((p) => {
            const perms = effectivePermissions(p);
            const granted = Object.values(perms).filter((v) => v === true).length;
            const accent = p.isOwner || p.role === 'owner' ? G.warning : G.accent;

            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.8}
                style={[styles.memberCard, { backgroundColor: G.card, borderColor: G.border, opacity: p.isActive ? 1 : 0.55 }]}
                onPress={() => canAssignRoles && setEditing(p.id)}
              >
                <View style={[styles.avatar, { backgroundColor: accent + '1A' }]}>
                  {p.avatar ? (
                    <Image source={{ uri: p.avatar }} style={styles.avatar} />
                  ) : (
                    <AppText variant="body" weight="bold" style={{ color: accent }}>
                      {p.name.slice(0, 1).toUpperCase()}
                    </AppText>
                  )}
                </View>
                <View style={styles.memberInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                      {p.name}
                    </AppText>
                    {(p.isOwner || p.role === 'owner') && <Crown size={14} color={G.warning} />}
                  </View>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: accent + '14' }]}>
                      <AppText variant="micro" weight="bold" style={{ color: accent }} numberOfLines={1}>
                        {roleLabel(p.role)}
                      </AppText>
                    </View>

                    {/* Real-time device presence badge */}
                    {(() => {
                      const dev = deviceStatuses.find(
                        (d) => d.user_id === p.id || d.user_name?.toLowerCase() === p.name.toLowerCase()
                      );
                      const connState = !dev
                        ? 'offline'
                        : dev.status === 'active' || dev.status === 'online' || dev.online
                          ? 'online'
                          : dev.status === 'connecting'
                            ? 'connecting'
                            : dev.status === 'reconnecting'
                              ? 'reconnecting'
                              : 'offline';

                      const presenceColor =
                        connState === 'online'
                          ? G.success
                          : connState === 'connecting' || connState === 'reconnecting'
                            ? G.warning
                            : G.muted;

                      const presenceText =
                        connState === 'online'
                          ? 'Online'
                          : connState === 'connecting'
                            ? 'Connecting…'
                            : connState === 'reconnecting'
                              ? 'Reconnecting…'
                              : `Offline · ${timeAgo(dev?.last_seen_at)}`;

                      return (
                        <View style={[styles.badge, { backgroundColor: presenceColor + '14', borderColor: presenceColor + '30', borderWidth: 1 }]}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: presenceColor, marginRight: 4 }} />
                          <AppText variant="micro" weight="bold" style={{ color: presenceColor }} numberOfLines={1}>
                            {presenceText}
                          </AppText>
                        </View>
                      );
                    })()}

                    <AppText variant="micro" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                      {granted} {t('teams.permissions_count')}
                    </AppText>
                  </View>
                </View>
                <ChevronRight size={18} color={G.border} />
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add member sheet */}
      <AddMemberSheet
        visible={showAdd}
        businessId={businessId}
        roleOptions={roleOptions}
        onClose={() => setShowAdd(false)}
        onAdded={() => {
          setShowAdd(false);
          triggerRefresh();
        }}
      />

      {/* Edit member sheet */}
      <EditMemberSheet
        user={editingUser}
        canManage={canManage}
        canAssignRoles={canAssignRoles}
        roleOptions={roleOptions}
        onClose={() => setEditing(null)}
        onUpdated={() => triggerRefresh()}
        onRemove={handleRemove}
        onRoleChange={handleRoleChange}
        onToggleActive={handleToggleActive}
        onPermissionChange={handlePermissionChange}
        roleLabel={roleLabel}
        permLabel={permLabel}
        permDesc={permDesc}
      />
    </SafeAreaView>
  );
}

// ─── Add member bottom sheet ─────────────────────────────────────────────

const AddMemberSheet: React.FC<{
  visible: boolean;
  businessId: string | null;
  roleOptions: RoleOption[];
  onClose: () => void;
  onAdded: () => void;
}> = ({ visible, businessId, roleOptions, onClose, onAdded }) => {
  const { colors, t } = useSettings();
  const G = {
    bg: colors.background,
    fg: colors.text,
    muted: colors.textSecondary,
    card: colors.card,
    border: colors.border,
    accent: colors.primary,
  };
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [role, setRole] = useState<string>('cashier');
  const [error, setError] = useState('');

  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Photo library permission is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setAvatar(uri);
      }
    } catch { /* best effort */ }
  };

  const submit = () => {
    setError('');
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedUsername = username.trim();

    if (!businessId) {
      setError('Active business is required.');
      return;
    }
    if (!trimmedName || trimmedName.length < 2) {
      setError('Member name must be at least 2 characters.');
      return;
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (trimmedPhone && trimmedPhone.replace(/\D/g, '').length < 7) {
      setError('Phone number must contain at least 7 digits.');
      return;
    }
    if (trimmedUsername && trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (trimmedUsername) {
      const existingUsers = getUsers(businessId);
      if (existingUsers.some((u) => u.username?.toLowerCase() === trimmedUsername.toLowerCase())) {
        setError('This username is already taken by another team member.');
        return;
      }
    }

    try {
      addUser({
        businessId,
        name: trimmedName,
        phone: trimmedPhone || undefined,
        email: trimmedEmail || undefined,
        username: trimmedUsername || undefined,
        avatar: avatar || undefined,
        role,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setName('');
      setPhone('');
      setEmail('');
      setUsername('');
      setAvatar(null);
      setError('');
      setRole('cashier');
      onAdded();
    } catch (e: any) {
      setError(e?.message || 'Failed to add member.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.sheetBackdrop}>
        <View style={[styles.sheet, { backgroundColor: G.bg }]}>
          <View style={[styles.sheetHandle, { backgroundColor: G.border }]} />
          <View style={styles.sheetHeader}>
            <AppText variant="title" weight="bold" style={{ color: G.fg }}>
              {t('teams.add_member_title')}
            </AppText>
            <TouchableOpacity onPress={onClose} style={[styles.backBtn, { backgroundColor: G.card }]}>
              <X size={18} color={G.fg} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Avatar picker */}
            <View style={{ alignItems: 'center', marginVertical: 12 }}>
              <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} style={{ position: 'relative' }}>
                <View style={[styles.avatarLarge, { backgroundColor: G.accent + '20' }]}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatarLarge} />
                  ) : (
                    <User size={36} color={G.accent} />
                  )}
                </View>
                <View style={[styles.cameraBadge, { backgroundColor: G.accent }]}>
                  <Camera size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <AppText variant="micro" weight="medium" style={{ color: G.muted, marginTop: 6 }}>
                Profile Photo (Optional)
              </AppText>
            </View>

            <View style={styles.formGroup}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1.2 }}>
                {t('teams.name_label')}
              </AppText>
              <TextInput
                style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.card }]}
                placeholder={t('teams.name_placeholder')}
                placeholderTextColor={G.muted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.formGroup}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1.2 }}>
                {t('common.phone')}
              </AppText>
              <TextInput
                style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.card }]}
                placeholder={t('form.contact_placeholder')}
                placeholderTextColor={G.muted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1.2 }}>
                Email
              </AppText>
              <TextInput
                style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.card }]}
                placeholder="email@example.com"
                placeholderTextColor={G.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1.2 }}>
                Username (For sign-in)
              </AppText>
              <TextInput
                style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.card }]}
                placeholder="username"
                placeholderTextColor={G.muted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1.2, marginBottom: 8 }}>
              {t('teams.role')}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {roleOptions.map((r) => {
                const active = role === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setRole(r.key);
                    }}
                    style={[
                      styles.roleChip,
                      { backgroundColor: active ? G.accent : G.card, borderColor: active ? G.accent : G.border },
                    ]}
                  >
                    {r.key === 'owner' && <Crown size={13} color={active ? '#FFFFFF' : colors.warning} />}
                    <AppText variant="caption" weight="bold" style={{ color: active ? '#FFFFFF' : G.fg }}>
                      {r.isSystem && isBuiltinRole(r.key) ? t(`teams.role_${r.key}`) : r.label}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {error ? (
              <AppText variant="caption" weight="bold" style={{ color: colors.error, marginBottom: 12, textAlign: 'center' }}>
                {error}
              </AppText>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: G.accent, opacity: name.trim().length >= 2 ? 1 : 0.5 }]}
              disabled={name.trim().length < 2}
              onPress={submit}
            >
              <Plus size={18} color="#FFFFFF" />
              <AppText variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
                {t('teams.add')}
              </AppText>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─── Edit member bottom sheet ─────────────────────────────────────────────

const EditMemberSheet: React.FC<{
  user: any;
  canManage: boolean;
  canAssignRoles: boolean;
  roleOptions: RoleOption[];
  onClose: () => void;
  onUpdated: () => void;
  onRemove: (userId: string, name: string) => void;
  onRoleChange: (userId: string, roleKey: string) => void;
  onToggleActive: (userId: string, next: boolean) => void;
  onPermissionChange: (userId: string, key: string, current: PermissionValue) => void;
  roleLabel: (key: string) => string;
  permLabel: (d: any) => string;
  permDesc: (d: any) => string;
}> = ({
  user,
  canManage,
  canAssignRoles,
  roleOptions,
  onClose,
  onUpdated,
  onRemove,
  onRoleChange,
  onToggleActive,
  onPermissionChange,
  roleLabel,
  permLabel,
  permDesc,
}) => {
  const { colors, t } = useSettings();
  const { showToast } = useToast();
  const G = {
    bg: colors.background,
    fg: colors.text,
    muted: colors.textSecondary,
    card: colors.card,
    border: colors.border,
    accent: colors.primary,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
  };

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setPhone(user.phone ?? '');
      setEmail(user.email ?? '');
      setUsername(user.username ?? '');
      setAvatar(user.avatar ?? null);
    }
  }, [user]);

  if (!user) return null;

  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Photo library permission is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setAvatar(uri);
        updateUserMemberDetails(user.id, { avatar: uri });
        showToast('Profile photo updated', 'success');
        onUpdated();
      }
    } catch { /* best effort */ }
  };

  const handleSaveDetails = () => {
    if (!name.trim()) return;
    updateUserMemberDetails(user.id, { name, phone, email, username, avatar });
    showToast('Member details saved', 'success');
    onUpdated();
  };

  return (
    <Modal visible={!!user} animationType="slide" transparent>
      <View style={styles.sheetBackdrop}>
        <View style={[styles.sheet, { backgroundColor: G.bg }]}>
          <View style={[styles.sheetHandle, { backgroundColor: G.border }]} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <AppText variant="title" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                {user.name}
              </AppText>
              <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                {roleLabel(user.role)}
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.backBtn, { backgroundColor: G.card }]}>
              <X size={18} color={G.fg} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Avatar & Basic details */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} style={{ position: 'relative' }}>
                <View style={[styles.avatarLarge, { backgroundColor: G.accent + '20' }]}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatarLarge} />
                  ) : (
                    <AppText variant="title" weight="bold" style={{ color: G.accent, fontSize: 28 }}>
                      {name.slice(0, 1).toUpperCase()}
                    </AppText>
                  )}
                </View>
                <View style={[styles.cameraBadge, { backgroundColor: G.accent }]}>
                  <Camera size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <AppText variant="micro" weight="medium" style={{ color: G.muted, marginTop: 6 }}>
                Tap to change photo
              </AppText>
            </View>

            {canManage && (
              <View style={[styles.scopeBlock, { borderColor: G.border, marginBottom: 16 }]}>
                <AppText variant="caption" weight="bold" style={{ color: G.fg, marginBottom: 8 }}>
                  Member Information
                </AppText>
                <View style={styles.formGroup}>
                  <AppText variant="micro" weight="bold" style={{ color: G.muted }}>Name</AppText>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.card }]}
                    value={name}
                    onChangeText={setName}
                  />
                </View>
                <View style={styles.formGroup}>
                  <AppText variant="micro" weight="bold" style={{ color: G.muted }}>Phone</AppText>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.card }]}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.formGroup}>
                  <AppText variant="micro" weight="bold" style={{ color: G.muted }}>Email</AppText>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.card }]}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.formGroup}>
                  <AppText variant="micro" weight="bold" style={{ color: G.muted }}>Username</AppText>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.card }]}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.saveDetailsBtn, { backgroundColor: G.accent }]}
                  onPress={handleSaveDetails}
                >
                  <AppText variant="body-sm" weight="bold" style={{ color: '#FFFFFF' }}>
                    Save Profile Details
                  </AppText>
                </TouchableOpacity>
              </View>
            )}

            {/* Role selector */}
            {canAssignRoles && (
              <View style={styles.sectionBlock}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1.2, marginBottom: 8 }}>
                  {t('teams.role')}
                </AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {roleOptions.map((r) => {
                    const active = user.role === r.key;
                    return (
                      <TouchableOpacity
                        key={r.key}
                        onPress={() => onRoleChange(user.id, r.key)}
                        style={[
                          styles.roleChip,
                          {
                            backgroundColor: active ? G.accent : G.card,
                            borderColor: active ? G.accent : G.border,
                          },
                        ]}
                      >
                        {r.key === 'owner' && <Crown size={13} color={active ? '#FFFFFF' : G.warning} />}
                        <AppText variant="caption" weight="bold" style={{ color: active ? '#FFFFFF' : G.fg }}>
                          {r.isSystem && isBuiltinRole(r.key) ? t(`teams.role_${r.key}`) : r.label}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Status */}
            {canManage && (
              <View style={[styles.statusRow, { backgroundColor: G.card, borderColor: G.border }]}>
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="bold" style={{ color: G.fg }}>
                    {t('teams.status')}
                  </AppText>
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                    {t('teams.status_desc')}
                  </AppText>
                </View>
                <Switch
                  value={user.isActive}
                  onValueChange={(v) => onToggleActive(user.id, v)}
                  trackColor={{ false: G.border, true: G.success + '60' }}
                  thumbColor={user.isActive ? G.success : G.muted}
                />
              </View>
            )}

            {/* Permissions grouped by scope */}
            {canAssignRoles && (
              <View style={styles.sectionBlock}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <ShieldCheck size={16} color={G.accent} />
                  <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1.2 }}>
                    {t('teams.permissions')}
                  </AppText>
                </View>
                {(['sales', 'products', 'inventory', 'customers', 'payments', 'reports', 'team', 'devices', 'settings'] as PermissionScope[]).map((scope) => {
                  const defs = PERMISSION_CATALOG.filter((d) => d.scope === scope);
                  if (!defs.length) return null;
                  const perms = effectivePermissions(user);
                  return (
                    <View key={scope} style={[styles.scopeBlock, { borderColor: G.border }]}>
                      <AppText variant="caption" weight="bold" style={{ color: G.fg, marginBottom: 6 }}>
                        {t(`teams.scope_${scope}`)}
                      </AppText>
                      {defs.map((d) => {
                        const val: PermissionValue = perms[d.key] ?? false;
                        return (
                          <View key={d.key} style={styles.permRow}>
                            <View style={{ flex: 1, paddingRight: 10 }}>
                              <AppText variant="body-sm" weight="semibold" style={{ color: G.fg }} numberOfLines={1}>
                                {permLabel(d)}
                              </AppText>
                              <AppText variant="micro" weight="medium" style={{ color: G.muted }} numberOfLines={2}>
                                {val === 'approval'
                                  ? t('teams.needs_approval')
                                  : permDesc(d)}
                              </AppText>
                            </View>
                            {val === 'approval' ? (
                              <View style={[styles.badge, { backgroundColor: G.warning + '14' }]}>
                                <AppText variant="micro" weight="bold" style={{ color: G.warning }}>
                                  {t('teams.approval_badge')}
                                </AppText>
                              </View>
                            ) : (
                              <Switch
                                value={val === true}
                                onValueChange={() => onPermissionChange(user.id, d.key, val)}
                                trackColor={{ false: G.border, true: G.accent + '60' }}
                                thumbColor={val === true ? G.accent : G.muted}
                              />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Remove */}
            {canManage && (
              <TouchableOpacity
                style={[styles.removeBtn, { borderColor: G.error }]}
                onPress={() => {
                  onClose();
                  onRemove(user.id, user.name);
                }}
              >
                <AppText variant="body-sm" weight="bold" style={{ color: G.error }}>
                  {t('teams.remove')}
                </AppText>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  noAccess: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  searchWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontFamily: Fonts.medium, fontSize: 14, paddingVertical: 0 },
  listContent: { padding: Spacing.lg, gap: 10 },
  empty: { alignItems: 'center', paddingTop: 80 },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  memberInfo: { flex: 1, gap: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  sectionBlock: { marginTop: Spacing.md },
  scopeBlock: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: 10 },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  formGroup: { marginBottom: 12 },
  input: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    marginTop: 12,
  },
  saveDetailsBtn: {
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: 12,
  },
  removeBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
});
