import { EventEmitter } from 'events';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { getDB } from '../database/db';
import { applyChange, APPLY_ORDER, CORE_BUSINESS_SCOPED_ENTITIES, resolveLocalBusinessId } from './syncService';
import { DEVICE_JOIN_MSG, PERIPHERAL_MSG } from '@shega/shared';

// Simple logger (defined before first use)
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[WS] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WS] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[WS] ${msg}`, ...args),
};

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

export class WsSyncClient extends EventEmitter {
  private ws: any = null;
  private config: WsSyncClientConfig | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason: any) => void; timeout: ReturnType<typeof setTimeout> }>();
  private requestCounter = 0;
  private lastServerSeq = 0;
  private _isConnected = false;
  private isSyncing = false;
  private messageQueue: any[] = [];

  constructor() {
    super();
  }

  async connect(config: WsSyncClientConfig): Promise<void> {
    if (this._isConnected) return;

    this.config = config;
    this.reconnectAttempts = 0;

    return new Promise((resolve, reject) => {
      const wsUrl = config.hubUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/sync';
      logger.info(`[WS] Connecting to ${wsUrl}`);

      try {
        // Dynamic import for react-native-websocket
        const WS = require('react-native-websocket').WebSocket;
        this.ws = new WS(wsUrl);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          logger.info('[WS] Connected to hub');
          this._isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.processQueue();
          this.sendPairRequest().then(resolve).catch(reject);
        };

        this.ws.onmessage = (event: any) => {
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

        this.ws.onclose = (event: any) => {
          logger.warn(`[WS] Disconnected: ${event.code} ${event.reason}`);
          this.handleDisconnect(event.code === 1000 ? null : new Error(`Connection closed: ${event.code}`));
        };

        this.ws.onerror = (error: any) => {
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
      platform: 'mobile',
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

      case 'DATA_CHANGED':
        // Live push from the hub: some other device just pushed data. Pull it
        // now rather than waiting for the timer. Consumers subscribe to
        // 'dataChanged' to refresh UI.
        this.lastServerSeq = typeof msg.payload?.serverSeq === 'number' ? Math.max(this.lastServerSeq, msg.payload.serverSeq) : this.lastServerSeq;
        this.emit('dataChanged', msg.payload);
        this.syncNow().catch(() => {});
        break;

      case DEVICE_JOIN_MSG.ACK:
      case DEVICE_JOIN_MSG.RESPONSE:
        this.resolvePending(msg.requestId, msg.payload);
        break;

      case PERIPHERAL_MSG.HELLO:
        // Hub accepts phone peripherals — announce our capabilities.
        this.registerAsPeripheral().catch((e) => logger.warn('[WS] peripheral register failed', e));
        break;

      case PERIPHERAL_MSG.SCAN_REQUEST:
        this.emit('peripheralScanRequest', msg.payload);
        break;

      case PERIPHERAL_MSG.CAPTURE_REQUEST:
        this.emit('peripheralCaptureRequest', msg.payload);
        break;

      case PERIPHERAL_MSG.CANCEL:
        this.emit('peripheralCancel', msg.payload);
        break;

      case PERIPHERAL_MSG.ACK:
      case PERIPHERAL_MSG.RESPONSE:
        this.resolvePending(msg.requestId, msg.payload);
        break;

      case 'SYNC_VERIFY_RESPONSE':
        this.resolvePending(msg.requestId, msg.payload);
        break;

      case 'INVITE_RESPONSE':
        this.resolvePending(msg.requestId, msg.payload);
        break;

      case 'RESYNC_RESPONSE':
        this.resolvePending(msg.requestId, msg.payload);
        break;

      case 'P2P_SIGNAL':
        // WebRTC signaling (SDP/ICE) relayed by the hub — business data never
        // travels this path.
        try { this.emit('signal', msg.payload?.signal ?? msg.payload); } catch {}
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
    if (!changes.length) return;

    const sorted = changes.slice().sort((a: any, b: any) => {
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
    const { entity, entity_uuid, op, payload, checksum } = change;

    if (checksum) {
      const expected = await this.computeChecksum({ entity, entity_uuid, op, payload });
      if (checksum !== expected) {
        throw new Error('Checksum mismatch');
      }
    }

    // Delegate to the shared apply path (column filter, business scoping, FK
    // remapping, echo-outbox pruning, LWW) so WS pulls behave exactly like
    // HTTP pulls.
    applyChange(change);
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

  async submitDeviceJoinRequest(payload: any): Promise<any> {
    if (!this._isConnected) throw new Error('Not connected to hub');
    return this.sendRequest(DEVICE_JOIN_MSG.SUBMIT, payload);
  }

  async listDeviceJoinRequests(businessId: string): Promise<any[]> {
    if (!this._isConnected) throw new Error('Not connected to hub');
    const res = await this.sendRequest(DEVICE_JOIN_MSG.LIST, { businessId });
    return res?.requests ?? [];
  }

  async decideDeviceJoinRequest(payload: any): Promise<any> {
    if (!this._isConnected) throw new Error('Not connected to hub');
    return this.sendRequest(DEVICE_JOIN_MSG.DECIDE, payload);
  }

  async publishInvitation(payload: any): Promise<any> {
    if (!this._isConnected) throw new Error('Not connected to hub');
    return this.sendRequest(DEVICE_JOIN_MSG.PUBLISH, payload);
  }

  async resolveInvitation(code: string): Promise<any> {
    if (!this._isConnected) throw new Error('Not connected to hub');
    return this.sendRequest(DEVICE_JOIN_MSG.RESOLVE, { code });
  }

  async checkDeviceJoinStatus(code: string, joinerDeviceId: string): Promise<any> {
    if (!this._isConnected) throw new Error('Not connected to hub');
    return this.sendRequest(DEVICE_JOIN_MSG.STATUS, { code, joinerDeviceId });
  }

  // ---------- Desktop user invites (QR join) ----------

  /** Claim a desktop-generated user invite code on the LAN hub. */
  async claimHubInvite(code: string, name: string, joinerDeviceId: string): Promise<any> {
    if (!this._isConnected) throw new Error('Not connected to hub');
    return this.sendRequest('INVITE_CLAIM', { code, name, joinerDeviceId });
  }

  /** Poll the owner's decision on a claimed desktop user invite. */
  async getHubInviteStatus(code: string): Promise<any> {
    if (!this._isConnected) throw new Error('Not connected to hub');
    return this.sendRequest('INVITE_STATUS', { code });
  }

  // ---------- P2P signaling (WebRTC setup only — no business data) ----------

  /** Subscribe to relayed WebRTC signaling messages from the hub. */
  onSignal(fn: (msg: any) => void): () => void {
    this.on('signal', fn);
    return () => this.off('signal', fn);
  }

  /** Send a signaling message to a peer via the hub (to='__broadcast__' floods). */
  sendSignal(toDeviceId: string, signal: any): void {
    if (!this._isConnected) return;
    this.send({ type: 'P2P_SIGNAL', payload: { to: toDeviceId, signal } });
  }

  /** Raw message send for status beacons (queued if socket drops). */
  sendRaw(msg: { type: string; payload: any }): void {
    this.send(msg);
  }

  /** Tell the hub this phone is no longer available as a peripheral. */
  unregisterPeripheral(): void {
    if (!this._isConnected) return;
    const { getThisDeviceId } = require('@/services/businessService');
    this.send({
      type: PERIPHERAL_MSG.REGISTER,
      payload: { deviceId: getThisDeviceId() || this.config?.deviceId, kinds: [] },
    });
  }

  // ---------- Phone-peripheral (scanner / camera for the desktop POS) ----------

  /** Announce this phone as an available scanner/camera to the hub. */
  async registerAsPeripheral(kinds: string[] = ['scanner', 'camera']): Promise<any> {
    if (!this._isConnected) throw new Error('Not connected to hub');
    const { getThisDeviceId } = await import('@/services/businessService');
    return this.sendRequest(PERIPHERAL_MSG.REGISTER, {
      deviceId: getThisDeviceId() || this.config?.deviceId,
      name: 'Shega Mobile',
      model: Platform.OS === 'ios' ? 'iPhone' : 'Android',
      platform: 'mobile',
      kinds,
    });
  }

  /** Answer a desktop scan request with the scanned barcode. */
  sendScanResult(requestId: string, barcode: string, symbology?: string): void {
    const { getThisDeviceId } = require('@/services/businessService');
    this.send({
      type: PERIPHERAL_MSG.SCAN_RESULT,
      payload: { requestId, barcode, symbology, deviceId: getThisDeviceId() || this.config?.deviceId },
    });
  }

  /** Answer a desktop capture request (photo data URL or scanned text). */
  sendCaptureResult(requestId: string, result: { dataUrl?: string; text?: string; mode: string; cancelled?: boolean }): void {
    const { getThisDeviceId } = require('@/services/businessService');
    this.send({
      type: PERIPHERAL_MSG.CAPTURE_RESULT,
      payload: { ...result, requestId, deviceId: getThisDeviceId() || this.config?.deviceId },
    });
  }

  get isConnectedToHub(): boolean {
    return this._isConnected;
  }

  async syncNow(): Promise<SyncResult> {
    if (!this._isConnected || this.isSyncing) {
      return { pushed: 0, pulled: 0, conflicts: 0 };
    }

    this.isSyncing = true;
    let totalPushed = 0;
    let totalPulled = 0;
    let totalConflicts = 0;

    try {
      const { changes, seqs } = await this.buildChangesFromOutbox();
      if (changes.length > 0) {
        const pushResult = await this.sendRequest('SYNC_PUSH', { changes, client_seq: this.lastServerSeq });
        totalPushed = pushResult.applied || 0;
        totalConflicts = pushResult.conflicts || 0;

        const db = getDB();
        // Prune only rows the hub merged. Per-change outcomes arrive keyed to
        // client_seq; without them fall back to deleting on success. Pending/
        // skipped rows (e.g. unresolved item FK) stay queued for retry.
        const outcome = Array.isArray(pushResult.results)
          ? new Map((pushResult.results as { client_seq: number | null; status: string }[]).map((r) => [r.client_seq, r.status]))
          : null;
        const prune = outcome
          ? seqs.filter((seq) => {
              const status = outcome.get(seq);
              return status === 'applied' || status === 'conflict' || status === undefined;
            })
          : seqs;
        if (prune.length) {
          db.runSync('DELETE FROM sync_outbox WHERE seq IN (' + prune.map(() => '?').join(',') + ')', prune);
        }
      }

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
        changes.push({ entity: row.entity, entity_uuid: row.entity_uuid, op: row.op, payload, checksum, client_seq: row.seq });
        seqs.push(row.seq);
      } else if (row.row_id != null) {
        const r = getDB().getFirstSync(`SELECT * FROM ${row.entity} WHERE id = ?`, [row.row_id]) as any;
        if (r) {
          const payload: any = {};
          const cols = Object.keys(r);
          for (const c of cols) payload[c] = r[c];
          if (CORE_BUSINESS_SCOPED_ENTITIES.includes(row.entity) && payload.businessId == null) {
            payload.businessId = resolveLocalBusinessId();
          }
          const checksum = await this.computeChecksum({ entity: row.entity, entity_uuid: row.entity_uuid, op: row.op, payload });
          changes.push({ entity: row.entity, entity_uuid: row.entity_uuid, op: row.op, payload, checksum, client_seq: row.seq });
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
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg);
    }
  }

  private processQueue(): void {
    while (this.messageQueue.length && this.ws && this.ws.readyState === 1) {
      const msg = this.messageQueue.shift();
      if (msg) this.send(msg);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        this.send({ type: 'HEARTBEAT', timestamp: Date.now() });
      }
    }, 15000);
  }

  private handleDisconnect(error: Error | null): void {
    this._isConnected = false;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.emit('disconnected', error);

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts), 30000);
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
    this._isConnected = false;
  }

  get isConnectedNow(): boolean {
    return this._isConnected && this.ws?.readyState === 1;
  }
}

// Singleton wrapper
export const wsSyncClient = new (class extends EventEmitter {
  private instance: WsSyncClient | null = null;

  async connect(config: any) {
    if (this.instance) await this.instance.disconnect();
    this.instance = new WsSyncClient();
    this.instance.on('connected', () => this.emit('connected'));
    this.instance.on('disconnected', (err: any) => this.emit('disconnected', err));
    this.instance.on('syncCompleted', (r: any) => this.emit('syncCompleted', r));
    this.instance.on('conflict', (c: any) => this.emit('conflict', c));
    this.instance.on('error', (e: any) => this.emit('error', e));
    return this.instance.connect(config);
  }

  async syncNow() {
    return this.instance?.syncNow() ?? { pushed: 0, pulled: 0, conflicts: 0 };
  }

  async submitDeviceJoinRequest(payload: any) {
    return this.instance?.submitDeviceJoinRequest(payload);
  }

  async listDeviceJoinRequests(businessId: string) {
    return this.instance?.listDeviceJoinRequests(businessId) ?? [];
  }

  async decideDeviceJoinRequest(payload: any) {
    return this.instance?.decideDeviceJoinRequest(payload);
  }

  async publishInvitation(payload: any) {
    return this.instance?.publishInvitation(payload);
  }

  async resolveInvitation(code: string) {
    return this.instance?.resolveInvitation(code);
  }

  async checkDeviceJoinStatus(code: string, joinerDeviceId: string) {
    return this.instance?.checkDeviceJoinStatus(code, joinerDeviceId);
  }

  async claimHubInvite(code: string, name: string, joinerDeviceId: string) {
    return this.instance?.claimHubInvite(code, name, joinerDeviceId);
  }

  async getHubInviteStatus(code: string) {
    return this.instance?.getHubInviteStatus(code);
  }

  async disconnect() {
    await this.instance?.disconnect();
    this.instance = null;
  }

  get isConnected() {
    return this.instance?.isConnectedNow ?? false;
  }

  // Peripheral pass-through — forward instance events + methods
  onPeripheralEvent(event: string, handler: (...args: any[]) => void) {
    this.instance?.on(event, handler);
    return () => this.instance?.off(event, handler);
  }

  // P2P signaling pass-through
  onSignal(fn: (msg: any) => void): () => void {
    const h = (payload: any) => fn(payload?.signal ?? payload);
    this.instance?.on('signal', h);
    this.on('signal', fn);
    return () => {
      this.instance?.off('signal', h);
      this.off('signal', fn);
    };
  }

  sendSignal(toDeviceId: string, signal: any) {
    this.instance?.sendSignal(toDeviceId, signal);
  }

  registerAsPeripheral(kinds?: string[]) {
    return this.instance?.registerAsPeripheral(kinds);
  }

  unregisterPeripheral() {
    this.instance?.unregisterPeripheral();
  }

  sendRaw(msg: { type: string; payload: any }) {
    this.instance?.sendRaw(msg);
  }

  sendScanResult(requestId: string, barcode: string, symbology?: string) {
    this.instance?.sendScanResult(requestId, barcode, symbology);
  }

  sendCaptureResult(requestId: string, result: { dataUrl?: string; text?: string; mode: string; cancelled?: boolean }) {
    this.instance?.sendCaptureResult(requestId, result);
  }
})();
