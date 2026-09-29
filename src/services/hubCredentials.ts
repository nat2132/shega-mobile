/**
 * P3 — the mobile hub's credential state.
 *
 * The async twin of the desktop's `hub-credentials.ts`: it owns one
 * `HubAuthenticator` for this phone acting as an owner hub, and keeps the
 * durable parts (issued credentials + revocations) in AsyncStorage so an
 * approved device does not have to be re-approved after an app restart.
 *
 * ## Why the same shape on both platforms
 *
 * The crypto and the state machine are shared (`@shega/shared`); only storage
 * and the async-ness differ. Keeping the two facades identical in shape is what
 * makes "one implementation, transports differ" true rather than aspirational
 * — a divergence here is exactly the class of bug the shared module exists to
 * prevent.
 *
 * ## Storage choices
 *
 * The **own** signing key comes from `deviceKeys.ts` (SecureStore / Keystore)
 * and never passes through here. Issued **credentials** and **revocations** are
 * public signed data — not secrets — so AsyncStorage is right for them and keeps
 * the keystore round-trip off the connection hot path.
 */

import {
  HubAuthenticator,
  type AuthChallengeMessage,
  type AuthHandshakeResult,
  type ChallengeProof,
  type DevicePublicKey,
  type MembershipCredential,
  type Revocation,
} from '@shega/shared';
import { getDeviceId } from './syncService';
import { getDeviceIdentity } from './deviceKeys';

const CREDENTIALS_KEY = 'shega:hubCredentials.v1';
const REVOCATIONS_KEY = 'shega:hubRevocations.v1';

function storage(): any {
  const mod = require('@react-native-async-storage/async-storage');
  return mod.default ?? mod;
}

let authenticator: HubAuthenticator | null = null;
let loadPromise: Promise<HubAuthenticator | null> | null = null;

/**
 * The hub authenticator, or null when this install has no identity key yet.
 *
 * Returning null (rather than throwing) matters: a phone that has never paired
 * still has to be able to RUN a hub and answer the owner's own device. Key
 * generation is cheap, so this is only null in the window before the keystore
 * has been read.
 */
export async function getHubAuthenticator(): Promise<HubAuthenticator | null> {
  if (authenticator) return authenticator;
  if (loadPromise) return loadPromise;

  loadPromise = (async (): Promise<HubAuthenticator | null> => {
    let deviceId: string;
    try {
      deviceId = getDeviceId();
    } catch {
      return null;
    }
    let identity: { deviceId: string; publicKey: DevicePublicKey; secretKey: string };
    try {
      identity = await getDeviceIdentity(deviceId);
    } catch {
      // No keystore access: the hub still serves LAN discovery and the join
      // flow, it just cannot issue credentials yet. Callers fall back to the
      // token path rather than failing the connection.
      return null;
    }

    authenticator = new HubAuthenticator({
      deviceId: identity.deviceId,
      publicKey: identity.publicKey,
      secretKey: identity.secretKey,
    });

    try {
      const raw = await storage().getItem(CREDENTIALS_KEY);
      const creds = raw ? (JSON.parse(raw) as Record<string, MembershipCredential>) : {};
      for (const cred of Object.values(creds)) {
        if (cred && typeof cred.signature === 'string') authenticator.rememberCredential(cred);
      }
    } catch { /* corrupted — start with nothing issued */ }
    try {
      const raw = await storage().getItem(REVOCATIONS_KEY);
      const revs = raw ? (JSON.parse(raw) as Revocation[]) : [];
      for (const rev of revs) {
        if (rev && typeof rev.signature === 'string') authenticator.rememberRevocation(rev);
      }
    } catch { /* corrupted — start with nothing revoked */ }

    return authenticator;
  })();

  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

async function persist(creds: Record<string, MembershipCredential>, revs: Revocation[]): Promise<void> {
  const s = storage();
  await s.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
  await s.setItem(REVOCATIONS_KEY, JSON.stringify(revs));
}

async function readStore(): Promise<{ creds: Record<string, MembershipCredential>; revs: Revocation[] }> {
  const s = storage();
  let creds: Record<string, MembershipCredential> = {};
  let revs: Revocation[] = [];
  try {
    const raw = await s.getItem(CREDENTIALS_KEY);
    if (raw) creds = JSON.parse(raw);
  } catch { /* ignore */ }
  try {
    const raw = await s.getItem(REVOCATIONS_KEY);
    if (raw) revs = JSON.parse(raw);
  } catch { /* ignore */ }
  return { creds, revs };
}

/**
 * Mint a credential for a joiner the owner just approved.
 *
 * Returns null when this install cannot act as a hub yet (no identity key) or
 * when the role is 'owner' — the credential format deliberately cannot express
 * owner membership, because the hub IS the owner.
 */
export async function issueJoinerCredential(input: {
  businessId: string;
  deviceId: string;
  devicePublicKey: DevicePublicKey;
  role: string;
}): Promise<MembershipCredential | null> {
  const auth = await getHubAuthenticator();
  if (!auth) return null;
  try {
    const cred = auth.issueFor(input);
    const { creds, revs } = await readStore();
    creds[input.deviceId] = cred;
    await persist(creds, revs);
    return cred;
  } catch (e) {
    console.warn('[hubCredentials] issueJoinerCredential failed:', e);
    return null;
  }
}

export async function getJoinerCredential(deviceId: string): Promise<MembershipCredential | null> {
  const auth = await getHubAuthenticator();
  if (!auth) return null;
  return auth.getCredentialFor(deviceId);
}

export async function beginJoinChallenge(
  credential: MembershipCredential,
  businessId: string,
): Promise<{ challenge: AuthChallengeMessage } | { error: string }> {
  const auth = await getHubAuthenticator();
  if (!auth) return { error: 'hub_not_ready' };
  return auth.beginChallenge(credential, businessId);
}

export async function completeJoinChallenge(
  credential: MembershipCredential,
  proof: ChallengeProof,
): Promise<AuthHandshakeResult> {
  const auth = await getHubAuthenticator();
  if (!auth) return { ok: false, reason: 'hub_not_ready' };
  return auth.completeChallenge(credential, proof);
}

/** Revoke a device. Its credential stops verifying from the next connection on. */
export async function revokeJoinerCredential(input: {
  businessId: string;
  deviceId: string;
  credentialSignature: string;
  reason?: string;
}): Promise<Revocation | null> {
  const auth = await getHubAuthenticator();
  if (!auth) return null;
  try {
    const rev = auth.revoke(input);
    const { creds, revs } = await readStore();
    delete creds[input.deviceId];
    await persist(creds, [...revs.filter((r) => r.deviceId !== input.deviceId), rev]);
    return rev;
  } catch (e) {
    console.warn('[hubCredentials] revokeJoinerCredential failed:', e);
    return null;
  }
}

export async function isJoinerRevoked(deviceId: string): Promise<boolean> {
  const auth = await getHubAuthenticator();
  return auth ? auth.isRevoked(deviceId) : false;
}

/** The hub's public key, for beacons and QR. Null until the keystore is read. */
export async function getHubPublicKey(): Promise<DevicePublicKey | null> {
  const auth = await getHubAuthenticator();
  return auth ? auth.issuerPublicKey : null;
}

/** Diagnostics: what this hub has issued, never the signing key. */
export async function describeIssued(): Promise<Array<{ deviceId: string; role: string; businessId: string }>> {
  const auth = await getHubAuthenticator();
  if (!auth) return [];
  return auth.listIssued().map((c) => ({ deviceId: c.deviceId, role: c.role, businessId: c.businessId }));
}

/** Drop the cached authenticator (tests, or after a key rotation). */
export function resetHubAuthenticator(): void {
  authenticator = null;
  loadPromise = null;
}
