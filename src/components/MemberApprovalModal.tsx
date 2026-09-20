/**
 * Owner-side member approval modal (Mobile).
 *
 * Mirrors the desktop JoinApprovalConfig: the owner assigns the joining
 * member a display name, profile picture, role (Owner / Cashier / Custom)
 * and — for Custom — a custom role name plus individual permissions from the
 * shared PERMISSION_CATALOG. Confirming delivers the assigned identity to the
 * joiner through the join channel, so the member joins with exactly the
 * identity, role and permissions the owner configured.
 */

import React, { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Check, ImagePlus, Search, Trash2, X } from 'lucide-react-native';
import { AppText, AppButton } from '@/components/ui';
import { PERMISSION_CATALOG, SCOPE_LABELS } from '@shega/shared';

export interface MemberApprovalConfig {
  name: string;
  avatar: string | null;
  role: string;
  permissions?: Record<string, unknown>;
}

interface Props {
  request: { joinerUser?: string; joinerName?: string; platform?: string; role?: string };
  glass: any;
  onClose: () => void;
  onConfirm: (cfg: MemberApprovalConfig) => void | Promise<void>;
}

type RoleKind = 'cashier' | 'owner' | 'custom';

const MemberApprovalModal: React.FC<Props> = ({ request, glass, onClose, onConfirm }) => {
  const [name, setName] = useState(request.joinerUser || request.joinerName || '');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [roleKind, setRoleKind] = useState<RoleKind>('cashier');
  const [customRoleName, setCustomRoleName] = useState('');
  const [permSearch, setPermSearch] = useState('');
  const [permPicks, setPermPicks] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    if (!q) return PERMISSION_CATALOG;
    return PERMISSION_CATALOG.filter(
      (p) => p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q) || p.scope.includes(q),
    );
  }, [permSearch]);

  const grouped = useMemo(() => {
    const g = new Map<string, typeof PERMISSION_CATALOG>();
    for (const p of filtered) {
      const list = g.get(p.scope) || [];
      list.push(p);
      g.set(p.scope, list);
    }
    return Array.from(g.entries());
  }, [filtered]);

  const pickedCount = Object.values(permPicks).filter(Boolean).length;

  const pickAvatar = async (fromCamera: boolean) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [1, 1] })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [1, 1] });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setAvatar(result.assets[0].uri);
        Haptics.selectionAsync();
      }
    } catch { /* permission denied / picker unavailable */ }
  };

  const confirm = () => {
    const finalName = name.trim() || request.joinerUser || 'Team Member';
    let role: RoleKind | string = roleKind;
    let permissions: Record<string, unknown> | undefined;
    if (roleKind === 'custom') {
      role = customRoleName.trim().toLowerCase().replace(/\s+/g, '-') || 'custom';
      permissions = Object.fromEntries(Object.entries(permPicks).filter(([, v]) => v));
    }
    onConfirm({ name: finalName, avatar, role, permissions });
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 18 }}>
        <View style={{ backgroundColor: glass.bgCard, borderRadius: 22, borderWidth: 1, borderColor: glass.border, maxHeight: '88%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: glass.border }}>
            <AppText variant="title" weight="bold" style={{ color: glass.fg, flex: 1 }} numberOfLines={1}>
              New team member — {request.joinerUser || request.joinerName || 'Unknown'}
            </AppText>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={20} color={glass.muted} /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {/* Identity: avatar + name */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View>
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); if (Platform.OS === 'ios') pickAvatar(false); else pickAvatar(true); }}
                  onLongPress={() => pickAvatar(false)}
                  style={{ width: 64, height: 64, borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderStyle: 'dashed', borderColor: glass.border, backgroundColor: glass.bg, alignItems: 'center', justifyContent: 'center' }}
                >
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <ImagePlus size={20} color={glass.muted} />
                  )}
                </TouchableOpacity>
                {avatar && (
                  <TouchableOpacity onPress={() => setAvatar(null)} style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#e74c3c', borderRadius: 10, padding: 3 }}>
                    <Trash2 size={11} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="caption" weight="bold" style={{ color: glass.muted, marginBottom: 6 }}>MEMBER NAME</AppText>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={request.joinerUser || 'e.g. Abebe Adugna'}
                  placeholderTextColor={glass.muted}
                  style={{ borderWidth: 1, borderColor: glass.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: glass.fg, backgroundColor: glass.bg }}
                />
                <AppText variant="micro" weight="medium" style={{ color: glass.muted, marginTop: 4 }}>
                  {request.joinerName || 'Device'} ({request.platform === 'desktop' ? 'Desktop' : 'Mobile'}) · tap the square to add a photo
                </AppText>
              </View>
            </View>

            {/* Role selection */}
            {([
              { key: 'owner', label: '👑 Owner', desc: 'Full equal owner — manage everything' },
              { key: 'cashier', label: 'Cashier', desc: 'Point-of-sale and daily sales operations' },
              { key: 'custom', label: 'Custom', desc: 'Name the role and pick exact permissions' },
            ] as const).map((o) => (
              <TouchableOpacity
                key={o.key}
                onPress={() => { setRoleKind(o.key); Haptics.selectionAsync(); }}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 2, marginBottom: 8, borderColor: roleKind === o.key ? '#2ecc71' : 'transparent', backgroundColor: glass.bg }}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="bold" style={{ color: glass.fg }}>{o.label}</AppText>
                  <AppText variant="caption" weight="medium" style={{ color: glass.muted }}>{o.desc}</AppText>
                </View>
                {roleKind === o.key && <Check size={18} color="#2ecc71" />}
              </TouchableOpacity>
            ))}

            {/* Custom role: name + permission picks */}
            {roleKind === 'custom' && (
              <View style={{ borderRadius: 14, borderWidth: 1, borderColor: glass.border, padding: 12, backgroundColor: glass.bg, marginBottom: 8 }}>
                <AppText variant="caption" weight="bold" style={{ color: glass.muted, marginBottom: 6 }}>CUSTOM ROLE NAME</AppText>
                <TextInput
                  value={customRoleName}
                  onChangeText={setCustomRoleName}
                  placeholder="e.g. Store Supervisor"
                  placeholderTextColor={glass.muted}
                  style={{ borderWidth: 1, borderColor: glass.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: glass.fg, marginBottom: 10 }}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <AppText variant="caption" weight="bold" style={{ color: glass.muted }}>PERMISSIONS ({pickedCount} selected)</AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: glass.border, borderRadius: 8, paddingHorizontal: 6 }}>
                    <Search size={11} color={glass.muted} />
                    <TextInput value={permSearch} onChangeText={setPermSearch} placeholder="Search…" placeholderTextColor={glass.muted} style={{ paddingVertical: 4, paddingHorizontal: 4, color: glass.fg, width: 90 }} />
                  </View>
                </View>
                <ScrollView style={{ maxHeight: 220 }}>
                  {grouped.map(([scope, perms]) => (
                    <View key={scope} style={{ marginBottom: 8 }}>
                      <AppText variant="micro" weight="bold" style={{ color: glass.muted, opacity: 0.7 }}>
                        {(SCOPE_LABELS as any)[scope] || scope}
                      </AppText>
                      {perms.map((p) => (
                        <TouchableOpacity
                          key={p.key}
                          onPress={() => setPermPicks((prev) => ({ ...prev, [p.key]: !prev[p.key] }))}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}
                        >
                          <View style={{ width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: permPicks[p.key] ? '#2ecc71' : glass.border, backgroundColor: permPicks[p.key] ? '#2ecc71' : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                            {permPicks[p.key] ? <Check size={12} color="#fff" /> : null}
                          </View>
                          <AppText variant="caption" weight="bold" style={{ color: glass.fg, flex: 1 }}>{p.label}</AppText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                  {grouped.length === 0 && (
                    <AppText variant="caption" weight="medium" style={{ color: glass.muted, paddingVertical: 8 }}>No permissions match your search.</AppText>
                  )}
                </ScrollView>
              </View>
            )}

            <AppButton label="✓ Confirm Invitation & Sync" variant="primary" onPress={confirm} />
            <View style={{ height: 8 }} />
            <AppButton label="Decline request" variant="danger" onPress={() => { onClose(); }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default MemberApprovalModal;
