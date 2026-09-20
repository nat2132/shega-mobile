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
 */

import { NativeModules, Platform } from 'react-native';
import {
  type PairingBeacon,
  type BeaconRole,
  encodePairingBeacon,
  decodePairingBeacon,
  isBeaconLive,
} from '@shega/shared';
// The library ships untyped JS whose CJS build exposes the class as
// `exports.default` (not `.Zeroconf`) — handle both shapes defensively.
const ZeroconfMod: any = require('react-native-zeroconf');
const ZeroconfCtor: any = ZeroconfMod?.default ?? ZeroconfMod?.Zeroconf;
// The JS constructor always succeeds even when the native side is missing
// (unlinked module / Expo Go). publishService/scan then throw
// "Cannot read property 'registerService' of null", so gate on the native
// module up front instead of only catching at publish time.
const RNZeroconfNative = NativeModules?.RNZeroconf ?? null;
/** Warn only once per session — publish attempts repeat and would spam. */
let warnedZeroconfMissing = false;
import { getDB } from '../database/db';
import { getDeviceId } from './syncService';
import { getMobileSyncPort } from './mobileSyncServer';

/** Real device name for beacons/discovery lists ("Abebe's iPhone" style). */
export function getThisDeviceName(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Device = require('expo-device');
    const os = Platform.OS === 'ios' ? 'iPhone' : 'Android';
    const owner = Device?.deviceName || Device?.modelName;
    return owner ? `${os} — ${owner}`.slice(0, 48) : os;
  } catch {
    return Platform.OS === 'ios' ? 'iPhone' : 'Android';
  }
}

const PAIR_SERVICE_TYPE = 'shega-pair';

interface DiscoveredBeacon {
  beacon: PairingBeacon;
  host: string;
  addresses: string[];
  discoveredAt: number;
}

type Listener = (entry: DiscoveredBeacon) => void;

class MobilePairingBeaconService {
  private zeroconf: any | null = null;
  private published: PairingBeacon | null = null;
  /** mDNS service name of the beacon we're publishing (needed to unpublish). */
  private publishedName: string | null = null;
  private seen = new Map<string, DiscoveredBeacon>();
  private browsing = false;
  private listeners = new Set<Listener>();
  private rescanTimer: ReturnType<typeof setInterval> | null = null;

  private ensureZeroconf(): any | null {
    if (this.zeroconf) return this.zeroconf;
    try {
      this.zeroconf = new ZeroconfCtor();
    } catch (e: any) {
      console.warn('[pair-beacon] zeroconf unavailable:', e?.message);
      return null;
    }
    return this.zeroconf;
  }

  /** True when the native mDNS module is actually linked (not Expo Go). */
  isSupported(): boolean {
    return !!RNZeroconfNative;
  }

  // ── Owner side: publish / stop ──────────────────────────────────────────

  publishBeacon(beacon: PairingBeacon): void {
    this.stopPublishing();
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
    const zc = this.ensureZeroconf();
    if (!zc) return;
    const deviceId = beacon.owner.deviceId || getDeviceId();
    const port = getMobileSyncPort() || 5759;
    const svcName = `Shega Pair — ${beacon.businessName}`.slice(0, 60);
    try {
      zc.publishService(
        PAIR_SERVICE_TYPE,
        'tcp',
        'local.',
        svcName,
        port,
        {
          device_id: deviceId,
          platform: 'mobile',
          beacon: encodePairingBeacon(beacon),
        },
      );
      this.published = beacon;
      this.publishedName = svcName;
      console.log(`[pair-beacon] publishing "${svcName}" until ${beacon.expiresAt}`);
    } catch (e: any) {
      // Never crash the caller (this runs from button handlers) if the native
      // side blows up at publish time despite the guard above.
      console.warn('[pair-beacon] publish failed:', e?.message);
    }
  }

  stopPublishing(): void {
    if (!this.published) return;
    // react-native-zeroconf exposes unpublishService(name) — there is no
    // unpublishAll(). Keep the service name to unpublish precisely ours.
    try { this.zeroconf?.unpublishService?.(this.publishedName); } catch { /* best-effort */ }
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
  advertiseInvitation(invite: {
    id: string;
    code: string;
    businessId: string;
    role?: string | null;
    expiresAt?: string | null;
  }): void {
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
    this.publishBeacon(beacon);
  }

  /**
   * Discovery mode: when true, this device stays visible/searchable even
   * without an open invite ("Add Team" onboarding / joining mode). While in
   * discovery mode an empty-code beacon is broadcast so other devices can see
   * the device name — joiners learn the device exists; actual joining still
   * requires a live invite code.
   */
  setDiscoverable(on: boolean, businessName = 'Shega', role: BeaconRole = 'owner'): void {
    if (on) {
      if (this.published) return; // a live invite beacon is already stronger
      const db = getDB();
      const biz = db.getFirstSync(
        'SELECT uuid, name FROM businesses WHERE is_deleted = 0 ORDER BY (is_default = 1) DESC, created_at LIMIT 1',
      ) as any;
      const beacon: PairingBeacon = {
        v: 1,
        businessId: biz?.uuid ?? 'discovery',
        businessName: biz?.name ?? businessName,
        owner: {
          deviceId: getDeviceId(),
          deviceName: getThisDeviceName(),
          platform: 'mobile' as const,
        },
        // Discovery-only beacons carry no invite code: they cannot be joined.
        code: '',
        role,
        expiresAt: new Date(Date.now() + 12 * 3600_000).toISOString(),
        suggestedRole: 'cashier' as any,
      };
      this.publishBeacon(beacon);
    } else if (this.published && this.published.code === '') {
      // Only stop if the current beacon is a discovery-only one — never kill
      // a live invite beacon.
      this.stopPublishing();
    }
  }

  // ── Joiner side: browse nearby owners ─────────────────────────────────

  startBrowsing(): void {
    if (this.browsing) return;
    if (!this.isSupported()) {
      // Native mDNS not linked: skip discovery silently; the 6-digit code
      // entry path on the join screen still works.
      if (!warnedZeroconfMissing) {
        warnedZeroconfMissing = true;
        console.warn('[pair-beacon] zeroconf native module unavailable — discovery skipped (manual code entry still works). Run `npx expo run:android` to link the native module.');
      }
      this.browsing = false;
      return;
    }
    const zc = this.ensureZeroconf();
    if (!zc) return;
    zc.on('resolved', (service: any) => {
      const beacon = decodePairingBeacon(service.txtRecord?.beacon);
      if (!beacon || !isBeaconLive(beacon)) return;
      const entry: DiscoveredBeacon = {
        beacon,
        host: service.host || service.ip || '',
        addresses: [service.ip].filter(Boolean),
        discoveredAt: Date.now(),
      };
      this.seen.set(beacon.owner.deviceId, entry);
      this.listeners.forEach((fn) => fn(entry));
    });
    zc.on('remove', (service: any) => {
      // zeroconf gives us the service name only — match it against the
      // known beacon service names (computed the same way as publish).
      const name: string = service?.name || '';
      if (!name) return;
      for (const [deviceId, entry] of this.seen) {
        const svcName = `Shega Pair — ${entry.beacon.businessName}`.slice(0, 60);
        if (name === svcName || name.startsWith(svcName.slice(0, 20))) {
          this.seen.delete(deviceId);
          this.listeners.forEach((fn) => fn({ ...entry, discoveredAt: 0 }));
        }
      }
    });
    try { zc.scan(PAIR_SERVICE_TYPE, 'tcp'); } catch (e: any) { console.warn('[pair-beacon] scan failed:', e?.message); }
    this.browsing = true;
    // Periodic re-scan: devices that enter discovery mode after we started
    // browsing must appear (mDNS caches can miss late advertisers), and stale
    // entries get re-checked. Also auto-start our own discovery beacon so the
    // device is mutually visible on both sides.
    if (this.rescanTimer) clearInterval(this.rescanTimer);
    this.rescanTimer = setInterval(() => {
      if (!this.browsing) return;
      try { zc.scan(PAIR_SERVICE_TYPE, 'tcp'); } catch { /* best-effort */ }
    }, 8000);
    console.log('[pair-beacon] browsing for nearby pairing beacons…');
  }

  stopBrowsing(): void {
    try { this.zeroconf?.stop(); } catch { /* best-effort */ }
    if (this.rescanTimer) { clearInterval(this.rescanTimer); this.rescanTimer = null; }
    this.browsing = false;
    this.seen.clear();
  }

  isBrowsingActive(): boolean {
    return this.browsing;
  }

  /** Snapshot for the discovery list — expired beacons filtered out. */
  getNearbyOwners(): Array<{ beacon: PairingBeacon; host: string }> {
    const out: Array<{ beacon: PairingBeacon; host: string }> = [];
    for (const [deviceId, entry] of this.seen) {
      if (!isBeaconLive(entry.beacon)) { this.seen.delete(deviceId); continue; }
      out.push({ beacon: entry.beacon, host: entry.host });
    }
    return out;
  }

  /** Subscribe to live beacon arrivals (returns an unsubscribe fn). */
  onFound(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
}

export const mobilePairingBeacon = new MobilePairingBeaconService();
