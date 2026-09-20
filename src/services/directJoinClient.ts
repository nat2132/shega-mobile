/**
 * Direct hub join client.
 *
 * The DEVICE_JOIN channel lives on the hub (desktop WS hub, or a mobile phone
 * acting as the POS hub). A fresh joiner device has no pairing with that hub
 * yet — this module speaks the newline-delimited JSON protocol directly over
 * TCP so a joiner can:
 *
 *   1. resolve an invite code against the owner's hub,
 *   2. submit a join request, and
 *   3. poll its approval status —
 *
 * all without a pre-existing pairing and without any cloud dependency.
 * Used by the join flow when there is no WS connection available.
 */

import { validateInviteCode } from './invitationService';

export interface DirectJoinTarget {
  host: string;
  port: number;
}

interface PendingCall {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** One-shot TCP client: opens, sends, awaits the response, closes. */
async function rpc(target: DirectJoinTarget, msg: any, timeoutMs = 20000): Promise<any> {
  const TcpSocket = require('react-native-tcp-socket');
  return new Promise((resolve, reject) => {
    let socket: any;
    const pending = new Map<string, PendingCall>();
    const call = (fn: () => void) => { try { fn(); } catch { /* ignore */ } };

    const fail = (err: Error) => { call(() => socket?.destroy?.()); reject(err); };

    try {
      socket = TcpSocket.createConnection({ host: target.host, port: target.port }, () => {
        let buf = '';
        socket.on('data', (chunk: any) => {
          buf += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
          let idx: number;
          while ((idx = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line) continue;
            try {
              const m = JSON.parse(line);
              const p = pending.get(String(m.requestId ?? ''));
              if (p) {
                clearTimeout(p.timer);
                pending.delete(String(m.requestId));
                if (m.type === 'ERROR') p.reject(new Error(m.payload?.message || 'hub error'));
                else p.resolve(m);
              }
            } catch { /* malformed line */ }
          }
        });
        socket.on('error', (e: any) => fail(new Error(e?.message || 'connection error')));
        const requestId = `dj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        pending.set(requestId, {
          resolve: (v) => { call(() => socket?.destroy?.()); resolve(v); },
          reject: (e) => { call(() => socket?.destroy?.()); reject(e); },
          timer: setTimeout(() => fail(new Error('hub timeout')), timeoutMs),
        });
        socket.write(JSON.stringify({ ...msg, requestId }) + '\n');
      });
      socket.on('error', (e: any) => fail(new Error(e?.message || 'connection error')));
    } catch (e: any) {
      reject(new Error(e?.message || 'Cannot connect to the hub'));
    }
  });
}

/** Resolve an invite code against a mobile hub. Returns the invitation or null. */
export async function directResolveInvite(target: DirectJoinTarget, code: string): Promise<any | null> {
  const res = await rpc(target, { type: 'INVITE_RESOLVE', payload: { code } });
  return res?.payload?.invitation ?? null;
}

/** Submit a join request to a mobile hub. */
export async function directSubmitJoin(target: DirectJoinTarget, payload: any): Promise<any> {
  const res = await rpc(target, { type: 'DEVICE_JOIN_SUBMIT', payload });
  return res?.payload ?? {};
}

/** Poll a join request's status. Returns { record, pairingToken? }. */
export async function directJoinStatus(target: DirectJoinTarget, code: string, joinerDeviceId: string): Promise<any> {
  const res = await rpc(target, { type: 'DEVICE_JOIN_STATUS', payload: { code, joinerDeviceId } });
  return res?.payload ?? {};
}

/**
 * Desktop hubs speak HTTP (port 5757), not the TCP JSON protocol — resolve a
 * code against a desktop hub via its LAN API. Returns null when unavailable.
 */
export async function desktopHttpResolveInvite(baseUrl: string, code: string): Promise<any | null> {
  try {
    const res = await fetch(`${baseUrl}/sync/invitations/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.invitation ?? (data?.code ? data : null);
  } catch {
    return null;
  }
}

/** True when the host looks reachable — used to prune unreachable targets. */
export async function isHubReachable(target: DirectJoinTarget): Promise<boolean> {
  try { await rpc(target, { type: 'HEARTBEAT', payload: {} }, 5000); return true; }
  catch { return false; }
}
