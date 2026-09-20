/**
 * Mobile Sync Server — lightweight LAN sync server for Mobile-to-Mobile sync.
 *
 * On Android, React Native can create a TCP server via `react-native-tcp-socket`.
 * This enables a mobile device to act as a sync hub for other mobile devices
 * on the same LAN, supporting the full Device↔Device matrix:
 * - Desktop ↔ Desktop (via existing SyncHub on port 5757)
 * - Mobile ↔ Mobile (via this server on port 5759)
 * - Desktop ↔ Mobile (mobile connects to desktop hub OR desktop connects to mobile hub)
 *
 * The server uses the same Change/LWW protocol as the desktop sync hub.
 * Business membership verification is enforced on every connection.
 *
 * When `react-native-tcp-socket` is not available (e.g. Expo Go), the server
 * is disabled and the device operates in client-only mode (connecting to
 * discovered desktop hubs or using cloud sync).
 */

import { getDB } from '../database/db';
import { getDeviceId, currentOutboxSeq, pruneOutboxEchoes } from './syncService';
import { validateInviteCode } from './invitationService';
import { bumpDataVersion } from './dataVersion';
import * as Crypto from 'expo-crypto';

export const MOBILE_SYNC_PORT = 5759;

interface TcpClient {
  socket: any;
  deviceId: string;
  paired: boolean;
  businessId: string | null;
  lastHeartbeat: number;
}

// ─── Pairing token management ───────────────────────────────────────────────

function getPairingToken(): string {
  const db = getDB();
  const row = db.getFirstSync(
    "SELECT value FROM app_settings WHERE key = 'mobile_pairing_token'"
  ) as any;
  if (row?.value) return row.value;
  // Generate 6-char token from crypto
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  const randomBytes = Crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) token += chars[randomBytes[i] % chars.length];
  db.runSync(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('mobile_pairing_token', ?)",
    [token]
  );
  return token;
}

function getCurrentBusinessId(): string | null {
  const db = getDB();
  const row = db.getFirstSync(
    "SELECT value FROM app_settings WHERE key = 'active_business_id'"
  ) as any;
  if (row?.value) {
    const biz = db.getFirstSync('SELECT uuid FROM businesses WHERE id = ? AND is_deleted = 0', [row.value]) as any;
    if (biz?.uuid) return biz.uuid;
  }
  const fallback = db.getFirstSync(
    "SELECT uuid FROM businesses WHERE is_deleted = 0 ORDER BY (is_default = 1) DESC, created_at LIMIT 1"
  ) as any;
  return fallback?.uuid ?? null;
}

// ─── Sync data helpers ──────────────────────────────────────────────────────

const SYNC_TABLES = [
  'categories', 'items', 'item_packs', 'sales', 'debt_payments',
  'adjustments', 'returns', 'customers', 'contacts',
  'stock_movements', 'businesses', 'locations', 'registers',
  'business_roles', 'users', 'devices',
  'subscriptions', 'scheduled_reminders', 'suppliers', 'orders',
  'order_items', 'shipments', 'shipment_items', 'employees',
  'employee_roles', 'employee_accounts', 'attendance', 'employee_performance',
] as const;

type SyncTable = (typeof SYNC_TABLES)[number];

let columnCache: Record<string, string[]> = {};
function columnsOf(entity: string): string[] {
  if (!columnCache[entity]) {
    const db = getDB();
    const info = db.getAllSync(`PRAGMA table_info(${entity})`) as any[];
    columnCache[entity] = info.map((c: any) => c.name);
  }
  return columnCache[entity];
}

function cleanPayload(entity: string, payload: Record<string, any>): Record<string, any> {
  const cols = columnsOf(entity);
  const clean: Record<string, any> = {};
  for (const k of Object.keys(payload)) {
    if (cols.includes(k)) clean[k] = payload[k];
  }
  return clean;
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

function tsValue(v: any): number {
  if (v == null || v === '') return -Infinity;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (/^[0-9]+$/.test(s)) return Number(s);
  const norm = s.replace(' ', 'T');
  const ms = Date.parse(norm.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(norm) ? norm : `${norm}Z`);
  return Number.isNaN(ms) ? -Infinity : ms;
}

function maxSeq(): number {
  return currentOutboxSeq();
}

function snapshotSince(since: number): { changes: any[]; lastSeq: number; snapshot: boolean } {
  const db = getDB();
  const seq = maxSeq();
  if (since <= 0) {
    const changes: any[] = [];
    for (const entity of SYNC_TABLES) {
      try {
        const rows = db.getAllSync(`SELECT * FROM ${entity} WHERE is_deleted = 0`) as any[];
        for (const r of rows) {
          changes.push({ entity, entity_uuid: r.uuid, op: 'INSERT', payload: r, device_id: r.device_id ?? getDeviceId() });
        }
      } catch { /* table may not exist */ }
    }
    return { changes, lastSeq: seq, snapshot: true };
  }
  // BREAK-01: the outbox has NO `payload` column — the delta must re-read the
  // current row by row_id (live row state) like buildChangesFromOutbox does,
  // with a minimal tombstone for deletes.
  const outboxRows = db.getAllSync('SELECT * FROM sync_outbox WHERE seq > ? ORDER BY seq ASC LIMIT 1000', [since]) as any[];
  const devId = getDeviceId();
  const changes: any[] = [];
  for (const r of outboxRows) {
    let payload: any = {};
    if (r.op === 'DELETE') {
      payload = { id: r.row_id ?? null, uuid: r.entity_uuid, deleted_at: new Date().toISOString() };
    } else if (r.row_id != null) {
      try {
        const row = db.getFirstSync(`SELECT * FROM ${r.entity} WHERE id = ?`, [r.row_id]) as any;
        if (row) payload = row;
      } catch { /* table may not exist */ }
    }
    if (r.op !== 'DELETE' && Object.keys(payload).length === 0) continue;
    changes.push({ entity: r.entity, entity_uuid: r.entity_uuid, op: r.op, payload, device_id: payload.device_id ?? devId, seq: r.seq });
  }
  return { changes, lastSeq: seq, snapshot: false };
}

interface Change {
  entity: string;
  entity_uuid: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, any>;
  device_id?: string;
  checksum?: string;
}

function applyChange(deviceId: string, change: Change): 'applied' | 'conflict' | 'skipped' {
  const { entity, entity_uuid, op, payload } = change;
  if (!SYNC_TABLES.includes(entity as SyncTable) || !entity_uuid) return 'skipped';

  const db = getDB();
  const data = cleanPayload(entity, payload);
  const outboxPreSeq = currentOutboxSeq();

  if (op === 'DELETE') {
    try {
      db.runSync(`UPDATE ${entity} SET is_deleted = 1, deleted_at = COALESCE(?, deleted_at) WHERE uuid = ?`, [
        payload.deleted_at ?? new Date().toISOString(), entity_uuid,
      ]);
    } catch { /* table may not exist */ }
    pruneOutboxEchoes(entity, entity_uuid, outboxPreSeq);
    bumpDataVersion();
    return 'applied';
  }

  const existing = db.getFirstSync(`SELECT * FROM ${entity} WHERE uuid = ?`, [entity_uuid]) as any;
  // Resolve peer FKs to local ids on the update path (mirrors syncService.applyChange):
  // a movement/sale/return UPDATE carrying the sender's raw itemId would violate
  // the stock_movements → items FOREIGN KEY when local ids differ.
  if ((entity === 'stock_movements' || entity === 'sales' || entity === 'returns') && data.itemId != null) {
    try {
      const localItem = db.getFirstSync('SELECT id FROM items WHERE uuid = ? OR id = ?', [String(data.itemId), data.itemId]) as any;
      if (localItem?.id != null) data.itemId = localItem.id;
      else delete data.itemId;
    } catch { delete data.itemId; }
  }
  if (!existing) {
    const insertData = { ...data };
    delete insertData.id;
    // FK guard: never insert an unresolvable peer itemId (would violate the
    // stock_movements → items FOREIGN KEY).
    if ((entity === 'stock_movements' || entity === 'sales' || entity === 'returns') && insertData.itemId != null) {
      try {
        const localItem = db.getFirstSync('SELECT id FROM items WHERE uuid = ? OR id = ?', [String(insertData.itemId), insertData.itemId]) as any;
        insertData.itemId = localItem?.id ?? null;
      } catch { insertData.itemId = null; }
    }
    insertData.uuid = entity_uuid;
    insertData.device_id = deviceId;
    insertData.updated_at = insertData.updated_at ?? new Date().toISOString();
    const cols = columnsOf(entity).filter((c) => c in insertData);
    const placeholders = cols.map(() => '?').join(', ');
    db.runSync(`INSERT INTO ${entity} (${cols.join(', ')}) VALUES (${placeholders})`, cols.map((c) => insertData[c]));
    pruneOutboxEchoes(entity, entity_uuid, outboxPreSeq);
    bumpDataVersion();
    return 'applied';
  }

  // LWW
  const incoming = { ...data, uuid: entity_uuid, updated_at: data.updated_at ?? new Date().toISOString() };
  if (lastWriteWins(incoming, existing)) {
    const updateData = { ...data };
    delete updateData.id;
    updateData.device_id = deviceId;
    const cols = columnsOf(entity).filter((c) => c in updateData && c !== 'id' && c !== 'uuid');
    if (cols.length) {
      const sets = cols.map((c) => `${c} = ?`).join(', ');
      db.runSync(`UPDATE ${entity} SET ${sets} WHERE uuid = ?`, [...cols.map((c) => updateData[c]), entity_uuid]);
    }
    pruneOutboxEchoes(entity, entity_uuid, outboxPreSeq);
    bumpDataVersion();
    return 'applied';
  }
  return 'conflict';
}

function applyPush(deviceId: string, changes: Change[]): { applied: number; conflicts: number; skipped: number } {
  const result = { applied: 0, conflicts: 0, skipped: 0 };
  for (const change of changes) {
    try {
      const status = applyChange(deviceId, change);
      if (status === 'applied') result.applied++;
      else if (status === 'conflict') result.conflicts++;
      else result.skipped++;
    } catch {
      // One constraint-violating row must not abort the whole batch.
      result.skipped++;
    }
  }
  return result;
}

// ─── TCP server ─────────────────────────────────────────────────────────────

let server: any = null;
const clients = new Map<string, TcpClient>();

function handleMessage(client: TcpClient, data: string): void {
  let msg: any;
  try {
    msg = JSON.parse(data);
  } catch {
    sendTo(client.socket, { type: 'ERROR', payload: { code: 'INVALID_MESSAGE', message: 'Malformed JSON' } });
    return;
  }

  switch (msg.type) {
    case 'HEARTBEAT':
      client.lastHeartbeat = Date.now();
      sendTo(client.socket, { type: 'HEARTBEAT_ACK', timestamp: Date.now() });
      break;

    case 'PAIR_REQUEST':
      handlePairRequest(client, msg);
      break;

    case 'SYNC_PUSH':
      handleSyncPush(client, msg);
      break;

    case 'SYNC_PULL':
      handleSyncPull(client, msg);
      break;

    case 'INVITE_RESOLVE':
      handleInviteResolve(client, msg);
      break;

    case 'DEVICE_JOIN_SUBMIT':
      handleJoinSubmit(client, msg);
      break;

    case 'DEVICE_JOIN_STATUS':
      handleJoinStatus(client, msg);
      break;

    case 'DEVICE_JOIN_LIST':
      handleJoinList(client, msg);
      break;

    case 'DEVICE_JOIN_DECIDE':
      handleJoinDecide(client, msg);
      break;

    default:
      sendError(client.socket, 'UNKNOWN_TYPE', `Unknown message type: ${msg.type}`);
  }
}

function handlePairRequest(client: TcpClient, msg: any): void {
  const { device_id, name, token, business_id } = msg.payload || {};
  if (!device_id) {
    sendError(client.socket, 'PAIR_FAILED', 'device_id required');
    return;
  }

  // Verify pairing token — the token is REQUIRED (no more token-less pairing).
  const hubToken = getPairingToken();
  if (String(token ?? '').trim().toUpperCase() !== hubToken) {
    sendError(client.socket, 'PAIR_FAILED', token ? 'Invalid pairing token' : 'Pairing token required');
    return;
  }

  // A revoked/unpaired device is refused even with a valid token — an owner
  // must approve a new pairing before it can sync again.
  try {
    const revoked = getDB().getFirstSync(
      "SELECT status FROM devices WHERE id = ? OR uuid = ?", [device_id, device_id]
    ) as any;
    if (revoked && (revoked.status || '') === 'revoked') {
      sendError(client.socket, 'PAIR_FAILED', 'Device was unpaired by the owner. A new pairing is required.');
      return;
    }
  } catch { /* devices table may not exist yet */ }

  // Verify business membership
  const hubBizId = getCurrentBusinessId();
  if (!hubBizId) {
    sendError(client.socket, 'PAIR_FAILED', 'No active business on this hub');
    return;
  }
  if (business_id && business_id !== hubBizId) {
    sendError(client.socket, 'PAIR_FAILED', 'Business membership mismatch');
    return;
  }
  const bizId = business_id ?? hubBizId;

  // Register device — bound to the hub's business, awaiting owner approval.
  // A person never gets created here: the device is just a pending install of
  // the SAME business/membership, approved and bound to a user by the owner.
  const db = getDB();
  db.runSync(
    `INSERT OR REPLACE INTO devices
       (id, business_id, user_id, name, platform, status, is_active, uuid, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 'mobile', 'pending', 1, ?, ?, ?)`,
    [device_id, bizId, name || device_id.slice(0, 8), device_id, new Date().toISOString(), new Date().toISOString()]
  );

  client.deviceId = device_id;
  client.paired = true;
  client.businessId = bizId;

  sendTo(client.socket, {
    type: 'PAIR_RESPONSE',
    requestId: msg.requestId,
    payload: {
      success: true,
      hubId: getDeviceId(),
      schemaVersion: 21,
    },
  });

  console.log(`[MobileSync] Device paired: ${device_id} (${name || 'unknown'})`);
}

function handleSyncPush(client: TcpClient, msg: any): void {
  if (!client.paired) {
    sendError(client.socket, 'NOT_PAIRED', 'Device not paired');
    return;
  }

  const { changes } = msg.payload || {};
  if (!Array.isArray(changes)) {
    sendError(client.socket, 'INVALID_PAYLOAD', 'changes must be array');
    return;
  }

  const result = applyPush(client.deviceId, changes);
  sendTo(client.socket, {
    type: 'SYNC_ACK',
    requestId: msg.requestId,
    payload: { ...result, serverSeq: maxSeq() },
  });
}

function handleSyncPull(client: TcpClient, msg: any): void {
  if (!client.paired) {
    sendError(client.socket, 'NOT_PAIRED', 'Device not paired');
    return;
  }

  const since = typeof msg.payload?.since === 'number' ? msg.payload.since : 0;
  const result = snapshotSince(since);

  sendTo(client.socket, {
    type: 'SYNC_CHANGES',
    requestId: msg.requestId,
    payload: { changes: result.changes, lastSeq: result.lastSeq, snapshot: result.snapshot },
  });
}

function sendTo(socket: any, msg: any): void {
  try {
    if (socket && typeof socket.write === 'function') {
      socket.write(JSON.stringify(msg) + '\n');
    }
  } catch {}
}

function sendError(socket: any, code: string, message: string): void {
  sendTo(socket, { type: 'ERROR', payload: { code, message } });
}

// ─── Device-join channel (hub side) ─────────────────────────────────────────
// Mirrors the desktop WS hub's DEVICE_JOIN channel so a mobile phone acting
// as the main connector can serve joiners (mobile OR desktop) without any
// cloud dependency. Codes resolve against THIS phone's `invitations` table;
// requests are staged into `device_requests`; the owner's BusinessManagement
// screen lists and decides them — all locally, all offline.

const normalizeCode = (code: string) => String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Local `device_requests` rows for a business, newest decisions last. */
function listLocalJoinRequests(businessId: string): any[] {
  const db = getDB();
  return db.getAllSync(
    `SELECT * FROM device_requests WHERE business_id = ?
     ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 100`,
    [businessId],
  ).map((r: any) => ({
    requestId: r.id,
    businessId: r.business_id,
    code: r.code,
    joinerDeviceId: r.joiner_device_id,
    joinerName: r.joiner_name,
    joinerModel: r.joiner_model,
    joinerUser: r.joiner_user,
    role: r.role,
    platform: r.platform,
    status: r.status,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
    assignedName: r.assigned_name ?? null,
    assignedAvatar: r.assigned_avatar ?? null,
    assignedPermissions: r.assigned_permissions ? safeParse(r.assigned_permissions) : null,
  }));
}

function ensureJoinTables(): void {
  const db = getDB();
  db.runSync(`CREATE TABLE IF NOT EXISTS device_requests (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      code TEXT,
      joiner_device_id TEXT NOT NULL,
      joiner_name TEXT,
      joiner_model TEXT,
      joiner_user TEXT,
      role TEXT,
      platform TEXT DEFAULT 'mobile',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT,
      decided_at TEXT,
      assigned_name TEXT,
      assigned_avatar TEXT,
      assigned_permissions TEXT
    )`);
  for (const col of ['assigned_name TEXT', 'assigned_avatar TEXT', 'assigned_permissions TEXT']) {
    try { db.runSync(`ALTER TABLE device_requests ADD COLUMN ${col}`); } catch { /* already present */ }
  }
}

/**
 * Owner "configure before they ask" handoff, keyed by joiner device id.
 *
 * The Add-Team radar lets the owner configure a discovered phone/desktop that
 * is still waiting to join. Storing the configuration here means the request
 * is approved with the assigned identity the instant it arrives — one
 * confirmation, no second approval step.
 */
const preassignedJoins = new Map<string, { name?: string; avatar?: string | null; role?: string; permissions?: Record<string, unknown> }>();

export function preassignJoinIdentity(
  deviceId: string,
  cfg: { name?: string; avatar?: string | null; role?: string; permissions?: Record<string, unknown> },
): void {
  if (!deviceId) return;
  preassignedJoins.set(deviceId, cfg);
}

function handleInviteResolve(client: TcpClient, msg: any): void {
  const code = String(msg.payload?.code ?? '');
  if (!code) { sendError(client.socket, 'INVITE_FAILED', 'code required'); return; }
  const inv = validateInviteCode(code);
  if (!inv) { sendError(client.socket, 'INVITE_INVALID', 'Invitation not found or expired'); return; }
  const db = getDB();
  const biz = db.getFirstSync(
    'SELECT uuid, name FROM businesses WHERE uuid = ? OR id = ? LIMIT 1',
    [inv.business_id, inv.business_id],
  ) as any;
  sendTo(client.socket, {
    type: 'DEVICE_JOIN_RESPONSE',
    requestId: msg.requestId,
    payload: {
      invitation: {
        id: inv.id,
        businessId: biz?.uuid ?? String(inv.business_id),
        code: inv.code,
        name: inv.name,
        role: inv.role,
        platform: inv.platform,
        expiresAt: inv.expires_at,
        businessName: biz?.name ?? null,
      },
    },
  });
}

function handleJoinSubmit(client: TcpClient, msg: any): void {
  const p = msg.payload || {};
  if (!p.code || !p.joinerDeviceId) {
    sendError(client.socket, 'DEVICE_JOIN_FAILED', 'code and joinerDeviceId required');
    return;
  }
  const inv = validateInviteCode(p.code);
  if (!inv) { sendError(client.socket, 'INVITE_INVALID', 'Invitation not found or expired'); return; }
  const db = getDB();
  const biz = db.getFirstSync(
    'SELECT uuid FROM businesses WHERE uuid = ? OR id = ? LIMIT 1',
    [inv.business_id, inv.business_id],
  ) as any;
  const canonicalBizId = String(biz?.uuid ?? inv.business_id);
  ensureJoinTables();
  const existing = db.getFirstSync(
    "SELECT id FROM device_requests WHERE business_id = ? AND joiner_device_id = ? AND status = 'pending'",
    [canonicalBizId, p.joinerDeviceId],
  ) as any;
  const requestId = existing?.id ?? `jr-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  if (!existing) {
    db.runSync(
      `INSERT INTO device_requests
         (id, business_id, code, joiner_device_id, joiner_name, joiner_model, joiner_user, role, platform, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [requestId, canonicalBizId, p.code, p.joinerDeviceId, p.joinerName ?? null,
       p.joinerModel ?? null, p.joinerUser ?? 'New Member', p.role ?? inv.role ?? 'cashier',
       p.platform ?? 'mobile', new Date().toISOString()],
    );
  }
  client.paired = true; // joiners may poll status through this connection
  client.deviceId = p.joinerDeviceId;
  // Pre-configured in the owner's Add-Team radar: apply the assigned identity
  // and approve on arrival so the joiner lands straight in the business.
  const pre = preassignedJoins.get(p.joinerDeviceId);
  if (pre) {
    preassignedJoins.delete(p.joinerDeviceId);
    try {
      db.runSync(
        `UPDATE device_requests SET assigned_name = ?, assigned_avatar = ?, assigned_permissions = ?,
           role = ?, status = 'approved', decided_at = ? WHERE id = ?`,
        [pre.name ?? null, pre.avatar ?? null, pre.permissions ? JSON.stringify(pre.permissions) : null,
         pre.role ?? 'cashier', new Date().toISOString(), requestId],
      );
      db.runSync("UPDATE invitations SET status = 'used' WHERE code = ?", [p.code]);
      try {
        const req = db.getFirstSync('SELECT * FROM device_requests WHERE id = ?', [requestId]) as any;
        db.runSync(
          `INSERT OR REPLACE INTO devices (id, business_id, user_id, name, platform, status, is_active, uuid, created_at, updated_at)
           VALUES (?, ?, NULL, ?, ?, 'active', 1, ?, ?, ?)`,
          [p.joinerDeviceId, canonicalBizId, pre.name || p.joinerName || p.joinerDeviceId.slice(0, 8),
           p.platform === 'desktop' ? 'desktop' : 'mobile', p.joinerDeviceId,
           new Date().toISOString(), new Date().toISOString()],
        );
        void req;
      } catch { /* roster mirror is best-effort */ }
    } catch { /* fall back to the manual approval flow below */ }
    sendTo(client.socket, { type: 'DEVICE_JOIN_ACK', requestId: msg.requestId, payload: { requestId, status: 'approved' } });
    console.log(`[MobileSync] Device join auto-approved (pre-configured): ${p.joinerDeviceId}`);
    return;
  }
  sendTo(client.socket, { type: 'DEVICE_JOIN_ACK', requestId: msg.requestId, payload: { requestId, status: 'pending' } });
  console.log(`[MobileSync] Device join staged: ${p.joinerDeviceId} -> ${canonicalBizId}`);
}

function handleJoinStatus(client: TcpClient, msg: any): void {
  const { code, joinerDeviceId } = msg.payload || {};
  if (!code || !joinerDeviceId) {
    sendError(client.socket, 'DEVICE_JOIN_FAILED', 'code and joinerDeviceId required');
    return;
  }
  ensureJoinTables();
  const n = normalizeCode(code);
  const db = getDB();
  const row = db.getFirstSync(
    `SELECT * FROM device_requests WHERE replace(replace(upper(coalesce(code,'')), '-', ''), ' ', '') = ?
       AND joiner_device_id = ? ORDER BY created_at DESC LIMIT 1`,
    [n, joinerDeviceId],
  ) as any;
  const record = row ? {
    requestId: row.id, businessId: row.business_id, code: row.code,
    joinerDeviceId: row.joiner_device_id, joinerName: row.joiner_name,
    joinerModel: row.joiner_model, joinerUser: row.assigned_name || row.joiner_user,
    role: row.role, platform: row.platform, status: row.status,
    createdAt: row.created_at, decidedAt: row.decided_at,
    // Owner-assigned identity rides along so the joiner adopts it on approval.
    assignedName: row.assigned_name ?? null,
    assignedAvatar: row.assigned_avatar ?? null,
    assignedPermissions: row.assigned_permissions ? safeParse(row.assigned_permissions) : null,
  } : null;
  const payload: any = { record };
  // Approval grants the hub pairing credential in-band (same as desktop).
  if (record && record.status === 'approved') payload.pairingToken = getPairingToken();
  sendTo(client.socket, { type: 'DEVICE_JOIN_RESPONSE', requestId: msg.requestId, payload });
}

function safeParse(json: string): any {
  try { return JSON.parse(json); } catch { return null; }
}

function handleJoinList(client: TcpClient, msg: any): void {
  const { businessId } = msg.payload || {};
  if (!businessId) { sendError(client.socket, 'DEVICE_JOIN_FAILED', 'businessId required'); return; }
  ensureJoinTables();
  sendTo(client.socket, { type: 'DEVICE_JOIN_RESPONSE', requestId: msg.requestId, payload: { requests: listLocalJoinRequests(String(businessId)) } });
}

function handleJoinDecide(client: TcpClient, msg: any): void {
  const p = msg.payload || {};
  if (!p.requestId || !['approved', 'rejected'].includes(p.decision)) {
    sendError(client.socket, 'DEVICE_JOIN_FAILED', 'requestId and valid decision required');
    return;
  }
  ensureJoinTables();
  const db = getDB();
  const row = db.getFirstSync('SELECT * FROM device_requests WHERE id = ?', [p.requestId]) as any;
  if (!row) { sendError(client.socket, 'DEVICE_JOIN_FAILED', 'request not found'); return; }
  db.runSync('UPDATE device_requests SET status = ?, decided_at = ? WHERE id = ?',
    [p.decision, new Date().toISOString(), p.requestId]);
  // Persist the owner-assigned identity so the joiner's STATUS poll returns it.
  try {
    const sets: string[] = [];
    const vals: any[] = [];
    if (p.assignedName) { sets.push('assigned_name = ?'); vals.push(p.assignedName); }
    if (p.assignedRole) { sets.push('role = ?'); vals.push(p.assignedRole); }
    if (p.assignedAvatar !== undefined && p.assignedAvatar !== null) { sets.push('assigned_avatar = ?'); vals.push(p.assignedAvatar); }
    if (p.assignedPermissions && typeof p.assignedPermissions === 'object') { sets.push('assigned_permissions = ?'); vals.push(JSON.stringify(p.assignedPermissions)); }
    if (sets.length) { vals.push(p.requestId); db.runSync(`UPDATE device_requests SET ${sets.join(', ')} WHERE id = ?`, vals); }
  } catch {
    try {
      db.runSync('ALTER TABLE device_requests ADD COLUMN assigned_name TEXT');
      db.runSync('ALTER TABLE device_requests ADD COLUMN assigned_avatar TEXT');
      db.runSync('ALTER TABLE device_requests ADD COLUMN assigned_permissions TEXT');
    } catch { /* columns exist */ }
  }
  if (p.decision === 'approved') {
    // Consume the invite + promote the device on this owner phone so both
    // sides' rosters agree. The joiner learns the outcome via STATUS polling.
    try { db.runSync("UPDATE invitations SET status = 'used' WHERE code = ?", [row.code]); } catch { /* best-effort */ }
    try {
      db.runSync(
        `INSERT OR REPLACE INTO devices (id, business_id, user_id, name, platform, status, is_active, uuid, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, 'active', 1, ?, ?, ?)`,
        [row.joiner_device_id, row.business_id, row.joiner_name || row.joiner_device_id.slice(0, 8),
         row.platform === 'desktop' ? 'desktop' : 'mobile', row.joiner_device_id,
         new Date().toISOString(), new Date().toISOString()],
      );
    } catch { /* roster mirror is best-effort */ }
  }
  const updated = db.getFirstSync('SELECT * FROM device_requests WHERE id = ?', [p.requestId]) as any;
  sendTo(client.socket, {
    type: 'DEVICE_JOIN_RESPONSE',
    requestId: msg.requestId,
    payload: { record: { requestId: updated.id, businessId: updated.business_id, code: updated.code,
      joinerDeviceId: updated.joiner_device_id, joinerName: updated.joiner_name,
      joinerModel: updated.joiner_model, joinerUser: updated.assigned_name || updated.joiner_user,
      role: updated.role, platform: updated.platform, status: updated.status,
      createdAt: updated.created_at, decidedAt: updated.decided_at,
      assignedName: updated.assigned_name ?? null,
      assignedAvatar: updated.assigned_avatar ?? null,
      assignedPermissions: updated.assigned_permissions ? safeParse(updated.assigned_permissions) : null } },
  });
  console.log(`[MobileSync] Device join ${p.decision}: ${row.joiner_device_id}`);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function startMobileSyncServer(): Promise<boolean> {
  // Try to use react-native-tcp-socket if available
  try {
    const TcpServer = require('react-native-tcp-socket').TcpServer;
    const server = TcpServer.createServer((socket: any) => {
      const clientId = Crypto.randomUUID();
      const client: TcpClient = {
        socket,
        deviceId: '',
        paired: false,
        businessId: null,
        lastHeartbeat: Date.now(),
      };
      clients.set(clientId, client);

      socket.on('data', (data: any) => {
        const text = data.toString('utf8');
        // Handle multiple messages in one buffer (newline-delimited)
        const messages = text.split('\n').filter(Boolean);
        for (const msg of messages) {
          handleMessage(client, msg);
        }
      });

      socket.on('close', () => {
        clients.delete(clientId);
        console.log(`[MobileSync] Client disconnected: ${clientId}`);
      });

      socket.on('error', (err: any) => {
        console.warn(`[MobileSync] Client error: ${err.message}`);
        clients.delete(clientId);
      });

      console.log(`[MobileSync] Client connected: ${clientId}`);
    });

    server.listen(MOBILE_SYNC_PORT, '0.0.0.0');
    console.log(`[MobileSync] Server listening on port ${MOBILE_SYNC_PORT}`);
    return true;
  } catch (e: any) {
    console.warn('[MobileSync] TCP server not available:', e?.message);
    console.log('[MobileSync] Running in client-only mode (no LAN hosting)');
    return false;
  }
}

export function stopMobileSyncServer(): void {
  if (server) {
    try { server.close(); } catch {}
    server = null;
  }
  clients.clear();
  console.log('[MobileSync] Server stopped');
}

export function isMobileSyncServerRunning(): boolean {
  return server !== null;
}

export function getMobileSyncPort(): number {
  return MOBILE_SYNC_PORT;
}
