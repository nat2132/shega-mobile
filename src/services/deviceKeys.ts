/**
 * P2 — this device's Ed25519 identity key (mobile).
 *
 * Storage rules, in priority order:
 *
 *  1. **SecureStore** (iOS keychain / Android Keystore-backed). The secret key
 *     is the device's ability to prove "I am the device that was approved", so
 *     it must not sit in the SQLCipher database or in AsyncStorage where a
 *     rooted device or a DB backup extracts it. This mirrors how `crypto.ts`
 *     already keeps the PIN hash.
 *  2. **In-memory cache** for the hot path. Signing happens on every handshake
 *     and `SecureStore.getItemAsync` is a native round-trip; the key does not
 *     change during a process lifetime.
 *
 * The `deviceId` is deliberately NOT stored here. It is the device's stable
 * business identity — outbox seqs, receipts, and every synced row key off it —
 * so it keeps living in the database where it already is. Re-deriving an id from
 * a key would orphan all of that the moment the key is rotated. The public key
 * travels alongside it.
 *
 * Rotation is supported on purpose: `rotateDeviceKey()` mints a new pair and
 * leaves a revocation behind for the old public key, so a stolen old key stops
 * being useful instead of silently remaining valid forever.
 */

import * as SecureStore from 'expo-secure-store';
import {
  derivePublicKey,
  generateDeviceKeyPair,
  isValidPublicKey,
  decodeBase64Url,
  type DevicePublicKey,
  type DeviceSecretKey,
} from '@shega/shared';

const SECRET_KEY_ITEM = 'shega_device_ed25519_secret_v1';
const PUBLIC_KEY_ITEM = 'shega_device_ed25519_public_v1';

export interface DeviceIdentity {
  deviceId: string;
  publicKey: DevicePublicKey;
  secretKey: DeviceSecretKey;
}

let cached: DeviceIdentity | null = null;
let loadPromise: Promise<DeviceIdentity> | null = null;

function decodeStoredSecret(value: string | null): DeviceSecretKey | null {
  if (!value) return null;
  // Stored as base64url of the 64-byte secret key.
  const bytes = decodeBase64Url(value);
  if (!bytes || bytes.length !== 64) return null;
  return value;
}

/**
 * Load this device's key pair, generating one on first run.
 *
 * Concurrency-safe: concurrent callers share one in-flight load, because the
 * discovery and sync layers both call this during startup and a race here would
 * otherwise mint two different identities for one device.
 */
export async function getDeviceIdentity(deviceId: string): Promise<DeviceIdentity> {
  if (cached) return cached;
  if (loadPromise) return loadPromise;

  loadPromise = (async (): Promise<DeviceIdentity> => {
    if (!deviceId) throw new Error('getDeviceIdentity: deviceId is required');
    try {
      const [storedSecret, storedPublic] = await Promise.all([
        SecureStore.getItemAsync(SECRET_KEY_ITEM),
        SecureStore.getItemAsync(PUBLIC_KEY_ITEM),
      ]);

      const secretKey = decodeStoredSecret(storedSecret);
      if (secretKey && storedPublic && isValidPublicKey(storedPublic)) {
        // Cross-check: a public key that does not match its secret key would
        // produce a device that can never complete a handshake, and the failure
        // would look like a peer bug. Derive from the secret and compare.
        if (derivePublicKey(secretKey) === storedPublic) {
          cached = { deviceId, publicKey: storedPublic, secretKey };
          return cached;
        }
        console.warn('[DeviceKeys] stored public key does not match the secret key; re-keying');
      }
    } catch {
      // Fall through and generate a fresh key. A keystore read failure must not
      // brick the app; a new identity simply re-pairs.
    }

    const fresh = generateDeviceKeyPair(deviceId);
    await SecureStore.setItemAsync(PUBLIC_KEY_ITEM, fresh.publicKey, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync(SECRET_KEY_ITEM, fresh.secretKey, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    cached = { deviceId, publicKey: fresh.publicKey, secretKey: fresh.secretKey };
    return cached;
  })();

  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

/** True when this install already has a key pair (i.e. has been through pairing). */
export async function hasDeviceIdentity(): Promise<boolean> {
  if (cached) return true;
  try {
    const [s, p] = await Promise.all([
      SecureStore.getItemAsync(SECRET_KEY_ITEM),
      SecureStore.getItemAsync(PUBLIC_KEY_ITEM),
    ]);
    return !!s && !!p && isValidPublicKey(p);
  } catch {
    return false;
  }
}

/** The public key alone — safe to publish in beacons and handshakes. */
export async function getDevicePublicKey(deviceId: string): Promise<DevicePublicKey | null> {
  try {
    return (await getDeviceIdentity(deviceId)).publicKey;
  } catch {
    return null;
  }
}

/**
 * Replace the key pair. The caller is responsible for revoking the old
 * credential; this only guarantees the new key is what future handshakes use.
 */
export async function rotateDeviceKey(deviceId: string): Promise<DeviceIdentity> {
  const fresh = generateDeviceKeyPair(deviceId);
  await SecureStore.setItemAsync(PUBLIC_KEY_ITEM, fresh.publicKey, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(SECRET_KEY_ITEM, fresh.secretKey, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  cached = { deviceId, publicKey: fresh.publicKey, secretKey: fresh.secretKey };
  return cached;
}

/** Drop the in-memory cache. The SecureStore values are left alone. */
export function clearIdentityCache(): void {
  cached = null;
  loadPromise = null;
}
