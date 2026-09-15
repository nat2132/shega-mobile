/**
 * Mobile WebRTC transport for Yjs updates, using react-native-webrtc.
 * Signaling flows over the existing WS sync client (LAN hub or cloud relay);
 * the Yjs update binaries travel only over direct DataChannels.
 */

import type { RTCSessionDescription } from 'react-native-webrtc';
import {
  DEFAULT_ICE_SERVERS,
  type ConnectionKind,
  type SignalMessage,
  type YjsPeerInfo,
} from '@shega/shared';

// react-native-webrtc ships a JS shim, but its native module only exists in a
// build that ran the config plugin (dev/standalone). In Expo Go the module
// throws "WebRTC native module not found" on import, so load it defensively
// and let the manager no-op until the native module is present.
interface RtcGlobals {
  RTCPeerConnection: any;
  RTCIceCandidate: any;
  RTCSessionDescription: any;
}

let rtcModule: RtcGlobals | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  rtcModule = require('react-native-webrtc') as RtcGlobals;
  if (!rtcModule || typeof rtcModule.RTCPeerConnection !== 'function') rtcModule = null;
} catch {
  rtcModule = null;
}

const rtcAvailable = rtcModule !== null;

interface PeerSession {
  deviceId: string;
  deviceType: 'mobile' | 'desktop';
  pc: any;
  dc: any;
  businessId: string;
  kind: ConnectionKind;
  connectedAt: number;
}

interface MobileWebRtcEvents {
  peerConnected: (peer: YjsPeerInfo) => void;
  peerDisconnected: (deviceId: string) => void;
  update: (businessId: string, fromDeviceId: string, update: Uint8Array) => void;
  status: (line: string) => void;
}

export class MobileWebRtcManager {
  private sessions = new Map<string, PeerSession>();
  private listeners = new Map<keyof MobileWebRtcEvents, Set<Function>>();
  private signalingSend: ((toDeviceId: string, msg: SignalMessage) => void) | null = null;
  private myId = 'mobile';
  private businessId = '';

  setSignalingSender(fn: (toDeviceId: string, msg: SignalMessage) => void): void {
    this.signalingSend = fn;
  }

  on<K extends keyof MobileWebRtcEvents>(event: K, fn: MobileWebRtcEvents[K]): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)!.delete(fn);
  }

  private emit<K extends keyof MobileWebRtcEvents>(event: K, ...args: Parameters<MobileWebRtcEvents[K]>): void {
    this.listeners.get(event)?.forEach((fn) => (fn as Function)(...args));
  }

  init(deviceId: string, businessId: string): void {
    this.myId = deviceId;
    this.businessId = businessId;
  }

  /** True when the react-native-webrtc native module is present. */
  isAvailable(): boolean {
    return rtcAvailable;
  }

  getPeers(): YjsPeerInfo[] {
    return [...this.sessions.values()].map((s) => ({
      deviceId: s.deviceId,
      deviceType: s.deviceType,
      businessId: s.businessId,
      kind: s.kind,
      connectedAt: s.connectedAt,
    }));
  }

  sendUpdate(deviceId: string, update: Uint8Array): boolean {
    const s = this.sessions.get(deviceId);
    if (!s?.dc || (s.dc as any).readyState !== 'open') return false;
    try {
      s.dc.send(String.fromCharCode(...new Uint8Array(update)) as any);
      return true;
    } catch {
      // Chunk large updates — RN data channels have a small message limit.
      return false;
    }
  }

  broadcastUpdate(businessId: string, update: Uint8Array): void {
    for (const [deviceId, s] of this.sessions) {
      if (s.businessId === businessId) this.sendUpdate(deviceId, update);
    }
  }

  /** Deterministic initiator: higher id dials to avoid double offers. */
  private rank(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h;
  }

  handleSignal(msg: SignalMessage): void {
    if (!rtcModule) return;
    switch (msg.t) {
      case 'hello':
        if (msg.businessId !== this.businessId) return;
        if (!this.sessions.has(msg.deviceId) && this.rank(this.myId) > this.rank(msg.deviceId)) {
          void this.dial(msg.deviceId, msg.deviceType);
        }
        break;
      case 'offer':
        if (msg.to !== this.myId) return;
        void this.acceptOffer(msg.from, msg.sdp);
        break;
      case 'answer':
        if (msg.to !== this.myId) return;
        void this.acceptAnswer(msg.from, msg.sdp);
        break;
      case 'ice':
        if (msg.to !== this.myId) return;
        {
          const s = this.sessions.get(msg.from);
          if (s) void s.pc.addIceCandidate(new rtcModule.RTCIceCandidate({ candidate: msg.candidate, sdpMid: msg.sdpMid, sdpMLineIndex: msg.sdpMLineIndex ?? 0 }));
        }
        break;
      case 'bye':
        this.closePeer(msg.from);
        break;
    }
  }

  private newSession(deviceId: string, deviceType: 'mobile' | 'desktop'): PeerSession {
    if (!rtcModule) throw new Error('WebRTC unavailable');
    const pc = new rtcModule.RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS as any });
    const session: PeerSession = {
      deviceId, deviceType, pc, dc: null,
      businessId: this.businessId, kind: 'p2p-direct', connectedAt: 0,
    };
    this.sessions.set(deviceId, session);

    (pc as any).addEventListener('icecandidate', (ev: any) => {
      if (ev.candidate) {
        this.signalingSend?.(deviceId, {
          t: 'ice', from: this.myId, to: deviceId,
          candidate: ev.candidate.candidate,
          sdpMid: ev.candidate.sdpMid ?? undefined,
          sdpMLineIndex: ev.candidate.sdpMLineIndex ?? undefined,
        });
      }
    });

    (pc as any).addEventListener('connectionstatechange', () => {
      const state = (pc as any).connectionState;
      this.emit('status', `peer ${deviceId}: ${state}`);
      if (state === 'failed' || state === 'closed') this.closePeer(deviceId);
    });

    (pc as any).addEventListener('datachannel', (ev: any) => this.attachChannel(session, ev.channel));
    return session;
  }

  private attachChannel(session: PeerSession, dc: any): void {
    session.dc = dc;
    (dc as any).onopen = () => {
      session.connectedAt = Date.now();
      this.emit('peerConnected', {
        deviceId: session.deviceId,
        deviceType: session.deviceType,
        businessId: session.businessId,
        kind: session.kind,
        connectedAt: session.connectedAt,
      });
    };
    (dc as any).onclose = () => this.closePeer(session.deviceId);
    (dc as any).onmessage = (ev: any) => {
      const raw = ev.data;
      if (typeof raw === 'string') {
        // JSON control frames (force-lock etc.) are not Yjs updates.
        if (raw.startsWith('{') && raw.includes('__shega_control__')) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.__shega_control__ === 'force-lock') {
              this.emit('update', session.businessId, session.deviceId, new TextEncoder().encode(raw));
            }
          } catch { /* ignore */ }
          return; // never forward control frames to Yjs
        }
        // String-encoded binary (chunked) — decode to bytes.
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xff;
        this.emit('update', session.businessId, session.deviceId, bytes);
      } else if (raw instanceof ArrayBuffer) {
        this.emit('update', session.businessId, session.deviceId, new Uint8Array(raw));
      }
    };
  }

  /** No-op hook kept for API compatibility with control-frame filtering. */
  suppressLastUpdate(): void { /* handled inline in the message handler */ }

  async dial(deviceId: string, deviceType: 'mobile' | 'desktop'): Promise<void> {
    if (!rtcModule || this.sessions.has(deviceId)) return;
    const session = this.newSession(deviceId, deviceType);
    const dc = session.pc.createDataChannel('yjs', { ordered: true } as any);
    this.attachChannel(session, dc as any);
    try {
      const offer = await session.pc.createOffer();
      await session.pc.setLocalDescription(offer);
      this.signalingSend?.(deviceId, { t: 'offer', from: this.myId, to: deviceId, sdp: (offer as RTCSessionDescription).sdp ?? '' });
    } catch (e) {
      this.emit('status', `dial ${deviceId} failed: ${String(e)}`);
      this.closePeer(deviceId);
    }
  }

  private async acceptOffer(deviceId: string, sdp: string): Promise<void> {
    if (!rtcModule) return;
    try {
      let session = this.sessions.get(deviceId);
      if (!session) session = this.newSession(deviceId, 'mobile');
      await session.pc.setRemoteDescription(new rtcModule.RTCSessionDescription({ type: 'offer', sdp }));
      const answer = await session.pc.createAnswer();
      await session.pc.setLocalDescription(answer);
      this.signalingSend?.(deviceId, { t: 'answer', from: this.myId, to: deviceId, sdp: (answer as RTCSessionDescription).sdp ?? '' });
    } catch (e) {
      this.emit('status', `acceptOffer failed: ${String(e)}`);
    }
  }

  private async acceptAnswer(deviceId: string, sdp: string): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session || !rtcModule) return;
    try {
      await session.pc.setRemoteDescription(new rtcModule.RTCSessionDescription({ type: 'answer', sdp }));
    } catch { /* ignore */ }
  }

  closePeer(deviceId: string): void {
    const s = this.sessions.get(deviceId);
    if (!s) return;
    try { s.dc?.close(); } catch {}
    try { s.pc.close(); } catch {}
    this.sessions.delete(deviceId);
    this.emit('peerDisconnected', deviceId);
  }

  closeAll(): void {
    for (const id of [...this.sessions.keys()]) this.closePeer(id);
  }
}

export const mobileWebRtc = new MobileWebRtcManager();
