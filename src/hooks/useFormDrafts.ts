import { useState, useEffect, useCallback, useRef } from 'react';
import {
  saveDraft,
  loadDraft,
  getAllDrafts,
  deleteDraft,
  Draft,
} from '@/services/draftService';

interface UseFormDraftsOptions {
  screen: string;
  formKey: string;
  getPayload: () => Record<string, any>;
  getTitle: () => string;
  getSubtitle: () => string;
  delay?: number;
  enabled?: boolean;
}

export function useFormDrafts({
  screen,
  formKey,
  getPayload,
  getTitle,
  getSubtitle,
  delay = 2500,
  enabled = true,
}: UseFormDraftsOptions) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<string>('');

  const refreshDrafts = useCallback(async () => {
    const all = await getAllDrafts();
    setDrafts(all.filter((d) => d.screen === screen));
  }, [screen]);

  useEffect(() => {
    if (enabled) refreshDrafts();
  }, [enabled, refreshDrafts]);

  const persist = useCallback(async () => {
    const id = formKey;
    const payload = getPayload();
    const payloadStr = JSON.stringify(payload);
    if (payloadStr === lastPayloadRef.current) return;
    lastPayloadRef.current = payloadStr;
    setIsSaving(true);
    try {
      await saveDraft(id, {
        screen,
        title: getTitle(),
        subtitle: getSubtitle(),
        data: payload,
      });
      await refreshDrafts();
    } catch {}
    setIsSaving(false);
  }, [formKey, getPayload, getTitle, getSubtitle, screen, refreshDrafts]);

  useEffect(() => {
    if (!enabled) return;
    const payloadStr = JSON.stringify(getPayload());
    if (payloadStr === '{}' || payloadStr === lastPayloadRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(), delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, delay, getPayload, persist]);

  useEffect(() => {
    if (!enabled) return;
    return () => {
      const payload = getPayload();
      const payloadStr = JSON.stringify(payload);
      if (payloadStr && payloadStr !== '{}') persist();
    };
  }, [enabled, getPayload, persist]);

  const restore = useCallback(
    async (id: string): Promise<Draft | null> => {
      const draft = await loadDraft(id);
      return draft;
    },
    [],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteDraft(id);
      await refreshDrafts();
    },
    [refreshDrafts],
  );

  const clearCurrent = useCallback(async () => {
    await deleteDraft(formKey);
    await refreshDrafts();
  }, [formKey, refreshDrafts]);

  return {
    drafts,
    showDrafts: drafts.length > 0,
    isSaving,
    restore,
    remove,
    clearCurrent,
    refreshDrafts,
  };
}
