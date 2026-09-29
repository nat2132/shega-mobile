/**
 * Mobile mDNS Publisher — advertises this mobile device as a sync hub on LAN.
 *
 * When a mobile device is in hub mode (capable of accepting incoming sync
 * connections from other mobile or desktop peers), it publishes its service
 * via mDNS/Bonjour so other devices can discover it automatically.
 *
 * This uses the same `_shega-pos._tcp` service type as the Desktop hub,
 * with a `platform=mobile` TXT record to distinguish them.
 *
 * Publishing now goes through the app-wide mobileMdnsRegistry: Android's NSD
 * manager allows exactly ONE live service registration per app, so the hub ad
 * and the pairing beacon (`_shega-pair._tcp`) must share a single slot. The
 * pairing beacon preempts this hub ad while a pairing screen is open, and the
 * registry re-publishes the hub automatically when the beacon stops.
 */

import { PROTOCOL_VERSION } from '@shega/shared';
import { getDeviceId } from './syncService';
import { getMobileSyncPort } from './mobileSyncServer';
import { mdnsRegistry } from './mobileMdnsRegistry';

let warnedMissing = false;

function getCurrentBusinessId(): string | null {
  try {
    const { getDB } = require('../database/db');
    const db = getDB();
    const row = db.getFirstSync(
      "SELECT value FROM app_settings WHERE key = 'active_business_id'"
    );
    if (row?.value) {
      const biz = db.getFirstSync('SELECT uuid FROM businesses WHERE id = ? AND is_deleted = 0', [row.value]);
      if (biz?.uuid) return biz.uuid;
    }
    const fallback = db.getFirstSync(
      "SELECT uuid FROM businesses WHERE is_deleted = 0 ORDER BY (is_default = 1) DESC, created_at LIMIT 1"
    );
    return fallback?.uuid ?? null;
  } catch {
    return null;
  }
}

/**
 * Request this mobile device be advertised as a sync hub on the local network.
 * Other devices (mobile or desktop) will discover it via mDNS.
 *
 * Returns nothing (fire-and-forget); the registry serializes with the pairing
 * beacon and logs the outcome. `getDiscoveryDiagnostics()` in the registry
 * reports the live state.
 */
export function publishMobileHub(): void {
  if (!mdnsRegistry.nativePresent) {
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn('[mDNS] Cannot publish mobile hub: react-native-zeroconf unavailable (native module missing — rebuild the dev client with `npx expo run:android`)');
    }
    return;
  }
  const deviceId = getDeviceId();
  const port = getMobileSyncPort();
  const businessId = getCurrentBusinessId();
  void mdnsRegistry.publish({
    kind: 'hub',
    serviceType: 'shega-pos',
    name: `Shega Mobile Hub (${deviceId.slice(0, 8)})`,
    port,
    txt: {
      device_id: deviceId,
      schema_version: String(PROTOCOL_VERSION),
      port: String(port),
      platform: 'mobile',
      business_id: businessId || '',
      capabilities: 'lan,sync,mobile',
      // P3: pairing_token is intentionally absent. mDNS TXT records are readable
      // by every device on the subnet, so broadcasting the hub's shared bearer
      // here gave it to anyone merely listening. Peers authenticate with a
      // signed membership credential instead; a build too old for that is still
      // ACCEPTED, it just has to receive the token out of band (owner-issued or
      // via the hub QR, which is a physical channel rather than a passive one).
    },
  });
}

/**
 * Stop advertising the mobile hub service. If a pairing beacon is currently
 * live, its slot is left untouched — only the "wanted hub" flag is cleared.
 */
export function unpublishMobileHub(): void {
  void mdnsRegistry.unregister('hub');
}

export function isMobileHubPublished(): boolean {
  return mdnsRegistry.isActive('hub');
}
