import * as Crypto from 'expo-crypto';
import { getDB } from '../database/db';

// Phase 3 offline-first sync client. Talks to the Shega Desktop hub
// (HTTP JSON on port 5757) using the same payload format the hub expects.

export const SYNC_ENTITIES = [
  'categories',
  'items',
  'item_packs',
  'sales',
  'debt_payments',
  'expenses',
  'adjustments',
  'returns',
  'customers'
] as const;

type SyncEntity = (typeof SYNC_ENTITIES)[number];

// Apply order so FK references resolve before they are needed.
const APPLY_ORDER: SyncEntity[] = ['categories', 'items', 'item_packs', 'customers', 'sales', 'debt_payments', 'expenses', 'adjustments', 'returns'];

interface OutboxRow {
  seq: number;
  entity: string;
  entity_uuid: string;
  op: string;
  row_id: number | null;
}

interface HubChange {
  entity: string;
  entity_uuid: string;
  op: string;
  payload: Record<string, any>;
  device_id?: string;
  checksum?: string;
}

export interface SyncStatus {
  lastSyncAt: string | null;
  hubSeq: number;
  outboxCount: number;
  hub: string | null;
  token: string;
}

let columnCache: Record<string, string[]> = {};
function columnsOf(entity: string): string[] {
  const db = getDB();
  if (!columnCache[entity]) {
    const info = db.getAllSync(`PRAGMA table_info(${entity})`) as any[];
    columnCache[entity] = info.map((c) => c.name);
  }
  return columnCache[entity];
}

export function getDeviceId(): string {
  const db = getDB();
  const row = db.getFirstSync('SELECT device_id FROM sync_meta WHERE id = 1') as any;
  if (row?.device_id) return row.device_id;
  const id = Crypto.randomUUID();
  db.runSync('INSERT OR REPLACE INTO sync_meta (id, device_id) VALUES (1, ?)', [id]);
  return id;
}

export function getHubUrl(): string {
  const db = getDB();
  const row = db.getFirstSync("SELECT value FROM app_settings WHERE key = 'sync_hub_url'") as any;
  return row?.value || '';
}

export function setHubUrl(url: string): void {
  const db = getDB();
  db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['sync_hub_url', url.trim().replace(/\/+$/, '')]);
}

export function getHubToken(): string {
  const db = getDB();
  const row = db.getFirstSync("SELECT value FROM app_settings WHERE key = 'sync_hub_token'") as any;
  return row?.value || '';
}

export function setHubToken(token: string): void {
  const db = getDB();
  db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['sync_hub_token', token.trim().toUpperCase()]);
}

export function getSyncStatus(): SyncStatus {
  const db = getDB();
  const cursor = db.getFirstSync('SELECT hub_seq, last_sync_at FROM sync_cursor WHERE id = 1') as any;
  const outbox = db.getFirstSync('SELECT COUNT(*) AS c FROM sync_outbox') as any;
  return {
    lastSyncAt: cursor?.last_sync_at ?? null,
    hubSeq: cursor?.hub_seq ?? 0,
    outboxCount: outbox?.c ?? 0,
    hub: getHubUrl() || null,
    token: getHubToken()
  };
}

function lastWriteWins(incoming: Record<string, any>, existing: Record<string, any>): boolean {
  const iTs = (incoming.updated_at ?? incoming.createdAt ?? '') as string;
  const eTs = (existing.updated_at ?? existing.createdAt ?? '') as string;
  if (iTs !== eTs) return iTs > eTs;
  const iVer = Number(incoming.row_version ?? 0);
  const eVer = Number(existing.row_version ?? 0);
  if (iVer !== eVer) return iVer > eVer;
  return String(incoming.uuid ?? '') >= String(existing.uuid ?? '');
}

function cleanPayload(entity: string, payload: Record<string, any>): Record<string, any> {
  const cols = columnsOf(entity);
  const clean: Record<string, any> = {};
  for (const k of Object.keys(payload)) {
    if (cols.includes(k)) clean[k] = payload[k];
  }
  return clean;
}

function recordRef(deviceId: string, entity: string, payload: Record<string, any>): void {
  const db = getDB();
  if (payload.id == null || !payload.uuid) return;
  db.runSync('INSERT OR REPLACE INTO sync_refs (device_id, entity, local_id, uuid) VALUES (?, ?, ?, ?)', [
    deviceId,
    entity,
    Number(payload.id),
    String(payload.uuid)
  ]);
}

function resolveFk(deviceId: string, entity: string, localId: number | null): number | null {
  const db = getDB();
  if (localId == null) return null;
  const ref = db.getFirstSync('SELECT uuid FROM sync_refs WHERE device_id = ? AND entity = ? AND local_id = ?', [
    deviceId,
    entity,
    localId
  ]) as any;
  if (!ref?.uuid) return null;
  const row = db.getFirstSync(`SELECT id FROM ${entity} WHERE uuid = ?`, [ref.uuid]) as any;
  return row?.id ?? null;
}

function recordConflict(change: HubChange): void {
  const db = getDB();
  db.runSync('INSERT OR REPLACE INTO sync_conflicts (entity, entity_uuid, op, incoming_payload, created_at) VALUES (?, ?, ?, ?, ?)', [
    change.entity,
    change.entity_uuid,
    change.op,
    JSON.stringify(change.payload ?? {}),
    new Date().toISOString()
  ]);
}

export function getConflicts(): { id: number; entity: string; entity_uuid: string; op: string; createdAt: string }[] {
  const db = getDB();
  return db.getAllSync('SELECT id, entity, entity_uuid, op, created_at FROM sync_conflicts ORDER BY id DESC LIMIT 100') as any;
}

export function dismissConflict(id: number): void {
  const db = getDB();
  db.runSync('DELETE FROM sync_conflicts WHERE id = ?', [id]);
}

export async function resolveConflict(id: number, keepTheirs: boolean): Promise<void> {
  const db = getDB();
  const row = db.getFirstSync('SELECT * FROM sync_conflicts WHERE id = ?', [id]) as any;
  if (!row) return;
  if (keepTheirs) {
    let payload: Record<string, any> = {};
    try {
      payload = JSON.parse(row.incoming_payload || '{}');
    } catch {}
    const change: HubChange = { entity: row.entity, entity_uuid: row.entity_uuid, op: row.op, payload, device_id: getDeviceId() };
    if (change.op === 'DELETE') {
      db.runSync(`UPDATE ${row.entity} SET is_deleted = 1, deleted_at = ? WHERE uuid = ?`, [new Date().toISOString(), row.entity_uuid]);
    } else {
      applyChange(change, true);
    }
  }
  db.runSync('DELETE FROM sync_conflicts WHERE id = ?', [id]);
}

/**
 * Apply one pulled change locally (upsert by uuid, LWW). Triggers capture the
 * local write into sync_outbox so it can be re-pushed later, but the hub
 * dedupes identical changes so this does not loop.
 * When `force` is true, LWW is skipped and the incoming row wins (manual conflict resolution).
 */
function applyChange(change: HubChange, force = false): void {
  const db = getDB();
  const entity = change.entity as SyncEntity;
  if (!SYNC_ENTITIES.includes(entity)) return; // e.g. customers (desktop-only)
  const data = cleanPayload(entity, change.payload);

  if (change.op === 'DELETE') {
    db.runSync(`UPDATE ${entity} SET is_deleted = 1, deleted_at = COALESCE(?, deleted_at) WHERE uuid = ?`, [
      change.payload?.deleted_at ?? new Date().toISOString(),
      change.entity_uuid
    ]);
    return;
  }

  const existing = db.getFirstSync(`SELECT * FROM ${entity} WHERE uuid = ?`, [change.entity_uuid]) as any;
  if (!existing) {
    const insertData: Record<string, any> = { ...data };
    delete insertData.id; // local ids stay local — remap via sync_refs
    insertData.uuid = change.entity_uuid;
    insertData.device_id = change.device_id ?? getDeviceId();
    insertData.updated_at = insertData.updated_at ?? new Date().toISOString();
    if ((entity === 'sales' || entity === 'returns') && insertData.itemId != null) {
      const localItemId = resolveFk(change.device_id ?? getDeviceId(), 'items', insertData.itemId);
      if (localItemId != null) insertData.itemId = localItemId;
    }
    if (entity === 'sales' && insertData.packId != null) {
      const localPackId = resolveFk(change.device_id ?? getDeviceId(), 'item_packs', insertData.packId);
      if (localPackId != null) insertData.packId = localPackId;
    }
    const cols = columnsOf(entity).filter((c) => c in insertData);
    const placeholders = cols.map(() => '?').join(', ');
    db.runSync(`INSERT INTO ${entity} (${cols.join(', ')}) VALUES (${placeholders})`, cols.map((c) => insertData[c]));
    const inserted = db.getFirstSync(`SELECT id FROM ${entity} WHERE uuid = ?`, [change.entity_uuid]) as any;
    recordRef(change.device_id ?? getDeviceId(), entity, { id: inserted?.id, uuid: change.entity_uuid });
    return;
  }

  const incoming = { ...data, uuid: change.entity_uuid, updated_at: data.updated_at ?? new Date().toISOString() };
  if (!force && !lastWriteWins(incoming, existing)) {
    recordConflict(change); // existing wins — surface for manual resolution (3.5)
    return;
  }
  const updateData: Record<string, any> = { ...data };
  delete updateData.id;
  updateData.device_id = change.device_id ?? getDeviceId();
  const cols = columnsOf(entity).filter((c) => c in updateData && c !== 'id' && c !== 'uuid');
  if (cols.length) {
    const sets = cols.map((c) => `${c} = ?`).join(', ');
    db.runSync(`UPDATE ${entity} SET ${sets} WHERE uuid = ?`, [...cols.map((c) => updateData[c]), change.entity_uuid]);
  }
}

function canonicalChange(c: { entity: string; entity_uuid: string; op: string; payload: Record<string, any> }): string {
  return `${c.entity}|${c.entity_uuid}|${c.op}|${JSON.stringify(c.payload)}`;
}

async function changeChecksum(c: { entity: string; entity_uuid: string; op: string; payload: Record<string, any> }): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonicalChange(c));
}

/**
 * Build hub-format changes from the local outbox. For INSERT/UPDATE the full
 * current row is read by row_id; for DELETE a minimal tombstone is sent.
 */
async function buildChangesFromOutbox(): Promise<{ changes: HubChange[]; seqs: number[] }> {
  const db = getDB();
  const rows = db.getAllSync('SELECT * FROM sync_outbox ORDER BY seq ASC LIMIT 300') as any[];
  const changes: HubChange[] = [];
  const seqs: number[] = [];
  for (const row of rows as OutboxRow[]) {
    const entity = row.entity;
    if (!SYNC_ENTITIES.includes(entity as SyncEntity)) {
      seqs.push(row.seq);
      continue;
    }
    const payload: Record<string, any> = {};
    if (row.op === 'DELETE') {
      payload.id = row.row_id ?? null;
      payload.uuid = row.entity_uuid;
      payload.deleted_at = new Date().toISOString();
    } else if (row.row_id != null) {
      const r = db.getFirstSync(`SELECT * FROM ${entity} WHERE id = ?`, [row.row_id]) as any;
      if (!r) {
        seqs.push(row.seq); // row gone — nothing to send
        continue;
      }
      for (const c of columnsOf(entity)) payload[c] = r[c];
    }
    const change: HubChange = { entity, entity_uuid: row.entity_uuid, op: row.op, payload };
    change.checksum = await changeChecksum(change);
    changes.push(change);
    seqs.push(row.seq);
  }
  return { changes, seqs };
}

async function httpJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(typeof body === 'object' ? body?.error || `HTTP ${res.status}` : `HTTP ${res.status}`);
  return body;
}

/**
 * Push pending outbox entries to the hub, then pull + apply changes since the
 * last cursor. Returns a summary. Throws when the hub is unreachable.
 */
export async function syncNow(): Promise<{ pushed: number; pulled: number; conflicts: number }> {
  const hubUrl = getHubUrl();
  if (!hubUrl) throw new Error('Hub URL not configured');
  const deviceId = getDeviceId();

  let pushed = 0;
  let conflicts = 0;
  const token = getHubToken();
  const { changes, seqs } = await buildChangesFromOutbox();
  if (changes.length > 0) {
    const res = await httpJson(`${hubUrl}/sync/push`, {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, token, changes })
    });
    pushed = changes.length;
    conflicts = Number(res?.conflicts ?? 0);
    const db = getDB();
    db.runSync('DELETE FROM sync_outbox WHERE seq IN (' + seqs.map(() => '?').join(',') + ')', seqs);
  }

  const db = getDB();
  const cursor = db.getFirstSync('SELECT hub_seq FROM sync_cursor WHERE id = 1') as any;
  const since = cursor?.hub_seq ?? 0;
  const pulled = await httpJson(`${hubUrl}/sync/pull?device=${encodeURIComponent(deviceId)}&since=${since}&token=${encodeURIComponent(token)}`);
  // 3.10: hub asked for a full re-snapshot — trust the response even if it was
  // larger than `since`; the cursor below already points at the new lastSeq.
  const changesIn = (pulled?.changes ?? []) as HubChange[];
  if (changesIn.length > 0) {
    const sorted = changesIn.slice().sort((a, b) => {
      const ia = APPLY_ORDER.indexOf(a.entity as SyncEntity);
      const ib = APPLY_ORDER.indexOf(b.entity as SyncEntity);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    for (const change of sorted) {
      try {
        applyChange(change);
      } catch (e: any) {
        console.warn('[sync] apply failed', change.entity, change.entity_uuid, e?.message);
      }
    }
  }
  db.runSync('INSERT OR REPLACE INTO sync_cursor (id, hub_seq, last_sync_at) VALUES (1, ?, ?)', [
    Number(pulled?.lastSeq ?? since),
    new Date().toISOString()
  ]);

  return { pushed, pulled: changesIn.length, conflicts };
}

export async function verifyRemote(): Promise<any> {
  const hubUrl = getHubUrl();
  if (!hubUrl) throw new Error('Hub URL not configured');
  const token = getHubToken();
  return httpJson(`${hubUrl}/sync/verify?token=${encodeURIComponent(token)}`);
}

export async function pairDevice(): Promise<any> {
  const hubUrl = getHubUrl();
  if (!hubUrl) throw new Error('Hub URL not configured');
  const deviceId = getDeviceId();
  return httpJson(`${hubUrl}/sync/pair`, {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, name: 'Shega Mobile', token: getHubToken() })
  });
}