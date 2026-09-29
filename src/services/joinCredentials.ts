/**
 * P3 — the joiner side of the authenticated handshake (mobile).
 *
 * ## What is stored where, and why
 *
 * The **credential** is a signed public assertion from the owner device: it
 * proves "the owner admitted this device for this business at this role", and
 * anyone holding it can read all of that. It is not a secret, so it lives in
 * AsyncStorage next to the other re-dial state (`shega:rejoinBundle`) rather
 * than in the keystore.
 *
 * The **secret key** is the other half and it never comes near this file: it
 * stays in `deviceKeys.ts` (SecureStore / Keystore) and is only ever used to
 * sign a challenge. A stolen credential alone gets an attacker nothing; the
 * proof requires the key.
 *
 * ## Why a persisted credential is not a session token
 *
 * The old flow handed out a bearer token that was valid forever and identical
 * for every device on the hub. This credential is scoped to one business, one
 * device id, one public key and one role, and the hub can revoke it
 * independently. Possession of it proves nothing on its own — the challenge
 * exchange is what turns it into authentication.
 */

import { JoinerAuthenticator, type MembershipCredential } from '@shega/shared';
import { getDeviceIdentity, type DeviceIdentity } from './deviceKeys';

const CREDENTIAL_KEY = 'shega:membershipCredential';
/**
 * Per-request poll token for the in-flight join.
 *
 * The join channel is unauthenticated, so the hub only hands out a credential
 * (or the legacy token) to whoever presents this. Persisted because the join
 * outlives an app restart — a joiner that is killed while waiting for the owner
 * must still be able to collect its credential when it comes back.
 */
const POLL_TOKEN_KEY = 'shega:joinPollToken';

export async function saveJoinPollToken(token: string | null | undefined): Promise<void> {
  try {
    if (!token) return;
    await storage().setItem(POLL_TOKEN_KEY, String(token));
  } catch { /* the joiner can still collect nothing this release; it re-submits */ }
}

export async function loadJoinPollToken(): Promise<string | null> {
  try {
    return (await storage().getItem(POLL_TOKEN_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function clearJoinPollToken(): Promise<void> {
  try { await storage().removeItem(POLL_TOKEN_KEY); } catch { /* nothing to clear */ }
}

function storage(): any {
  const mod = require('@react-native-async-storage/async-storage');
  return mod.default ?? mod;
}

/** Read the credential this device was issued, if it still has one. */
export async function loadMembershipCredential(): Promise<MembershipCredential | null> {
  try {
    const raw = await storage().getItem(CREDENTIAL_KEY);
    if (!raw) return null;
    const cred = JSON.parse(raw) as MembershipCredential;
    // A truncated or hand-edited blob must not be treated as a credential: the
    // handshake would fail later with a confusing "bad signature" instead of
    // falling back to the token path here.
    if (!cred || typeof cred.signature !== 'string' || typeof cred.deviceId !== 'string') {
      return null;
    }
    if (Number.isFinite(cred.expiresAt) && cred.expiresAt < Date.now()) {
      // Expired: drop it so the next approval can issue a fresh one.
      await clearMembershipCredential();
      return null;
    }
    return cred;
  } catch {
    return null;
  }
}

/** Persist a credential the owner just issued. */
export async function saveMembershipCredential(cred: MembershipCredential): Promise<void> {
  try {
    await storage().setItem(CREDENTIAL_KEY, JSON.stringify(cred));
  } catch (e) {
    console.warn('[joinCredentials] failed to persist credential:', e);
  }
}

export async function clearMembershipCredential(): Promise<void> {
  try {
    await storage().removeItem(CREDENTIAL_KEY);
  } catch { /* nothing to clear */ }
}

/**
 * Validate a credential arriving from the owner and keep it.
 *
 * The `acceptCredential` guard is load-bearing: it refuses a credential whose
 * device id or public key is not ours, so a hub cannot talk this device into
 * authenticating as somebody else's. A rejection here is treated as "this
 * approval is not for me" and the credential is dropped rather than retried.
 */
export async function acceptMembershipCredential(cred: MembershipCredential): Promise<boolean> {
  if (!cred || typeof cred.signature !== 'string') return false;
  let identity: DeviceIdentity;
  try {
    identity = await getDeviceIdentity(cred.deviceId);
  } catch {
    return false;
  }
  const joiner = new JoinerAuthenticator({
    deviceId: identity.deviceId,
    publicKey: identity.publicKey,
    secretKey: identity.secretKey,
  });
  try {
    joiner.acceptCredential(cred);
  } catch (e) {
    console.warn('[joinCredentials] rejected credential:', e);
    return false;
  }
  await saveMembershipCredential(cred);
  return true;
}

export interface JoinerHandle {
  joiner: JoinerAuthenticator;
  identity: DeviceIdentity;
}

/**
 * A ready-to-answer authenticator, or null when this device has no credential
 * yet (first pairing, or a device that predates the handshake). Callers fall
 * back to the token path in that case rather than failing the connection.
 */
export async function getJoinerHandle(): Promise<JoinerHandle | null> {
  const cred = await loadMembershipCredential();
  if (!cred) return null;
  let identity: DeviceIdentity;
  try {
    identity = await getDeviceIdentity(cred.deviceId);
  } catch {
    return null;
  }
  const joiner = new JoinerAuthenticator({
    deviceId: identity.deviceId,
    publicKey: identity.publicKey,
    secretKey: identity.secretKey,
  });
  try {
    joiner.acceptCredential(cred);
  } catch {
    // The stored credential no longer matches our key (device identity was
    // re-keyed). It is useless to us — drop it so the next approval re-issues.
    await clearMembershipCredential();
    return null;
  }
  return { joiner, identity };
}

/** Diagnostics surface: what this device will present, never the key itself. */
export function describeCredential(cred: MembershipCredential | null) {
  if (!cred) return null;
  return {
    businessId: cred.businessId,
    role: cred.role,
    deviceId: cred.deviceId,
    issuedAt: cred.issuedAt,
    expiresAt: cred.expiresAt ?? null,
    issuerPublicKey: cred.issuerPublicKey,
  };
}
