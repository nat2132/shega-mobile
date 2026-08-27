import { WebSocket } from 'react-native-websocket';
import { EventEmitter } from 'events';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { getDB } from '../database/db';

export interface WsMessage {
  type: string;
  payload?: any;
  requestId?: string;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
}

export interface WsSyncClientConfig {
  hubUrl: string;
  hubToken: string;
  deviceId: string;
  onSyncProgress?: (progress: { pushed: number; pulled: number; conflicts: number }) => void;
  onConflict?: (conflict: any) => void;
  onError?: (error: Error) => void;
}

type SyncEventMap = {
  connected: [];
  disconnected: [Error | null];
  syncCompleted: [SyncResult];
  conflict: [any];
  error: [Error];
  heartbeat: [number];
};

export class WsSyncClient extends EventEmitter<SyncEventMap> {
  private ws: WebSocket | null = null;
  private config: WsSyncClientConfig | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason: any) => void; timeout: NodeJS.Timeout }>();
  private requestCounter = 0;
  private lastServerSeq = 0;
  private isConnected = false;
  private isSyncing = false;
  private messageQueue: { msg: WsMessage; resolve: (value: any) => void; reject: (reason: any) => void }[] = [];

  constructor() {
    super();
  }

  async connect(config: WsSyncClientConfig): Promise<void> {
    if (this.isConnected) return;

    this.config = config;
    this.reconnectAttempts = 0;

    return new Promise((resolve, reject) => {
      const wsUrl = config.hubUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/sync';
      logger.info(`[WS] Connecting to ${wsUrl}`);

      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          logger.info('[WS] Connected to hub');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.processQueue();
          this.sendPairRequest().then(resolve).catch(reject);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = event.data instanceof ArrayBuffer
              ? new TextDecoder().decode(event.data)
              : event.data;
            const msg: WsMessage = JSON.parse(data);
            this.handleMessage(msg);
          } catch (e) {
            logger.warn('[WS] Failed to parse message:', e);
          }
        };

        this.ws.onclose = (event) => {
          logger.warn(`[WS] Disconnected: ${event.code} ${event.reason}`);
          this.handleDisconnect(event.code === 1000 ? null : new Error(`Connection closed: ${event.code}`));
        };

        this.ws.onerror = (error) => {
          logger.error('[WS] Error:', error);
          reject(error);
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  private async sendPairRequest(): Promise<void> {
    if (!this.config) throw new Error('Not configured');

    await this.sendRequest('PAIR_REQUEST', {
      device_id: this.config.deviceId,
      name: 'Shega Mobile',
      token: this.config.hubToken,
    });
  }

  private handleMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'HEARTBEAT':
        this.send({ type: 'HEARTBEAT_ACK', timestamp: Date.now() });
        this.emit('heartbeat', Date.now());
        break;

      case 'HEARTBEAT_ACK':
        // Heartbeat acknowledged
        break;

      case 'PAIR_RESPONSE':
        if (msg.payload?.success) {
          logger.info('[WS] Paired with hub');
          this.lastServerSeq = msg.payload?.serverSeq || 0;
          this.emit('connected');
        } else {
          this.emit('error', new Error(msg.payload?.message || 'Pairing failed'));
        }
        this.resolvePending(msg.requestId, msg.payload);
        break;

      case 'SYNC_ACK':
        this.emit('syncCompleted', {
          pushed: msg.payload?.applied || 0,
          pulled: 0,
          conflicts: msg.payload?.conflicts || 0,
        });
        this.lastServerSeq = msg.payload?.serverSeq || this.lastServerSeq;
        this.resolvePending(msg.requestId, msg.payload);
        break;

      case 'SYNC_CHANGES':
        this.handleIncomingChanges(msg.payload?.changes || []);
        this.lastServerSeq = msg.payload?.lastSeq || this.lastServerSeq;
        this.emit('syncCompleted', {
          pushed: 0,
          pulled: msg.payload?.changes?.length || 0,
          conflicts: 0,
        });
        this.resolvePending(msg.requestId, msg.payload);
        break;

      case 'SYNC_VERIFY_RESPONSE':
        this.resolvePending(msg.requestId, msg.payload);
        break;

      case 'RESYNC_RESPONSE':
        this.resolvePending(msg.requestId, msg.payload);
        break;

      case 'ERROR':
        logger.error('[WS] Server error:', msg.payload);
        this.emit('error', new Error(`${msg.payload?.code}: ${msg.payload?.message}`));
        this.rejectPending(msg.requestId, new Error(msg.payload?.message));
        break;

      default:
        logger.warn('[WS] Unknown message type:', msg.type);
    }
  }

  private async handleIncomingChanges(changes: any[]): Promise<void> {
    const db = getDB();
    if (!changes.length) return;

    // Apply in dependency order
    const APPLY_ORDER = ['categories', 'items', 'item_packs', 'customers', 'sales', 'debt_payments', 'expenses', 'adjustments', 'returns'];
    const sorted = changes.slice().sort((a, b) => {
      const ia = APPLY_ORDER.indexOf(a.entity);
      const ib = APPLY_ORDER.indexOf(b.entity);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    for (const change of sorted) {
      try {
        await this.applyChange(change);
      } catch (e: any) {
        logger.warn('[WS] Apply failed:', change.entity, change.entity_uuid, e?.message);
      }
    }
  }

  private async applyChange(change: any): Promise<void> {
    const db = getDB();
    const { entity, entity_uuid, op, payload, device_id, checksum } = change;

    if (checksum) {
      const expected = await this.computeChecksum({ entity, entity_uuid, op, payload });
      if (checksum !== expected) {
        throw new Error('Checksum mismatch');
      }
    }

    const table = entity;
    const existing = db.getFirstSync(`SELECT * FROM ${table} WHERE uuid = ?`, [entity_uuid]) as any;

    if (op === 'DELETE') {
      if (existing) {
        db.runSync(`UPDATE ${table} SET is_deleted = 1, deleted_at = COALESCE(?, deleted_at) WHERE uuid = ?`, [
          payload?.deleted_at ?? new Date().toISOString(),
          entity_uuid,
        ]);
      }
      return;
    }

    if (!existing) {
      const insertData = { ...payload };
      delete insertData.id;
      insertData.uuid = entity_uuid;
      insertData.device_id = device_id ?? (await this.getDeviceId());
      insertData.updated_at = insertData.updated_at ?? new Date().toISOString();

      const cols = Object.keys(insertData).filter(c => c in insertData);
      const placeholders = cols.map(() => '?').join(', ');
      db.runSync(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, cols.map(c => insertData[c]));
      return;
    }

    // LWW conflict resolution
    const incoming = { ...payload, uuid: entity_uuid, updated_at: payload.updated_at ?? new Date().toISOString() };
    if (this.lwwWins(incoming, existing)) {
      const updateData = { ...payload };
      delete updateData.id;
      updateData.device_id = device_id ?? (await this.getDeviceId());
      const cols = Object.keys(updateData).filter(c => c in updateData && c !== 'id' && c !== 'uuid');
      if (cols.length) {
        const sets = cols.map(c => `${c} = ?`).join(', ');
        db.runSync(`UPDATE ${table} SET ${sets} WHERE uuid = ?`, [...cols.map(c => updateData[c]), entity_uuid]);
      }
    }
  }

  private lwwWins(incoming: Record<string, any>, existing: Record<string, any>): boolean {
    const iTs = (incoming.updated_at ?? incoming.createdAt ?? '') as string;
    const eTs = (existing.updated_at ?? existing.createdAt ?? '') as string;
    if (iTs !== eTs) return iTs > eTs;
    const iVer = Number(incoming.row_version ?? 0);
    const eVer = Number(existing.row_version ?? 0);
    if (iVer !== eVer) return iVer > eVer;
    return String(incoming.uuid ?? '') >= String(existing.uuid ?? '');
  }

  private async computeChecksum(change: { entity: string; entity_uuid: string; op: string; payload: Record<string, any> }): Promise<string> {
    const canonical = `${change.entity}|${change.entity_uuid}|${change.op}|${JSON.stringify(change.payload)}`;
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical);
  }

  private async getDeviceId(): Promise<string> {
    const db = getDB();
    const row = db.getFirstSync('SELECT device_id FROM sync_meta WHERE id = 1') as any;
    if (row?.device_id) return row.device_id;
    const id = Crypto.randomUUID();
    db.runSync('INSERT OR REPLACE INTO sync_meta (id, device_id) VALUES (1, ?)', [id]);
    return id;
  }

  async syncNow(): Promise<SyncResult> {
    if (!this.isConnected || this.isSyncing) {
      return { pushed: 0, pulled: 0, conflicts: 0 };
    }

    this.isSyncing = true;
    let totalPushed = 0;
    let totalPulled = 0;
    let totalConflicts = 0;

    try {
      // Push outbox
      const { changes, seqs } = await this.buildChangesFromOutbox();
      if (changes.length > 0) {
        const pushResult = await this.sendRequest('SYNC_PUSH', { changes, client_seq: this.lastServerSeq });
        totalPushed = pushResult.applied || 0;
        totalConflicts = pushResult.conflicts || 0;

        const db = getDB();
        db.runSync('DELETE FROM sync_outbox WHERE seq IN (' + seqs.map(() => '?').join(',') + ')', seqs);
      }

      // Pull changes
      const pullResult = await this.sendRequest('SYNC_PULL', { since: this.lastServerSeq });
      totalPulled = pullResult.changes?.length || 0;

      const result: SyncResult = { pushed: totalPushed, pulled: totalPulled, conflicts: totalConflicts };
      this.emit('syncCompleted', result);
      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  private async buildChangesFromOutbox(): Promise<{ changes: any[]; seqs: number[] }> {
    const db = getDB();
    const rows = db.getAllSync('SELECT * FROM sync_outbox ORDER BY seq ASC LIMIT 300') as any[];
    const changes: any[] = [];
    const seqs: number[] = [];

    for (const row of rows) {
      if (row.op === 'DELETE') {
        const payload: any = { id: row.row_id ?? null, uuid: row.entity_uuid, deleted_at: new Date().toISOString() };
        const checksum = await this.computeChecksum({ entity: row.entity, entity_uuid: row.entity_uuid, op: row.op, payload });
        changes.push({ entity: row.entity, entity_uuid: row.entity_uuid, op: row.op, payload, checksum });
        seqs.push(row.seq);
      } else if (row.row_id != null) {
        const r = getDB().getFirstSync(`SELECT * FROM ${row.entity} WHERE id = ?`, [row.row_id]) as any;
        if (r) {
          const payload: any = {};
          const cols = Object.keys(r);
          for (const c of cols) payload[c] = r[c];
          const checksum = await this.computeChecksum({ entity: row.entity, entity_uuid: row.entity_uuid, op: row.op, payload });
          changes.push({ entity: row.entity, entity_uuid: row.entity_uuid, op: row.op, payload, checksum });
          seqs.push(row.seq);
        }
      }
    }

    return { changes, seqs };
  }

  private async sendRequest(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 30000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      const msg = { type, payload, requestId };
      this.send({ type, payload, requestId });
    });
  }

  private resolvePending(requestId: string | undefined, payload: any): void {
    if (!requestId) return;
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.resolve(payload);
    }
  }

  private rejectPending(requestId: string | undefined, error: Error): void {
    if (!requestId) return;
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.reject(error);
    }
  }

  private send(msg: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg);
    }
  }

  private processQueue(): void {
    while (this.messageQueue.length && this.ws?.readyState === WebSocket.OPEN) {
      const msg = this.messageQueue.shift();
      if (msg) this.send(msg);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'HEARTBEAT', timestamp: Date.now() });
      }
    }, 15000);
  }

  private handleDisconnect(error: Error | null): void {
    this.isConnected = false;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.emit('disconnected', error);

    // Auto-reconnect with exponential backoff
    if (this.reconnectAttempts < 10) {
      const delay = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts), 30000);
      this.reconnectAttempts++;
      setTimeout(() => this.connect(this.config!), delay);
    }
  }

  async disconnect(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  get isConnectedNow(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// Simple logger
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[WS] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WS] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[WS] ${msg}`, ...args),
};

interface WsSyncClientEvents {
  connected: [];
  disconnected: [Error | null];
  syncCompleted: [any];
  conflict: [any];
  error: [Error];
}

export const wsSyncClient = new (class extends EventEmitter<WsSyncClientEvents> {
  private instance: WsSyncClient | null = null;

  async connect(config: any) {
    if (this.instance) await this.instance.disconnect();
    this.instance = new WsSyncClient();
    this.instance.on('connected', () => this.emit('connected'));
    this.instance.on('disconnected', (err) => this.emit('disconnected', err));
    this.instance.on('syncCompleted', (r) => this.emit('syncCompleted', r));
    this.instance.on('conflict', (c) => this.emit('conflict', c));
    this.instance.on('error', (e) => this.emit('error', e));
    return this.instance.connect(config);
  }

  async syncNow() {
    return this.instance?.syncNow() ?? { pushed: 0, pulled: 0, conflicts: 0 };
  }

  async disconnect() {
    await this.instance?.disconnect();
    this.instance = null;
  }

  get isConnected() {
    return this.instance?.isConnectedNow ?? false;
  }
})();