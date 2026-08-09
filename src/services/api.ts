// Central HTTP client + configuration for the Shega Django backend.
//
// NOTE: The backend base URL is intentionally a configurable placeholder.
// Point API_BASE_URL at your deployed Django REST API (e.g.
// https://api.yourdomain.com/api) before shipping.

import * as SecureStore from 'expo-secure-store';

// Production base URL for the Shega Django backend deployed on Render.
// Override via EXPO_PUBLIC_API_URL (e.g. for local development against a
// local backend, set EXPO_PUBLIC_API_URL="http://10.0.2.2:8000").
import Constants from 'expo-constants';

const ENV_API_URL: string | undefined =
  (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.apiUrl as string | undefined;

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ||
  ENV_API_URL ||
  'https://shega-api-dah3.onrender.com';

const TOKEN_KEY = 'shega_access_token';
const REFRESH_TOKEN_KEY = 'shega_refresh_token';
const USER_KEY = 'shega_user';

// ---------------------------------------------------------------------------
// Secure token + user persistence
// ---------------------------------------------------------------------------

export const getStoredToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredToken = async (token: string | null): Promise<void> => {
  try {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (e) {
    console.error('[API] Failed to persist token', e);
  }
};

export const getStoredRefreshToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredRefreshToken = async (refresh: string | null): Promise<void> => {
  try {
    if (refresh) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch (e) {
    console.error('[API] Failed to persist refresh token', e);
  }
};

export const getStoredUser = async <T = AccountUser>(): Promise<T | null> => {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const setStoredUser = async <T = AccountUser>(user: T | null): Promise<void> => {
  try {
    if (user) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } else {
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  } catch (e) {
    console.error('[Auth] Failed to persist user', e);
  }
};

export const clearAuthStorage = async (): Promise<void> => {
  await setStoredToken(null);
  await setStoredRefreshToken(null);
  await setStoredUser(null);
};

// ---------------------------------------------------------------------------
// Types (mirror the Django REST API contract)
// ---------------------------------------------------------------------------

export interface AccountUser {
  id: number;
  name: string;
  email: string;
  business_name: string;
}

export interface Plan {
  id: number;
  name: string;
  display_name: string;
  price: number;
  duration_months: number;
  features?: string[];
  description?: string;
}

export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface PaymentInfo {
  id?: number;
  plan_id?: number;
  plan_name?: string;
  transaction_id?: string;
  amount?: number;
  status: PaymentStatus;
  reason?: string;
  created_at?: string;
}

export interface SubscriptionStatusInfo {
  plan?: string;
  plan_name?: string;
  status: 'none' | 'pending' | 'active' | 'expired' | 'rejected';
  expires_at?: string;
  started_at?: string;
  license_key?: string;
}

export interface LicenseStatusInfo {
  valid: boolean;
  plan?: string;
  expires_at?: string;
  license_key?: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

interface HttpOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  retried?: boolean;
}

export class ApiError extends Error {
  status: number;
  detail?: string;
  retryAfter?: number; // seconds, when a 429 carries a Retry-After header
  constructor(status: number, message: string, detail?: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.detail = detail;
    this.retryAfter = retryAfter;
  }
}

export class RateLimitError extends ApiError {
  /**
   * Thrown for HTTP 429 (Too Many Requests). `retryAfter` (in seconds) comes
   * from the `Retry-After` response header when the server provides one.
   *
   * Recommended handling: disable the triggering UI control, start a countdown,
   * and re-enable / retry the action once `retryAfter` has elapsed.
   */
  constructor(message: string, retryAfter?: number) {
    super(429, message, undefined, retryAfter);
    this.name = 'RateLimitError';
  }
}

let refreshPromise: Promise<boolean> | null = null;

// Exchanges a stored refresh token for a fresh access token. The backend
// rotates refresh tokens (SIMPLE_JWT ROTATE_REFRESH_TOKENS=True), so the new
// refresh token is persisted too. A single in-flight refresh is shared across
// concurrent requests to avoid stampedes when the access token expires.
export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refresh = await getStoredRefreshToken();
      if (!refresh) return false;
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh/`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) return false;
      const data: { access?: string; refresh?: string } = await res.json();
      if (!data.access) return false;
      await setStoredToken(data.access);
      if (data.refresh) await setStoredRefreshToken(data.refresh);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request<T = unknown>(path: string, options: HttpOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false, retried = false } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (auth) {
    const token = await getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, 'Unable to reach the server. Check your connection and try again.', String(e));
  }

  let data: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (response.status === 401 && auth && !retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, { ...options, retried: true });
    }
  }

  // 401 token refresh handled above. 429 (rate limit) is surfaced as a typed
  // RateLimitError so callers can back off for the hinted period instead of the
  // request being retried immediately (which only makes throttling worse).
  if (response.status === 429) {
    let retryAfter: number | undefined;
    const retryHeader = response.headers.get('Retry-After');
    if (retryHeader) {
      const asNum = Number(retryHeader);
      if (!Number.isNaN(asNum)) {
        retryAfter = asNum;
      } else {
        const parsed = Date.parse(retryHeader);
        if (!Number.isNaN(parsed)) {
          retryAfter = Math.max(1, Math.ceil((parsed - Date.now()) / 1000));
        }
      }
    }
    const msg =
      extractErrorMessage(data) ||
      'Too many requests. Please wait before trying again.';
    throw new RateLimitError(msg, retryAfter);
  }

  if (!response.ok) {
    const msg = extractErrorMessage(data) || `Request failed with status ${response.status}`;
    throw new ApiError(response.status, msg, typeof data === 'string' ? data : undefined);
  }

  return data as T;
}

function extractErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.detail === 'string') return obj.detail;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  if (typeof obj.non_field_errors === 'string') return obj.non_field_errors;
  if (Array.isArray(obj.non_field_errors) && obj.non_field_errors.length) {
    return String(obj.non_field_errors[0]);
  }
  // Take the first field error for friendly messages.
  for (const value of Object.values(obj)) {
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return `${String(keyOf(obj, value))}: ${value[0]}`;
    }
    if (typeof value === 'string') return value;
  }
  return null;
}

function keyOf(obj: Record<string, unknown>, value: unknown): string {
  return Object.keys(obj).find((k) => obj[k] === value) || 'field';
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

export const registerUser = (payload: {
  name: string;
  email: string;
  business_name: string;
  password: string;
}): Promise<{ token?: string; access?: string; refresh?: string; user?: AccountUser; id?: number; name?: string; email?: string; business_name?: string }> =>
  request('/api/auth/register/', { method: 'POST', body: payload });

export const loginUser = (payload: {
  email: string;
  password: string;
}): Promise<{ access?: string; refresh?: string; token?: string; user?: AccountUser }> =>
  request('/api/auth/login/', { method: 'POST', body: payload });

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export const fetchPlans = (): Promise<Plan[]> =>
  request<Plan[]>('/api/plans/', { auth: true });

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const createPayment = (payload: {
  plan_id: number;
  transaction_id: string;
}): Promise<PaymentInfo> =>
  request<PaymentInfo>('/api/payments/create/', { method: 'POST', body: payload, auth: true });

export const fetchMyPayment = (): Promise<PaymentInfo> =>
  request<PaymentInfo>('/api/payments/my-payment/', { auth: true });

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export const fetchSubscriptionStatus = (): Promise<SubscriptionStatusInfo> =>
  request<SubscriptionStatusInfo>('/api/subscription/status/', { auth: true });

// ---------------------------------------------------------------------------
// License
// ---------------------------------------------------------------------------

export const fetchLicenseStatus = (): Promise<LicenseStatusInfo> =>
  request<LicenseStatusInfo>('/api/license/status/', { auth: true });

export const verifyLicense = (payload: { license_key: string }): Promise<LicenseStatusInfo> =>
  request<LicenseStatusInfo>('/api/license/verify/', { method: 'POST', body: payload, auth: true });

// ---------------------------------------------------------------------------
// Error handling helpers
// ---------------------------------------------------------------------------

/** Type guard: narrow an unknown thrown value to a RateLimitError. */
export const isRateLimited = (error: unknown): error is RateLimitError =>
  error instanceof RateLimitError;

/** Human-readable wait hint, e.g. "1 minute" or "30 seconds". */
export const formatRetryAfter = (seconds?: number): string => {
  if (!seconds || !Number.isFinite(seconds) || seconds < 1) return '';
  if (seconds < 60) {
    return `${Math.round(seconds)} second${Math.round(seconds) === 1 ? '' : 's'}`;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
};

/**
 * Convert any thrown value into a friendly, display-ready message + optional
 * retry hint. Use this in UI catch blocks so 429s render a countdown instead of
 * a generic "request failed".
 */
export const handleApiError = (error: unknown): { message: string; retryAfter?: number; status: number } => {
  if (error instanceof RateLimitError) {
    const wait = error.retryAfter;
    const hint = formatRetryAfter(wait);
    const message = hint
      ? `${error.message} Try again in ${hint}.`
      : error.message || 'Too many requests. Please try again shortly.';
    return { message, retryAfter: wait, status: 429 };
  }
  if (error instanceof ApiError) {
    return { message: error.message, status: error.status };
  }
  if (error instanceof Error) {
    return { message: error.message, status: 0 };
  }
  return { message: 'Something went wrong. Please try again.', status: 0 };
};