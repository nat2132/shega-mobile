// MoR (Ministry of Revenues) taxpayer verification — Section U.
// Mobile half: local cache in app_settings + authenticated calls through the
// Shega backend gateway. Official-API-first: the app NEVER holds MoR
// credentials and never claims "verified" unless the Ministry answered.
import { getAppSetting, setComplianceSetting } from '@/database/db';
import { API_BASE_URL, getStoredToken } from './api';
import {
  buildClientCacheRecord,
  fromMorBackendResponse,
  isVerificationFresh,
  normalizeSubTin,
  normalizeTin,
  type MorBackendResponse,
  type MorVerification,
} from '@shega/shared';

const KEY = 'mor_verifications';

interface StoredMap {
  [tin: string]: MorVerification;
}

const readMap = (): StoredMap => {
  try {
    const raw = getAppSetting(KEY, null);
    return raw ? (JSON.parse(raw) as StoredMap) : {};
  } catch {
    return {};
  }
};

const writeMap = (map: StoredMap) => {
  setComplianceSetting(KEY, JSON.stringify(map));
};

const normalizeTinOrNull = (tin: string): string | null => normalizeTin(tin);

/** Offline-first read of a cached answer for a TIN (may be stale — check helpers). */
export const getCachedVerification = (tin: string, subTin?: string | null): MorVerification | null => {
  const flat = normalizeTinOrNull(tin);
  if (!flat) return null;
  const map = readMap();
  const exact = map[flat];
  if (exact) return exact;
  // tolerate a sub-TIN variant recorded under the same TIN
  const sub = normalizeSubTin(subTin);
  const matches = Object.values(map)
    .filter((v) => v.tin === flat && (!sub || v.subTin === sub))
    .sort((a, b) => (b.cachedAt || '').localeCompare(a.cachedAt || ''));
  return matches[0] ?? exact ?? null;
};

export const listVerifications = (): { verification: MorVerification; fresh: boolean }[] => {
  const map = readMap();
  return Object.values(map)
    .sort((a, b) => (b.cachedAt || '').localeCompare(a.cachedAt || ''))
    .map((verification) => ({ verification, fresh: isVerificationFresh(verification) }));
};

export const clearVerification = (tin: string): void => {
  const flat = normalizeTinOrNull(tin);
  if (!flat) return;
  const map = readMap();
  delete map[flat];
  writeMap(map);
};

const recordOffline = (verification: MorVerification): void => {
  const map = readMap();
  map[verification.tin] = verification;
  writeMap(map);
};

/** Fallback result produced without fabricating a Ministry answer. */
const unreachable = (tin: string, reason: string): MorVerification => ({
  tin,
  subTin: null,
  status: 'unavailable',
  source: 'client-cache',
  reason,
});

/**
 * Verify a TIN with MoR via the Shega backend.
 * - fresh cached answer + no force → served offline (source client-cache).
 * - otherwise calls the gateway; on network/token failure returns the previous
 *   cached record when one exists (marked stale via its cache_until) so offline
 *   users keep their dated answer with a clear "cached" indicator, or an honest
 *   `unavailable` result when there is nothing cached.
 */
export const verifyTin = async (
  tin: string,
  subTin?: string | null,
  force = false,
): Promise<MorVerification> => {
  const flat = normalizeTinOrNull(tin) ?? '';
  if (!flat) {
    return { tin, subTin: subTin ?? null, status: 'unavailable', reason: 'invalid_tin', source: 'client-cache' };
  }
  const sub = normalizeSubTin(subTin);

  if (!force) {
    const cached = getCachedVerification(flat, sub);
    if (cached && isVerificationFresh(cached)) return cached;
  }

  const token = await getStoredToken();
  if (!token) {
    return getCachedVerification(flat, sub) ?? unreachable(flat, 'backend_link_required');
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/mor/verify-tin/`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tin: flat, sub_tin: sub ?? null, force }),
    });
    if (!res.ok) {
      return getCachedVerification(flat, sub) ?? unreachable(flat, res.status === 401 ? 'backend_link_required' : 'backend_unreachable');
    }
    const data: MorBackendResponse = await res.json();
    const record = buildClientCacheRecord(fromMorBackendResponse(data));
    record.subTin = record.subTin ?? sub ?? null;
    recordOffline(record);
    return record;
  } catch {
    // Offline: prefer the dated cached answer with an honest cached indicator.
    return getCachedVerification(flat, sub) ?? unreachable(flat, 'backend_unreachable');
  }
};

/** Persist a verification obtained elsewhere so the cache is coherent. */
export const saveVerification = (verification: MorVerification): void => {
  const map = readMap();
  map[verification.tin] = buildClientCacheRecord(verification);
  writeMap(map);
};