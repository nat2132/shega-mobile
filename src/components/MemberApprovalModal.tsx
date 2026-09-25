/**
 * Owner-side member approval modal (Mobile).
 *
 * The owner assigns ONLY the joining member's role (Owner / Cashier / Custom)
 * at this stage — not a name or profile picture. The joiner supplies their own
 * name, profile image and PIN on their device after approval, so identity stays
 * with the person/account, never with the owner's pick. For a Custom role the
 * owner still names the role and picks individual permissions from the shared
 * PERMISSION_CATALOG. Confirming delivers the assigned role (+ permissions for
 * custom) to the joiner through the join channel.
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Search, X } from 'lucide-react-native';
import { AppText, AppButton } from '@/components/ui';
import { PERMISSION_CATALOG, SCOPE_LABELS } from '@shega/shared';

export interface MemberApprovalConfig {
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

  const confirm = () => {
    let role: string = roleKind;
    let permissions: Record<string, unknown> | undefined;
    if (roleKind === 'custom') {
      role = customRoleName.trim().toLowerCase().replace(/\s+/g, '-') || 'custom';
      permissions = Object.fromEntries(Object.entries(permPicks).filter(([, v]) => v));
    }
    onConfirm({ role, permissions });
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
            <AppText variant="caption" weight="bold" style={{ color: glass.muted, marginBottom: 14 }}>
              Assign this member&apos;s role. They set up their own name, profile picture and PIN on their device after approval.
            </AppText>

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