/**
 * Shega UDP Discovery Engine (Mobile side) — Sub-millisecond LAN/Hotspot Discovery.
 *
 * Bypasses mDNS multicast lock restrictions and sequential TCP IP sweeps by using
 * UDP broadcast on port 5756.
 *
 * - Listens for `SHEGA_PING` broadcasts from mobile or desktop devices.
 * - Answers immediately with `SHEGA_PONG` carrying device identity and open invite code.
 * - Broadcasts `SHEGA_PING` to 255.255.255.255 and subnet broadcast addresses for instant peer discovery.
 */

import { EventEmitter } from 'events';
import { getDeviceId } from './syncService';
import { getThisDeviceName } from './deviceIdentity';
import { getDB } from '../database/db';

export const UDP_DISCOVERY_PORT = 5756;

/** bind() is async; a silent failure must not leave the socket half-open forever. */
const BIND_TIMEOUT_MS = 2_500;

export interface DiscoveredUdpPeer {
  deviceId: string;
  deviceName: string;
  platform: 'desktop' | 'mobile';
  host: string;
  port: number;
  inviteCode?: string | null;
  beacon: {
    v: number;
    businessId: string;
    businessName: string;
    owner: { deviceId: string; deviceName: string; platform: 'desktop' | 'mobile' };
    code: string;
    role: 'owner';
    expiresAt: string;
    suggestedRole: string;
  };
  discoveredAt: number;
}

/**
 * UTF-8 byte length of a string.
 *
 * `String.length` counts UTF-16 code units, so any device name outside ASCII
 * (Amharic business names, Arabic, emoji) reports a SHORTER length than the
 * packet actually occupies on the wire. Passing that as the send length
 * truncates the JSON mid-token and the receiver's JSON.parse fails, so the peer
 * is never discovered.
 */
function utf8Bytes(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { bytes += 4; i += 1; } // surrogate pair
    else bytes += 3;
  }
  return bytes;
}

function getOpenInviteCode(): string | null {
  try {
    const row = getDB().getFirstSync(
      "SELECT code FROM invitations WHERE status = 'open' ORDER BY created_at DESC LIMIT 1"
    ) as any;
    return row?.code ? String(row.code) : null;
  } catch {
    return null;
  }
}

/** Load the TCP module once and remember whether it can do UDP at all. */
let cachedTcpSocket: any | undefined;
let cachedHasCreateSocket = false;
function loadTcpSocket(): any | null {
  if (cachedTcpSocket !== undefined) return cachedTcpSocket;
  try {
    const mod = require('react-native-tcp-socket');
    cachedTcpSocket = mod ?? null;
    cachedHasCreateSocket = typeof mod?.createSocket === 'function';
  } catch {
    cachedTcpSocket = null;
    cachedHasCreateSocket = false;
  }
  return cachedTcpSocket;
}

class MobileUdpDiscoveryService extends EventEmitter {
  private socket: any = null;
  private running = false;
  /** True between createSocket() and the bind callback. */
  private binding = false;
  /** The platform's TCP module has no datagram API — UDP discovery is inert. */
  private unavailable = false;
  private seen = new Map<string, DiscoveredUdpPeer>();

  /**
   * Whether UDP discovery can actually run. False on builds where
   * react-native-tcp-socket exposes no `createSocket` (the shipped 6.x line),
   * which is the whole UDP surface on React Native today.
   */
  isSupported(): boolean {
    loadTcpSocket();
    return cachedHasCreateSocket && !this.unavailable;
  }

  start(port = UDP_DISCOVERY_PORT): void {
    if (this.unavailable) return;
    // Re-entry guard. A second start() while a bind is in flight replaced
    // this.socket with a second descriptor and orphaned the first — the old
    // socket kept emitting 'message' with nothing reading it, and every
    // retry burned a file descriptor until the process ran out.
    if (this.running || this.binding) return;

    const TcpSocket = loadTcpSocket();
    if (!TcpSocket?.createSocket) {
      // react-native-tcp-socket@6.4.3 exports connect/createServer/
      // createConnection only — `createSocket` does not exist and there is no
      // datagram support in the Android/iOS native modules either. Previously
      // this returned silently, so every caller believed UDP discovery was
      // running while no socket was ever bound: the phone never received a
      // desktop PING, never answered, and never appeared via UDP.
      this.unavailable = true;
      return;
    }

    let socket: any;
    try {
      socket = TcpSocket.createSocket({ type: 'udp4' });
      this.socket = socket;
      this.binding = true;

      let settled = false;
      let bindTimer: ReturnType<typeof setTimeout> | null = null;
      const settle = (bound: boolean) => {
        if (settled) return;
        settled = true;
        if (bindTimer) clearTimeout(bindTimer);
        this.binding = false;
        if (!bound) {
          // Failed or timed out — drop the half-open socket so the next start()
          // can retry cleanly rather than leak a descriptor per attempt.
          try { socket?.close?.(); } catch { /* already gone */ }
          if (this.socket === socket) this.socket = null;
        }
      };

      socket.on('error', (err: any) => {
        console.warn('[UDP Discovery] Socket error:', err?.message);
        settle(false);
      });

      socket.on('message', (msg: any, rinfo: any) => {
        const raw = typeof msg === 'string' ? msg : msg.toString('utf8');
        this.handleMessage(raw, rinfo.address, rinfo.port);
      });

      // Without a deadline a bind that never calls back leaves `running` false
      // forever: broadcastPing() would keep "restarting" a bind that can never
      // complete and no packet would ever leave the phone.
      bindTimer = setTimeout(() => {
        console.warn(`[UDP Discovery] bind on UDP port ${port} timed out`);
        settle(false);
      }, BIND_TIMEOUT_MS);

      socket.bind(port, () => {
        // The deadline already gave up on this socket: settle(false) ran,
        // nulled this.socket and cleared `binding`. Adopting it here would set
        // `running` while this.socket is null, so every later sendBurst() would
        // bail on the null socket and start() would refuse to rebuild it — a
        // permanently dead discovery engine. Close it and let the next
        // broadcastPing() retry from scratch.
        if (settled) {
          try { socket?.close?.(); } catch { /* already gone */ }
          return;
        }
        try {
          socket?.setBroadcast?.(true);
        } catch { /* ignore */ }
        // `running === true` now implies this.socket is a live bound socket.
        this.running = true;
        console.log(`[UDP Discovery] Mobile listening on UDP port ${port}`);
        settle(true);
      });
    } catch (e: any) {
      this.binding = false;
      console.warn('[UDP Discovery] Failed to bind mobile UDP socket:', e?.message);
    }
  }

  stop(): void {
    if (!this.running && !this.binding) return;
    this.running = false;
    this.binding = false;
    try {
      this.socket?.close?.();
    } catch { /* ignore */ }
    this.socket = null;
    this.seen.clear();
  }

  /**
   * Resolve once the socket is actually listening, or false once the bind has
   * definitively failed/timed out. Callers MUST gate their first send on this:
   * `bind()` only flips `running` inside its callback, so a synchronous burst
   * right after `start()` used to be dropped on the floor every time.
   */
  private whenReady(timeoutMs = BIND_TIMEOUT_MS): Promise<boolean> {
    if (this.running) return Promise.resolve(true);
    if (!this.isSupported()) return Promise.resolve(false);
    this.start();
    if (this.running) return Promise.resolve(true);
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearInterval(poll);
        clearTimeout(deadline);
        resolve(ok);
      };
      const poll = setInterval(() => {
        if (this.running) finish(true);
        else if (!this.binding) finish(false); // bind gave up — stop waiting
      }, 50);
      const deadline = setTimeout(() => finish(this.running), timeoutMs);
    });
  }

  /** Send an instant UDP ping to 255.255.255.255 and subnet broadcast addresses with rapid burst. */
  broadcastPing(): void {
    if (!this.isSupported()) return;
    const selfId = getDeviceId();
    const packet = JSON.stringify({
      type: 'SHEGA_PING',
      deviceId: selfId,
      deviceName: getThisDeviceName(),
      platform: 'mobile',
      port: 5759,
      inviteCode: getOpenInviteCode(),
      timestamp: Date.now(),
    });

    const sendBurst = () => {
      if (!this.socket || !this.running) return;
      const targets = new Set<string>([
        '255.255.255.255',
        '192.168.1.255',
        '192.168.0.255',
        '192.168.43.255',
        '172.20.10.255',
        '192.168.137.255',
        '192.168.49.255',
      ]);

      for (const targetHost of targets) {
        try {
          // `packet.length` is UTF-16 code units, not UTF-8 bytes. A device
          // name with any non-ASCII character (Amharic, Arabic, emoji) makes the
          // advertised byte length larger than the code-unit count, so a
          // byte-oriented send() truncates the JSON and the peer silently
          // discards it as malformed. Measure UTF-8 and pass explicit bytes.
          const bytes = utf8Bytes(packet);
          this.socket?.send?.(packet, 0, bytes, UDP_DISCOVERY_PORT, targetHost, () => {});
        } catch { /* ignore send errors on inactive interfaces */ }
      }
    };

    // Send rapid burst: 0ms, 120ms, 300ms — measured from the moment the socket
    // is really listening, not from the call.
    void this.whenReady().then((bound) => {
      if (!bound) return;
      sendBurst();
      setTimeout(sendBurst, 120);
      setTimeout(sendBurst, 300);
    });
  }

  private handleMessage(raw: string, senderHost: string, _senderPort: number): void {
    try {
      const msg = JSON.parse(raw);
      if (!msg || typeof msg !== 'object') return;

      const selfId = getDeviceId();
      if (msg.deviceId === selfId) return; // Ignore self packets

      if (msg.type === 'SHEGA_PING' || msg.type === 'SHEGA_PONG' || msg.type === 'SHEGA_PING_ACK') {
        // Symmetrical discovery: register peer whether packet was PING or PONG
        const peer: DiscoveredUdpPeer = {
          deviceId: String(msg.deviceId),
          deviceName: String(msg.deviceName || 'Shega Device'),
          platform: String(msg.platform || 'mobile').includes('desktop') ? 'desktop' : 'mobile',
          host: senderHost,
          port: Number(msg.port || (msg.platform === 'desktop' ? 5757 : 5759)),
          inviteCode: msg.inviteCode ? String(msg.inviteCode) : null,
          beacon: {
            v: 1,
            businessId: '',
            businessName: 'Shega',
            owner: {
              deviceId: String(msg.deviceId),
              deviceName: String(msg.deviceName || 'Shega Device'),
              platform: String(msg.platform || 'mobile').includes('desktop') ? 'desktop' : 'mobile',
            },
            code: msg.inviteCode ? String(msg.inviteCode) : '',
            role: 'owner',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            suggestedRole: 'cashier',
          },
          discoveredAt: Date.now(),
        };

        this.seen.set(peer.deviceId, peer);
        console.log(`[UDP Discovery] Mobile discovered peer ${peer.deviceName} (${peer.platform}) at ${senderHost}:${peer.port} via ${msg.type}`);
        this.emit('peerDiscovered', peer);

        if (msg.type === 'SHEGA_PING') {
          // Answer PING immediately with PONG
          this.sendPong(senderHost, msg.deviceId);
        }
      }
    } catch { /* malformed packet */ }
  }

  private sendPong(targetHost: string, _targetDeviceId: string): void {
    if (!this.socket || !this.running) return;
    const packet = JSON.stringify({
      type: 'SHEGA_PONG',
      deviceId: getDeviceId(),
      deviceName: getThisDeviceName(),
      platform: 'mobile',
      port: 5759,
      inviteCode: getOpenInviteCode(),
      timestamp: Date.now(),
    });

    try {
      this.socket?.send?.(packet, 0, utf8Bytes(packet), UDP_DISCOVERY_PORT, targetHost, () => {});
    } catch { /* best-effort */ }
  }

  getDiscoveredPeers(): DiscoveredUdpPeer[] {
    const now = Date.now();
    const out: DiscoveredUdpPeer[] = [];
    for (const [id, peer] of this.seen) {
      if (now - peer.discoveredAt > 45_000) {
        this.seen.delete(id);
      } else {
        out.push(peer);
      }
    }
    return out;
  }
}

export const udpDiscovery = new MobileUdpDiscoveryService();
udpDiscovery.start();
