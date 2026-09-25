/**
 * Shega Concurrent Connection Manager (Mobile side).
 *
 * Orchestrates sub-second device discovery and instant connection establishment:
 *   1. Known Device Quick-Dial (probe saved IP / hubUrl in < 50ms)
 *   2. UDP Broadcast Discovery (port 5756 — < 10ms response)
 *   3. mDNS / Zeroconf Discovery (_shega-pair._tcp)
 *   4. Subnet LAN Sweep (parallel /24 sweep)
 *   5. Internet Cloud / P2P Fallback (when local discovery yields no target)
 *
 * Runs applicable methods CONCURRENTLY. As soon as a valid Shega device is discovered,
 * it establishes connection immediately without waiting for slower methods.
 */

import { EventEmitter } from 'events';
import { getHubUrl, getHubToken } from './syncService';
import { directDeviceHello, desktopHttpResolveInvite } from './directJoinClient';
import { udpDiscovery, type DiscoveredUdpPeer } from './udpDiscovery';
import { mobilePairingBeacon } from './mobilePairingBeacon';
import { sweepLanAsBeacons } from './lanSweep';
import { canSweepLan, checkInternetConnection } from './connectivity';
import { lookupPairingInvite } from './pairingService';

export interface DiscoveredTarget {
  id: string;
  deviceId: string;
  deviceName: string;
  platform: 'desktop' | 'mobile';
  host: string;
  port: number;
  inviteCode?: string | null;
  businessId?: string;
  businessName?: string;
  role?: string;
  via: 'known' | 'udp' | 'mdns' | 'lan' | 'cloud';
}

type ConnectionEvents = {
  targetFound: [DiscoveredTarget];
  statusChanged: [string];
};

class MobileConnectionManager extends EventEmitter {
  private searching = false;
  private knownTargets = new Set<string>();

  /**
   * Run concurrent multi-method discovery.
   * Returns immediately found targets and emits `targetFound` as new peers arrive.
   */
  async startDiscovery(code?: string): Promise<DiscoveredTarget[]> {
    this.searching = true;
    const foundMap = new Map<string, DiscoveredTarget>();

    const addTarget = (target: DiscoveredTarget) => {
      if (!target.deviceId && !target.host) return;
      const key = target.deviceId || `${target.host}:${target.port}`;
      if (!foundMap.has(key)) {
        foundMap.set(key, target);
        console.log(`[ConnectionManager] Target found via ${target.via}: ${target.deviceName} (${target.host}:${target.port})`);
        try {
          mobilePairingBeacon.addKnownTarget({
            deviceId: target.deviceId,
            deviceName: target.deviceName,
            platform: target.platform,
            host: target.host,
            port: target.port,
            inviteCode: target.inviteCode,
          });
        } catch { /* best-effort */ }
        this.emit('targetFound', target);
      }
    };

    // 1. Quick-Dial Known Endpoint & Gateway IPs (< 50ms)
    const probeHost = async (host: string, port: number) => {
      try {
        if (port === 5757) {
          const res = await fetch(`http://${host}:5757/sync/info`, { signal: AbortSignal.timeout(200) });
          if (res.ok) {
            const info = await res.json();
            if (info?.hub) {
              addTarget({
                id: info.hub,
                deviceId: info.hub,
                deviceName: info.deviceName || 'Desktop Hub',
                platform: 'desktop',
                host,
                port: 5757,
                inviteCode: info.inviteCode ?? null,
                via: 'known',
              });
            }
          }
        } else {
          const info = await directDeviceHello({ host, port: 5759 });
          if (info?.deviceId) {
            addTarget({
              id: info.deviceId,
              deviceId: info.deviceId,
              deviceName: info.deviceName || 'Mobile Hub',
              platform: 'mobile',
              host,
              port: 5759,
              inviteCode: info.inviteCode ?? null,
              via: 'known',
            });
          }
        }
      } catch { /* probe offline */ }
    };

    const hubUrl = getHubUrl();
    if (hubUrl) {
      try {
        const hostMatch = hubUrl.match(/http:\/\/([^:]+):(\d+)/);
        if (hostMatch) {
          void probeHost(hostMatch[1], Number(hostMatch[2]));
        }
      } catch { /* ignore */ }
    }

    // Direct gateway quick probes (hotspot gateway / router)
    const gateways = ['192.168.43.1', '172.20.10.1', '192.168.137.1', '192.168.1.1', '192.168.0.1', '192.168.49.1'];
    for (const gw of gateways) {
      void probeHost(gw, 5757);
      void probeHost(gw, 5759);
    }

    // 2. UDP Broadcast Discovery (Instant < 10ms)
    udpDiscovery.on('peerDiscovered', (peer: DiscoveredUdpPeer) => {
      addTarget({
        id: peer.deviceId,
        deviceId: peer.deviceId,
        deviceName: peer.deviceName,
        platform: peer.platform,
        host: peer.host,
        port: peer.port,
        inviteCode: peer.inviteCode ?? null,
        via: 'udp',
      });
    });
    udpDiscovery.broadcastPing();

    // 3. mDNS / Zeroconf Discovery (Parallel)
    try {
      mobilePairingBeacon.startBrowsing();
      const sub = mobilePairingBeacon.onFound(({ beacon, host }) => {
        if (beacon.owner?.deviceId) {
          addTarget({
            id: beacon.owner.deviceId,
            deviceId: beacon.owner.deviceId,
            deviceName: beacon.owner.deviceName || 'Shega Device',
            platform: beacon.owner.platform === 'desktop' ? 'desktop' : 'mobile',
            host,
            port: beacon.owner.platform === 'desktop' ? 5757 : 5759,
            inviteCode: beacon.code ?? null,
            businessId: beacon.businessId,
            businessName: beacon.businessName,
            via: 'mdns',
          });
        }
      });
    } catch { /* ignore */ }

    // 4. LAN Subnet Sweep (Parallel Background)
    void (async () => {
      try {
        const hits = await sweepLanAsBeacons();
        for (const h of hits) {
          if (h.beacon?.owner?.deviceId) {
            addTarget({
              id: h.beacon.owner.deviceId,
              deviceId: h.beacon.owner.deviceId,
              deviceName: h.beacon.owner.deviceName || 'Shega Device',
              platform: h.beacon.owner.platform === 'desktop' ? 'desktop' : 'mobile',
              host: h.host,
              port: h.beacon.owner.platform === 'desktop' ? 5757 : 5759,
              inviteCode: h.beacon.code ?? null,
              via: 'lan',
            });
          }
        }
      } catch { /* ignore */ }
    })();

    // 5. Cloud Lookup Fallback (Parallel if invitation code present)
    if (code && code.trim()) {
      void (async () => {
        try {
          const cloud = await lookupPairingInvite({ code: code.trim() });
          if (cloud?.business_id) {
            addTarget({
              id: cloud.business_id,
              deviceId: cloud.business_id,
              deviceName: cloud.business_name || 'Cloud Business',
              platform: 'desktop',
              host: '',
              port: 0,
              inviteCode: code.trim(),
              businessId: cloud.business_id,
              businessName: cloud.business_name,
              via: 'cloud',
            });
          }
        } catch { /* ignore */ }
      })();
    }

    return [...foundMap.values()];
  }

  stopDiscovery(): void {
    this.searching = false;
    try {
      mobilePairingBeacon.stopBrowsing();
    } catch { /* ignore */ }
  }
}

export const connectionManager = new MobileConnectionManager();
