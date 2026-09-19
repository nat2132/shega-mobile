/**
 * Mobile mDNS Publisher — advertises this mobile device as a sync hub on LAN.
 *
 * When a mobile device is in hub mode (capable of accepting incoming sync
 * connections from other mobile or desktop peers), it publishes its service
 * via mDNS/Bonjour so other devices can discover it automatically.
 *
 * This uses the same `_shega-pos._tcp` service type as the Desktop hub,
 * with a `platform=mobile` TXT record to distinguish them.
 */

// The library ships untyped JS (publishService/unpublishAll exist at runtime);
// type as any so the real API surface is usable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ZeroconfMod: any = require('react-native-zeroconf');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ZeroconfCtor: any = ZeroconfMod?.default ?? ZeroconfMod?.Zeroconf;
import { getDeviceId } from './syncService';
import { getMobileSyncPort } from './mobileSyncServer';

let zeroconf: any | null = null;
let isPublishing = false;

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
 * Publish this mobile device as a sync hub on the local network.
 * Other devices (mobile or desktop) will discover it via mDNS.
 */
export function publishMobileHub(): void {
  if (isPublishing) return;

  try {
    if (!ZeroconfCtor) {
      console.warn('[mDNS] Cannot publish mobile hub: react-native-zeroconf unavailable');
      return;
    }
    zeroconf = new ZeroconfCtor();
    const deviceId = getDeviceId();
    const port = getMobileSyncPort();
    const businessId = getCurrentBusinessId();

    zeroconf.publishService({
      name: `Shega Mobile Hub (${deviceId.slice(0, 8)})`,
      type: 'shega-pos',
      protocol: 'tcp',
      port,
      txt: {
        device_id: deviceId,
        schema_version: '21',
        port: String(port),
        platform: 'mobile',
        business_id: businessId || '',
        capabilities: 'lan,sync,mobile',
      },
    });

    isPublishing = true;
    console.log(`[mDNS] Publishing mobile hub service on port ${port}`);
  } catch (e: any) {
    console.warn('[mDNS] Failed to publish mobile hub:', e?.message);
  }
}

/**
 * Stop publishing the mobile hub service.
 */
export function unpublishMobileHub(): void {
  if (zeroconf) {
    try { zeroconf.unpublishAll(); } catch {}
    zeroconf = null;
  }
  isPublishing = false;
  console.log('[mDNS] Stopped publishing mobile hub');
}

export function isMobileHubPublished(): boolean {
  return isPublishing;
}
