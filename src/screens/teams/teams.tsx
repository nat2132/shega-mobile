import React, { useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  UserPlus,
  Users as UsersIcon,
  X,
} from 'lucide-react-native';

import { AppText } from '@/components/ui';
import { Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import {
  addUser,
  effectivePermissions,
  getCustomRoles,    getUsers,
    getUser,
  removeUser,
  setUserActive,
  updateUserPermissions,
  updateUserRole,
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

  const refreshKey = useState(0)[1];

  const people = useMemo(() => {
    if (!businessId) return [];
    const list = getUsers(businessId);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.phone ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q),
    );
  }, [businessId, search, refreshKey]);

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

  const roleAccent = (u: { isOwner: boolean; role: string }) => {
    if (u.isOwner || u.role === 'owner') return G.warning;
    if (u.role === 'manager') return G.accent;
    if (u.role === 'cashier') return G.success;
    return G.muted;
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
        refreshKey((k) => k + 1);
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
          text: isOwner ? t('common.delete') : t('common.delete'),
          style: 'destructive',
          onPress: () => {
            try {
              removeUser(userId);
              refreshKey((k) => k + 1);
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
        refreshKey((k) => k + 1);
      } catch (e: any) {
        Alert.alert(t('teams.error_role'), e?.message || t('teams.error_unknown'));
      }
    };
    const target = getUser(userId);
    const wasOwner = !!target?.isOwner || target?.role === 'owner';
    // Ownership-sensitive: granting or revoking OWNER gets an explicit confirm.
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
    permKey: string,
    current: PermissionValue,
  ) => {
    if (!canAssignRoles) return;
    Haptics.selectionAsync();
    const user = people.find((p) => p.id === userId);
    if (!user) return;
    const overrides = { ...(user.permissions ?? {}) };
    if (current === true) overrides[permKey] = false;
    else overrides[permKey] = true;
    updateUserPermissions(userId, overrides);
    refreshKey((k) => k + 1);
  };

  const goBack = () => {
    if (onClose) onClose();
    else if (router.canGoBack()) router.back();
  };

  if (!canView) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
        <View style={styles.noAccess}>
          <Shield size={44} color={G.muted} />
          <AppText variant="title" weight="bold" style={{ color: G.fg, marginTop: 12 }}>
            {t('teams.no_access_title')}
          </AppText>
          <AppText variant="body-sm" weight="medium" style={{ color: G.muted, marginTop: 6, textAlign: 'center' }}>
            {t('teams.no_access_sub')}
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  const activeCount = people.filter((p) => p.isActive).length;
  const editingUser = editing ? people.find((p) => p.id === editing) : undefined;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: G.border }]}>
        <TouchableOpacity onPress={goBack} style={[styles.backBtn, { backgroundColor: G.card }]}>
          <ChevronLeft size={22} color={G.fg} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText variant="title" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
            {t('teams.title')}
          </AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
            {t('teams.subtitle', { active: String(activeCount), total: String(people.length) })}
          </AppText>
        </View>
        {canManage && (
          <TouchableOpacity
            onPress={handleAddMember}
            style={[styles.addBtn, { backgroundColor: G.accent }]}
          >
            <UserPlus size={18} color="#FFFFFF" />
            <AppText variant="caption" weight="bold" style={{ color: '#FFFFFF' }}>
              {t('teams.add')}
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: G.card, borderColor: G.border }]}>
          <Search size={18} color={G.muted} />
          <TextInput
            style={[styles.searchInput, { color: G.fg }]}
            placeholder={t('teams.search_placeholder')}
            placeholderTextColor={G.muted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={G.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Members */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {people.length === 0 ? (
          <View style={styles.empty}>
            <UsersIcon size={40} color={G.muted} />
            <AppText variant="body" weight="medium" style={{ color: G.muted, marginTop: 10 }}>
              {t('teams.empty')}
            </AppText>
          </View>
        ) : (
          people.map((p) => {
            const perms = effectivePermissions(p);
            const granted = Object.values(perms).filter((v) => v === true).length;
            const accent = roleAccent(p);
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
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: p.isActive ? G.success + '14' : G.error + '14' },
                      ]}
                    >
                      <AppText
                        variant="micro"
                        weight="bold"
                        style={{ color: p.isActive ? G.success : G.error }}
                        numberOfLines={1}
                      >
                        {p.isActive ? t('teams.status_active') : t('teams.status_inactive')}
                      </AppText>
                    </View>
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
          refreshKey((k) => k + 1);
        }}
      />

      {/* Member permissions sheet */}
      <Modal visible={!!editingUser} animationType="slide" transparent>
        {editingUser && (
          <View style={styles.sheetBackdrop}>
            <View style={[styles.sheet, { backgroundColor: G.bg }]}>
              <View style={[styles.sheetHandle, { backgroundColor: G.border }]} />
              <View style={styles.sheetHeader}>
                <View>
                  <AppText variant="title" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                    {editingUser.name}
                  </AppText>
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                    {roleLabel(editingUser.role)}
                  </AppText>
                </View>
                <TouchableOpacity onPress={() => setEditing(null)} style={[styles.backBtn, { backgroundColor: G.card }]}>
                  <X size={18} color={G.fg} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Role selector */}
                {canAssignRoles && (
                  <View style={styles.sectionBlock}>
                    <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1.2, marginBottom: 8 }}>
                      {t('teams.role')}
                    </AppText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {roleOptions.map((r) => {
                        const active = editingUser.role === r.key;
                        return (
                          <TouchableOpacity
                            key={r.key}
                            onPress={() => handleRoleChange(editingUser.id, r.key)}
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

                {/* Status — owners can be deactivated too (with service-side
                    last-owner guard and explicit confirm). */}
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
                      value={editingUser.isActive}
                      onValueChange={(v) => handleToggleActive(editingUser.id, v)}
                      trackColor={{ false: G.border, true: G.success + '60' }}
                      thumbColor={editingUser.isActive ? G.success : G.muted}
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
                      const perms = effectivePermissions(editingUser);
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
                                    onValueChange={() => handlePermissionChange(editingUser.id, d.key, val)}
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
                {/* Remove — allowed for owners too (explicit confirm inside). */}
                {canManage && (
                  <TouchableOpacity
                    style={[styles.removeBtn, { borderColor: G.error }]}
                    onPress={() => {
                      setEditing(null);
                      handleRemove(editingUser.id, editingUser.name);
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
        )}
      </Modal>
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
  const [role, setRole] = useState<string>('cashier');

  const submit = () => {
    if (!businessId || !name.trim()) return;
    addUser({ businessId, name: name.trim(), phone: phone.trim() || undefined, role });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setName('');
    setPhone('');
    setRole('cashier');
    onAdded();
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

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: G.accent, opacity: name.trim() ? 1 : 0.5 }]}
            disabled={!name.trim()}
            onPress={submit}
          >
            <Plus size={18} color="#FFFFFF" />
            <AppText variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
              {t('teams.add')}
            </AppText>
          </TouchableOpacity>
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
  memberInfo: { flex: 1, gap: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
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
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
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
  formGroup: { marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    fontFamily: Fonts.medium,
    fontSize: 14,
    marginTop: 6,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
  },
  removeBtn: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: Spacing.lg,
  },
});
