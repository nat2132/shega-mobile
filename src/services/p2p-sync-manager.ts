/**
 * Mobile SyncManager facade for P2P Yjs+WebRTC sync.
 *
 * Mobile ↔ Desktop and Mobile ↔ Mobile: Yjs docs replicate over WebRTC
 * DataChannels; signaling rides the existing WS sync client. SQLite stays the
 * application database. Never blocks local operations — everything works
 * offline and syncs when a peer appears.
 */

import { getDB } from '../database/db';
import { mobileYjs } from './yjs-manager';
import { mobileWebRtc } from './webrtc-manager';
import { wsSyncClient } from './wsSyncClient';
import { bumpDataVersion } from './dataVersion';
import { getThisDeviceId } from './businessService';
import {
  COLLECTION_TABLE,
  APPEND_ONLY,
  isYjsCollection,
  reconcileToColumns,
  type YjsCollection,
  type YjsRecord,
  type SyncHealthSnapshot,
  type SignalMessage,
} from '@shega/shared';

export interface MobileDeviceStatus {
  deviceId: string;
  deviceType: string;
  kind: string;
  connectedAt: number;
}

/**
 * Tables whose primary key IS the sync uuid (TEXT). Inserting a remote record
 * must set id = record.uuid or the NOT NULL PK fails. These are the canonical
 * business-scoped tables (snake_case, mobile) plus the root `businesses` row.
 */
const UUID_PK_TABLES: ReadonlySet<string> = new Set([
  'businesses',
  'users',
  'devices',
  'locations',
  'registers',
  'business_roles',
]);

class MobileP2pSyncManager {
  private businessUuid = '';
  private lastSyncAt: number | null = null;
  private unsubs: Array<() => void> = [];
  private started = false;
  private outboxTimer: ReturnType<typeof setInterval> | null = null;
  private lastOutboxSeq = 0;

  /** Map outbox entity names → Yjs collections. */
  private static ENTITY_TO_COLLECTION: Record<string, YjsCollection> = {
    items: 'products',
    categories: 'categories',
    sales: 'sales',
    stock_movements: 'inventory',
    debt_payments: 'debtPayments',
    adjustments: 'inventory',
    returns: 'returns',
    customers: 'customers',
    suppliers: 'suppliers',
    businesses: 'businesses',
    locations: 'locations',
    registers: 'registers',
    audit_logs: 'activities',
    users: 'users',
    employees: 'employees',
    employee_roles: 'employeeRoles',
  };

  start(businessUuid: string): void {
    if (this.started && this.businessUuid === businessUuid) return;
    if (this.businessUuid && this.businessUuid !== businessUuid) {
      mobileYjs.closeBusiness(this.businessUuid);
      mobileWebRtc.closeAll();
    }
    // A business switch must drop the previous run's subscriptions. Without
    // this, every switch stacked another set of 'update'/'peerConnected'
    // handlers on the shared Yjs/WebRTC emitters: remote updates were then
    // applied to SQLite N times (N = number of business switches), each pass
    // re-running reconciliation and bumping the data version, and only the
    // first start's callbacks referred to the previous business.
    this.unsubs.forEach((u) => {
      try { u(); } catch { /* already detached */ }
    });
    this.unsubs = [];
    this.businessUuid = businessUuid;
    this.started = true;

    const deviceId = getThisDeviceId() ?? `mobile-${Date.now().toString(36)}`;
    mobileYjs.setDeviceId(deviceId);
    mobileWebRtc.init(deviceId, businessUuid);
    mobileYjs.bootstrapBusiness(businessUuid);
    this.repairOrphanedRows();

    // Local changes → send to peers.
    this.unsubs.push(
      mobileYjs.onUpdate((bizId, update, origin) => {
        if (origin !== 'local') return;
        mobileWebRtc.broadcastUpdate(bizId, update);
      }),
    );

    // Remote updates → doc → SQLite.
    this.unsubs.push(
      mobileWebRtc.on('update', (bizId, _from, update) => {
        const before = mobileYjs.getFullState(bizId);
        mobileYjs.acceptRemoteUpdate(bizId, update);
        const after = mobileYjs.getFullState(bizId);
        if (before && after) this.applyDocToSqlite(bizId, before);
        this.lastSyncAt = Date.now();
      }),
    );

    // On peer connect: reply with our full state so both sides catch up.
    this.unsubs.push(
      mobileWebRtc.on('peerConnected', (peer) => {
        const state = mobileYjs.getFullState(this.businessUuid);
        if (state) mobileWebRtc.sendUpdate(peer.deviceId, state);
        this.lastSyncAt = Date.now();
      }),
    );

    // Signaling: ride the WS sync client's custom message path. `onSignal`
    // returns an unsubscribe; it is retained so a business switch (or shutdown)
    // detaches the handler instead of leaving one wired to a closed client.
    try {
      const offSignal = wsSyncClient.onSignal((msg: SignalMessage) => mobileWebRtc.handleSignal(msg));
      if (typeof offSignal === 'function') this.unsubs.push(offSignal);
      mobileWebRtc.setSignalingSender((to, msg) => wsSyncClient.sendSignal(to, msg));
    } catch { /* signaling unavailable — data channel just won't establish yet */ }

    // Tail the sync_outbox so local SQLite mutations land in the Yjs doc.
    //
    // Resume at 0, not MAX(seq): the old watermark meant a row written while
    // the app was closed (or killed mid-pump) was never relayed — the pump
    // considered everything below MAX already done. Undelivered work is now
    // identified by status='pending', which survives restarts.
    this.lastOutboxSeq = 0;
    if (this.outboxTimer) clearInterval(this.outboxTimer);
    this.outboxTimer = setInterval(() => this.pumpOutbox(), 2000);
  }

  /**
   * One-time repair: rows synced from peers before the business fallback
   * existed may have business_id/businessId NULL and be invisible to every
   * business-scoped query. Re-attach them to the operating business.
   */
  private repairOrphanedRows(): void {
    if (!this.businessUuid) return;
    const db = getDB();
    const tables = ['items', 'categories', 'sales', 'sale_items', 'debt_payments', 'adjustments', 'customers', 'suppliers', 'returns', 'stock_movements'];
    let fixed = 0;
    for (const table of tables) {
      try {
        const cols = (db.getAllSync(`PRAGMA table_info(${table})`) as any[]).map((c) => c.name);
        const bizCol = cols.includes('businessId') ? 'businessId' : cols.includes('business_id') ? 'business_id' : null;
        if (!bizCol || !cols.includes('uuid')) continue;
        const r = db.runSync(`UPDATE ${table} SET ${bizCol} = ? WHERE ${bizCol} IS NULL AND uuid IS NOT NULL`, [this.businessUuid]);
        fixed += r.changes;
      } catch { /* table may not exist */ }
    }
    if (fixed > 0) {
      console.log(`[p2p] re-attached ${fixed} orphaned row(s) to the active business`);
      bumpDataVersion();
      // Re-broadcast the repaired rows so peers get the corrected scope too.
      try { mobileYjs.bootstrapBusiness(this.businessUuid); } catch { /* non-fatal */ }
    }
  }

  private pumpOutbox(): void {
    if (!this.businessUuid) return;
    const db = getDB();
    try {
      // Undelivered work only. `seq > lastOutboxSeq` was a purely in-memory
      // watermark, so anything queued by a trigger before the app started was
      // invisible; status is durable, so a crash mid-pump resumes correctly.
      // Rows already relayed stay out of this query, so a peer that is slow to
      // subscribe cannot re-receive the whole backlog every 2s.
      const rows = db.getAllSync(
        `SELECT seq, entity, entity_uuid, op, row_id, attempts
           FROM sync_outbox
          WHERE status IS NULL OR status = 'pending'
          ORDER BY seq ASC LIMIT 300`,
      ) as any[];
      for (const row of rows) {
        this.lastOutboxSeq = Math.max(this.lastOutboxSeq, row.seq);
        const collection = MobileP2pSyncManager.ENTITY_TO_COLLECTION[row.entity];
        if (!collection) {
          this.markUnsupported(row);
          continue;
        }
        const table = COLLECTION_TABLE[collection];
        let payload: Record<string, any> = {};
        try {
          const r = db.getFirstSync(`SELECT * FROM ${table} WHERE uuid = ?`, [row.entity_uuid]) as any;
          if (r) payload = { ...r };
        } catch { /* row gone — a delete only needs the uuid */ }
        try {
          mobileYjs.recordLocalChange(this.businessUuid, collection, row.entity_uuid, payload, row.op === 'DELETE');
          this.markRelayed(row);
        } catch (e: any) {
          this.markFailed(row, e?.message);
        }
      }
    } catch { /* db busy — next tick */ }
  }

  /** Marks a change as handed to the Yjs doc so it is not replayed forever. */
  private markRelayed(row: any): void {
    try {
      getDB().runSync(
        `UPDATE sync_outbox
            SET status = 'sent', acked_at = CURRENT_TIMESTAMP, business_id = COALESCE(business_id, ?)
          WHERE seq = ?`,
        [this.businessUuid, row.seq],
      );
    } catch { /* best effort */ }
  }

  /**
   * Some tables have change-capture triggers but no Yjs collection (devices
   * travel over the pairing/approval protocol instead, and business_roles is
   * not in the shared model). Marking these 'sent' would falsely imply delivery,
   * and leaving them 'pending' would re-read them every tick forever, so they
   * get an explicit terminal status that stays visible for diagnostics.
   */
  private markUnsupported(row: any): void {
    try {
      getDB().runSync(
        `UPDATE sync_outbox
            SET status = 'unsupported', business_id = COALESCE(business_id, ?),
                last_error = 'no Yjs collection for entity'
          WHERE seq = ?`,
        [this.businessUuid, row.seq],
      );
    } catch { /* best effort */ }
  }

  /**
   * Keeps a failed change in the queue with backoff. Without this a change that
   * failed once (Yjs doc not ready, business not set) was either lost or retried
   * in a tight loop.
   */
  private markFailed(row: any, message: string): void {
    try {
      const attempts = (row.attempts ?? 0) + 1;
      const backoffSec = Math.min(300, 2 ** Math.min(attempts, 8));
      getDB().runSync(
        `UPDATE sync_outbox
            SET attempts = ?, last_error = ?, next_retry_at = datetime('now', ?)
          WHERE seq = ?`,
        [attempts, String(message ?? '').slice(0, 500), `+${backoffSec} seconds`, row.seq],
      );
    } catch { /* best effort */ }
  }

  /** Called by the outbox watcher for local SQLite mutations. */
  recordLocalChange(collection: string, entityUuid: string, payload: Record<string, any>, deleted = false): void {
    if (!this.businessUuid || !isYjsCollection(collection)) return;
    mobileYjs.recordLocalChange(this.businessUuid, collection as YjsCollection, entityUuid, payload, deleted);
  }

  private applyDocToSqlite(businessId: string, before: Uint8Array): void {
    const changes = mobileYjs.collectRemoteChanges(businessId, before);
    for (const { collection, record } of changes) {
      if (record.businessId !== businessId) continue; // business isolation
      this.applyRecord(collection, record);
    }
  }

  private applyRecord(collection: YjsCollection, record: YjsRecord): void {
    const table = COLLECTION_TABLE[collection];
    const db = getDB();
    try {
      const cols = (db.getAllSync(`PRAGMA table_info(${table})`) as any[]).map((c) => c.name);
      const hasUuid = cols.includes('uuid');
      const hasBiz = cols.includes('businessId') || cols.includes('business_id');
      const bizCol = cols.includes('businessId') ? 'businessId' : 'business_id';
      // Reconcile key-by-key against this table's real columns instead of a
      // blind camel<->snake pass: mobile core tables are camelCase (items,
      // sales, customers, ...), canonical tables are snake_case. Anything that
      // matches neither default naming (e.g. camelCase keys that only exist on
      // snake tables) is dropped as a source-only column. This keeps fields
      // like categoryId/createdAt intact for camelCase mobile tables.
      const data: Record<string, any> = reconcileToColumns(
        record.data as Record<string, any>,
        new Set(cols),
        'mobile',
      );
      if (hasUuid) data.uuid = record.uuid;
      // Canonical business tables use the sync uuid as their TEXT primary key
      // (businesses, users, devices, locations, registers, business_roles).
      if (UUID_PK_TABLES.has(table)) data.id = record.uuid;
      if (record.deleted) {
        if (hasUuid) db.runSync(`UPDATE ${table} SET is_deleted = 1, is_synced = 1 WHERE uuid = ?`, [record.uuid]);
        return;
      }
      let existing: any = null;
      if (hasUuid) existing = db.getFirstSync(`SELECT id FROM ${table} WHERE uuid = ?`, [record.uuid]);
      if (existing && APPEND_ONLY.has(collection)) return; // immutable event already applied

      if (hasBiz) {
        // Prefer the record's business, but never store NULL: a legacy peer
        // (or one that predates the multi-business model) may omit it — the
        // record came from a membership-verified peer of THIS business, so
        // attach it to the operating business instead of orphaning the row
        // where business-scoped queries can never see it.
        data[bizCol] = record.businessId ?? this.businessUuid;
      }
      const keys = Object.keys(data).filter((k) => cols.includes(k));
      if (keys.length === 0) return;

      if (existing) {
        const setSql = keys.map((k) => `${k} = ?`).join(', ');
        db.runSync(`UPDATE ${table} SET ${setSql}, is_synced = 1 WHERE id = ?`, [...keys.map((k) => data[k]), existing.id]);
      } else {
        const colSql = keys.join(', ');
        const ph = keys.map(() => '?').join(', ');
        db.runSync(`INSERT INTO ${table} (${colSql}, is_synced) VALUES (${ph}, 1)`, keys.map((k) => data[k]));
      }
      bumpDataVersion();
    } catch (e) {
      console.warn(`[p2p] apply ${collection}/${record.uuid} failed:`, e);
    }
  }

  getHealth(): SyncHealthSnapshot {
    const peers = mobileWebRtc.getPeers();
    return {
      businessId: this.businessUuid || null,
      health: peers.length > 0 ? 'synced' : this.businessUuid ? 'waiting' : 'offline',
      peers,
      lastSyncAt: this.lastSyncAt,
      pendingUpdates: 0,
    };
  }

  getDevices(): MobileDeviceStatus[] {
    return mobileWebRtc.getPeers().map((p) => ({
      deviceId: p.deviceId,
      deviceType: p.deviceType,
      kind: p.kind,
      connectedAt: p.connectedAt,
    }));
  }

  /** Owner: rename a device in the roster. */
  renameDevice(deviceId: string, newName: string): boolean {
    const db = getDB();
    try {
      db.runSync('UPDATE devices SET name = ?, updated_at = ? WHERE id = ? OR uuid = ?', [newName, new Date().toISOString(), deviceId, deviceId]);
      return true;
    } catch { return false; }
  }

  /** Revoke a paired device (owner action) — disconnects and blocks re-sync. */
  revokeDevice(deviceId: string): void {
    const db = getDB();
    try { db.runSync('UPDATE devices SET status = ? WHERE id = ? OR uuid = ?', ['revoked', deviceId, deviceId]); } catch {}
    // Drop any live session with it.
    try { mobileWebRtc.closePeer(deviceId); } catch {}
  }

  /** Per-collection record counts for the sync/bootstrap progress UI. */
  getRecordCounts(): Record<string, number> {
    const db = getDB();
    const out: Record<string, number> = {};
    const tableToLabel: Array<[string, string, string]> = [
      ['items', 'Products', 'business_id'],
      ['categories', 'Categories', 'business_id'],
      ['sales', 'Sales', 'business_id'],
      ['customers', 'Customers', 'business_id'],
      ['suppliers', 'Suppliers', 'business_id'],
      ['debt_payments', 'Payments', 'business_id'],
      ['stock_movements', 'Inventory', 'business_id'],
      ['returns', 'Returns', 'business_id'],
      ['audit_logs', 'Activities', 'business_id'],
    ];
    const bizId = this.businessUuid;
    for (const [table, label, bizCol] of tableToLabel) {
      try {
        const r = db.getFirstSync(`SELECT COUNT(*) AS c FROM ${table} WHERE ${bizCol} = ? AND is_deleted = 0`, [bizId]) as any;
        out[label] = r?.c ?? 0;
      } catch { out[label] = 0; }
    }
    return out;
  }

  /** Dial every known peer (hello through the signaling path). */
  announce(): void {
    try {
      wsSyncClient.sendSignal('__broadcast__', {
        t: 'hello',
        deviceId: mobileYjs.getDeviceId(),
        deviceType: 'mobile',
        businessId: this.businessUuid,
      });
    } catch { /* offline — retry on next announce */ }
  }

  shutdown(): void {
    this.unsubs.splice(0).forEach((u) => {
      try { u(); } catch { /* already detached */ }
    });
    if (this.outboxTimer) { clearInterval(this.outboxTimer); this.outboxTimer = null; }
    mobileWebRtc.setSignalingSender(null);
    mobileWebRtc.closeAll();
    this.started = false;
  }
}

export const mobileP2pSync = new MobileP2pSyncManager();
