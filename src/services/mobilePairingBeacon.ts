/**
 * Pairing-beacon discovery (mobile side) — "Bluetooth-style" nearby-owner
 * visibility for the join flow.
 *
 * Mirrors the desktop module exactly (same `_shega-pair._tcp` service, same
 * encoded PairingBeacon TXT payload) so Mobile ↔ Desktop discovery is
 * symmetric and platform-equal:
 *
 *   • The OWNER phone advertises a beacon while a pairing invitation is open
 *     (onboarding "Add team member" or Settings → Team / POS Hub).
 *   • The JOINER phone browses the service and shows nearby businesses in the
 *     join discovery list, like a Bluetooth scan.
 *
 * Beacons carry only the short-lived invite code + business identity — never
 * credentials or business data — and expire with the invite.
 *
 * All native NSD access goes through `mdnsRegistry`: Android allows exactly ONE
 * live service registration and ONE discovery listener per app, so this module
 * (pairing `_shega-pair._tcp`) and the POS-hub advertisement
 * (`_shega-pos._tcp`) share a single slot. The beacon preempts the hub ad
 * while it is live; the hub is re-published when the beacon stops. Browsing
 * similarly preempts the default `shega-pos` browse for as long as the radar
 * is open and restores it on close.
 */

import {
  type PairingBeacon,
  type BeaconRole,
  encodePairingBeacon,
  decodePairingBeacon,
  isBeaconLive,
} from '@shega/shared';
import { mdnsRegistry } from './mobileMdnsRegistry';
import { getDB } from '../database/db';
import { getDeviceId } from './syncService';
import { getMobileSyncPort, startMobileSyncServer, isMobileSyncServerRunning } from './mobileSyncServer';
import { getThisDeviceName } from './deviceIdentity';
import { sweepLanAsBeacons } from './lanSweep';
import { udpDiscovery } from './udpDiscovery';

// The device-name helper is shared with the LAN sync server; re-exported here
// so existing importers keep working unchanged.
export { getThisDeviceName } from './deviceIdentity';

const PAIR_SERVICE_TYPE = 'shega-pair';
const LEGACY_PAIR_SERVICE_TYPE = 'shega-pos';

/** Warn only once per session — publish attempts repeat and would spam. */
let warnedZeroconfMissing = false;

interface DiscoveredBeacon {
  beacon: PairingBeacon;
  host: string;
  addresses: string[];
  discoveredAt: number;
}

type Listener = (entry: DiscoveredBeacon) => void;

class MobilePairingBeaconService {
  private published: PairingBeacon | null = null;
  /** mDNS service name of the beacon we published (diagnostics/logging). */
  private publishedName: string | null = null;
  private seen = new Map<string, DiscoveredBeacon>();
  /** LAN-sweep results (no invite code) — merged into the discovery list. */
  private lanSeen = new Map<string, DiscoveredBeacon>();
  private browsing = false;
  private listeners = new Set<Listener>();
  /** Registry event subscriptions while the radar is open (unsubscribe on stop). */
  private browseSubs: Array<() => void> = [];
  private rescanTimer: ReturnType<typeof setInterval> | null = null;
  private lanTimer: ReturnType<typeof setInterval> | null = null;

  /** True when the native mDNS module is actually linked (not Expo Go). */
  isSupported(): boolean {
    return mdnsRegistry.nativePresent;
  }

  // ── Owner side: publish / stop ──────────────────────────────────────────

  async publishBeacon(beacon: PairingBeacon): Promise<void> {
    // NOTE: intentionally NOT calling stopPublishing() here. The registry
    // replaces an existing pair beacon in-place (unregister → register) without
    // a detour through the hub ad, which would otherwise flicker on every
    // invite-code refresh.
    const serverStarted = isMobileSyncServerRunning() || await startMobileSyncServer();
    if (!serverStarted) {
      console.warn('[Discovery] Mobile pairing advertisement skipped: sync server is not listening');
      return;
    }
    if (!this.isSupported()) {
      // Native module not linked (Expo Go / stale dev build): beacons can't be
      // advertised. This is NOT an error for the pairing flow — the QR code +
      // manual code still work, and the LAN hub publish is separate.
      if (!warnedZeroconfMissing) {
        warnedZeroconfMissing = true;
        console.warn('[pair-beacon] zeroconf native module unavailable — beacon not published (QR/manual pairing still works). Run `npx expo run:android` to link the native module.');
      }
      return;
    }
    const deviceId = beacon.owner.deviceId || getDeviceId();
    const port = getMobileSyncPort() || 5759;
    // Deterministic per-device mDNS name — NEVER business-name-derived. A JS
    // reload/Fast Refresh in the dev client keeps the native NSD registration
    // alive across sessions, so Android rejects a new registerService with
    // FAILURE_ALREADY_ACTIVE (silently stubbed in Java). The registry's recovery
    // path unpublishes THIS exact name to free the stale slot — that only works
    // when this session's name equals the stale session's name. The human
    // business/device name lives in the beacon TXT payload, not the service name.
    const svcName = `Shega Pair — ${deviceId.slice(0, 8)}`;
    this.published = beacon;
    this.publishedName = svcName;
    // The registry owns the single native NSD slot: it serializes the hub ad
    // and this beacon, unregisters-then-registers (a live registration would
    // otherwise get FAILURE_ALREADY_ACTIVE), and pops any diagnostics.
    void mdnsRegistry.publish({
      kind: 'pair',
      serviceType: PAIR_SERVICE_TYPE,
      name: svcName,
      port,
      txt: {
        device_id: deviceId,
        platform: 'mobile',
        beacon: encodePairingBeacon(beacon),
      },
    });
    console.log(`[Discovery] Mobile pairing advertisement started: ${svcName} on port ${port}`);
  }

  stopPublishing(): void {
    if (!this.published) return;
    // Unpublish through the registry — it tracks the name Android actually
    // registered and waits for the native ack before the next publish.
    void mdnsRegistry.unregister('pair');
    this.published = null;
    this.publishedName = null;
    console.log('[pair-beacon] publishing stopped');
  }

  isPublishing(): boolean {
    return this.published !== null;
  }

  /**
   * Build a beacon for an open local invitation and advertise it
   * (owner role on this phone — the phone may equally be desktop- or
   * mobile-owner; the flow is identical).
   */
  async advertiseInvitation(invite: {
    id: string;
    code: string;
    businessId: string;
    role?: string | null;
    expiresAt?: string | null;
  }): Promise<void> {
    const db = getDB();
    const biz = db.getFirstSync(
      'SELECT uuid, name FROM businesses WHERE uuid = ? OR id = ? LIMIT 1',
      [invite.businessId, invite.businessId],
    ) as any;
    const beacon: PairingBeacon = {
      v: 1,
      businessId: biz?.uuid ?? String(invite.businessId),
      businessName: biz?.name ?? 'Shega Business',
      owner: {
        deviceId: getDeviceId(),
        deviceName: getThisDeviceName(),
        platform: 'mobile',
      },
      code: invite.code,
      role: 'owner',
      expiresAt: invite.expiresAt ?? new Date(Date.now() + 10 * 60_000).toISOString(),
      suggestedRole: (invite.role ?? 'cashier') as any,
    };
    await this.publishBeacon(beacon);
  }

  /**
   * Discovery mode: when true, this device stays visible/searchable even
   * without an open invite ("Add Team" onboarding / joining mode). While in
   * discovery mode an empty-code beacon is broadcast so other devices can see
   * the device name — joiners learn the device exists; actual joining still
   * requires a live invite code.
   */
  /**
   * Turn the phone discoverable. In discovery mode the phone publishes the
   * freshest OPEN invitation for its current business as the beacon — that is
   * what lets an owner on another device see THIS phone as a selectable joiner
   * (not just a name in space) and connect without typing anything.
   *
   * When the phone has no business yet (first-run) or no open invite, it still
   * publishes a lightweight presence beacon so it appears as a name; other
   * devices can tap it to learn it exists. They cannot join from that beacon
   * alone — the joiner still needs an open invite, generated by the owner.
   *
   * Owner/joiner identity is immutable for the lifetime of this app-session:
   * this phone is whatever role it was at first business creation / first join.
   * setDiscoverable never promotes a joiner into an owner.
   */
  async setDiscoverable(on: boolean, businessName = 'Shega', role: BeaconRole = 'owner'): Promise<void> {
    if (!on) {
      // Stop a discovery-only beacon only — never kill a live invite beacon
      // that the owner side still needs for the joiner to connect.
      if (this.published && this.published.code === '') this.stopPublishing();
      return;
    }
    if (this.published) return; // a stronger beacon is already live

    const db = getDB();
    const biz = db.getFirstSync(
      'SELECT uuid, name FROM businesses WHERE is_deleted = 0 ORDER BY (is_default = 1) DESC, created_at LIMIT 1',
    ) as any;

    // If there is an open invitation for this business, advertise THAT as the
    // beacon. That gives the joiner's radar a real, connectable invite with a
    // code — not an empty "No invite code" entry. This is the fix for "I can
    // see the device but it says No invite code".
    const openInvite = (() => {
      try {
        const rows = db.getAllSync(
          `SELECT * FROM invitations WHERE status = 'open'
           ORDER BY CASE WHEN business_id = ? THEN 0 ELSE 1 END, created_at DESC LIMIT 1`,
          [biz?.uuid ?? null],
        ) as any[];
        return rows[0] ?? null;
      } catch { return null; }
    })();

    const beacon: PairingBeacon = {
      v: 1,
      businessId: biz?.uuid ?? 'discovery',
      businessName: biz?.name ?? businessName,
      owner: {
        deviceId: getDeviceId(),
        deviceName: getThisDeviceName(),
        platform: 'mobile' as const,
      },
      // When the phone HAS an open invite for its business, carry that code so
      // the owner's Add-Team radar finds a connectable joiner. When there is
      // no open invite (no business yet, or all invites used/expired), publish
      // a discoverable presence — the joiner still needs the owner to generate
      // a fresh invite before a join can complete.
      code: openInvite?.code ?? '',
      // Discovery mode on the PHONE always advertises itself as a potential
      // joiner target from the owner's / Add-Team perspective ('team'), and as
      // the business owner from the joiner's Join-side perspective ('owner').
      // The role flag is informational; the real authorization is the invite
      // code + the owner's approval, never the beacon role alone.
      role: openInvite ? 'owner' : role,
      expiresAt: (openInvite?.expires_at ?? new Date(Date.now() + 12 * 3600_000).toISOString()),
      suggestedRole: (openInvite?.role ?? 'cashier') as any,
    };
    await this.publishBeacon(beacon);
  }

  // ── Joiner side: browse nearby owners ─────────────────────────────────

  startBrowsing(): void {
    if (this.browsing) return;
    // LAN sweep runs regardless of mDNS: it is the discovery path that keeps
    // working when multicast is blocked (Windows Firewall, AP isolation, or a
    // missing multicast permission). This is the "same Wi-Fi but they can't
    // find each other" fix.
    this.startLanSweep();
    if (!this.isSupported()) {
      // mDNS native module not linked — the sweep above still finds devices.
      if (!warnedZeroconfMissing) {
        warnedZeroconfMissing = true;
        console.warn('[pair-beacon] zeroconf native module unavailable — using LAN sweep discovery instead. Run `npx expo run:android` to re-link native modules.');
      }
      this.browsing = false;
      return;
    }
    this.attachBrowseListeners();
    // The registry owns the ONE native discovery slot. Browsing the pairing
    // service preempts the default `shega-pos` hub browse (which is re-issued
    // as the legacy pair service below anyway); `restoreDefaultBrowse()` on
    // stop brings the hub browse back.
    mdnsRegistry.browse([PAIR_SERVICE_TYPE, LEGACY_PAIR_SERVICE_TYPE]);
    this.browsing = true;
    // Broadcast instant UDP ping to all local interfaces & hotspot subnets
    try { udpDiscovery.broadcastPing(); } catch { /* ignore */ }

    // Periodic re-scan: devices that enter discovery mode after we started
    // browsing must appear (mDNS caches can miss late advertisers), and stale
    // entries get re-checked. Also auto-start our own discovery beacon so the
    // device is mutually visible on both sides.
    if (this.rescanTimer) clearInterval(this.rescanTimer);
    this.rescanTimer = setInterval(() => {
      if (!this.browsing) return;
      mdnsRegistry.refreshBrowse();
      try { udpDiscovery.broadcastPing(); } catch { /* ignore */ }
    }, 2000);
    console.log('[pair-beacon] browsing for nearby pairing beacons…');
  }

  /** Subscribe to the registry's shared instance events (idempotent). */
  private attachBrowseListeners(): void {
    if (this.browseSubs.length > 0) return;

    // UDP Discovery instant listener (< 5ms response)
    const onUdpPeer = (peer: any) => {
      if (!peer?.deviceId || !peer?.beacon) return;
      const entry: DiscoveredBeacon = {
        beacon: peer.beacon,
        host: peer.host,
        addresses: [peer.host],
        discoveredAt: Date.now(),
      };
      this.seen.set(peer.deviceId, entry);
      this.listeners.forEach((fn) => fn(entry));
    };
    udpDiscovery.on('peerDiscovered', onUdpPeer);
    this.browseSubs.push(() => udpDiscovery.off('peerDiscovered', onUdpPeer));

    this.browseSubs.push(mdnsRegistry.on('resolved', (service: any) => {
      const txt = service?.txtRecord ?? service?.txt;
      const beacon = decodePairingBeacon(txt?.beacon);
      if (!beacon || !isBeaconLive(beacon)) return;
      const addrs: string[] = service?.addresses || [service?.ip || service?.host].filter(Boolean);
      const ipv4 = addrs.find((a: string) => /^\d+\.\d+\.\d+\.\d+$/.test(a)) || addrs[0] || service?.host || '';
      const entry: DiscoveredBeacon = {
        beacon,
        host: ipv4,
        addresses: addrs,
        discoveredAt: Date.now(),
      };
      this.seen.set(beacon.owner.deviceId, entry);
      this.listeners.forEach((fn) => fn(entry));
    }));
    this.browseSubs.push(mdnsRegistry.on('remove', (data: any) => {
      // The registry may deliver a bare name string or { name } — the library
      // relays RNZeroconfServiceRemoved as a service name only.
      const name: string = typeof data === 'string' ? data : data?.name;
      if (!name) return;
      for (const [deviceId, entry] of this.seen) {
        // Must mirror the deterministic publish name (deviceId, not businessName).
        const svcName = `Shega Pair — ${deviceId.slice(0, 8)}`;
        if (name === svcName || name.startsWith(svcName.slice(0, 20))) {
          this.seen.delete(deviceId);
          this.listeners.forEach((fn) => fn({ ...entry, discoveredAt: 0 }));
        }
      }
    }));
    console.log('[Discovery] Mobile searching for _shega-pair._tcp (single Android NSD listener)');
  }

  stopBrowsing(): void {
    if (this.rescanTimer) { clearInterval(this.rescanTimer); this.rescanTimer = null; }
    if (this.lanTimer) { clearInterval(this.lanTimer); this.lanTimer = null; }
    this.browsing = false;
    this.seen.clear();
    this.lanSeen.clear();
    if (this.browseSubs.length > 0) {
      // NEVER stop the shared native instance (that would kill the app-wide
      // hub discovery) — just release the browse slot back to the default.
      this.browseSubs.forEach((unsub) => { try { unsub(); } catch { /* best-effort */ } });
      this.browseSubs = [];
      mdnsRegistry.restoreDefaultBrowse();
    }
  }

  /**
   * LAN sweep loop: knock on the desktop (5757) and mobile (5759) sync ports
   * across our /24. Results land in `lanSeen` and are surfaced through
   * `getNearbyOwners()` exactly like mDNS hits, so every discovery screen gets
   * them for free.
   */
  private startLanSweep(): void {
    if (this.lanTimer) return;
    const run = async () => {
      try {
        const hits = await sweepLanAsBeacons();
        this.lanSeen.clear();
        for (const hit of hits) {
          // mDNS always wins: it carries a live invite code.
          if (this.seen.has(hit.beacon.owner.deviceId)) continue;
          this.lanSeen.set(hit.beacon.owner.deviceId, {
            beacon: hit.beacon as PairingBeacon,
            host: hit.host,
            addresses: [hit.host],
            discoveredAt: Date.now(),
          });
        }
        this.listeners.forEach((fn) => {
          for (const entry of this.lanSeen.values()) fn(entry);
        });
      } catch { /* sweep is best-effort */ }
    };
    void run();
    // Sweeps are cheap-but-not-free: 20s keeps the list fresh without burning
    // battery on a phone sitting on a discovery screen.
    this.lanTimer = setInterval(() => { void run(); }, 20_000);
  }

  isBrowsingActive(): boolean {
    return this.browsing;
  }

  /**
   * Snapshot for the discovery list — expired beacons filtered out. Merges
   * mDNS beacons (which carry an invite code) with LAN-sweep hits (which prove
   * presence only), mDNS taking precedence for the same device.
   */
  getNearbyOwners(): Array<{ beacon: PairingBeacon; host: string }> {
    const out: Array<{ beacon: PairingBeacon; host: string }> = [];
    const included = new Set<string>();

    for (const [deviceId, entry] of this.seen) {
      if (!isBeaconLive(entry.beacon)) { this.seen.delete(deviceId); continue; }
      out.push({ beacon: entry.beacon, host: entry.host });
      included.add(deviceId);
    }

    try {
      const udpHits = udpDiscovery.getDiscoveredPeers();
      for (const hit of udpHits) {
        if (included.has(hit.deviceId)) continue;
        if (!isBeaconLive(hit.beacon as any)) continue;
        out.push({ beacon: hit.beacon as any, host: hit.host });
        included.add(hit.deviceId);
      }
    } catch { /* ignore */ }

    for (const [deviceId, entry] of this.lanSeen) {
      if (included.has(deviceId)) continue;
      if (!isBeaconLive(entry.beacon)) { this.lanSeen.delete(deviceId); continue; }
      out.push({ beacon: entry.beacon, host: entry.host });
    }
    return out;
  }

  /** Manually inject a discovered target from ConnectionManager or UDP into the beacon cache. */
  addKnownTarget(target: { deviceId: string; deviceName: string; platform: 'desktop' | 'mobile'; host: string; port: number; inviteCode?: string | null }): void {
    if (!target.deviceId || !target.host) return;
    const beacon: any = {
      v: 1,
      businessId: '',
      businessName: 'Shega',
      owner: {
        deviceId: target.deviceId,
        deviceName: target.deviceName,
        platform: target.platform,
      },
      code: target.inviteCode || '',
      role: 'owner',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      suggestedRole: 'cashier',
    };
    const entry: DiscoveredBeacon = {
      beacon,
      host: target.host,
      addresses: [target.host],
      discoveredAt: Date.now(),
    };
    this.lanSeen.set(target.deviceId, entry);
    this.listeners.forEach((fn) => fn(entry));
  }

  /** Subscribe to live beacon arrivals (returns an unsubscribe fn). */
  onFound(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
}

export const mobilePairingBeacon = new MobilePairingBeaconService();
