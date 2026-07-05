import React from 'react';
import { View, Text } from 'react-native';
import { FileText } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { DraftCard } from '@/components/DraftCard';
import { Draft } from '@/services/draftService';
import { useSettings } from '@/context/SettingsContext';

interface DraftSectionProps {
  drafts: Draft[];
  onRestore: (draft: Draft) => void;
  onDelete: (id: string) => void;
}

export function DraftSection({ drafts, onRestore, onDelete }: DraftSectionProps) {
  const { colors, t } = useSettings();

  if (drafts.length === 0) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      <AppText
        variant="micro"
        weight="bold"
        transform="uppercase"
        style={{ color: colors.textSecondary, marginBottom: 10, letterSpacing: 1 }}
      >
        {t('drafts.saved_drafts')}
      </AppText>
      {drafts.map((draft) => (
        <DraftCard
          key={draft.id}
          draft={draft}
          onRestore={onRestore}
          onDelete={onDelete}
        />
      ))}
    </View>
  );
}
