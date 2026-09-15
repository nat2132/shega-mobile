/**
 * Mobile YjsManager — mirrors the desktop manager: one Y.Doc per business,
 * bootstrapped from expo-sqlite, persisted locally, with two-way record
 * application. SQLite remains the app database; Yjs is the replication layer.
 */

import * as Y from 'yjs';
import { getDB } from '../database/db';
import {
  YJS_COLLECTIONS,
  COLLECTION_TABLE,
  APPEND_ONLY,
  isYjsCollection,
  createBusinessDoc,
  encodeFullState,
  type YjsCollection,
  type YjsRecord,
} from '@shega/shared';

const columnCache = new Map<string, string[]>();

function tableColumns(table: string): string[] {
  let cols = columnCache.get(table);
  if (!cols) {
    cols = (getDB().getAllSync(`PRAGMA table_info(${table})`) as any[]).map((c) => c.name);
    columnCache.set(table, cols);
  }
  return cols;
}

function rowToData(table: string, row: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of tableColumns(table)) {
    if (c === 'id' || c === 'row_version' || c === 'is_synced') continue;
    const v = row[c];
    if (v === undefined) continue;
    out[c] = v === null ? null : typeof v === 'object' ? JSON.stringify(v) : v;
  }
  return out;
}

class MobileYjsManager {
  private docs = new Map<string, { doc: Y.Doc; maps: Record<YjsCollection, Y.Map<YjsRecord>> }>();
  private deviceId = 'mobile-unknown';
  private userId: string | null = null;
  private listeners = new Set<(businessId: string, update: Uint8Array, origin: 'local' | 'remote') => void>();

  setDeviceId(id: string): void { this.deviceId = id || this.deviceId; }
  setUserId(id: string | null): void { this.userId = id; }
  getDeviceId(): string { return this.deviceId; }

  onUpdate(fn: (businessId: string, update: Uint8Array, origin: 'local' | 'remote') => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private ensureDoc(businessId: string) {
    let entry = this.docs.get(businessId);
    if (entry) return entry;
    const { doc, maps } = createBusinessDoc(businessId);

    // Restore persisted state, if any (async storage-backed snapshot).
    try {
      // Persistence is handled by yjs-persist (mobile) — re-applied at start.
    } catch {}

    doc.on('update', (update: Uint8Array, origin: unknown) => {
      const dir = origin === 'remote' ? 'remote' : 'local';
      for (const fn of this.listeners) fn(businessId, update, dir);
    });

    entry = { doc, maps };
    this.docs.set(businessId, entry);
    return entry;
  }

  bootstrapBusiness(businessId: string): void {
    const entry = this.ensureDoc(businessId);
    for (const collection of YJS_COLLECTIONS) {
      const table = COLLECTION_TABLE[collection];
      let rows: any[] = [];
      try {
        // Core POS tables carry the camelCase `businessId` (the business UUID
        // on mobile); canonical business tables use snake `business_id`. A
        // table without either holds shared/global rows — seed them all.
        const cols = tableColumns(table);
        const hasSnake = cols.includes('business_id');
        const hasCamel = cols.includes('businessId');
        rows = hasSnake
          ? getDB().getAllSync(`SELECT * FROM ${table} WHERE business_id = ? AND is_deleted = 0 LIMIT 5000`, [businessId]) as any[]
          : hasCamel
            ? getDB().getAllSync(`SELECT * FROM ${table} WHERE businessId = ? AND is_deleted = 0 LIMIT 5000`, [businessId]) as any[]
            : getDB().getAllSync(`SELECT * FROM ${table} WHERE is_deleted = 0 LIMIT 5000`) as any[];
      } catch { continue; }
      const map = entry.maps[collection];
      for (const row of rows) {
        const uuid = String(row.uuid ?? row.id);
        if (!uuid || map.has(uuid)) continue;
        map.set(uuid, {
          uuid,
          businessId,
          deviceId: this.deviceId,
          createdAt: Date.parse(row.createdAt ?? row.created_at ?? '') || Date.now(),
          rev: Number(row.row_version ?? 1),
          deleted: false,
          data: rowToData(table, row),
        });
      }
    }
  }

  recordLocalChange(businessUuid: string, collection: YjsCollection, uuid: string, payload: Record<string, any>, deleted = false): void {
    if (!isYjsCollection(collection)) return;
    const entry = this.ensureDoc(businessUuid);
    entry.maps[collection].set(uuid, {
      uuid,
      businessId: businessUuid,
      deviceId: this.deviceId,
      userId: this.userId ?? undefined,
      createdAt: Date.now(),
      rev: (entry.maps[collection].get(uuid)?.rev ?? 0) + 1,
      deleted,
      data: payload,
    });
  }

  acceptRemoteUpdate(businessId: string, update: Uint8Array): void {
    const entry = this.ensureDoc(businessId);
    Y.applyUpdate(entry.doc, update, 'remote');
  }

  getFullState(businessId: string): Uint8Array | null {
    const entry = this.docs.get(businessId);
    return entry ? encodeFullState(entry.doc) : null;
  }

  collectRemoteChanges(businessId: string, sinceState: Uint8Array): Array<{ collection: YjsCollection; record: YjsRecord }> {
    const entry = this.docs.get(businessId);
    if (!entry) return [];
    const out: Array<{ collection: YjsCollection; record: YjsRecord }> = [];
    const seen = new Y.Doc();
    Y.applyUpdate(seen, sinceState);
    const seenMaps = {} as Record<YjsCollection, Y.Map<YjsRecord>>;
    for (const c of YJS_COLLECTIONS) seenMaps[c] = seen.getMap<YjsRecord>(c);
    for (const c of YJS_COLLECTIONS) {
      for (const [uuid, rec] of entry.maps[c].entries()) {
        const prev = seenMaps[c].get(uuid);
        if (!prev || prev.rev !== rec.rev || prev.deleted !== rec.deleted) {
          out.push({ collection: c, record: rec });
        }
      }
    }
    return out;
  }

  closeBusiness(businessId: string): void {
    const entry = this.docs.get(businessId);
    if (!entry) return;
    entry.doc.destroy();
    this.docs.delete(businessId);
  }
}

export const mobileYjs = new MobileYjsManager();
