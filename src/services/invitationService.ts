import { getDB } from '@/database/db';
import {
  getBusiness, getThisDeviceId, addUser, addDevice, setActiveBusiness, setCurrentUserId,
} from '@/services/businessService';
import { wsSyncClient } from '@/services/wsSyncClient';
import { Business } from '@shega/shared';

/**
 * Invitation + device-join flow (spec §4/5/6/26).
 *
 * Owner side: generates a time-limited invitation (code + optional QR URI).
 * Joiner side: validates/claims an invitation and submits a join request
 * (relayed through the LAN hub's DEVICE_JOIN channel, or staged locally when
 * offline) so the owner can approve.
 */

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const codeN = (n: number) =>
  Array.from({ length: n }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

export interface GeneratedInvitation {
  id: string;
  code: string;
  expiresAt: string;
  qrUri: string;
}

export interface InviteRow {
  id: string;
  business_id: string;
  code: string;
  name: string | null;
  role: string | null;
  platform: string | null;
  created_by: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
}

function rowToInvite(row: any): InviteRow {
  return {
    id: row.id,
    business_id: row.business_id,
    code: row.code,
    name: row.name,
    role: row.role,
    platform: row.platform,
    created_by: row.created_by,
    expires_at: row.expires_at,
    status: row.status,
    created_at: row.created_at,
  };
}

/** Owner generates a time-limited invitation for a person/role. */
export function generateInvitation(input: {
  businessId: string;
  name?: string;
  role?: string;
  platform?: 'mobile' | 'desktop';
  createdBy?: string;
  expiresInMinutes?: number;
}): GeneratedInvitation {
  const db = getDB();
  const id = `inv-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const code = `${codeN(3)}-${codeN(3)}-${codeN(3)}`;
  const minutes = input.expiresInMinutes ?? 30;
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
  db.runSync(
    `INSERT INTO invitations (id, business_id, code, name, role, platform, created_by, expires_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [id, input.businessId, code, input.name ?? null, input.role ?? null,
     input.platform ?? 'mobile', input.createdBy ?? null, expiresAt,
     new Date().toISOString()]
  );
  return {
    id,
    code,
    expiresAt,
    qrUri: `shega://join?b=${encodeURIComponent(input.businessId)}&c=${encodeURIComponent(code)}`,
  };
}

/** Open (unexpired) invitations for a business. */
export function getInvitations(businessId: string): InviteRow[] {
  const db = getDB();
  const now = new Date().toISOString();
  const rows = db.getAllSync(
    `SELECT * FROM invitations WHERE business_id = ? AND status = 'open'
     ORDER BY created_at DESC`, [businessId]) as any[];
  rows.forEach((r) => {
    if (r.expires_at && r.expires_at < now) {
      db.runSync(`UPDATE invitations SET status = 'expired' WHERE id = ?`, [r.id]);
      r.status = 'expired';
    }
  });
  return rows.filter((r) => r.status === 'open').map(rowToInvite);
}

export function revokeInvitation(id: string): void {
  const db = getDB();
  db.runSync(`UPDATE invitations SET status = 'revoked' WHERE id = ?`, [id]);
}

/** Resolve a code to a local open invitation (returns null if invalid/expired). */
export function validateInviteCode(code: string): InviteRow | undefined {
  const db = getDB();
  const normalized = code.trim().toUpperCase();
  const row = db.getFirstSync(
    `SELECT * FROM invitations WHERE code = ? AND status = 'open'`, [normalized]) as any;
  if (!row) return undefined;
  if (row.expires_at && row.expires_at < new Date().toISOString()) {
    db.runSync(`UPDATE invitations SET status = 'expired' WHERE id = ?`, [row.id]);
    return undefined;
  }
  return rowToInvite(row);
}

/**
 * The device id this install registered its current join under. Persisted when
 * the request is submitted so approval-status polls always query the exact id
 * the hub recorded — a fresh install with no sync_meta row yet must not fall
 * back to a different (blank) id while waiting for the owner.
 */
export function resolveJoinDeviceId(): string {
  const db = getDB();
  try {
    const row = db.getFirstSync(
      "SELECT value FROM app_settings WHERE key = 'pending_join_device_id'") as any;
    if (row?.value) return row.value;
  } catch { /* settings table may not exist yet on very fresh installs */ }
  return getThisDeviceId() ?? `dev-${Date.now().toString(36)}`;
}

/**
 * Joiner side: submit a join request so the owner can approve. Prefers the LAN
 * hub channel; falls back to a local pending record delivered on next connect.
 * Returns the staged request.
 */
export async function submitJoinRequest(input: {
  businessId: string;
  code: string;
  joinerName: string;
  joinerModel?: string;
  joinerUser: string;
  role: string;
  platform?: 'mobile' | 'desktop';
}): Promise<{ requestId?: string; relayed: boolean }> {
  const deviceId = resolveJoinDeviceId();
  try {
    const db = getDB();
    db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
      ['pending_join_device_id', deviceId]);
  } catch { /* best-effort; the status poll falls back to getThisDeviceId() */ }
  const payload = {
    businessId: input.businessId,
    code: input.code,
    joinerDeviceId: deviceId,
    joinerName: input.joinerName,
    joinerModel: input.joinerModel,
    joinerUser: input.joinerUser,
    role: input.role,
    platform: input.platform ?? 'mobile',
  };
  if (wsSyncClient.isConnected) {
    const ack = await wsSyncClient.submitDeviceJoinRequest(payload);
    return { requestId: ack?.requestId, relayed: true };
  }
  await stageLocalJoin(payload);
  return { relayed: false };
}

/** Local fallback queue (delivered to the hub on next connect). */
async function stageLocalJoin(payload: any): Promise<void> {
  const db = getDB();
  const app = db.getFirstSync(
    `SELECT name FROM app_settings WHERE key = 'pending_join_business'`) as any;
  db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    ['pending_join_business', payload.businessId]);
  db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    ['pending_join_payload', JSON.stringify(payload)]);
}

// ---------- Device limits (spec §29) ----------

/** Count active devices + compute how many more the business plan allows. */
export function deviceLimitStatus(business: Business, activeCount: number): {
  allowed: boolean; availableMobile: number; availableDesktop: number; usedMobile: number; usedDesktop: number;
} {
  // Platform-neutral: Desktop and Mobile are equal first-class platforms, so
  // the binding cap is the TOTAL device allowance, applied across any mix.
  const totalAllowed = Math.max(
    (business as unknown as { maxDevices?: number }).maxDevices ?? 0,
    business.maxMobile,
    business.maxDesktop,
  );
  const usedTotal = activeCount;
  const availableTotal = Math.max(0, totalAllowed - usedTotal);
  return {
    allowed: availableTotal > 0,
    usedMobile: usedTotal,
    usedDesktop: 0,
    availableMobile: availableTotal,
    availableDesktop: availableTotal,
  };
}

export function getActiveDeviceCount(businessId: string): number {
  const db = getDB();
  const row = db.getFirstSync(
    `SELECT COUNT(*) as n FROM devices WHERE business_id = ? AND status = 'active' AND is_deleted = 0`,
    [businessId]) as any;
  return row?.n ?? 0;
}

export function canAddDevice(businessId: string): boolean {
  const business = getBusiness(businessId);
  if (!business) return false;
  return deviceLimitStatus(business, getActiveDeviceCount(businessId)).allowed;
}

const localId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

/**
 * Owner approved the join: restore the business identity on this joiner device.
 * Creates a local business row whose `uuid == id == businessId` (the identity the
 * owner knows), adds the employee (non-owner), marks THIS device active, and
 * switches to the business — the joiner becomes an activated member who will
 * receive the shared roster/sync via the hub channel.
 */
export function restoreBusinessFromJoin(info: {
  businessId: string;
  name: string;
  joinerUser: string;
  role: string;
  joinerName?: string;
  /** Owner-assigned identity: overrides the joiner's self-entered name. */
  assignedName?: string | null;
  assignedAvatar?: string | null;
  /** PermissionSet override chosen by the owner for a Custom role. */
  assignedPermissions?: Record<string, unknown> | null;
}): Business {
  const db = getDB();
  try {
    db.runSync("DELETE FROM app_settings WHERE key = 'pending_join_device_id'");
  } catch { /* ignore */ }
  const existing = getBusiness(info.businessId);
  if (existing) {
    setActiveBusiness(info.businessId);
    return existing;
  }
  const now = new Date().toISOString();
  const code = (info.name.trim() || 'SHOP').replace(/[^A-Za-z0-9]/gi, '').toUpperCase().slice(0, 5) || 'SHOP';
  const isFirst = (db.getFirstSync('SELECT COUNT(*) as n FROM businesses') as any)?.n === 0;
  db.runSync(
    `INSERT INTO businesses (id, name, owner_user_id, currency, plan_label, max_mobile, max_desktop, is_default, business_code, uuid, created_at, is_synced)
     VALUES (?, ?, NULL, 'ETB', NULL, 1, 0, ?, ?, ?, ?, 1)`,
    [info.businessId, info.name.trim(), isFirst ? 1 : 0, code, info.businessId, now]
  );
  const person = addUser({ businessId: info.businessId, name: info.joinerUser.trim() || 'Member', role: info.role || 'cashier' });
  // Apply the owner-assigned identity: display name, profile picture and —
  // for Custom roles — the exact permission set the owner picked.
  try {
    const finalName = (info.assignedName || '').trim();
    if (finalName || info.assignedAvatar !== undefined) {
      const db2 = getDB();
      const sets: string[] = [];
      const vals: any[] = [];
      if (finalName) { sets.push('name = ?'); vals.push(finalName); }
      if (info.assignedAvatar) { sets.push('avatar = ?'); vals.push(info.assignedAvatar); }
      if (info.assignedPermissions && typeof info.assignedPermissions === 'object') {
        sets.push('permissions = ?'); vals.push(JSON.stringify(info.assignedPermissions));
      }
      if (sets.length) {
        sets.push('updated_at = ?'); vals.push(new Date().toISOString());
        vals.push(person.id);
        db2.runSync(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
      }
    }
  } catch { /* best-effort identity application */ }
  const deviceId = getThisDeviceId() ?? localId('dev');
  addDevice({
    businessId: info.businessId,
    name: info.joinerName || info.joinerUser.trim() || 'My Device',
    platform: 'mobile',
    userId: person.id,
    role: info.role || 'cashier',
  }, deviceId);
  setActiveBusiness(info.businessId);
  setCurrentUserId(person.id);
  return getBusiness(info.businessId)!;
}
