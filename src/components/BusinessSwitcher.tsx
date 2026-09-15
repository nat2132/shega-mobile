import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Building2,
  Check,
  ChevronDown,
  Layers,
  Search,
  X,
} from 'lucide-react-native';

import { AppText } from '@/components/ui';
import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import {
  ALL_BUSINESSES,
  useBusinessScope,
} from '@/context/BusinessScopeContext';

/**
 * Business selector — shows the active business and, when the account has
 * access to more than one business, lets the user switch between a single
 * business and the combined "All Businesses" scope. Used on the Dashboard
 * header and in Settings; the selection is global and persists.
 */
export function BusinessSwitcher({ compact = false }: { compact?: boolean }) {
  const { colors, t } = useSettings();
  const { scopeLabel, businesses, canSwitch, isAllMode, scope, switchTo } = useBusinessScope();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const G = {
    bg: colors.background,
    fg: colors.text,
    muted: colors.textSecondary,
    card: colors.card,
    border: colors.border,
    accent: colors.primary,
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter((b) => b.name.toLowerCase().includes(q));
  }, [businesses, query]);

  if (!canSwitch) {
    // Single-business accounts still show which business they're in.
    return (
      <View style={[styles.chip, { backgroundColor: G.card, borderColor: G.border }, compact && styles.chipCompact]}>
        <Building2 size={compact ? 13 : 15} color={G.accent} />
        <AppText variant={compact ? 'caption' : 'body-sm'} weight="bold" style={{ color: G.fg }} numberOfLines={1}>
          {scopeLabel}
        </AppText>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setOpen(true);
        }}
        style={[styles.chip, { backgroundColor: G.card, borderColor: G.border }, compact && styles.chipCompact]}
      >
        {isAllMode ? (
          <Layers size={compact ? 13 : 15} color={G.accent} />
        ) : (
          <Building2 size={compact ? 13 : 15} color={G.accent} />
        )}
        <AppText variant={compact ? 'caption' : 'body-sm'} weight="bold" style={{ color: G.fg, flexShrink: 1 }} numberOfLines={1}>
          {scopeLabel}
        </AppText>
        <ChevronDown size={14} color={G.muted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: G.bg, borderColor: G.border }]}>
            <View style={styles.sheetHead}>
              <AppText variant="title" weight="bold" style={{ color: G.fg }}>
                {t('business_scope.pick')}
              </AppText>
              <TouchableOpacity onPress={() => setOpen(false)} style={[styles.closeBtn, { backgroundColor: G.card }]}>
                <X size={16} color={G.fg} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBar, { backgroundColor: G.card, borderColor: G.border }]}>
              <Search size={16} color={G.muted} />
              <TextInput
                style={[styles.searchInput, { color: G.fg }]}
                placeholder={t('business_scope.search')}
                placeholderTextColor={G.muted}
                value={query}
                onChangeText={setQuery}
              />
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              <ScopeRow
                icon={<Layers size={17} color={scope === ALL_BUSINESSES ? G.accent : G.muted} />}
                title={t('business_scope.all')}
                subtitle={t('business_scope.all_sub')}
                active={scope === ALL_BUSINESSES}
                accent={G.accent}
                fg={G.fg}
                muted={G.muted}
                border={G.border}
                onPress={() => {
                  Haptics.selectionAsync();
                  switchTo(ALL_BUSINESSES);
                  setOpen(false);
                  setQuery('');
                }}
              />
              {filtered.map((b) => (
                <ScopeRow
                  key={b.id}
                  icon={<Building2 size={17} color={scope === b.id ? G.accent : G.muted} />}
                  title={b.name}
                  subtitle={b.isDefault ? t('business_scope.default') : undefined}
                  active={scope === b.id}
                  accent={G.accent}
                  fg={G.fg}
                  muted={G.muted}
                  border={G.border}
                  onPress={() => {
                    Haptics.selectionAsync();
                    switchTo(b.id);
                    setOpen(false);
                    setQuery('');
                  }}
                />
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const ScopeRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  active: boolean;
  accent: string;
  fg: string;
  muted: string;
  border: string;
  onPress: () => void;
}> = ({ icon, title, subtitle, active, accent, fg, muted, border, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.row, { borderColor: active ? accent : border, backgroundColor: active ? accent + '10' : 'transparent' }]}
  >
    <View style={styles.rowIcon}>{icon}</View>
    <View style={{ flex: 1 }}>
      <AppText variant="body" weight="bold" style={{ color: fg }} numberOfLines={1}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="caption" weight="medium" style={{ color: muted }} numberOfLines={1}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
    {active && <Check size={18} color={accent} />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 260,
  },
  chipCompact: { paddingVertical: 5, paddingHorizontal: 10 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, fontFamily: Fonts.medium, fontSize: 13, paddingVertical: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: 12,
    marginTop: 8,
  },
  rowIcon: { width: 30, alignItems: 'center' },
});
