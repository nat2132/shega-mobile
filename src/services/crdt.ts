import * as Crypto from 'expo-crypto';
import { getDB } from '../database/db';

export interface VectorClock {
  [deviceId: string]: number;
}

export interface Delta {
  entity: string;
  entity_uuid: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, any>;
  vector_clock: VectorClock;
  origin_device_id: string;
  checksum: string;
  timestamp: number;
}

export const SYNC_ENTITIES = [
  'categories',
  'items',
  'item_packs',
  'sales',
  'debt_payments',
  'returns',
  'adjustments',
  'customers',
] as const;

export async function getVectorClock(): Promise<VectorClock> {
  const db = getDB();
  const rows = db.getAllSync('SELECT device_id, MAX(seq) as max_seq FROM sync_outbox GROUP BY device_id') as any[];
  const clock: VectorClock = {};
  for (const row of rows) {
    if (row.device_id) clock[row.device_id] = row.max_seq;
  }
  return clock;
}

export function incrementVectorClock(clock: VectorClock, deviceId: string): VectorClock {
  return { ...clock, [deviceId]: (clock[deviceId] || 0) + 1 };
}

export function mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
  const merged = { ...a };
  for (const [deviceId, seq] of Object.entries(b)) {
    merged[deviceId] = Math.max(merged[deviceId] || 0, seq);
  }
  return merged;
}

export type VectorClockComparison = 'a-before-b' | 'b-before-a' | 'concurrent' | 'equal';

export function compareVectorClocks(a: VectorClock, b: VectorClock): VectorClockComparison {
  const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);
  let aGreater = false;
  let bGreater = false;

  for (const deviceId of allDevices) {
    const aSeq = a[deviceId] || 0;
    const bSeq = b[deviceId] || 0;
    if (aSeq > bSeq) aGreater = true;
    else if (bSeq > aSeq) bGreater = true;
  }

  if (aGreater && !bGreater) return 'a-before-b';
  if (bGreater && !aGreater) return 'b-before-a';
  if (aGreater && bGreater) return 'concurrent';
  return 'equal';
}

export async function createDelta(
  entity: string,
  entity_uuid: string,
  op: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: Record<string, any>,
  originDeviceId: string
): Promise<any> {
  const db = getDB();
  const clock = await getVectorClock();
  const vector_clock = incrementVectorClock(clock, originDeviceId);
  const timestamp = Date.now();
  const canonical = `${entity}|${entity_uuid}|${op}|${JSON.stringify(payload)}|${timestamp}`;
  const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical);

  return {
    entity,
    entity_uuid,
    op,
    payload,
    vector_clock,
    origin_device_id: originDeviceId,
    checksum,
    timestamp,
  };
}

export async function applyDelta(delta: any): Promise<{ applied: boolean; conflict: boolean; reason?: string }> {
  const db = getDB();
  const { entity, entity_uuid, op, payload, vector_clock, origin_device_id, checksum } = delta;

  // Verify checksum
  const canonical = `${delta.entity}|${delta.entity_uuid}|${delta.op}|${JSON.stringify(delta.payload)}|${delta.timestamp}`;
  const expectedChecksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical);
  if (delta.checksum !== expectedChecksum) {
    return { applied: false, conflict: false, reason: 'checksum_mismatch' };
  }

  if (!['categories', 'items', 'item_packs', 'sales', 'debt_payments', 'returns', 'adjustments', 'customers'].includes(delta.entity)) {
    return { applied: false, conflict: false, reason: 'entity_not_shared' };
  }

  try {
    const existing = db.getFirstSync(`SELECT * FROM ${delta.entity} WHERE uuid = ?`, [delta.entity_uuid]) as any;

    if (delta.op === 'DELETE') {
      if (existing) {
        db.runSync(`UPDATE ${delta.entity} SET is_deleted = 1, deleted_at = COALESCE(?, deleted_at) WHERE uuid = ?`, [
          delta.payload.deleted_at || new Date().toISOString(),
          delta.entity_uuid,
        ]);
        return { applied: true, conflict: false };
      }
      return { applied: false, conflict: false, reason: 'not_found' };
    }

    if (!existing) {
      // INSERT
      const insertData = { ...delta.payload };
      delete insertData.id;
      insertData.uuid = delta.entity_uuid;
      insertData.device_id = delta.origin_device_id;
      insertData.updated_at = delta.payload.updated_at || new Date().toISOString();

      if ((delta.entity === 'sales' || delta.entity === 'returns') && insertData.itemId != null) {
        const hubItemId = await resolveFk(delta.origin_device_id, 'items', insertData.itemId);
        if (hubItemId != null) insertData.itemId = hubItemId;
        else insertData.itemId = null;
      }
      if (delta.entity === 'sales' && insertData.packId != null) {
        const hubPackId = await resolveFk(delta.origin_device_id, 'item_packs', insertData.packId);
        if (hubPackId != null) insertData.packId = hubPackId;
      }

      const cols = Object.keys(insertData).filter(c => c in insertData);
      const placeholders = cols.map(() => '?').join(', ');
      db.runSync(`INSERT INTO ${delta.entity} (${cols.join(', ')}) VALUES (${placeholders})`, cols.map(c => insertData[c]));
      await recordRef(delta.origin_device_id, delta.entity, insertData);

      return { applied: true, conflict: false };
    }

    const existingVc = await getVectorClockForRow(delta.entity, delta.entity_uuid);

    const cmp = compareVectorClocks(vector_clock, existingVc);

    if (cmp === 'b-before-a' || cmp === 'equal') {
      // Incoming wins
      const updateData = { ...delta.payload };
      delete updateData.id;
      updateData.device_id = delta.origin_device_id;
      const cols = Object.keys(updateData).filter(c => c in updateData && c !== 'id' && c !== 'uuid');
      if (cols.length) {
        const sets = cols.map(c => `${c} = ?`).join(', ');
        const values = [...cols.map(c => delta.payload[c]), delta.entity_uuid];
        db.runSync(`UPDATE ${delta.entity} SET ${sets} WHERE uuid = ?`, [...cols.map(c => delta.payload[c]), delta.entity_uuid]);
      }
      await recordRef(delta.origin_device_id, delta.entity, delta.payload);
      return { applied: true, conflict: false };
    }

    if (cmp === 'concurrent') {
      // Merge non-conflicting fields
      const existingRow = db.getFirstSync(`SELECT * FROM ${delta.entity} WHERE uuid = ?`, [delta.entity_uuid]) as any;
      const merged = mergeConcurrent(existingRow, delta.payload);
      const updateData = { ...merged };
      delete updateData.id;
      updateData.device_id = delta.origin_device_id;
      const cols = Object.keys(updateData).filter(c => c in updateData && c !== 'id' && c !== 'uuid');
      if (cols.length) {
        const sets = cols.map(c => `${c} = ?`).join(', ');
        const values = [...cols.map(c => merged[c]), delta.entity_uuid];
        db.runSync(`UPDATE ${delta.entity} SET ${sets} WHERE uuid = ?`, [...values, delta.entity_uuid]);
      }
      await recordRef(delta.origin_device_id, delta.entity, merged);
      return { applied: true, conflict: true };
    }

    // a-before-b: existing is newer, reject
    return { applied: false, conflict: true, reason: 'existing_newer' };
  } catch (e: any) {
    return { applied: false, conflict: false, reason: e.message };
  }
}

async function getVectorClockForRow(entity: string, uuid: string): Promise<Record<string, number>> {
  const db = getDB();
  const row = db.getFirstSync(`
    SELECT device_id, seq FROM sync_outbox
    WHERE entity = ? AND entity_uuid = ?
    ORDER BY seq DESC LIMIT 1
  `, [entity, uuid]) as any;

  if (!row) return {};
  return { [row.device_id]: row.seq };
}

function cleanPayload(entity: string, payload: Record<string, any>): Record<string, any> {
  const db = getDB();
  const cols = db.getAllSync(`PRAGMA table_info(${entity})`) as any[];
  const colNames = new Set(cols.map((c: any) => c.name));
  const clean: Record<string, any> = {};
  for (const k of Object.keys(payload)) {
    if (colNames.has(k)) clean[k] = payload[k];
  }
  return clean;
}

async function resolveFk(deviceId: string, entity: string, localId: number): Promise<number | null> {
  if (localId == null) return null;
  const db = getDB();
  const ref = db.getFirstSync('SELECT uuid FROM sync_refs WHERE device_id = ? AND entity = ? AND local_id = ?', [deviceId, entity, localId]) as any;
  if (!ref?.uuid) return null;
  const row = db.getFirstSync(`SELECT id FROM ${entity} WHERE uuid = ?`, [ref.uuid]) as any;
  return row?.id ?? null;
}

async function recordRef(deviceId: string, entity: string, payload: Record<string, any>): Promise<void> {
  if (payload.id == null || !payload.uuid) return;
  const db = getDB();
  db.runSync('INSERT OR REPLACE INTO sync_refs (device_id, entity, local_id, uuid) VALUES (?, ?, ?, ?)', [
    deviceId,
    entity,
    Number(payload.id),
    String(payload.uuid),
  ]);
}

function mergeConcurrent(existing: Record<string, any>, incoming: Record<string, any>): Record<string, any> {
  const merged = { ...existing };

  const quantityFields = ['totalBaseQuantity', 'totalPackQuantity', 'quantity', 'qty'];
  const priceFields = ['baseSalePrice', 'basePurchasePrice', 'packSalePrice', 'packPurchasePrice', 'unitPrice'];
  const timestampFields = ['updated_at', 'createdAt'];

  for (const key of Object.keys(incoming)) {
    if (key === 'id' || key === 'uuid' || key === 'device_id' || key === 'row_version') continue;

    const existingVal = existing[key];
    const incomingVal = incoming[key];

    if (['totalBaseQuantity', 'totalPackQuantity', 'quantity', 'qty'].includes(key) &&
        typeof existingVal === 'number' && typeof incomingVal === 'number') {
      merged[key] = Math.max(existingVal, incomingVal);
    } else if (['baseSalePrice', 'basePurchasePrice', 'packSalePrice', 'packPurchasePrice', 'unitPrice'].includes(key) &&
        typeof existingVal === 'number' && typeof incomingVal === 'number') {
      merged[key] = incomingVal;
    } else if (['updated_at', 'createdAt'].includes(key)) {
      merged[key] = incoming[key];
    } else {
      merged[key] = incomingVal;
    }
  }

  return merged;
}

export async function verifyChecksum(delta: any): Promise<boolean> {
  const canonical = `${delta.entity}|${delta.entity_uuid}|${delta.op}|${JSON.stringify(delta.payload)}|${delta.timestamp}`;
  const expected = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical);
  return delta.checksum === expected;
}

export async function getMaxSeq(): Promise<number> {
  const db = getDB();
  const r = db.getFirstSync('SELECT COALESCE(MAX(seq),0) AS m FROM sync_outbox') as any;
  return r?.m ?? 0;
}