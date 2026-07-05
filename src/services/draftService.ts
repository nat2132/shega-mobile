import * as FileSystem from 'expo-file-system/legacy';

const DRAFTS_DIR = `${FileSystem.documentDirectory}drafts/`;

export interface Draft {
  id: string;
  screen: string;
  title: string;
  subtitle: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

function ensureDir() {
  return FileSystem.makeDirectoryAsync(DRAFTS_DIR, { intermediates: true }).catch(() => {});
}

export async function saveDraft(id: string, draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
  await ensureDir();
  const now = new Date().toISOString();
  const existing = await loadDraft(id);
  const entry: Draft = {
    id,
    ...draft,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await FileSystem.writeAsStringAsync(`${DRAFTS_DIR}${id}.json`, JSON.stringify(entry), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function loadDraft(id: string): Promise<Draft | null> {
  try {
    const content = await FileSystem.readAsStringAsync(`${DRAFTS_DIR}${id}.json`, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function getAllDrafts(): Promise<Draft[]> {
  await ensureDir();
  try {
    const files = await FileSystem.readDirectoryAsync(DRAFTS_DIR);
    const drafts: Draft[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await FileSystem.readAsStringAsync(`${DRAFTS_DIR}${file}`, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        drafts.push(JSON.parse(content));
      } catch {}
    }
    return drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

export async function deleteDraft(id: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(`${DRAFTS_DIR}${id}.json`, { idempotent: true });
  } catch {}
}

export async function deleteAllDrafts(): Promise<void> {
  try {
    await FileSystem.deleteAsync(DRAFTS_DIR, { idempotent: true });
  } catch {}
}
