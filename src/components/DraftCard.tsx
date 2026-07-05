import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Trash2, FileText } from 'lucide-react-native';
import { AppText, AppNumber } from '@/components/ui';
import { Draft } from '@/services/draftService';
import { useSettings } from '@/context/SettingsContext';

interface DraftCardProps {
  draft: Draft;
  onRestore: (draft: Draft) => void;
  onDelete: (id: string) => void;
}

export function DraftCard({ draft, onRestore, onDelete }: DraftCardProps) {
  const { colors, t } = useSettings();

  const timeAgo = (() => {
    const diff = Date.now() - new Date(draft.updatedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return t('drafts.min_ago', { count: String(mins || 1) });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('drafts.hours_ago', { count: String(hours) });
    const days = Math.floor(hours / 24);
    return t('drafts.days_ago', { count: String(days) });
  })();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onRestore(draft)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
        <FileText size={18} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <AppText variant="body" weight="bold" style={{ color: colors.text }} numberOfLines={1}>
          {draft.title}
        </AppText>
        <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
          {draft.subtitle} • {timeAgo}
        </AppText>
      </View>
      <TouchableOpacity
        onPress={() => onDelete(draft.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.deleteBtn}
      >
        <Trash2 size={16} color={colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  body: {
    flex: 1,
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 8,
  },
});
