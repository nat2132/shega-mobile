import { EventEmitter } from 'events';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { getDB } from '../database/db';
import { applyChange, APPLY_ORDER, CORE_BUSINESS_SCOPED_ENTITIES, resolveLocalBusinessId, persistPeerDevice, getHubSeqCursor, setHubSeqCursor } from './syncService';
import { DEVICE_JOIN_MSG, PERIPHERAL_MSG, changeChecksum, computeReceiptWatermark, pruneableSeqs, type ReceiptedChange } from '@shega/shared';
import { markConnected, markFirstSync, markHeartbeat, markDisconnected, setPeerCounters } from './syncDiagnostics';
import { getJoinerHandle, acceptMembershipCredential } from './joinCredentials';

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
  timestamp?: number;
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
  syncStarted: [];
  syncCompleted: [SyncResult];
  conflict: [any];
  error: [Error];
  heartbeat: [number];
};

function sanitizePayload(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'bigint') return Number(obj);
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload);

  const clean: Record<string, any> = {};
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    if (val === undefined) continue;
    if (typeof val === 'bigint') {
      clean[k] = Number(val);
    } else if (val instanceof Date) {
      clean[k] = val.toISOString();
    } else if (typeof val === 'object' && val !== null) {
      clean[k] = sanitizePayload(val);
    } else {
      clean[k] = val;
    }
  }
  return clean;
}

export class WsSyncClient extends EventEmitter {
  private ws: any = null;
  private config: WsSyncClientConfig | null = null;
  private reconnectAttempts = 0;
  private reconnectDelay = 2000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private cappingAttempts = 0;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason: any) => void; timeout: ReturnType<typeof setTimeout> }>();
  private requestCounter = 0;
  /**
   * Highest hub outbox seq this device holds durably — the contiguous applied
   * prefix with no holes.
   *
   * This doubles as the pull cursor and as the value receipted via SYNC_APPLIED.
   * They must be the same number: a hole (a change that failed to apply) has to
   * be re-requested on the next pull AND must keep its row alive in the hub, so
   * advancing one without the other would either lose changes or prune changes
   * this device never merged. Persisted in sync_cursor, shared with the LAN
   * transport, so an app restart resumes the prefix instead of restarting from
   * zero (which would stall every future receipt).
   */
  private ackedUpto = 0;
  private _isConnected = false;
  private isSyncing = false;
  private messageQueue: any[] = [];

  /** Max one reconnect per 30s while offline — satisfies (3.4.2) graceful decay. */
  private readonly MAX_RECONNECT_DELAY_MS = 30_000;

  /**
   * Monotonic id of the socket that currently owns the connection.
   *
   * Every handler installed on a socket captures the id it was created with and
   * no-ops when it no longer matches. Without this, a socket that was already
   * superseded (e.g. its 1500ms connect timeout fired, we reconnected, then the
   * abandoned socket finally emitted `close`) would run `handleDisconnect()` and
   * tear down the *healthy* newer socket, leaving the client permanently
   * flapping between "connected" and "reconnecting".
   */
  private socketGeneration = 0;

  /**
   * Liveness watchdog. TCP does not always tell us when a peer goes away: a
   * phone that walks out of Wi-Fi range, or a router that reboots, silently
   * black-holes packets instead of sending FIN/RST, so `onclose`/`onerror` never
   * fire and the socket stays `OPEN` forever. The UI then claims "Connected"
   * while nothing syncs and nothing reconnects — the single most common cause of
   * "it says connected but I have to restart the app".
   *
   * The client already sends HEARTBEAT every 15s, so liveness is: if we have
   * sent a heartbeat and heard no HEARTBEAT/HEARTBEAT_ACK back within
   * HEARTBEAT_TIMEOUT_MS, the link is dead — close it and let the normal
   * backoff reconnect path run.
   */
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private awaitingAckSince: number | null = null;
  private lastInboundAt = 0;
  private readonly HEARTBEAT_INTERVAL_MS = 15_000;
  private readonly HEARTBEAT_TIMEOUT_MS = 45_000;

  /**
   * Terminal authorization failure. A revoked device or a wrong pairing token
   * can never succeed by retrying, so we must stop hammering the hub and tell
   * the user to re-pair. Cleared by an explicit `connect()` (i.e. a deliberate
   * new attempt) but never by a reconnect tick.
   */
  private authBlocked: { reason: string } | null = null;

  constructor() {
    super();
  }

  async connect(config: WsSyncClientConfig): Promise<void> {
    // A deliberate connect is the user (or the pairing flow) asking for a fresh
    // attempt, so it clears a previous terminal auth failure.
    this.authBlocked = null;

    if (this._isConnected || this.config) {
      // A config already exists (a reconnect timer is armed or a socket is up);
      // this call is a *kick* from connectivity restore — reconnect immediately.
      this.retryNow();
      return;
    }

    this.config = config;
    this.reconnectAttempts = 0;
    try {
      await this.openSocket();
    } catch (e: any) {
      logger.info('[WS] Initial connect notice:', e?.message || 'closed');
    }
  }

  /**
   * Open a fresh socket to the configured hub. Capped exponential backoff grows
   * across failures and only resets once the connection succeeds (onopen), so
   * recovery is instant when the hub returns (attempts reset) yet never hammers
   * an unreachable hub faster than every ~30s (3.4.1/3.4.2).
   */
  private async openSocket(): Promise<void> {
    if (!this.config) throw new Error('Not configured');
    // A revoked/incorrectly-paired device must not keep retrying: no amount of
    // backoff will ever turn a rejected token into an accepted one.
    if (this.authBlocked) {
      logger.warn('[WS] Not reconnecting — authorization blocked:', this.authBlocked.reason);
      return;
    }
    const config = this.config;
    const gen = ++this.socketGeneration;
    const isStale = () => gen !== this.socketGeneration;

    return new Promise((resolve, reject) => {
      const wsUrl = config.hubUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/sync';
      logger.info(`[WS] Connecting to ${wsUrl}`);

      try {
        const WS =
          (typeof require === 'function' ? (require('react-native-websocket') as any)?.WebSocket : undefined) ??
          (globalThis as any).WebSocket;
        if (!WS) {
          const err = new Error('[WS] No WebSocket implementation available.');
          logger.warn(err.message);
          reject(err);
          return;
        }

        // Fast 1500ms timeout for LAN socket connection
        let connTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          if (isStale()) return;
          if (this.ws && !this._isConnected) {
            logger.warn(`[WS] Connection timeout after 1500ms for ${wsUrl}`);
            try { this.ws.close(); } catch {}
            reject(new Error('WS connection timeout'));
          }
        }, 1500);

        this.ws = new WS(wsUrl);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = async () => {
          if (isStale()) { try { this.ws?.close(); } catch {} return; }
          if (connTimer) { clearTimeout(connTimer); connTimer = null; }
          logger.info('[WS] Connected to hub');
          this._isConnected = true;
          this.reconnectAttempts = 0;
          this.lastInboundAt = Date.now();
          this.startHeartbeat();
          this.processQueue();

          const token = await this.getEffectiveToken();
          if (token) {
            try {
              await this.sendPairRequest();
              resolve();
            } catch (e: any) {
              const reason = String(e?.message || e || 'pairing failed');
              // A rejected token, a denied credential, or a revoked device is
              // terminal: stop retrying and tell the UI a fresh pairing is
              // required, instead of looping forever on an error that can never
              // resolve itself. Note the credential reasons are NOT free-form —
              // they are the shared verifier's codes, so a revoked or tampered
              // credential blocks here instead of reconnect-looping.
              if (/invalid pairing token|pairing token required|required a new pairing|unpaired by the owner|^revoked$|^bad_signature$|^untrusted_issuer$|^business_mismatch$|^credential expired$|no credential found|credential mismatch|re-approval required/i.test(reason)) {
                this.authBlocked = { reason };
                this.emit('error', new Error(reason));
                logger.error('[WS] Pairing rejected — reconnect disabled until re-pair:', reason);
              } else {
                logger.warn('[WS] PAIR failed on open socket:', reason);
              }
              if (isStale()) return;
              try { this.ws?.close(); } catch { /* onclose still fires */ }
              reject(new Error(reason));
            }
          } else {
            logger.info('[WS] Connected as unpaired joiner (awaiting owner approval)');
            this.emit('connected');
            resolve();
          }
        };

        this.ws.onmessage = (event: any) => {
          if (isStale()) return;
          this.lastInboundAt = Date.now();
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
          if (connTimer) { clearTimeout(connTimer); connTimer = null; }
          // A superseded socket closing must NOT tear down the live connection.
          if (isStale()) return;
          logger.warn(`[WS] Disconnected: ${event.code} ${event.reason}`);
          this.handleDisconnect(event.code === 1000 ? null : new Error(`Connection closed: ${event.code}`));
        };

        this.ws.onerror = (error: any) => {
          if (connTimer) { clearTimeout(connTimer); connTimer = null; }
          if (isStale()) return;
          logger.info('[WS] Notice:', error?.message || 'socket closed');
          reject(error);
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  /** Immediately (re)connect now instead of waiting for the next timer. */
  retryNow(): void {
    if (this._isConnected) return;
    if (!this.config) return;
    if (this.authBlocked) {
      logger.warn('[WS] retryNow ignored — authorization blocked:', this.authBlocked.reason);
      return;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.openSocket().catch((e) => logger.warn('[WS] retryNow connect failed:', e?.message));
  }

  private async getEffectiveToken(): Promise<string> {
    let token = this.config?.hubToken ?? '';
    if (!token.trim()) {
      try {
        const asyncStorage = require('@react-native-async-storage/async-storage');
        const storage = asyncStorage.default ?? asyncStorage;
        const raw = await storage.getItem('shega:rejoinBundle');
        const bundle = raw ? JSON.parse(raw) : null;
        if (bundle?.pairingToken) {
          token = bundle.pairingToken;
        }
      } catch { /* no bundle */ }
    }
    return token.trim();
  }

  private async sendPairRequest(): Promise<void> {
    if (!this.config) throw new Error('Not configured');
    const token = await this.getEffectiveToken();
    if (!token) return;

    const payload: Record<string, unknown> = {
      device_id: this.config.deviceId,
      name: 'Shega Mobile',
      platform: 'mobile',
      token,
    };

    // P3: present the membership credential when this device has one. The hub
    // answers with a challenge instead of PAIR_RESPONSE, and the token becomes
    // a fallback rather than the only thing standing between a stranger and
    // the business data.
    const handle = await getJoinerHandle();
    if (handle) {
      payload.credential = handle.joiner.getCredential();
    }

    const res = await this.sendRequest('PAIR_REQUEST', payload);

    if (res?.__msgType === 'AUTH_CHALLENGE') {
      await this.answerChallenge(res);
    }
  }

  /**
   * Answer the hub's challenge (P3).
   *
   * The proof is signed over the hub's own transcript, so a hub that swaps its
   * advertised key or replays an old nonce produces a signature that does not
   * verify. `answer()` refuses outright if the advertised verifier key is not
   * the credential's issuer — that is the one place a joiner can notice it is
   * talking to someone who is not the device that signed its credential.
   */
  private async answerChallenge(challenge: any): Promise<void> {
    const handle = await getJoinerHandle();
    if (!handle) {
      throw new Error('Hub requested an authenticated handshake but this device has no credential');
    }
    const proof = handle.joiner.answer(challenge);
    const res = await this.sendRequest('AUTH_PROOF', proof);
    if (res?.__msgType === 'AUTH_DENY') {
      throw new Error(String(res.reason || 'authentication denied'));
    }
    logger.info('[WS] Authenticated handshake completed');
  }

  private handleMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'HEARTBEAT':
        this.send({ type: 'HEARTBEAT_ACK', timestamp: Date.now() });
        // P0 telemetry: an inbound heartbeat proves the link is alive, which is
        // exactly what the liveness watchdog uses to re-arm.
        markHeartbeat('desktop-hub', { transport: 'lan-ws' });
        this.emit('heartbeat', Date.now());
        break;

      case 'HEARTBEAT_ACK':
        // The hub acknowledges our heartbeat. Purely informational: no state
        // change, no echo (an ACK never re-triggers a push), so just measure
        // round-trip latency for the connection-health gauge.
        this.emit('heartbeatAck', Date.now() - (msg.timestamp ?? 0));
        break;

      case 'PAIR_RESPONSE':
        if (msg.payload?.success) {
          logger.info('[WS] Paired with hub');
          // Seed the durable prefix from local storage. It must NOT be the hub's
          // current max seq: that is what the hub has produced, not what this
          // device holds, and pulling `since = hubMax` would skip everything
          // written while this device was away. sync_cursor is the real
          // high-water mark, so a restart resumes the prefix rather than
          // restarting the receipt sequence at 0 (which would stall receipts).
          this.ackedUpto = getHubSeqCursor();
          // Persist the rejoin bundle (pairing token + last server seq) so a
          // reopened app can re-dial the hub by token instead of requiring a
          // fresh radar tap + admin re-approve. The hub's approve-by-code path
          // (p2p:approve, pairingToken filter) accepts this token directly.
          try {
            const saved = {
              hubUrl: this.config?.hubUrl || '',
              // The token we just authenticated WITH is the hub's pairing
              // token (handlePairRequest compares it to getPairingToken()) —
              // PAIR_RESPONSE never echoes it, so read it from our config.
              pairingToken: String(this.config?.hubToken || '').trim().toUpperCase(),
              // Informational only (nothing reads it back); record what the hub
              // has produced, not what this device has applied.
              serverSeq: Number(msg.payload?.serverSeq || 0),
            };
            const asyncStorage = require('@react-native-async-storage/async-storage');
            const storage = asyncStorage.default ?? asyncStorage;
            // handleMessage is sync — fire-and-forget the write.
            storage.setItem('shega:rejoinBundle', JSON.stringify(saved))
              .catch((e: unknown) => console.warn('[WS] Failed to save rejoin bundle:', e));
            logger.info('[WS] Saved rejoin bundle for token-based re-dial');
          } catch (e) {
            console.warn('[WS] Failed to save rejoin bundle:', e);
          }
          // Persist the hub as a peer device so it appears in Connected Devices
          // and we can reconnect to it after app restarts.
          try {
            const hubUrl = this.config?.hubUrl || '';
            const hubDeviceId = hubUrl.match(/\/([a-f0-9-]+)$/)?.[1] || 'desktop-hub';
            persistPeerDevice({
              deviceId: hubDeviceId,
              name: 'Shega Desktop Hub',
              platform: 'desktop',
              businessId: resolveLocalBusinessId() ?? undefined,
            });
          } catch (e) {
            console.warn('[WS] Failed to persist hub device:', e);
          }
          this.emit('connected');
          // P0 telemetry: PAIR_RESPONSE is the point the link is authenticated
          // and the resume cursor is seeded, so this is "connected".
          markConnected('desktop-hub', {
            transport: 'lan-ws',
            hubUrl: this.config?.hubUrl || '',
            protocolVersion: msg.payload?.schemaVersion,
          });
          this.flushPendingInvitePublishes().catch(() => {});
          // Trigger immediate sync on connection to exchange pending outbox/remote changes
          this.syncNow().catch(() => {});
        } else {
          this.emit('error', new Error(msg.payload?.message || 'Pairing failed'));
        }
        this.resolvePending(msg.requestId, msg.payload, msg.type);
        break;

      case 'AUTH_CHALLENGE':
        // Handled by answerChallenge() via the pending PAIR_REQUEST, but a hub
        // may also send one out of band. Resolve the waiter so the flow cannot
        // stall on a 30s timeout.
        this.resolvePending(msg.requestId, msg.payload, 'AUTH_CHALLENGE');
        break;

      case 'AUTH_OK':
        this.resolvePending(msg.requestId, msg.payload, 'AUTH_OK');
        break;

      case 'AUTH_DENY':
        // Terminal for this credential: a denial is a real decision by the hub,
        // so stop reconnecting until the owner re-approves.
        this.authBlocked = { reason: String(msg.payload?.reason || 'authentication denied') };
        this.emit('error', new Error(this.authBlocked.reason));
        this.resolvePending(msg.requestId, msg.payload, 'AUTH_DENY');
        break;

      case 'SYNC_ACK':
        this.emit('syncCompleted', {
          pushed: msg.payload?.applied || 0,
          pulled: 0,
          conflicts: msg.payload?.conflicts || 0,
        });
        // P0 telemetry: a SYNC_ACK means our push reached the hub and was
        // merged, so data has flowed in both directions on this link.
        markFirstSync('desktop-hub', { transport: 'lan-ws', via: 'SYNC_ACK' });
        setPeerCounters('desktop-hub', { cursor: this.ackedUpto ?? null });
        // Do NOT advance the cursor here — the serverSeq in SYNC_ACK is the
        // hub's max outbox seq AFTER applying our push. Advancing would skip
        // the subsequent SYNC_PULL (since would be the new max, so our own
        // pushes would never echo back). handleIncomingChanges advances it.
        this.resolvePending(msg.requestId, msg.payload, msg.type);
        break;

      case 'SYNC_CHANGES':
        // The receipt must be derived from what actually applied, so this is
        // awaited before the ack is sent (previously the apply was fire-and-
        // forget and the cursor advanced regardless of failures).
        //
        // The cursor is deliberately NOT set to `lastSeq` here: a change that
        // failed to apply would then never be re-requested, and its row would
        // sit in the hub forever. handleIncomingChanges advances it only over
        // the contiguous prefix that actually merged.
        this.handleIncomingChanges(msg.payload?.changes || [], !!msg.payload?.snapshot, Number(msg.payload?.lastSeq || 0))
          .then(() => {
            this.emit('syncCompleted', {
              pushed: 0,
              pulled: msg.payload?.changes?.length || 0,
              conflicts: 0,
            });
            // P0 telemetry: the batch was applied and the durable prefix
            // advanced, so this is the "first sync" milestone.
            markFirstSync('desktop-hub', { transport: 'lan-ws', via: 'SYNC_CHANGES' });
            setPeerCounters('desktop-hub', { cursor: this.ackedUpto ?? null });
            this.resolvePending(msg.requestId, msg.payload, msg.type);
          })
          .catch((e: any) => {
            // Never advance the cursor on an unexpected failure: the hub keeps
            // the rows, and the next pull re-delivers them.
            logger.warn('[WS] Incoming batch failed:', e?.message);
            this.resolvePending(msg.requestId, msg.payload, msg.type);
          });
        break;

      case 'DATA_CHANGED':
        // Live push from the hub: some other device just pushed data. Pull it
        // now rather than waiting for the timer. Consumers subscribe to
        // 'dataChanged' to refresh UI.
        // Do NOT advance lastServerSeq here — the SYNC_CHANGES response will
        // update it to the correct lastSeq after we apply the new changes.
        // Advancing before the pull would skip exactly the changes that were
        // just announced (since snapshotSince returns seq > since).
        this.emit('dataChanged', msg.payload);
        this.syncNow().catch(() => {});
        break;

      case DEVICE_JOIN_MSG.ACK:
      case DEVICE_JOIN_MSG.RESPONSE:
        // P3: an approved decision carries the signed membership credential.
        // Store it here — this is the only channel that delivers it, and the
        // next connection's challenge is answered from it. Fire-and-forget:
        // handleMessage is synchronous and the joiner's own flow does not wait
        // on the keystore write.
        if (msg.payload?.credential) {
          acceptMembershipCredential(msg.payload.credential)
            .then((ok) => {
              // Deliberately NOT a markConnected() call: holding a credential is
              // authorization, not connectivity. P0 telemetry treats PAIR_RESPONSE
              // as the "connected" milestone and this must not move it earlier.
              logger.info(ok
                ? '[WS] Stored membership credential for authenticated handshakes'
                : '[WS] Rejected membership credential — not issued to this device');
            })
            .catch((e) => logger.warn('[WS] credential store failed:', e));
        }
        this.emit('joinDecision', msg.payload);
        this.resolvePending(msg.requestId, msg.payload, msg.type);
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
        this.resolvePending(msg.requestId, msg.payload, msg.type);
        break;

      case 'SYNC_VERIFY_RESPONSE':
        this.resolvePending(msg.requestId, msg.payload, msg.type);
        break;

      case 'INVITE_RESPONSE':
        this.resolvePending(msg.requestId, msg.payload, msg.type);
        break;

      case 'RESYNC_RESPONSE':
        this.resolvePending(msg.requestId, msg.payload, msg.type);
        break;

      case 'P2P_SIGNAL':
        // WebRTC signaling (SDP/ICE) relayed by the hub — business data never
        // travels this path.
        try { this.emit('signal', msg.payload?.signal ?? msg.payload); } catch {}
        break;

      case 'ERROR':
        if (msg.payload?.code === 'NOT_PAIRED' || msg.payload?.code === 'PAIR_FAILED') {
          logger.info('[WS] Server response:', msg.payload?.message || msg.payload?.code);
        } else {
          logger.error('[WS] Server error:', msg.payload);
        }
        this.emit('error', new Error(`${msg.payload?.code}: ${msg.payload?.message}`));
        this.rejectPending(msg.requestId, new Error(msg.payload?.message));
        if (!msg.requestId && (msg.payload?.code === 'PAIR_FAILED' || msg.payload?.code === 'NOT_PAIRED')) {
          try { this.ws?.close(); } catch { /* onclose still fires */ }
        }
        break;

      default:
        logger.warn('[WS] Unknown message type:', msg.type);
    }
  }

  /**
   * Advances the durable prefix (pull cursor + receipt high-water mark) and
   * persists it. Only ever called with a value at or below the last receipt, so
   * it can move forward but never regress or skip a hole.
   */
  private advanceDurablePrefix(next: number, failedSeqs: number[] = []): void {
    if (!(next > this.ackedUpto)) return;
    this.ackedUpto = next;
    try {
      setHubSeqCursor(next);
    } catch (e: any) {
      // A failed persist only costs a re-pull; the receipt is still truthful.
      logger.warn('[WS] Failed to persist sync cursor:', e?.message);
    }
    this.sendAppliedAck(next, failedSeqs);
  }

  private async handleIncomingChanges(changes: any[], isSnapshot = false, batchLastSeq = 0): Promise<void> {
    if (!changes.length) {
      // An empty incremental batch still advances the receipt: there is nothing
      // outstanding at or below lastSeq. Without this the hub would hold rows
      // this client has already seen for a batch that legitimately had none.
      if (!isSnapshot) this.advanceDurablePrefix(batchLastSeq);
      return;
    }

    const sorted = changes.slice().sort((a: any, b: any) => {
      const ia = APPLY_ORDER.indexOf(a.entity);
      const ib = APPLY_ORDER.indexOf(b.entity);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    // Apply in dependency order but report the receipt in seq order — the hub
    // only understands "everything up to N", so the watermark math is shared
    // with the LAN transport rather than reimplemented here.
    const applied: ReceiptedChange[] = [];
    for (const change of sorted) {
      const seq = Number(change?.seq);
      try {
        await this.applyChange(change);
        applied.push({ seq, outcome: 'applied' });
      } catch (e: any) {
        logger.warn('[WS] Apply failed:', change.entity, change.entity_uuid, e?.message);
        applied.push({ seq, outcome: 'failed' });
      }
    }

    const { ackedUpto, failedSeqs } = computeReceiptWatermark(
      this.ackedUpto,
      applied,
      batchLastSeq,
      { isSnapshot },
    );
    this.advanceDurablePrefix(ackedUpto, failedSeqs);
  }

  /**
   * Tells the hub that changes up to `ackedUpto` are durable here, so it may
   * prune them once every other active peer has confirmed the same. Sent
   * fire-and-forget: a lost receipt only costs a redundant re-delivery, since
   * applying the same change twice is idempotent.
   */
  private sendAppliedAck(ackedUpto: number, failedSeqs: number[]): void {
    if (ackedUpto <= 0) return;
    this.send({
      type: 'SYNC_APPLIED',
      payload: { acked_upto: ackedUpto, failed_seqs: failedSeqs },
    });
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
    return changeChecksum(change);
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
    // P3: attach this device's public key so the hub can issue a membership
    // credential when the owner approves. Without it the approval can only
    // grant the legacy token, and the next connection stays unauthenticated.
    let joinerPublicKey: string | undefined;
    try {
      const deviceId = String(payload?.joinerDeviceId ?? this.config?.deviceId ?? await this.getDeviceId());
      const { getDevicePublicKey } = require('./deviceKeys');
      joinerPublicKey = (await getDevicePublicKey(deviceId)) ?? undefined;
    } catch (e) {
      logger.warn('[WS] could not read device public key for join submit:', e);
    }
    return this.sendRequest(DEVICE_JOIN_MSG.SUBMIT, { ...payload, ...(joinerPublicKey ? { joinerPublicKey } : {}) });
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

  onJoinDecision(fn: (payload: any) => void): () => void {
    this.on('joinDecision', fn);
    return () => this.off('joinDecision', fn);
  }

  async publishInvitation(payload: any): Promise<any> {
    if (!this._isConnected) {
      // Offline-first: stage the invite locally so it reaches the hub on the
      // next successful pair (the wizard's tap is otherwise silently lost).
      this.stagePendingInvitePublish(payload);
      return { published: true, queued: true, relayed: false };
    }
    try {
      return await this.sendRequest(DEVICE_JOIN_MSG.PUBLISH, payload);
    } catch (e) {
      this.stagePendingInvitePublish(payload);
      throw e;
    }
  }

  /**
   * Persist a not-yet-published invitation so it can be flushed once this
   * client connects to (and pairs with) the LAN hub. Idempotent per invite id.
   */
  private stagePendingInvitePublish(payload: any): void {
    try {
      const db = getDB();
      const row = db.getFirstSync(
        `SELECT value FROM app_settings WHERE key = 'pending_invite_publishes'`) as any;
      let list: any[] = [];
      try { list = JSON.parse(row?.value ?? '[]'); } catch { list = []; }
      if (!payload?.id) return;
      list = list.filter((p: any) => p?.id !== payload.id);
      list.push(payload);
      db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
        ['pending_invite_publishes', JSON.stringify(list.slice(-25))]);
      logger.info(`[WS] Queued invite publish ${payload.id} for the next hub connection`);
    } catch (e: any) {
      logger.warn('[WS] Could not stage pending invite publish:', e?.message);
    }
  }

  /** Push every queued invite publish to the hub (requires a paired socket). */
  private async flushPendingInvitePublishes(): Promise<void> {
    let list: any[] = [];
    try {
      const db = getDB();
      const row = db.getFirstSync(
        `SELECT value FROM app_settings WHERE key = 'pending_invite_publishes'`) as any;
      try { list = JSON.parse(row?.value ?? '[]'); } catch { list = []; }
      if (!list.length) return;
      const ok: string[] = [];
      for (const p of list) {
        try {
          await this.sendRequest(DEVICE_JOIN_MSG.PUBLISH, p);
          ok.push(p.id);
          logger.info(`[WS] Flushed queued invite publish ${p.id}`);
        } catch (e: any) {
          logger.warn(`[WS] Flush failed for invite ${p?.id}:`, e?.message);
        }
      }
      const remaining = list.filter((p: any) => !ok.includes(p.id));
      db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
        ['pending_invite_publishes', JSON.stringify(remaining)]);
    } catch (e: any) {
      logger.warn('[WS] Could not flush pending invite publishes:', e?.message);
    }
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

    const token = await this.getEffectiveToken();
    if (!token) {
      return { pushed: 0, pulled: 0, conflicts: 0 };
    }

    this.isSyncing = true;
    // Lifecycle notification hook: UI can show "sync started" when this fires.
    try { this.emit('syncStarted', {}); } catch { /* never break sync */ }
    let totalPushed = 0;
    let totalPulled = 0;
    let totalConflicts = 0;

    try {
      const { changes, seqs } = await this.buildChangesFromOutbox();
      if (changes.length > 0) {
        // The hub folds this into its per-connection pull baseline, so it must be
        // the durable prefix (what actually merged here), never the hub's max.
        const pushResult = await this.sendRequest('SYNC_PUSH', { changes, client_seq: this.ackedUpto });
        totalPushed = pushResult.applied || 0;
        totalConflicts = pushResult.conflicts || 0;

        const db = getDB();
        // Prune only rows the hub explicitly merged. A seq the hub did not report
        // is unknown, not success, so it stays queued; and an unconfirmed row caps
        // the prune so one permanent failure cannot discard the changes above it.
        const outcome = Array.isArray(pushResult.results)
          ? new Map(
              (pushResult.results as { client_seq: number | null; status: string }[])
                // A row without a client_seq can't correspond to any queued
                // change, so it carries no information about what may be pruned.
                .filter((r): r is { client_seq: number; status: string } => r.client_seq != null)
                .map((r) => [r.client_seq, r.status]),
            )
          : null;
        const prune = pruneableSeqs(seqs, outcome);
        if (prune.length) {
          db.runSync('DELETE FROM sync_outbox WHERE seq IN (' + prune.map(() => '?').join(',') + ')', prune);
        }
      }

      // Pull from the durable prefix, not the hub's max: a change that failed to
      // apply leaves a hole, and the hub must re-deliver it next time.
      const pullResult = await this.sendRequest('SYNC_PULL', { since: this.ackedUpto });
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

  private resolvePending(requestId: string | undefined, payload: any, msgType?: string): void {
    if (!requestId) return;
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      // Flatten the handshake ack onto the resolved payload so callers that
      // track a pairing session see the connection acknowledged immediately.
      // `__msgType` is the message TYPE, which the payload cannot always supply:
      // the P3 handshake turns one request into a challenge, and the caller has
      // to know which of the two replies it just got.
      pending.resolve({ ...payload, __msgType: msgType });
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
      try {
        const sanitized = sanitizePayload(msg);
        this.ws.send(JSON.stringify(sanitized));
      } catch (e: any) {
        logger.warn('[WS] Failed to serialize message:', e?.message);
      }
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
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        this.send({ type: 'HEARTBEAT', timestamp: Date.now() });
        this.armHeartbeatWatchdog();
      }
    }, this.HEARTBEAT_INTERVAL_MS);
    this.lastInboundAt = Date.now();
  }

  /**
   * Arm the liveness deadline. Any inbound frame (ACK, data, push) calls
   * `lastInboundAt` and implicitly proves the link is alive, so the watchdog is
   * re-armed from `lastInboundAt` rather than from when the heartbeat was sent.
   */
  private armHeartbeatWatchdog(): void {
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    this.heartbeatTimeout = setTimeout(() => {
      this.heartbeatTimeout = null;
      if (!this._isConnected) return;
      const silentFor = Date.now() - (this.lastInboundAt || Date.now());
      if (silentFor < this.HEARTBEAT_TIMEOUT_MS) {
        // Traffic arrived after arming — still healthy, wait for the next beat.
        this.armHeartbeatWatchdog();
        return;
      }
      logger.warn(`[WS] Heartbeat timeout — no traffic for ${Math.round(silentFor / 1000)}s, treating link as dead`);
      // Force the socket closed so the normal onclose → handleDisconnect path
      // runs and the capped backoff reconnects. Without this the socket stays
      // OPEN forever on a silently dropped network.
      try { this.ws?.close(); } catch { /* fall through to explicit handling */ }
      this.handleDisconnect(new Error('Connection lost: no heartbeat response'));
    }, this.HEARTBEAT_TIMEOUT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
    this.awaitingAckSince = null;
  }

  private handleDisconnect(error: Error | null): void {
    // Invalidate in-flight handlers: the socket that is going away must not be
    // able to clobber a socket opened by the reconnect that follows.
    this.socketGeneration++;
    this._isConnected = false;
    this.stopHeartbeat();
    // P0 telemetry: a disconnect is the other half of the reconnect story — the
    // diagnostics view needs the gap to judge link stability.
    markDisconnected('desktop-hub');

    // Reject in-flight requests so callers (and their UI spinners) do not hang
    // until their own timeout expires on a connection that is already gone.
    this.rejectAllPending('Connection lost');

    this.emit('disconnected', error);

    // An explicit disconnect() or a terminal auth failure must not be followed
    // by a reconnect: there is nothing to reconnect to, and retrying an
    // unrecoverable error forever is what produced "Reconnecting…" that never
    // resolves.
    if (!this.config) return;
    if (this.authBlocked) return;

    // Exponential backoff with jitter. Without jitter, every device that lost
    // the same hub at the same moment retries in lockstep and re-creates the
    // thundering herd the delay exists to prevent.
    const base = Math.min(
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts),
      this.MAX_RECONNECT_DELAY_MS,
    );
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.reconnectAttempts++;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.config) return;
      this.openSocket().catch((e) => logger.warn('[WS] reconnect failed:', e?.message));
    }, delay);
    logger.info(`[WS] Reconnecting in ${Math.round(delay / 100) / 10}s (attempt ${this.reconnectAttempts})`);
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // Invalidate before closing so the socket's own onclose is ignored and
    // cannot arm a reconnect for a connection we are deliberately tearing down.
    this.socketGeneration++;
    if (this.ws) {
      try { this.ws.close(); } catch { /* already gone */ }
      this.ws = null;
    }
    this.config = null;
    this._isConnected = false;
    this.authBlocked = null;
    this.rejectAllPending('Disconnected');
  }

  /** True when the hub rejected our credentials — a new pairing is required. */
  get isAuthorizationBlocked(): boolean {
    return this.authBlocked !== null;
  }

  get authorizationBlockReason(): string | null {
    return this.authBlocked?.reason ?? null;
  }

  private rejectAllPending(reason: string): void {
    for (const [, pending] of this.pendingRequests) {
      if (pending.timeout) clearTimeout(pending.timeout);
      try { pending.reject(new Error(reason)); } catch { /* already settled */ }
    }
    this.pendingRequests.clear();
  }

  get isConnectedNow(): boolean {
    return this._isConnected && this.ws?.readyState === 1;
  }

  /** True once a hub endpoint is known, even while the socket is down. */
  get hasConfig(): boolean {
    return this.config !== null;
  }
}

// Singleton wrapper
export const wsSyncClient = new (class extends EventEmitter {
  private instance: WsSyncClient | null = null;
  /** Instance events are forwarded once; re-wiring would duplicate every event. */
  private wired = false;
  /**
   * True once this facade has opened a socket (as opposed to merely kicking an
   * already-configured client). Only the owner should tear the connection down;
   * a component that merely re-rendered must not drop a live hub connection.
   */
  private ownsConnection = false;

  private ensureInstance(): WsSyncClient {
    if (!this.instance) this.instance = new WsSyncClient();
    if (!this.wired) {
      this.wired = true;
      this.instance.on('connected', () => this.emit('connected'));
      this.instance.on('disconnected', (err: any) => this.emit('disconnected', err));
      this.instance.on('syncCompleted', (r: any) => this.emit('syncCompleted', r));
      this.instance.on('conflict', (c: any) => this.emit('conflict', c));
      this.instance.on('error', (e: any) => this.emit('error', e));
    }
    return this.instance;
  }

  async connect(config: any) {
    // Reuse a live instance instead of building a new one. The previous
    // behaviour tore down the socket (and every in-flight request, cursor and
    // pending PAIR) on each call, so a re-run of the owning effect — a hub-URL
    // change, a settings toggle, a remount — became a full reconnect that also
    // discarded state. `instance.connect()` is already idempotent: with a
    // config present it becomes a `retryNow()` kick.
    const wasConfigured = this.instance?.isConnectedNow || (this.instance?.hasConfig ?? false);
    const res = await this.ensureInstance().connect(config);
    if (!wasConfigured) this.ownsConnection = true;
    return res;
  }

  /**
   * Release the connection only if this facade is the one that opened it.
   * A passive caller that merely re-rendered must not drop a live socket.
   */
  async disconnectIfOwner() {
    if (!this.ownsConnection) return;
    this.ownsConnection = false;
    await this.disconnect();
  }

  async syncNow() {
    return this.instance?.syncNow() ?? { pushed: 0, pulled: 0, conflicts: 0 };
  }

  /** Force an immediate reconnect attempt (network restore / app resume). */
  retryNow() {
    this.instance?.retryNow();
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
    this.wired = false;
    this.ownsConnection = false;
  }

  get isConnected() {
    return this.instance?.isConnectedNow ?? false;
  }

  /**
   * True when the hub rejected this device's credentials. Retrying cannot fix
   * it — the user has to pair again — so the UI must say so instead of showing
   * an endless "Reconnecting…".
   */
  get isAuthorizationBlocked() {
    return this.instance?.isAuthorizationBlocked ?? false;
  }

  get authorizationBlockReason() {
    return this.instance?.authorizationBlockReason ?? null;
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
