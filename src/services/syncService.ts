import * as Crypto from 'expo-crypto';
import { changeChecksum, SHARED_SYNC_ENTITIES } from '@shega/shared';
import { getDB } from '../database/db';
import { bumpDataVersion } from './dataVersion';

// Phase 3 offline-first sync client. Talks to the Shega Desktop hub
// (HTTP JSON on port 5757) using the same payload format the hub expects.

// Authoritative relay entity list — single source of truth in @shega/shared
// (sync/protocol.ts). Every device syncs against the same list so entities
// can never drift between the mobile outbox and the desktop hub.
export const SYNC_ENTITIES = SHARED_SYNC_ENTITIES;

type SyncEntity = (typeof SYNC_ENTITIES)[number];

// Entities whose primary key is a UUID (canonical business model) rather than an
// autoincrement integer â€” their id must be set to the sync uuid on apply.
const UUID_KEYED_ENTITIES: readonly string[] = ['businesses', 'locations', 'registers', 'business_roles', 'users', 'devices'];

// Apply order so FK references resolve before they are needed.
// Shared with wsSyncClient so WS pulls sort every entity, not just a subset.
export const APPLY_ORDER: SyncEntity[] = ['businesses', 'categories', 'items', 'item_packs', 'customers', 'suppliers', 'orders', 'order_items', 'order_history', 'shipments', 'shipment_items', 'shipment_history', 'employee_roles', 'employees', 'employee_accounts', 'attendance', 'employee_performance', 'sales', 'debt_payments', 'adjustments', 'returns', 'locations', 'registers', 'business_roles', 'users', 'devices', 'stock_movements', 'audit_logs', 'subscriptions', 'subscription_payments', 'subscription_renewals', 'scheduled_reminders', 'notifications', 'contacts'];

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
  /** Local outbox seq â€” echoed back per-change by the hub so the client can
   * prune only the deltas that were actually merged (3.7 retry semantics). */
  client_seq?: number;
}

export interface SyncStatus {
  lastSyncAt: string | null;
  hubSeq: number;
  outboxCount: number;
  hub: string | null;
  token: string;
}

// Â§24 Sync Center â€” unified synchronization status & diagnostics
export type SyncTransport = 'lan' | 'cloud' | 'offline';
export type SyncHealth = 'synced' | 'pending' | 'syncing' | 'error' | 'offline';

export interface PendingChange {
  id: number;
  entity: string;
  entity_uuid: string;
  op: string;
  created_at: string;
  status: 'pending' | 'failed' | 'synced';
  transport: SyncTransport;
  retry_count: number;
  source_device: string;
}

export interface DeviceStatus {
  device_id: string;
  name: string;
  status: 'online' | 'offline' | 'unknown';
  last_seen_at: string | null;
  last_sync_at: string | null;
  transport: SyncTransport;
  is_self: boolean;
  model?: string | null;
  platform?: 'mobile' | 'desktop' | null;
  userId?: string | null;
  role?: string | null;
  userName?: string | null;
}

export interface SyncHistoryEntry {
  id: number;
  timestamp: string;
  transport: SyncTransport;
  pushed: number;
  pulled: number;
  conflicts: number;
  status: 'success' | 'partial' | 'failed';
  error: string | null;
}

export interface UnifiedSyncStatus {
  health: SyncHealth;
  transport: SyncTransport;
  lastSyncAt: string | null;
  pendingOutbound: number;
  pendingInbound: number;
  failedChanges: number;
  conflicts: number;
  /** Coarse external status used by the Sync Center / header pill. */
  status: SyncDetailStatus;
  lan: {
    configured: boolean;
    hubUrl: string | null;
    lastSyncAt: string | null;
    outboxCount: number;
  };
}

/** The user-facing sync state machine: 7 distinct states. */
export type SyncDetailStatus =
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'changes-pending'
  | 'synced'
  | 'sync-failed'
  | 'offline';

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

/**
 * Persist a paired hub/peer device in the local devices table.
 * Called after successful pairing so the device appears in Connected Devices
 * and can be used for auto-reconnect.
 */
export function persistPeerDevice(device: {
  deviceId: string;
  name?: string;
  platform?: 'mobile' | 'desktop';
  businessId?: string;
  model?: string;
}): void {
  const db = getDB();
  const bizId = device.businessId ?? resolveLocalBusinessId();
  if (!bizId) {
    console.warn('[sync] Cannot persist peer device: no active business');
    return;
  }
  const now = new Date().toISOString();
  const existing = db.getFirstSync('SELECT id FROM devices WHERE id = ? AND is_deleted = 0', [device.deviceId]) as any;
  if (existing) {
    db.runSync(
      `UPDATE devices SET name = ?, platform = ?, status = 'active', model = ?, last_seen_at = ?, updated_at = ? WHERE id = ?`,
      [device.name ?? device.deviceId.slice(0, 8), device.platform ?? 'desktop', device.model ?? null, now, now, device.deviceId]
    );
  } else {
    db.runSync(
      `INSERT INTO devices (id, business_id, user_id, name, model, platform, register_id, role, status, is_primary, created_at, updated_at, last_seen_at)
       VALUES (?, ?, NULL, ?, ?, ?, NULL, NULL, 'active', 0, ?, ?, ?)`,
      [device.deviceId, bizId, device.name ?? device.deviceId.slice(0, 8), device.model ?? null, device.platform ?? 'desktop', now, now, now]
    );
  }
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

/**
 * Canonical epoch for a write timestamp, insensitive to the format skew between
 * SQLite CURRENT_TIMESTAMP (`2026-09-15 10:00:00`, UTC) and ISO strings
 * (`2026-09-15T10:00:00.000Z`). Raw string comparison makes the space format
 * ALWAYS lose to the ISO format at the same wall-clock time; both formats are
 * UTC on this app's write paths, so normalize both to the epoch before comparing.
 */
function tsValue(v: any): number {
  if (v == null || v === '') return -Infinity;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (/^[0-9]+$/.test(s)) return Number(s);
  const norm = s.replace(' ', 'T');
  const ms = Date.parse(norm.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(norm) ? norm : `${norm}Z`);
  return Number.isNaN(ms) ? -Infinity : ms;
}

function lastWriteWins(incoming: Record<string, any>, existing: Record<string, any>): boolean {
  const iTs = tsValue(incoming.updated_at ?? incoming.createdAt ?? '');
  const eTs = tsValue(existing.updated_at ?? existing.createdAt ?? '');
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

/**
 * Bridge the cross-wire column-name drift for the history tables. Desktop's
 * schema uses `action`/`performedBy`; mobile names them `status`/`changedBy`.
 * Synced symmetrically with the hub's bridgeHistoryColumns so history rows
 * survive the relay in both directions instead of being silently dropped by
 * cleanPayload's column filter.
 */
const HISTORY_COLUMN_BRIDGE: Record<string, [string, string]> = {
  order_history: ['status', 'action'],
  shipment_history: ['status', 'action']
};

function bridgeHistoryColumns(entity: string, payload: Record<string, any>): Record<string, any> {
  let out = { ...payload };
  if (entity === 'users') {
    if (out.business_id == null && out.businessId != null) out.business_id = out.businessId;
    if (out.businessId == null && out.business_id != null) out.businessId = out.business_id;

    if (out.is_active == null && out.isActive != null) out.is_active = out.isActive ? 1 : 0;
    if (out.isActive == null && out.is_active != null) out.isActive = out.is_active ? 1 : 0;

    if (out.is_owner == null && out.isOwner != null) out.is_owner = out.isOwner ? 1 : 0;
    if (out.isOwner == null && out.is_owner != null) out.isOwner = out.is_owner ? 1 : 0;

    if (out.pin_hash == null && out.pinHash != null) out.pin_hash = out.pinHash;
    if (out.pinHash == null && out.pin_hash != null) out.pinHash = out.pin_hash;

    if (out.pin_salt == null && out.pinSalt != null) out.pin_salt = out.pinSalt;
    if (out.pinSalt == null && out.pin_salt != null) out.pinSalt = out.pin_salt;

    if (out.recovery_hash == null && out.recoveryHash != null) out.recovery_hash = out.recoveryHash;
    if (out.recoveryHash == null && out.recovery_hash != null) out.recoveryHash = out.recovery_hash;

    if (out.recovery_salt == null && out.recoverySalt != null) out.recovery_salt = out.recoverySalt;
    if (out.recoverySalt == null && out.recovery_salt != null) out.recoverySalt = out.recovery_salt;

    if (out.role_name == null && out.roleName != null) out.role_name = out.roleName;
    if (out.roleName == null && out.role_name != null) out.roleName = out.role_name;
  }
  const bridge = HISTORY_COLUMN_BRIDGE[entity];
  if (!bridge) return out;
  const [mobileCol, desktopCol] = bridge;
  if (out[mobileCol] == null && out[desktopCol] != null) out[mobileCol] = out[desktopCol];
  if (out[desktopCol] == null && out[mobileCol] != null) out[desktopCol] = out[mobileCol];
  return out;
}

// Entities carrying a `business_id` column (multi-device business model). The
// local schema declares it NOT NULL for users/devices/locations/registers, but
// peers (desktop hub) may predate that column and send rows without a
// business_id, as camelCase `businessId`, or explicitly null. Those rows
// belong to the business this device operates as, so they are backfilled at
// apply time instead of violating the constraint.
const BUSINESS_SCOPED_ENTITIES: readonly string[] = ['users', 'devices', 'locations', 'registers', 'business_roles', 'audit_logs', 'suppliers', 'orders', 'order_items', 'shipments', 'shipment_items', 'employee_roles', 'employees', 'employee_accounts', 'scheduled_reminders', 'contacts'];

// Core POS tables carrying the camelCase `businessId` column (the mobile
// business UUID). Desktop peers relay these with the business UUID after the
// multi-business hub change; legacy peers send the desktop INTEGER id or
// nothing. Those are normalized to the operating business at apply time so a
// row can never surface under another business' filter.
export const CORE_BUSINESS_SCOPED_ENTITIES: readonly string[] = [
  'categories', 'items', 'item_packs', 'sales', 'debt_payments',
  'adjustments', 'returns', 'customers',
  'employee_roles', 'employees', 'employee_accounts', 'attendance', 'employee_performance',
  'subscriptions'
];

/**
 * Id of the business this device currently operates as â€” mirrors
 * businessService.getActiveBusiness() (active â†’ default â†’ first) but reads the
 * DB directly so the sync layer does not depend on the service layer.
 */
export function resolveLocalBusinessId(): string | null {
  const db = getDB();
  const activeId = (db.getFirstSync("SELECT value FROM app_settings WHERE key = 'active_business_id'") as any)?.value;
  if (activeId) {
    const active = db.getFirstSync('SELECT id FROM businesses WHERE id = ? AND is_deleted = 0', [activeId]) as any;
    if (active?.id) return active.id;
  }
  const fallback = db.getFirstSync(
    'SELECT id FROM businesses WHERE is_deleted = 0 ORDER BY (is_default = 1) DESC, created_at LIMIT 1'
  ) as any;
  return fallback?.id ?? null;
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

/**
 * Bulk-resolve every conflict at once. keepTheirs=true applies each stored
 * incoming payload (desktop wins); keepTheirs=false discards them and keeps
 * the local rows as-is (mine wins — the local change stays in sync_outbox and
 * will be pushed on the next sync). Returns how many were resolved.
 */
export function resolveAllConflicts(keepTheirs: boolean): number {
  const db = getDB();
  const rows = db.getAllSync('SELECT id FROM sync_conflicts ORDER BY id ASC') as any[];
  for (const r of rows) {
    try { resolveConflict(r.id, keepTheirs); } catch { /* keep resolving the rest */ }
  }
  if (rows.length > 0) bumpDataVersion();
  return rows.length;
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
 * Current high-water mark of sync_outbox (max seq) used to isolate trigger-
 * created echo rows created by THIS apply call.
 */
export function currentOutboxSeq(): number {
  const db = getDB();
  const r = db.getFirstSync('SELECT COALESCE(MAX(seq), 0) AS m FROM sync_outbox') as any;
  return r?.m ?? 0;
}

/**
 * Remove trigger-enqueued outbox rows produced as a side effect of applying a
 * REMOTE change. Such rows are echoes of rows the hub already owns; re-pushing
 * them is pure waste (and can wedge the client outbox behind dead rows). Local
 * edits made before this apply are untouched (seq <= `sinceSeq`).
 */
export function pruneOutboxEchoes(entity: string, entityUuid: string, sinceSeq: number): void {
  if (sinceSeq < 0) return;
  getDB().runSync('DELETE FROM sync_outbox WHERE entity = ? AND entity_uuid = ? AND seq > ?', [entity, entityUuid, sinceSeq]);
}

/**
 * Apply one pulled change locally (upsert by uuid, LWW). Triggers capture the
 * local write into sync_outbox so it can be re-pushed later, but the hub
 * dedupes identical changes so this does not loop.
 * When `force` is true, LWW is skipped and the incoming row wins (manual conflict resolution).
 */
export function applyChange(change: HubChange, force = false): void {
  const db = getDB();
  const entity = change.entity as SyncEntity;
  if (!SYNC_ENTITIES.includes(entity)) return; // e.g. customers (desktop-only)
  const outboxPreSeq = currentOutboxSeq();
  // Business-scoped rows may arrive without a business_id (or as camelCase
  // `businessId`) from peers that predate the multi-business model.
  const rawPayload = { ...change.payload };
  if (BUSINESS_SCOPED_ENTITIES.includes(entity)) {
    if (rawPayload.business_id == null && rawPayload.businessId != null) rawPayload.business_id = rawPayload.businessId;
    delete rawPayload.businessId;
  }
  const data = cleanPayload(entity, bridgeHistoryColumns(entity, rawPayload));

  if (change.op === 'DELETE') {
    db.runSync(`UPDATE ${entity} SET is_deleted = 1, deleted_at = COALESCE(?, deleted_at) WHERE uuid = ?`, [
      change.payload?.deleted_at ?? new Date().toISOString(),
      change.entity_uuid
    ]);
    pruneOutboxEchoes(entity, change.entity_uuid, outboxPreSeq);
    bumpDataVersion();
    return;
  }

    const existing = db.getFirstSync(
      `SELECT * FROM ${entity} WHERE uuid = ? OR id = ?`,
      [change.entity_uuid, change.entity_uuid]
    ) as any;
  if (entity === 'audit_logs' && existing) {
    // Append-only: dedupe an already-applied audit event; never rewrite a hashed row.
    return;
  }
  if (!existing) {    const insertData: Record<string, any> = { ...data };
    delete insertData.id; // local ids stay local â€” remap via sync_refs
    if (UUID_KEYED_ENTITIES.includes(entity)) {
      // Canonical business tables use the sync uuid as their TEXT primary key.
      insertData.id = change.entity_uuid;
    }
    insertData.uuid = change.entity_uuid;
    insertData.device_id = change.device_id ?? getDeviceId();
    insertData.updated_at = insertData.updated_at ?? new Date().toISOString();
    if (CORE_BUSINESS_SCOPED_ENTITIES.includes(entity)) {
      // Legacy peers relay the desktop INTEGER id (or nothing); mobile stores
      // the business UUID, so replace legacy/missing values with the operating
      // business. Also map unknown peer UUIDs to the local business so data
      // becomes visible in the active business scope.
      const rawBiz = insertData.businessId;
      if (rawBiz == null || /^[0-9]+$/.test(String(rawBiz))) {
        insertData.businessId = resolveLocalBusinessId();
      } else {
        const db = getDB();
        const exists = db.getFirstSync('SELECT 1 FROM businesses WHERE id = ? AND is_deleted = 0', [rawBiz]);
        if (!exists) insertData.businessId = resolveLocalBusinessId();
      }
    }
    if (BUSINESS_SCOPED_ENTITIES.includes(entity) && insertData.business_id == null) {
      // Attach hub rows that predate the multi-business model to the business
      // this device operates as, instead of violating NOT NULL (users/devices/â€¦).
      insertData.business_id = resolveLocalBusinessId();
    }
    if ((entity === 'sales' || entity === 'returns' || entity === 'stock_movements') && insertData.itemId != null) {
      const localItemId = resolveFk(change.device_id ?? getDeviceId(), 'items', insertData.itemId);
      if (localItemId != null) insertData.itemId = localItemId;
      else insertData.itemId = null; // unresolvable peer id would violate the FK
    }
    if (entity === 'sales' && insertData.packId != null) {
      const localPackId = resolveFk(change.device_id ?? getDeviceId(), 'item_packs', insertData.packId);
      if (localPackId != null) insertData.packId = localPackId;
    }
    if (entity === 'stock_movements' && insertData.warehouseId != null) {
      const localWhId = resolveFk(change.device_id ?? getDeviceId(), 'warehouses', insertData.warehouseId);
      if (localWhId != null) insertData.warehouseId = localWhId;
    }
    if (entity === 'stock_movements') {
      // Addition-only bridge: a relayed `restock_in` becomes a mobile addition
      // (feeds the activity view) and is stored as sync history. On-hand stock
      // is NOT altered here â€” it converges via the synced `items` rows.
      const type = String(insertData.type ?? 'restock_in');
      if (type === 'restock_in') {
        insertData.quantityAdded = insertData.quantity ?? insertData.quantityAdded;
        insertData.type = 'restock_in';
      } else {
        // Non-additive movement types have no mobile addition column; store as
        // history without counting into the activity feed.
        insertData.quantityAdded = insertData.quantityAdded ?? 0;
      }
    }
    if (entity === 'audit_logs') {
      // Map a desktop camelCase audit payload onto the mobile snake_case table
      // and dedup by uuid. Audit rows are append-only at the source; we only
      // insert (never update) them here.
      insertData.entity = insertData.entity ?? insertData.entityType ?? '';
      insertData.entity_id = insertData.entity_id != null ? insertData.entity_id : (insertData.entityId ?? null);
      insertData.action = insertData.action ?? '';
      insertData.old_value = insertData.old_value != null ? insertData.old_value : (insertData.oldValue ?? null);
      insertData.new_value = insertData.new_value != null ? insertData.new_value : (insertData.newValue ?? null);
      insertData.description = insertData.description != null ? (insertData.description as string) : (insertData.description ?? null);
      insertData.created_at = insertData.created_at ?? insertData.createdAt ?? new Date().toISOString();
      insertData.source_device = insertData.source_device ?? insertData.device_id;
      delete insertData.entityType;
      delete insertData.entityId;
      delete insertData.oldValue;
      delete insertData.newValue;
      delete insertData.createdAt;
      delete insertData.changedBy;
      delete insertData.changedById;
    }
    const cols = columnsOf(entity).filter((c) => c in insertData);
    const placeholders = cols.map(() => '?').join(', ');
    db.runSync(`INSERT OR REPLACE INTO ${entity} (${cols.join(', ')}) VALUES (${placeholders})`, cols.map((c) => insertData[c]));
    const inserted = db.getFirstSync(`SELECT id FROM ${entity} WHERE uuid = ?`, [change.entity_uuid]) as any;
    recordRef(change.device_id ?? getDeviceId(), entity, { id: inserted?.id, uuid: change.entity_uuid });
    pruneOutboxEchoes(entity, change.entity_uuid, outboxPreSeq);
    bumpDataVersion();
    return;
  }

  const incoming = { ...data, uuid: change.entity_uuid, updated_at: data.updated_at ?? new Date().toISOString() };
  if (!force && !lastWriteWins(incoming, existing)) {
    recordConflict(change); // existing wins â€” surface for manual resolution (3.5)
    return;
  }
  const updateData: Record<string, any> = { ...data };
  delete updateData.id;
  updateData.device_id = change.device_id ?? getDeviceId();
  // Resolve peer FKs to local ids on the update path too (the insert path
  // already does). Writing the sender's raw itemId would violate the
  // stock_movements → items FOREIGN KEY when the row maps to a different
  // local id.
  if ((entity === 'stock_movements' || entity === 'sales' || entity === 'returns') && updateData.itemId != null) {
    const localItemId = resolveFk(change.device_id ?? getDeviceId(), 'items', updateData.itemId);
    if (localItemId != null) updateData.itemId = localItemId;
    else delete updateData.itemId; // keep the existing local value rather than crash
  }
  if (BUSINESS_SCOPED_ENTITIES.includes(entity) && updateData.business_id === null) {
    // Preserve the local business scope â€” a peer without the column must not
    // null it out (the local columns are NOT NULL).
    delete updateData.business_id;
  }
  if (CORE_BUSINESS_SCOPED_ENTITIES.includes(entity) && updateData.businessId == null) {
    // Same guard for the camelCase businessId on core POS tables.
    delete updateData.businessId;
  }
  const cols = columnsOf(entity).filter((c) => c in updateData && c !== 'id' && c !== 'uuid');
  if (cols.length) {
    const sets = cols.map((c) => `${c} = ?`).join(', ');
    db.runSync(`UPDATE ${entity} SET ${sets} WHERE uuid = ?`, [...cols.map((c) => updateData[c]), change.entity_uuid]);
  }
  pruneOutboxEchoes(entity, change.entity_uuid, outboxPreSeq);
  bumpDataVersion();
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
        seqs.push(row.seq); // row gone â€” nothing to send
        continue;
      }
      for (const c of columnsOf(entity)) payload[c] = r[c];
      if (CORE_BUSINESS_SCOPED_ENTITIES.includes(entity) && payload.businessId == null) {
        payload.businessId = resolveLocalBusinessId();
      }
    }
    const change: HubChange = { entity, entity_uuid: row.entity_uuid, op: row.op, payload };
    change.checksum = changeChecksum(change);
    change.client_seq = row.seq;
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
      body: JSON.stringify({ device_id: deviceId, name: 'Shega Mobile', platform: 'mobile', token, changes })
    });
    pushed = changes.length;
    conflicts = Number(res?.conflicts ?? 0);
    const db = getDB();
    // Prune only the outbox rows the hub actually merged. Per-change outcomes
    // (`results`) come back keyed to client_seq; without them, fall back to
    // deleting everything on a successful push response. Rows the hub could
    // not apply yet (pending FK) or rejected are retried next round.
    const outcome = Array.isArray(res?.results)
      ? new Map((res.results as { client_seq: number | null; status: string }[]).map((r) => [r.client_seq, r.status]))
      : null;
    const prune = outcome ? seqs.filter((seq) => {
      const status = outcome.get(seq);
      return status === 'applied' || status === 'conflict' || status === undefined;
    }) : seqs;
    if (prune.length) {
      db.runSync('DELETE FROM sync_outbox WHERE seq IN (' + prune.map(() => '?').join(',') + ')', prune);
    }
  }

  const db = getDB();
  const cursor = db.getFirstSync('SELECT hub_seq FROM sync_cursor WHERE id = 1') as any;
  const since = cursor?.hub_seq ?? 0;
  const pulled = await httpJson(`${hubUrl}/sync/pull?device=${encodeURIComponent(deviceId)}&since=${since}&token=${encodeURIComponent(token)}`);
  // 3.10: hub asked for a full re-snapshot â€” trust the response even if it was
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

  // Persist the hub as a peer device so it appears in Connected Devices
  // and we have its info for auto-reconnect.
  if (pulled?.hub) {
    persistPeerDevice({
      deviceId: pulled.hub,
      name: 'Shega Desktop Hub',
      platform: 'desktop',
      businessId: resolveLocalBusinessId() ?? undefined,
    });
  }

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
  const res = await httpJson(`${hubUrl}/sync/pair`, {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, name: 'Shega Mobile', platform: 'mobile', token: getHubToken() })
  });
  // Persist the hub as a peer device after successful pairing
  if (res?.hubId) {
    persistPeerDevice({
      deviceId: res.hubId,
      name: 'Shega Desktop Hub',
      platform: 'desktop',
      businessId: resolveLocalBusinessId() ?? undefined,
    });
  }
  return res;
}

// ============================================================================
// Â§24 Sync Center â€” unified status, pending changes, device status, history
// ============================================================================

/**
 * Get unified sync status (LAN transport).
 */
export async function getUnifiedSyncStatus(): Promise<UnifiedSyncStatus> {
  const db = getDB();
  const lanStatus = getSyncStatus();

  // Count pending outbound (local outbox)
  const outboxCount = (db.getFirstSync('SELECT COUNT(*) AS c FROM sync_outbox') as any)?.c ?? 0;

  // Count failed changes (conflicts + errors)
  const failedCount = (db.getFirstSync('SELECT COUNT(*) AS c FROM sync_conflicts') as any)?.c ?? 0;
  const conflictsCount = failedCount; // conflicts table stores both

  // Pending inbound = server changes the hub has but this device has not yet
  // pulled (hub lastSeq - local cursor). `/sync/info` needs no pairing token,
  // so a reachable hub is sufficient to compute a real count.
  const cursorSeq = (db.getFirstSync('SELECT hub_seq FROM sync_cursor WHERE id = 1') as any)?.hub_seq ?? 0;
  let pendingInbound = 0;
  let hubReachable = false;
  if (lanStatus.hub) {
    try {
      const info = await httpJson(`${lanStatus.hub}/sync/info`);
      const hubLastSeq = Number(info?.lastSeq ?? 0);
      hubReachable = true;
      pendingInbound = Math.max(0, hubLastSeq - cursorSeq);
    } catch {
      hubReachable = false; // unreachable -> offline/failed below
    }
  }

  // Determine overall health
  let health: SyncHealth = 'synced';
  if (outboxCount > 0 || failedCount > 0) health = 'pending';
  const { getStoredToken } = await import('./api');
  const hasCloudAuth = !!(await getStoredToken());
  if (!lanStatus.hub && !hasCloudAuth) health = 'offline';

  // Resolve the active transport from real capabilities: LAN hub first; else
  // cloud when the app is authenticated (§5-style cloud fallback); else offline.
  const transport: SyncTransport = lanStatus.hub ? 'lan' : hasCloudAuth ? 'cloud' : 'offline';

  // 7-state machine (connecting/syncing are driven by caller state)
  let status: SyncDetailStatus;
  if (!lanStatus.hub && !hasCloudAuth) status = 'offline';
  else if (lanStatus.hub && !hubReachable) status = 'sync-failed';
  else if (outboxCount > 0 || pendingInbound > 0) status = 'changes-pending';
  else if (failedCount > 0) status = 'sync-failed';
  else status = lanStatus.lastSyncAt ? 'synced' : 'connected';

  return {
    health,
    transport,
    lastSyncAt: lanStatus.lastSyncAt ?? null,
    pendingOutbound: outboxCount,
    pendingInbound,
    failedChanges: failedCount,
    conflicts: conflictsCount,
    status,
    lan: {
      configured: !!lanStatus.hub,
      hubUrl: lanStatus.hub,
      lastSyncAt: lanStatus.lastSyncAt,
      outboxCount: lanStatus.outboxCount,
    },
  };
}

/**
 * Get pending changes from local outbox with status info.
 */
export function getPendingChanges(): PendingChange[] {
  const db = getDB();
  const rows = db.getAllSync(
    `SELECT o.seq as id, o.entity, o.entity_uuid, o.op, o.created_at, o.transport, o.retry_count, o.source_device
     FROM sync_outbox o
     ORDER BY o.seq ASC LIMIT 200`
  ) as any[];

  // Ensure sync_outbox has the new columns (migration handled separately)
  return rows.map(r => ({
    id: r.id,
    entity: r.entity,
    entity_uuid: r.entity_uuid,
    op: r.op,
    created_at: r.created_at ?? new Date().toISOString(),
    status: 'pending' as const,
    transport: (r.transport as SyncTransport) ?? 'lan',
    retry_count: r.retry_count ?? 0,
    source_device: r.source_device ?? getDeviceId(),
  }));
}

/**
 * Get device status grid from local roster + sync metadata.
 */
export function getDeviceStatusList(): DeviceStatus[] {
  const db = getDB();
  const selfId = getDeviceId();

  // Get roster devices from local database. `id` is the canonical device
  // identity (this install's own device row id === sync_meta.device_id).
  const roster = db.getAllSync(
    `SELECT d.id as device_id, d.name, d.model, d.platform, d.status, d.last_seen_at, d.last_sync_at,
            d.user_id, d.role AS device_role, u.name AS user_name, u.role AS user_role
     FROM devices d
     LEFT JOIN users u ON u.id = d.user_id
     WHERE d.is_deleted = 0`
  ) as any[];

  // Add self if not in roster
  const hasSelf = roster.some(d => d.device_id === selfId);
  if (!hasSelf) {
    roster.push({ device_id: selfId, name: 'This Device', model: null, platform: 'mobile',
      status: 'active', last_seen_at: new Date().toISOString(), last_sync_at: null,
      user_id: null, user_name: null, user_role: null });
  }

  const now = Date.now();
  return roster.map(d => {
    const lastSeen = d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0;
    const isOnline = lastSeen > 0 && (now - lastSeen) < 5 * 60 * 1000; // 5 min threshold
    const rawStatus = String(d.status ?? 'unknown').toLowerCase();
    return {
      device_id: d.device_id,
      name: d.name ?? d.device_id.slice(0, 8),
      status: isOnline ? 'online' : rawStatus === 'active' || rawStatus === 'online' ? 'offline' : 'unknown',
      last_seen_at: d.last_seen_at ?? null,
      last_sync_at: d.last_sync_at ?? null,
      transport: 'lan' as SyncTransport, // Would need cloud roster sync for cloud devices
      is_self: d.device_id === selfId,
      model: d.model ?? null,
      platform: d.platform === 'desktop' ? 'desktop' : 'mobile',
      userId: d.user_id ?? null,
      role: d.user_role ?? d.device_role ?? null,
      userName: d.user_name ?? null,
    };
  });
}

/**
 * Get sync history from local log.
 */
export function getSyncHistory(limit = 50): SyncHistoryEntry[] {
  const db = getDB();
  const rows = db.getAllSync(
    `SELECT id, created_at as timestamp, transport, pushed, pulled, conflicts, status, error
     FROM sync_history
     ORDER BY id DESC LIMIT ?`
  , [limit]) as any[];

  // Ensure sync_history table exists (migration handled separately)
  return rows.map(r => ({
    id: r.id,
    timestamp: r.timestamp,
    transport: r.transport as SyncTransport,
    pushed: r.pushed ?? 0,
    pulled: r.pulled ?? 0,
    conflicts: r.conflicts ?? 0,
    status: r.status as 'success' | 'partial' | 'failed',
    error: r.error ?? null,
  }));
}

/**
 * Record a sync attempt to history.
 */
export function recordSyncHistory(entry: {
  transport: SyncTransport;
  pushed: number;
  pulled: number;
  conflicts: number;
  status: 'success' | 'partial' | 'failed';
  error?: string | null;
}): void {
  const db = getDB();
  db.runSync(
    `INSERT INTO sync_history (transport, pushed, pulled, conflicts, status, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.transport,
      entry.pushed,
      entry.pulled,
      entry.conflicts,
      entry.status,
      entry.error ?? null,
      new Date().toISOString(),
    ]
  );
}

// ─── Cloud relay sync (§20) ──────────────────────────────────────────────────

function getCloudCursor(): number {
  const db = getDB();
  const row = db.getFirstSync("SELECT value FROM app_settings WHERE key = 'cloud_cursor'") as any;
  return Number(row?.value ?? 0);
}

function setCloudCursor(seq: number): void {
  const db = getDB();
  db.runSync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('cloud_cursor', ?)", [String(seq)]);
}

export interface CloudSyncSummary {
  pushed: number;
  pulled: number;
  applied: number;
  conflicts: number;
  cursor: number;
  reason?: string;
}

/**
 * One-shot cloud relay sync: push the local outbox to Django, then pull
 * other-branch changes since the cloud cursor and apply them with the same
 * LWW/checksum path used for LAN. Never throws — returns a structured summary
 * (a `reason` field explains why nothing happened: not authenticated, offline,
 * or the documented backend gap).
 */
export async function syncViaCloud(): Promise<CloudSyncSummary> {
  const { isCloudSyncReachable, cloudPushChanges, cloudPullChanges } = await import('./api');
  const reachable = await isCloudSyncReachable();
  if (!reachable.reachable) {
    return { pushed: 0, pulled: 0, applied: 0, conflicts: 0, cursor: getCloudCursor(), reason: reachable.reason ?? 'unreachable' };
  }

  const deviceId = getDeviceId();
  let pushed = 0;
  let conflicts = 0;
  try {
    const { changes, seqs } = await buildChangesFromOutbox();
    if (changes.length > 0) {
      const pushRes = await cloudPushChanges(deviceId, changes as any);
      if (!pushRes.ok) {
        return { pushed: 0, pulled: 0, applied: 0, conflicts: 0, cursor: getCloudCursor(), reason: pushRes.error || 'push_failed' };
      }
      pushed = changes.length;
      // The cloud accepts in bulk; prune what the relay acknowledged. Retry
      // safety comes from the per-change checksum, so over-pruning is avoided
      // by only dropping the seqs we just sent when the relay reported ok.
      const accepted = Number(pushRes.accepted ?? changes.length);
      if (accepted > 0) {
        const db = getDB();
        const drop = seqs.slice(0, accepted);
        if (drop.length) {
          db.runSync('DELETE FROM sync_outbox WHERE seq IN (' + drop.map(() => '?').join(',') + ')', drop);
        }
      }
    }

    const since = getCloudCursor();
    const pulledRes = await cloudPullChanges(deviceId, since);
    if (!pulledRes.ok) {
      return { pushed, pulled: 0, applied: 0, conflicts, cursor: since, reason: pulledRes.error || 'pull_failed' };
    }
    const changesIn = (pulledRes.changes ?? []) as HubChange[];
    let applied = 0;
    if (changesIn.length > 0) {
      const sorted = changesIn.slice().sort((a, b) => {
        const ia = APPLY_ORDER.indexOf(a.entity as SyncEntity);
        const ib = APPLY_ORDER.indexOf(b.entity as SyncEntity);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      for (const change of sorted) {
        try {
          applyChange(change);
          applied += 1;
        } catch (e: any) {
          console.warn('[cloud] apply failed', change.entity, change.entity_uuid, e?.message);
        }
      }
    }
    const lastSeq = Number(pulledRes.lastSeq ?? since);
    setCloudCursor(lastSeq);
    return { pushed, pulled: changesIn.length, applied, conflicts, cursor: lastSeq };
  } catch (e: any) {
    return { pushed, pulled: 0, applied: 0, conflicts, cursor: getCloudCursor(), reason: String(e?.message ?? e) };
  }
}

// ============================================================================
// Automatic Real-Time Outbox Watcher
// ============================================================================

let lastWatchedOutboxSeq = 0;
let outboxWatchTimer: ReturnType<typeof setInterval> | null = null;

export function notifyLocalDataChanged(): void {
  bumpDataVersion();
  // Trigger immediate real-time sync when local mutations occur
  import('./wsSyncClient').then(({ wsSyncClient }) => {
    if (wsSyncClient.isConnected) {
      wsSyncClient.syncNow().catch(() => {});
    }
  });
  import('./peerSyncManager').then(({ triggerSync }) => {
    triggerSync().catch(() => {});
  });
  import('./mobileSyncServer').then(({ broadcastServerOutbox }) => {
    try { broadcastServerOutbox(); } catch {}
  });
}

export function startOutboxWatcher(): void {
  if (outboxWatchTimer) return;
  lastWatchedOutboxSeq = currentOutboxSeq();
  outboxWatchTimer = setInterval(() => {
    const current = currentOutboxSeq();
    if (current > lastWatchedOutboxSeq) {
      lastWatchedOutboxSeq = current;
      console.log(`[Sync] Local outbox advanced (seq: ${current}), triggering automatic real-time sync`);
      notifyLocalDataChanged();
    }
  }, 500);
}

// Auto-start watcher on load
try { startOutboxWatcher(); } catch {}
