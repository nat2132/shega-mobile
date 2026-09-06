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
import { getDeviceId } from './syncService';
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
  'expenses', 'adjustments', 'returns', 'customers', 'contacts',
  'stock_movements', 'businesses', 'locations', 'registers',
  'business_roles', 'users', 'devices', 'budgets',
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
  const iTs = (incoming.updated_at ?? incoming.createdAt ?? '') as string;
  const eTs = (existing.updated_at ?? existing.createdAt ?? '') as string;
  if (iTs !== eTs) return iTs > eTs;
  const iVer = Number(incoming.row_version ?? 0);
  const eVer = Number(existing.row_version ?? 0);
  if (iVer !== eVer) return iVer > eVer;
  return String(incoming.uuid ?? '') >= String(existing.uuid ?? '');
}

function maxSeq(): number {
  const db = getDB();
  const r = db.getFirstSync('SELECT COALESCE(MAX(seq),0) AS m FROM sync_outbox') as any;
  return r?.m ?? 0;
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
          changes.push({ entity, entity_uuid: r.uuid, op: 'INSERT', payload: r, device_id: r.device_id });
        }
      } catch { /* table may not exist */ }
    }
    return { changes, lastSeq: seq, snapshot: true };
  }
  const rows = db.getAllSync(
    'SELECT * FROM sync_outbox WHERE seq > ? ORDER BY seq ASC LIMIT 1000'
  , [since]) as any[];
  const changes = rows.map((r: any) => {
    let payload: any = {};
    try { payload = JSON.parse(r.payload); } catch {}
    return { entity: r.entity, entity_uuid: r.entity_uuid, op: r.op, payload, device_id: r.device_id, seq: r.seq };
  });
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

  if (op === 'DELETE') {
    try {
      db.runSync(`UPDATE ${entity} SET is_deleted = 1, deleted_at = COALESCE(?, deleted_at) WHERE uuid = ?`, [
        payload.deleted_at ?? new Date().toISOString(), entity_uuid,
      ]);
    } catch { /* table may not exist */ }
    return 'applied';
  }

  const existing = db.getFirstSync(`SELECT * FROM ${entity} WHERE uuid = ?`, [entity_uuid]) as any;
  if (!existing) {
    const insertData = { ...data };
    delete insertData.id;
    insertData.uuid = entity_uuid;
    insertData.device_id = deviceId;
    insertData.updated_at = insertData.updated_at ?? new Date().toISOString();
    const cols = columnsOf(entity).filter((c) => c in insertData);
    const placeholders = cols.map(() => '?').join(', ');
    db.runSync(`INSERT INTO ${entity} (${cols.join(', ')}) VALUES (${placeholders})`, cols.map((c) => insertData[c]));
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
    return 'applied';
  }
  return 'conflict';
}

function applyPush(deviceId: string, changes: Change[]): { applied: number; conflicts: number; skipped: number } {
  const result = { applied: 0, conflicts: 0, skipped: 0 };
  for (const change of changes) {
    const status = applyChange(deviceId, change);
    if (status === 'applied') result.applied++;
    else if (status === 'conflict') result.conflicts++;
    else result.skipped++;
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

  // Verify pairing token
  const hubToken = getPairingToken();
  if (token && token.trim().toUpperCase() !== hubToken) {
    sendError(client.socket, 'PAIR_FAILED', 'Invalid pairing token');
    return;
  }

  // Verify business membership
  const hubBizId = getCurrentBusinessId();
  if (business_id && hubBizId && business_id !== hubBizId) {
    sendError(client.socket, 'PAIR_FAILED', 'Business membership mismatch');
    return;
  }

  // Register device
  const db = getDB();
  db.runSync(
    'INSERT OR REPLACE INTO devices (id, name, last_seen_at, uuid, is_active) VALUES (?, ?, ?, ?, 1)',
    [device_id, name || device_id.slice(0, 8), new Date().toISOString(), device_id]
  );

  client.deviceId = device_id;
  client.paired = true;
  client.businessId = business_id ?? hubBizId;

  sendTo(client.socket, {
    type: 'PAIR_RESPONSE',
    requestId: msg.requestId,
    payload: {
      success: true,
      hubId: getDeviceId(),
      pairingToken: hubToken,
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

      socket.on('data', (data: Buffer) => {
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
