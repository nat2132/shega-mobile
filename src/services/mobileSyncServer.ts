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
import { validateInviteCode, normalizeInviteCode, INVITE_CODE_EQ } from './invitationService';
import { bumpDataVersion } from './dataVersion';
import { getThisDeviceName } from './deviceIdentity';
import { PROTOCOL_VERSION } from '@shega/shared';
import { type PairingHandshakeAck, type MembershipCredential } from '@shega/shared';
import {
  beginJoinChallenge,
  completeJoinChallenge,
  getJoinerCredential,
  issueJoinerCredential,
} from './hubCredentials';
import { markConnected, markFirstSync, markHeartbeat, markDisconnected } from './syncDiagnostics';
import * as Crypto from 'expo-crypto';

export const MOBILE_SYNC_PORT = 5759;

// ─── Handshake-aware join responses ────────────────────────────────────────
// The mobile hub mirrors the desktop path: join submit/status responses now
// include a `handshake` field so the joiner's session tracker can mark the
// connection established immediately instead of waiting for the owner's decision.

function buildMobileHandshakeAck(rec: { requestId?: string | null; status?: string | null; business_id?: string | null } | null, joinerDeviceId?: string): PairingHandshakeAck {
  const hubDeviceId = getDeviceId();
  let businessId: string | null = null;
  let businessName: string | null = null;
  try {
    if (rec?.business_id) businessId = String(rec.business_id);
  } catch { /* cosmetic */ }
  try {
    if (businessId) {
      const db = getDB();
      const biz = db.getFirstSync('SELECT uuid, name FROM businesses WHERE uuid = ? OR id = ? LIMIT 1', [businessId, businessId]) as any;
      businessName = biz?.name ?? null;
    }
  } catch { /* cosmetic */ }
  return {
    ok: true,
    hubDeviceId,
    hubName: getThisDeviceName(),
    hubPlatform: 'mobile',
    hubPort: MOBILE_SYNC_PORT,
    businessId,
    businessName,
    status: (rec?.status ?? 'pending') as PairingHandshakeAck['status'],
    requestId: rec?.requestId ?? null,
    at: Date.now(),
  };
}

interface TcpClient {
  socket: any;
  deviceId: string;
  paired: boolean;
  businessId: string | null;
  lastHeartbeat: number;
  buffer?: string;
  /**
   * P3 handshake state: a challenge is open and this socket owes us a proof.
   *
   * Distinct from `paired`. `paired` used to be set by DEVICE_JOIN_SUBMIT so a
   * joiner could poll its status, which meant a socket that had merely *asked to
   * join* was indistinguishable from one the owner had actually admitted — and
   * every sync handler gates on `paired`. This flag lets a socket be a known
   * joiner without being a granted data channel.
   */
  pendingAuth?: { credential: MembershipCredential; sessionId: string; deviceId: string };
}

const joinWaiters = new Map<string, any>();

// ─── Client liveness reaping ────────────────────────────────────────────────

/**
 * A client that stops heartbeating is presumed dead and dropped.
 *
 * The server relies on the socket's `close`/`error` events to retire clients,
 * but a half-open TCP connection — peer sleeps, Wi-Fi drops without a FIN, NAT
 * silently discards the flow — produces neither. The stale entry then keeps
 * receiving every server broadcast, keeps a stale socket in the connected set
 * reported to the device grid, and makes a genuinely offline device look alive.
 *
 * The client sends a HEARTBEAT every 15s, so 90s is 6 missed beats — long
 * enough to ride out a brief network blip without dropping a healthy peer.
 */
const CLIENT_HEARTBEAT_TIMEOUT_MS = 90_000;
const CLIENT_REAP_INTERVAL_MS = 30_000;
let clientReaper: ReturnType<typeof setInterval> | null = null;

function startClientReaper(): void {
  if (clientReaper) return;
  clientReaper = setInterval(() => {
    const now = Date.now();
    for (const [id, client] of [...clients.entries()]) {
      if (now - client.lastHeartbeat <= CLIENT_HEARTBEAT_TIMEOUT_MS) continue;
      const deviceId = client.paired ? client.deviceId : null;
      console.warn(
        `[MobileSync] Reaping silent client ${id}${deviceId ? ` (${deviceId})` : ''} — ` +
        `no heartbeat for ${Math.round((now - client.lastHeartbeat) / 1000)}s`
      );
      clients.delete(id);
      if (deviceId) touchDevice(deviceId, { status: 'offline' });
      try { client.socket?.destroy?.(); } catch { /* already gone */ }
    }
  }, CLIENT_REAP_INTERVAL_MS);
  // Don't hold the JS runtime awake purely for reaping.
  (clientReaper as any)?.unref?.();
}

function stopClientReaper(): void {
  if (clientReaper) {
    clearInterval(clientReaper);
    clientReaper = null;
  }
}

// ─── Pairing token management ───────────────────────────────────────────────

export function getMobilePairingToken(): string {
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

/**
 * Touch a device's last_seen_at (+ optional status flip) so Connected Devices
 * shows live online/offline presence. Never blows away a 'pending' install
 * unless an explicit status is requested, and never re-activates 'revoked'.
 */
function touchDevice(deviceId: string, opts: { status?: string } = {}): void {
  const db = getDB();
  const now = new Date().toISOString();
  try {
    if (opts.status) {
      db.runSync(
        `UPDATE devices SET last_seen_at = ?, status = CASE WHEN status = 'revoked' THEN status ELSE ? END, updated_at = ?
         WHERE (id = ? OR uuid = ?) AND is_deleted = 0`,
        [now, opts.status, now, deviceId, deviceId]
      );
    } else {
      db.runSync(
        "UPDATE devices SET last_seen_at = ?, updated_at = ? WHERE (id = ? OR uuid = ?) AND is_deleted = 0",
        [now, now, deviceId, deviceId]
      );
    }
  } catch { /* devices table may not exist yet */ }
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
    } else {
      try {
        if (r.row_id != null) {
          const row = db.getFirstSync(`SELECT * FROM ${r.entity} WHERE id = ?`, [r.row_id]) as any;
          if (row) payload = row;
        }
        if (Object.keys(payload).length === 0 && r.entity_uuid) {
          const rowByUuid = db.getFirstSync(`SELECT * FROM ${r.entity} WHERE uuid = ?`, [r.entity_uuid]) as any;
          if (rowByUuid) payload = rowByUuid;
        }
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
      // P0 telemetry: only meaningful once the peer is identified; a heartbeat
      // from an unpaired socket proves liveness but not membership.
      if (client.paired && client.deviceId) {
        markHeartbeat(client.deviceId, { transport: 'lan-tcp' });
      }
      sendTo(client.socket, { type: 'HEARTBEAT_ACK', timestamp: Date.now() });
      break;

    case 'DEVICE_HELLO':
      handleDeviceHello(client, msg);
      break;

    case 'PAIR_REQUEST':
      handlePairRequest(client, msg);
      break;

    case 'AUTH_PROOF':
      void handleAuthProof(client, msg);
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

    case 'PERIPHERAL_REGISTER':
    case 'PERIPHERAL_SCAN_REQUEST':
    case 'PERIPHERAL_CAPTURE_REQUEST':
    case 'PERIPHERAL_SCAN_RESULT':
    case 'PERIPHERAL_CAPTURE_RESULT':
    case 'PERIPHERAL_CANCEL':
    case 'PERIPHERAL_ACK':
    case 'PERIPHERAL_RESPONSE':
    case 'PERIPHERAL_STATUS':
      handlePeripheralMessage(client, msg);
      break;

    default:
      sendError(client.socket, 'UNKNOWN_TYPE', `Unknown message type: ${msg.type}`);
  }
}

function handlePeripheralMessage(senderClient: TcpClient, msg: any): void {
  const targetDeviceId = msg.payload?.targetDeviceId;
  if (targetDeviceId) {
    for (const client of clients.values()) {
      if (client.deviceId === targetDeviceId && client.socket) {
        sendTo(client.socket, msg);
        return;
      }
    }
  }
  for (const client of clients.values()) {
    if (client.socket !== senderClient.socket && client.paired && client.socket) {
      sendTo(client.socket, msg);
    }
  }
}

function handlePairRequest(client: TcpClient, msg: any): void {
  const { device_id, name, token, business_id, credential } = msg.payload || {};
  if (!device_id) {
    sendError(client.socket, 'PAIR_FAILED', 'device_id required');
    return;
  }

  // P3: a presented credential takes the authenticated path. The token check
  // below is the legacy fallback and is only reached when no credential rides
  // along — so a device that has been approved and re-keyed never falls back to
  // a shared bearer secret.
  if (credential) {
    void handleCredentialPairRequest(client, msg, device_id, name, business_id, credential);
    return;
  }

  // Verify pairing token — the token is REQUIRED (no more token-less pairing).
  const hubToken = getMobilePairingToken();
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
       (id, business_id, user_id, name, platform, status, uuid, created_at, updated_at, last_seen_at)
     VALUES (?, ?, NULL, ?, 'mobile', 'pending', ?, ?, ?, ?)`,
    [device_id, bizId, name || device_id.slice(0, 8), device_id, new Date().toISOString(), new Date().toISOString(), new Date().toISOString()]
  );

  client.deviceId = device_id;
  client.paired = true;
  client.businessId = bizId;
  touchDevice(device_id);
  // P0 telemetry: an accepted PAIR_REQUEST is the mobile-hub side of "connected"
  // — the peer is authenticated and bound to a business.
  markConnected(device_id, { transport: 'lan-tcp', role: 'joiner', protocolVersion: PROTOCOL_VERSION });

  sendTo(client.socket, {
    type: 'PAIR_RESPONSE',
    requestId: msg.requestId,
    payload: {
      success: true,
      hubId: getDeviceId(),
      schemaVersion: PROTOCOL_VERSION,
    },
  });

  console.log(`[MobileSync] Device paired: ${device_id} (${name || 'unknown'})`);
}

/**
 * P3 — the credential path of PAIR_REQUEST.
 *
 * Mirrors the desktop hub exactly (see websocket-server.ts): the credential
 * must be one this hub actually issued, the signature is verified over the
 * PRESENTED body so an edited field is caught, and the socket is only marked
 * `paired` after a valid proof arrives.
 */
async function handleCredentialPairRequest(
  client: TcpClient,
  msg: any,
  deviceId: string,
  name: string | undefined,
  businessId: string | undefined,
  credential: MembershipCredential,
): Promise<void> {
  const deny = (reason: string, message: string) => {
    client.pendingAuth = undefined;
    sendTo(client.socket, {
      type: 'AUTH_DENY',
      requestId: msg.requestId,
      payload: { reason, message },
    });
  };

  const stored = await getJoinerCredential(deviceId);
  if (!stored) {
    deny('no_credential', 'No credential found for this device. Re-approval required.');
    return;
  }
  // Must be the exact credential this hub issued. Comparing signatures alone
  // would not catch an edited signed field (e.g. an escalated role leaves the
  // signature untouched), so the presented body is verified below as well.
  if (credential?.signature !== stored.signature) {
    deny('credential_mismatch', 'Credential mismatch. Re-approval required.');
    return;
  }

  const hubBizId = getCurrentBusinessId();
  if (!hubBizId) {
    deny('no_business', 'No active business on this hub');
    return;
  }
  const bizId = credential.businessId || businessId || hubBizId;
  if (bizId !== hubBizId) {
    deny('business_mismatch', 'Business membership mismatch');
    return;
  }

  // A revoked device is refused even with a genuine credential.
  try {
    const row = getDB().getFirstSync(
      "SELECT status FROM devices WHERE id = ? OR uuid = ?", [deviceId, deviceId]
    ) as any;
    if (row && (row.status || '') === 'revoked') {
      deny('revoked', 'Device was unpaired by the owner. A new pairing is required.');
      return;
    }
  } catch { /* devices table may not exist yet */ }

  const begun = await beginJoinChallenge(credential, bizId);
  if ('error' in begun) {
    deny(begun.error, `Credential rejected: ${begun.error}`);
    return;
  }

  client.deviceId = deviceId;
  client.pendingAuth = { credential: stored, sessionId: begun.challenge.sessionId, deviceId };

  sendTo(client.socket, {
    type: 'AUTH_CHALLENGE',
    requestId: msg.requestId,
    payload: begun.challenge,
  });
}

/** P3 — verify the joiner's proof and, on success, grant the socket. */
async function handleAuthProof(client: TcpClient, msg: any): Promise<void> {
  const proof = msg.payload;
  const deny = (reason: string, message: string) => {
    client.pendingAuth = undefined;
    sendTo(client.socket, {
      type: 'AUTH_DENY',
      requestId: msg.requestId,
      payload: { reason, message },
    });
  };

  if (!client.pendingAuth) {
    deny('no_pending_challenge', 'No pending challenge for this connection');
    return;
  }
  const { credential, sessionId, deviceId } = client.pendingAuth;
  if (!proof || proof.sessionId !== sessionId) {
    deny('session_mismatch', 'Session ID mismatch');
    return;
  }

  const res = await completeJoinChallenge(credential, proof);
  if (!res.ok) {
    deny(res.reason || 'invalid_proof', `Authentication failed: ${res.reason || 'invalid_proof'}`);
    try { client.socket?.destroy?.(); } catch { /* already gone */ }
    return;
  }

  client.pendingAuth = undefined;
  const bizId = res.businessId || getCurrentBusinessId();
  try {
    getDB().runSync(
      `INSERT OR REPLACE INTO devices
         (id, business_id, user_id, name, platform, status, uuid, created_at, updated_at, last_seen_at)
       VALUES (?, ?, NULL, ?, 'mobile', 'pending', ?, ?, ?, ?)`,
      [deviceId, bizId, msg.payload?.name || deviceId.slice(0, 8), deviceId,
        new Date().toISOString(), new Date().toISOString(), new Date().toISOString()]
    );
  } catch { /* roster mirror is best-effort */ }

  client.paired = true;
  client.businessId = bizId;
  touchDevice(deviceId);
  markConnected(deviceId, { transport: 'lan-tcp', role: 'joiner', protocolVersion: PROTOCOL_VERSION });

  sendTo(client.socket, {
    type: 'AUTH_OK',
    requestId: msg.requestId,
    payload: { role: res.role, businessId: res.businessId, sessionId },
  });
  sendTo(client.socket, {
    type: 'PAIR_RESPONSE',
    payload: {
      success: true,
      hubId: getDeviceId(),
      schemaVersion: PROTOCOL_VERSION,
    },
  });
  console.log(`[MobileSync] Device authenticated: ${deviceId} (role=${res.role ?? 'unknown'})`);
}

function broadcastChanges(originSocket: any, changes: Change[]): void {
  if (!changes || !changes.length) return;
  for (const client of clients.values()) {
    if (client.socket === originSocket) continue;
    if (client.paired && client.socket) {
      sendTo(client.socket, {
        type: 'SYNC_CHANGES',
        payload: { changes, lastSeq: maxSeq() },
      });
    }
  }
}

export function broadcastServerOutbox(): void {
  if (!clients.size) return;
  const db = getDB();
  const outboxRows = db.getAllSync('SELECT * FROM sync_outbox ORDER BY seq ASC LIMIT 100') as any[];
  if (!outboxRows.length) return;

  const changes: any[] = [];
  const devId = getDeviceId();
  for (const r of outboxRows) {
    let payload: any = {};
    if (r.op === 'DELETE') {
      payload = { id: r.row_id ?? null, uuid: r.entity_uuid, deleted_at: new Date().toISOString() };
    } else if (r.row_id != null) {
      const row = db.getFirstSync(`SELECT * FROM ${r.entity} WHERE id = ?`, [r.row_id]) as any;
      if (row) payload = row;
    }
    if (r.op !== 'DELETE' && Object.keys(payload).length === 0) continue;
    changes.push({ entity: r.entity, entity_uuid: r.entity_uuid, op: r.op, payload, device_id: payload.device_id ?? devId });
  }

  if (changes.length > 0) {
    for (const client of clients.values()) {
      if (client.paired && client.socket) {
        sendTo(client.socket, {
          type: 'SYNC_CHANGES',
          payload: { changes, lastSeq: maxSeq() },
        });
      }
    }
  }
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
  // P0 telemetry: the joiner's batch was merged on the hub, so data has flowed
  // for this link and the first-sync milestone is reached.
  markFirstSync(client.deviceId, { transport: 'lan-tcp', via: 'SYNC_PUSH' });
  sendTo(client.socket, {
    type: 'SYNC_ACK',
    requestId: msg.requestId,
    payload: { ...result, serverSeq: maxSeq() },
  });

  if (changes.length > 0) {
    broadcastChanges(client.socket, changes);
  }
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

// Code normalization is NOT local to this module: `invitations` rows are
// written by invitationService (dashed, e.g. "K2M-4NP-QW8"), joiners submit
// codes typed by hand, and the approval-status poll below re-reads them. Every
// side therefore normalizes through the same helper and the same
// separator-tolerant SQL predicate, or a valid request never matches its row
// and the owner can never approve it.

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
      assigned_permissions TEXT,
      joiner_public_key TEXT,
      poll_token TEXT
    )`);
  for (const col of ['assigned_name TEXT', 'assigned_avatar TEXT', 'assigned_permissions TEXT', 'joiner_public_key TEXT', 'poll_token TEXT']) {
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

/**
 * Identity probe used by LAN sweeps (desktop + mobile).
 *
 * It answers with WHO this device is — never business data, never tokens — so
 * two devices can find each other by knocking on the sync port even when mDNS
 * multicast is blocked by the network. This is what makes discovery work on
 * Windows-firewalled or AP-isolated Wi-Fi.
 */
function handleDeviceHello(client: TcpClient, msg: any): void {
  let businessName: string | null = null;
  let businessId: string | null = null;
  let inviteCode: string | null = null;
  try {
    const db = getDB();
    const biz = db.getFirstSync(
      'SELECT uuid, name FROM businesses WHERE is_deleted = 0 ORDER BY (is_default = 1) DESC, created_at LIMIT 1',
    ) as any;
    businessName = biz?.name ?? null;
    businessId = biz?.uuid ?? null;
  } catch { /* brand-new install has no business yet */ }
  // An open invitation rides along so a joiner on a network with multicast
  // blocked can still join (join-existing.tsx falls back to this when the
  // discovery beacon carried no code).
  //
  // RESIDUAL RISK, stated honestly: DEVICE_HELLO is unauthenticated, so this
  // hands an open invite code to anyone who can reach the port. An earlier
  // comment here claimed "same trust level as the mDNS beacon" — that was
  // wrong, since the mDNS beacon publishes the pairing TOKEN, which is far
  // stronger than an invite code.
  //
  // What this actually costs: a stranger can submit a join request and appear
  // in the owner's approval list. It does NOT grant access — the owner must
  // still approve, and only then is a signed credential issued (P3). So this is
  // a nuisance/spam vector, not a compromise, and removing it would push
  // blocked-multicast joiners onto the code-less radar-tap path instead.
  // Whether to accept that tradeoff is a product call, not a security fix.
  try {
    const row = getDB().getFirstSync(
      "SELECT code FROM invitations WHERE status = 'open' ORDER BY created_at DESC LIMIT 1",
    ) as any;
    inviteCode = row?.code ? String(row.code) : null;
  } catch { /* no open invite */ }
  sendTo(client.socket, {
    type: 'DEVICE_HELLO_ACK',
    requestId: msg.requestId,
    payload: {
      deviceId: getDeviceId(),
      deviceName: getThisDeviceName(),
      platform: 'mobile',
      port: MOBILE_SYNC_PORT,
      businessId,
      businessName,
      inviteCode,
    },
  });
}

function handleJoinSubmit(client: TcpClient, msg: any): void {
  void handleJoinSubmitAsync(client, msg);
}

async function handleJoinSubmitAsync(client: TcpClient, msg: any): Promise<void> {
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
  const stagedRole = p.role ?? inv.role ?? 'cashier';
  // P3: a per-request poll token, returned only to the submitter. See
  // isJoinPollAuthorised for why the unauthenticated join channel cannot treat
  // "approved" as sufficient to hand out a grant.
  const pollToken = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, '');
  if (existing) {
    // A radar-configured joiner may have been staged before it sent its public
    // key; fill it in so approval can still mint a credential.
    if (p.joinerPublicKey) {
      try { db.runSync('UPDATE device_requests SET joiner_public_key = ? WHERE id = ?', [p.joinerPublicKey, existing.id]); } catch { /* column absent on older installs */ }
    }
    // Re-submitting mints a fresh token: the joiner that re-asks is the one
    // that gets to collect, and the old token is invalidated with it.
    try { db.runSync('UPDATE device_requests SET poll_token = ? WHERE id = ?', [pollToken, existing.id]); } catch { /* column absent */ }
  } else {
    db.runSync(
      `INSERT INTO device_requests
         (id, business_id, code, joiner_device_id, joiner_name, joiner_model, joiner_user, role, platform, status, created_at, joiner_public_key, poll_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [requestId, canonicalBizId, normalizeInviteCode(p.code), p.joinerDeviceId, p.joinerName ?? null,
       p.joinerModel ?? null, p.joinerUser ?? 'New Member', stagedRole,
       p.platform ?? 'mobile', new Date().toISOString(), p.joinerPublicKey ?? null, pollToken],
    );
  }
  // NOTE: `paired` is deliberately NOT set here. It used to be, with the
  // comment "joiners may poll status through this connection" — but `paired` is
  // the flag every sync handler gates on, so a socket that had merely ASKED to
  // join was handed a full data channel before the owner approved anything.
  // Polling status needs no such grant: handleJoinStatus is reachable while
  // unpaired, and `client.deviceId` below is all it uses to answer.
  client.deviceId = p.joinerDeviceId;
  joinWaiters.set(p.joinerDeviceId, client.socket);
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
      db.runSync(`UPDATE invitations SET status = 'used' WHERE ${INVITE_CODE_EQ}`, [normalizeInviteCode(p.code)]);
      try {
        const req = db.getFirstSync('SELECT * FROM device_requests WHERE id = ?', [requestId]) as any;
        db.runSync(
          `INSERT OR REPLACE INTO devices (id, business_id, user_id, name, platform, status, uuid, created_at, updated_at, last_seen_at)
           VALUES (?, ?, NULL, ?, ?, 'active', ?, ?, ?, ?)`,
          [p.joinerDeviceId, canonicalBizId, pre.name || p.joinerName || p.joinerDeviceId.slice(0, 8),
           p.platform === 'desktop' ? 'desktop' : 'mobile', p.joinerDeviceId,
           new Date().toISOString(), new Date().toISOString(), new Date().toISOString()],
        );
        void req;
      } catch { /* roster mirror is best-effort */ }

      // P3: approval is the moment the device earns its credential. Issued here
      // as well as on the manual path so an auto-approved joiner is not left on
      // the weaker token flow just because the owner used the radar.
      const autoRole = pre.role ?? p.role ?? inv.role ?? 'cashier';
      const credential = p.joinerPublicKey
        ? await issueJoinerCredential({
            businessId: canonicalBizId,
            deviceId: p.joinerDeviceId,
            devicePublicKey: p.joinerPublicKey,
            role: autoRole,
          })
        : null;
      // The joiner is now genuinely admitted, so this socket may sync. It is set
      // here (not at submit) because auto-approval is a real owner decision.
      client.paired = true;
      client.businessId = canonicalBizId;
      sendTo(client.socket, {
        type: 'DEVICE_JOIN_ACK',
        requestId: msg.requestId,
        payload: {
          requestId,
          status: 'approved',
          // Credential for a P3 joiner, legacy token only for one that sent no
          // public key. Never both — see resolveApprovedCredential's doc comment.
          ...(credential
            ? { credential }
            : (p.joinerPublicKey ? {} : { pairingToken: getMobilePairingToken() })),
          // Returned to the submitter, who must present it to collect the grant
          // on a later status poll.
          pollToken: pollToken,
          handshake: buildMobileHandshakeAck({ requestId, status: 'approved', business_id: canonicalBizId }),
        },
      });
      console.log(`[MobileSync] Device join auto-approved (pre-configured): ${p.joinerDeviceId}`);
      return;
    } catch (e) {
      // A failed auto-approval must not leave the joiner hanging with no
      // answer: fall through to the manual path so the owner sees the request.
      console.warn('[MobileSync] auto-approval failed, falling back to manual:', e);
    }
  }
  sendTo(client.socket, {
    type: 'DEVICE_JOIN_ACK',
    requestId: msg.requestId,
    payload: {
      requestId,
      status: 'pending',
      // The submitter is the only party that learns this; it is what authorises
      // collecting the credential once the owner decides.
      pollToken: pollToken,
      handshake: buildMobileHandshakeAck({ requestId, status: 'pending', business_id: canonicalBizId }),
    },
  });
  console.log(`[MobileSync] Device join staged: ${p.joinerDeviceId} -> ${canonicalBizId}`);
}

function handleJoinStatus(client: TcpClient, msg: any): void {
  void handleJoinStatusAsync(client, msg);
}

async function handleJoinStatusAsync(client: TcpClient, msg: any): Promise<void> {
  const { code, joinerDeviceId, pollToken } = msg.payload || {};
  if (!joinerDeviceId) {
    sendError(client.socket, 'DEVICE_JOIN_FAILED', 'joinerDeviceId required');
    return;
  }
  joinWaiters.set(joinerDeviceId, client.socket);
  ensureJoinTables();
  const db = getDB();
  // Code-less admission lookup (radar-tap admission): the owner tapped the
  // joiner on the radar and admitted by device id alone — there is no invite
  // code the joiner typed, so the status poll keys purely on joiner_device_id.
  const n = code ? normalizeInviteCode(code) : null;
  const row = (n
    ? db.getFirstSync(
        `SELECT * FROM device_requests WHERE ${INVITE_CODE_EQ} AND joiner_device_id = ?
         ORDER BY created_at DESC LIMIT 1`,
        [n, joinerDeviceId],
      )
    : db.getFirstSync(
        `SELECT * FROM device_requests WHERE joiner_device_id = ?
         ORDER BY created_at DESC LIMIT 1`,
        [joinerDeviceId],
      )) as any;
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
    // Only the joiner's own public key, which is public by construction. It is
    // what lets an approval that predates this build still mint a credential.
    joinerPublicKey: row.joiner_public_key ?? null,
  } : null;
  const payload: any = { record };

  if (record && record.status === 'approved') {
    // The grant goes ONLY to the joiner that submitted. This channel is
    // unauthenticated by design (that is what lets an unknown device ask to
    // join), so without this check anyone who learned an approved device id
    // could poll for its credential — and, for a legacy device, the hub-wide
    // pairing token. Such a caller can still read the low-sensitivity record.
    if (!isJoinPollAuthorised(row, pollToken)) {
      console.warn(`[MobileSync] approved join polled without a valid poll token — grant withheld: ${joinerDeviceId}`);
    } else {
      // P3 grant rule (mirrors the desktop's approvalGrant()): a joiner that sent
      // a public key gets the signed credential and nothing else; only a joiner
      // too old to do the handshake gets the legacy bearer token. Handing a
      // modern device both would leave it holding a network-wide shared secret
      // it keeps using, which is exactly what this migration exists to stop.
      const credential = await resolveApprovedCredential(joinerDeviceId, record);
      if (credential) {
        payload.credential = credential;
      } else if (!record.joinerPublicKey) {
        payload.pairingToken = getMobilePairingToken();
      }
    }
  }

  // Explicit connection acknowledgement for the joiner's session tracker.
  payload.handshake = buildMobileHandshakeAck(row);
  sendTo(client.socket, { type: 'DEVICE_JOIN_RESPONSE', requestId: msg.requestId, payload });
}

/**
 * Whether a status poll comes from the joiner that actually submitted.
 *
 * Mirrors the desktop's isJoinPollAuthorised: without it, "approved" would be
 * enough for any caller that knows a device id to collect the credential (or,
 * worse, the hub-wide legacy token).
 */
function isJoinPollAuthorised(row: any, presented: any): boolean {
  const expected = row?.poll_token ? String(row.poll_token) : '';
  if (!expected) return false;
  const given = String(presented ?? '');
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function safeParse(json: string): any {
  try { return JSON.parse(json); } catch { return null; }
}

/**
 * The credential an approved joiner should receive, minting it if needed.
 *
 * Backfills rather than returning null: an approval decided before the joiner
 * sent a public key (or by a build that did not issue one) has nothing stored,
 * and silently downgrading such a device to the bearer token is how the weaker
 * path spread in the first place.
 */
async function resolveApprovedCredential(
  joinerDeviceId: string,
  record: { businessId: string; role?: string | null; joinerPublicKey?: string | null },
): Promise<MembershipCredential | null> {
  const existing = await getJoinerCredential(joinerDeviceId);
  if (existing) return existing;
  if (!record.joinerPublicKey) return null;
  return issueJoinerCredential({
    businessId: String(record.businessId),
    deviceId: joinerDeviceId,
    devicePublicKey: record.joinerPublicKey,
    role: record.role || 'cashier',
  });
}

function handleJoinList(client: TcpClient, msg: any): void {
  const { businessId } = msg.payload || {};
  if (!businessId) { sendError(client.socket, 'DEVICE_JOIN_FAILED', 'businessId required'); return; }
  ensureJoinTables();
  sendTo(client.socket, { type: 'DEVICE_JOIN_RESPONSE', requestId: msg.requestId, payload: { requests: listLocalJoinRequests(String(businessId)) } });
}

function handleJoinDecide(client: TcpClient, msg: any): void {
  void handleJoinDecideAsync(client, msg);
}

async function handleJoinDecideAsync(client: TcpClient, msg: any): Promise<void> {
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
    try { db.runSync(`UPDATE invitations SET status = 'used' WHERE ${INVITE_CODE_EQ}`, [normalizeInviteCode(row.code)]); } catch { /* best-effort */ }
    const now = new Date().toISOString();
    try {
      db.runSync(
        `INSERT OR REPLACE INTO devices (id, business_id, user_id, name, platform, status, uuid, created_at, updated_at, last_seen_at)
         VALUES (?, ?, NULL, ?, ?, 'active', ?, ?, ?, ?)`,
        [row.joiner_device_id, row.business_id, row.joiner_name || row.joiner_device_id.slice(0, 8),
         row.platform === 'desktop' ? 'desktop' : 'mobile', row.joiner_device_id,
         now, now, now],
      );
    } catch { /* roster mirror is best-effort */ }
    touchDevice(row.joiner_device_id);
  }
  const updated = db.getFirstSync('SELECT * FROM device_requests WHERE id = ?', [p.requestId]) as any;
  // P3: mint the credential at the moment of approval so the owner's decision
  // and the device's authentication material are created together. Falling
  // back to the joiner's stored public key covers approvals decided by a build
  // that predates the credential, and by joins staged without a key.
  const issued = p.decision === 'approved' && updated.joiner_public_key
    ? await issueJoinerCredential({
        businessId: String(updated.business_id),
        deviceId: updated.joiner_device_id,
        devicePublicKey: String(updated.joiner_public_key),
        role: updated.role || 'cashier',
      })
    : null;
  const decisionPayload = {
    record: {
      requestId: updated.id,
      businessId: updated.business_id,
      code: updated.code,
      joinerDeviceId: updated.joiner_device_id,
      joinerName: updated.joiner_name,
      joinerModel: updated.joiner_model,
      joinerUser: updated.assigned_name || updated.joiner_user,
      role: updated.role,
      platform: updated.platform,
      status: updated.status,
      createdAt: updated.created_at,
      decidedAt: updated.decided_at,
      assignedName: updated.assigned_name ?? null,
      assignedAvatar: updated.assigned_avatar ?? null,
      assignedPermissions: updated.assigned_permissions ? safeParse(updated.assigned_permissions) : null,
      joinerPublicKey: updated.joiner_public_key ?? null,
    },
    // Legacy token only for a joiner that sent no public key, and never
    // alongside a credential — the same rule as resolveApprovedCredential().
    pairingToken: p.decision === 'approved' && !updated.joiner_public_key ? getMobilePairingToken() : undefined,
    ...(issued ? { credential: issued } : {}),
    handshake: buildMobileHandshakeAck(updated, row.joiner_device_id),
  };

  // 1. Send DECIDE response to Owner
  sendTo(client.socket, {
    type: 'DEVICE_JOIN_RESPONSE',
    requestId: msg.requestId,
    payload: decisionPayload,
  });

  // 2. IMMEDIATELY PUSH decision to Joiner socket (if connected)
  const joinerSocket = joinWaiters.get(row.joiner_device_id);
  if (joinerSocket && joinerSocket !== client.socket) {
    sendTo(joinerSocket, {
      type: 'DEVICE_JOIN_RESPONSE',
      payload: decisionPayload,
    });
    console.log(`[MobileSync] Pushed join decision '${p.decision}' directly to joiner socket: ${row.joiner_device_id}`);
  }

  console.log(`[MobileSync] Device join ${p.decision}: ${row.joiner_device_id}`);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function startMobileSyncServer(): Promise<boolean> {
  // Already listening — stay on (keeps the module-level `server` consistent).
  if (server) return true;
  // Try to use react-native-tcp-socket if available
  try {
    const TcpServer = require('react-native-tcp-socket');
    server = TcpServer.createServer((socket: any) => {
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
        const text = typeof data === 'string' ? data : data.toString('utf8');
        client.buffer = (client.buffer || '') + text;
        let idx: number;
        while ((idx = client.buffer.indexOf('\n')) >= 0) {
          const line = client.buffer.slice(0, idx).trim();
          client.buffer = client.buffer.slice(idx + 1);
          if (line) {
            handleMessage(client, line);
          }
        }
      });

      socket.on('close', () => {
        const wasPaired = client.paired && client.deviceId;
        clients.delete(clientId);
        if (wasPaired) {
          touchDevice(client.deviceId, { status: 'offline' });
          // P0 telemetry: a dropped TCP link is the disconnect half of the
          // mobile-as-hub link-stability story.
          markDisconnected(client.deviceId);
        }
        console.log(`[MobileSync] Client disconnected: ${clientId}`);
      });

      socket.on('error', (err: any) => {
        console.warn(`[MobileSync] Client error: ${err.message}`);
        const wasPaired = client.paired && client.deviceId;
        clients.delete(clientId);
        if (wasPaired) {
          touchDevice(client.deviceId, { status: 'offline' });
          markDisconnected(client.deviceId);
        }
      });

      console.log(`[MobileSync] Client connected: ${clientId}`);
    });

    await new Promise<void>((resolve, reject) => {
      const onListening = () => {
        server?.removeListener?.('error', onError);
        resolve();
      };
      const onError = (error: any) => {
        server?.removeListener?.('listening', onListening);
        reject(error);
      };
      server.once?.('listening', onListening);
      server.once?.('error', onError);
      try {
        server.listen(MOBILE_SYNC_PORT, '0.0.0.0');
      } catch (error) {
        onError(error);
      }
    });
    console.log(`[Discovery] Mobile sync server started on 0.0.0.0:${MOBILE_SYNC_PORT}`);
    startClientReaper();
    return true;
  } catch (e: any) {
    server = null;
    console.warn('[MobileSync] TCP server not available:', e?.message);
    console.log('[MobileSync] Running in client-only mode (no LAN hosting)');
    return false;
  }
}

export function stopMobileSyncServer(): void {
  stopClientReaper();
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

/**
 * Device ids of the clients currently connected to *our* hub.
 *
 * Presence reporting reads this so a device that is genuinely dialled in shows
 * as online. Deriving presence only from the stored `last_seen_at` got this
 * backwards — that column is written at approval and on disconnect, never
 * refreshed while a connection is alive, so a perfectly healthy device was
 * reported offline for the whole time it was connected.
 */
export function getConnectedClientIds(): string[] {
  const out: string[] = [];
  for (const client of clients.values()) {
    if (client.deviceId) out.push(client.deviceId);
  }
  return out;
}

export function getMobileSyncPort(): number {
  return MOBILE_SYNC_PORT;
}
