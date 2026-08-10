// Centralized internet-connectivity detection for Shega.
//
// Screen/caller responsibilities:
//   - Call `assertInternetConnection()` (or wrap with `withConnectivity`) BEFORE
//     any network/API request so offline users never hit the server and get a
//     clear, friendly message instead of a generic API error.
//   - Use `isOfflineError(err)` in catch blocks to show the same friendly
//     message when a request failed because connectivity dropped mid-flight.
//
// Design notes:
//   - A short reachability probe (HEAD/GET to a well-known 204 endpoint) with a
//     hard timeout is used instead of installing a native netinfo dependency,
//     so the app keeps working in Expo Go without a native rebuild.
//   - Results are cached briefly (TTL) and shared while in flight, preventing
//     repeated taps from triggering multiple simultaneous probes.
//   - AppState 'active' transitions invalidate the cached result and re-probe,
//     so the app picks up connectivity the moment the user comes back online.

import { AppState } from 'react-native';

// Points app connectivity probes here. This is a standard reachability
// endpoint (returns HTTP 204) that carries no app/business data and no secrets.
const PROBE_URL = 'https://www.gstatic.com/generate_204';
const PROBE_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 15_000;

export const OFFLINE_MESSAGE =
  'Internet connection is required for this action. Please connect to the internet and try again.';

let cache: { at: number; value: boolean } | null = null;
let inflight: Promise<boolean> | null = null;

async function doProbe(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    fetch(PROBE_URL, {
      method: 'GET',
      cache: 'no-store',
      mode: 'no-cors',
      signal: controller.signal,
    })
      .then(() => resolve(true))
      .catch(() => resolve(false))
      .finally(() => clearTimeout(timer));
  });
}

/**
 * Returns whether we currently believe the device has working internet access.
 * `force` bypasses the short TTL cache for on-demand manual actions.
 */
export async function checkInternetConnection(force = false): Promise<boolean> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }
  if (inflight) return inflight;
  inflight = doProbe()
    .then((value) => {
      cache = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Thrown when a network-dependent action cannot proceed because the device is offline. */
export class OfflineError extends Error {
  constructor(message: string = OFFLINE_MESSAGE) {
    super(message);
    this.name = 'OfflineError';
  }
}

/** Type guard: did this failure happen because the device is offline? */
export const isOfflineError = (error: unknown): error is OfflineError =>
  error instanceof OfflineError;

/**
 * Ensures the device currently has internet access. Throws OfflineError
 * (with a user-friendly message) when it does not — callers should show that
 * message instead of a generic server error.
 */
export async function assertInternetConnection(opts?: { force?: boolean }): Promise<void> {
  const ok = await checkInternetConnection(opts?.force);
  if (!ok) throw new OfflineError();
}

/**
 * Runs `action` only after confirming internet access, so the action never
 * fires a doomed network request while offline.
 */
export async function withConnectivity<T>(
  action: () => Promise<T> | T,
  opts?: { force?: boolean },
): Promise<T> {
  await assertInternetConnection(opts);
  return action();
}

// ---------------------------------------------------------------------------
// Live connectivity status (for UI indicators / one-time checks)
// ---------------------------------------------------------------------------

export type ConnectivityStatus = 'unknown' | 'checking' | 'online' | 'offline';

let status: ConnectivityStatus = 'unknown';
const listeners = new Set<(s: ConnectivityStatus) => void>();

function setStatus(next: ConnectivityStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((l) => l(next));
}

/** Re-probe connectivity (bypasses cache) and publish the resulting status. */
export async function refreshConnectivityStatus(): Promise<ConnectivityStatus> {
  setStatus('checking');
  const ok = await checkInternetConnection(true);
  setStatus(ok ? 'online' : 'offline');
  return status;
}

export function getConnectivityStatus(): ConnectivityStatus {
  return status;
}

export function subscribeConnectivityStatus(listener: (s: ConnectivityStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Re-check whenever the app returns to the foreground so a previously failed
// action can be retried as soon as connectivity is restored.
if (AppState.currentState) {
  AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      refreshConnectivityStatus();
    }
  });
}