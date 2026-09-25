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

class MobileUdpDiscoveryService extends EventEmitter {
  private socket: any = null;
  private running = false;
  private seen = new Map<string, DiscoveredUdpPeer>();

  start(port = UDP_DISCOVERY_PORT): void {
    if (this.running) return;

    try {
      const TcpSocket = require('react-native-tcp-socket');
      if (typeof TcpSocket?.createSocket !== 'function') return;

      this.socket = TcpSocket.createSocket({ type: 'udp4' });

      this.socket.on('error', (err: any) => {
        console.warn('[UDP Discovery] Socket error:', err?.message);
      });

      this.socket.on('message', (msg: any, rinfo: any) => {
        const raw = typeof msg === 'string' ? msg : msg.toString('utf8');
        this.handleMessage(raw, rinfo.address, rinfo.port);
      });

      this.socket.bind(port, () => {
        try {
          this.socket?.setBroadcast?.(true);
        } catch { /* ignore */ }
        this.running = true;
        console.log(`[UDP Discovery] Mobile listening on UDP port ${port}`);
      });
    } catch (e: any) {
      console.warn('[UDP Discovery] Failed to bind mobile UDP socket:', e?.message);
    }
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    try {
      this.socket?.close?.();
    } catch { /* ignore */ }
    this.socket = null;
    this.seen.clear();
  }

  /** Send an instant UDP ping to 255.255.255.255 and subnet broadcast addresses with rapid burst. */
  broadcastPing(): void {
    if (!this.socket || !this.running) {
      this.start();
    }
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
          this.socket?.send?.(packet, 0, packet.length, UDP_DISCOVERY_PORT, targetHost, () => {});
        } catch { /* ignore send errors on inactive interfaces */ }
      }
    };

    // Send rapid burst: 0ms, 120ms, 300ms
    sendBurst();
    setTimeout(sendBurst, 120);
    setTimeout(sendBurst, 300);
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
      this.socket?.send?.(packet, 0, packet.length, UDP_DISCOVERY_PORT, targetHost, () => {});
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
