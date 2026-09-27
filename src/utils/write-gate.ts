/**
 * View-only access rules for Shega Mobile.
 *
 * The backend is the source of truth for the subscription, but the app must also
 * honour the clock: a trial or a monthly term that has run out must lock writes
 * even when the last synced status string still says `trial` or `active` (the
 * device may be offline, or nobody may have synced yet). Keying off the status
 * string alone is what let expired installs keep editing.
 *
 * Reads are never gated — an expired account keeps full visibility of its data.
 * Only mutations are blocked, and only until the subscription is renewed.
 */

/** Statuses that lock writes regardless of any date. */
export const LOCKED_STATUSES = [
  'expired',
  'cancelled',
  'rejected',
  'pending_verification',
  'pending_payment',
  'payment_rejected',
] as const;

export type AccessBlockReason = 'locked_status' | 'trial_ended' | 'expired';

export interface AccessSnapshot {
  status?: string | null;
  /** End of the paid term. */
  expiresAt?: string | null;
  /** End of the trial term. */
  trialEndsAt?: string | null;
  isTrial?: boolean;
}

export type AccessVerdict =
  | { allowed: true }
  | { allowed: false; reason: AccessBlockReason; status: string };

/** Marker so callers can distinguish a lock from an ordinary failure. */
export const VIEW_ONLY_CODE = 'SUBSCRIPTION_REQUIRED';

export class SubscriptionRequiredError extends Error {
  readonly code = VIEW_ONLY_CODE;
  readonly reason: AccessBlockReason;
  readonly status: string;

  constructor(reason: AccessBlockReason, status: string) {
    super(`[${VIEW_ONLY_CODE}] Your subscription does not allow editing business data.`);
    this.name = 'SubscriptionRequiredError';
    this.reason = reason;
    this.status = status;
  }
}

function timeOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Whether business data may be written right now.
 *
 * Fails open on missing or unparseable dates: a broken record must never lock a
 * paying customer out of their own shop, and the next status sync corrects it.
 */
export function evaluateAccess(snapshot: AccessSnapshot | null | undefined, now: number = Date.now()): AccessVerdict {
  const status = (snapshot?.status || '').trim();
  // No subscription row at all — a fresh install still needs to be usable.
  if (!status) return { allowed: true };

  if ((LOCKED_STATUSES as readonly string[]).includes(status)) {
    return { allowed: false, reason: 'locked_status', status };
  }

  const isTrial = snapshot?.isTrial ?? status === 'trial';
  const end = timeOf(isTrial ? snapshot?.trialEndsAt ?? snapshot?.expiresAt : snapshot?.expiresAt);

  if (end !== null && end <= now) {
    return { allowed: false, reason: isTrial ? 'trial_ended' : 'expired', status };
  }

  return { allowed: true };
}

export function isWriteBlocked(snapshot: AccessSnapshot | null | undefined, now?: number): boolean {
  return !evaluateAccess(snapshot, now).allowed;
}
