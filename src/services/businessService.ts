import { getDB, getAppSetting } from '@/database/db';
import { notifyLocalDataChanged } from './syncService';
import {
  Business, User, Device, Register, Location, CustomRole,
  PermissionSet, PermissionValue, BuiltinRoleKey, getBuiltinRole, DEFAULT_ROLE_SETS,
  BUILTIN_ROLES, PLANS,
} from '@shega/shared';
import { checkPermission, PermissionContext, PermissionCheckResult } from '@shega/shared';
import { hashPin, verifyPin } from './sqlcipher';
import { scrypt } from 'scrypt-js';

/**
 * Repository + use-case layer for the shared business model on Mobile.
 *
 * These tables are added by initDB (businesses, users, business_roles, devices,
 * locations, registers). UUID text ids keep records unique across devices.
 */

let uuidCounter = 0;
function newUuid(): string {
  uuidCounter += 1;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now().toString(36)}-${uuidCounter}`;
}

/**
 * A business row carries both a TEXT `id` and a `uuid`. Locally the two are
 * equal, but rows that arrived over sync (notably from Desktop, whose legacy
 * business ids can differ from the shared uuid) may reference a business by
 * either value in their `business_id` column. Resolving the full set of
 * acceptable values keeps a business's users, devices, registers, locations and
 * roles loading together — never a half-empty Business Center.
 */
export function businessIdVariants(businessId: string): string[] {
  const ids = new Set<string>([String(businessId)]);
  try {
    const row = getDB().getFirstSync(
      'SELECT id, uuid FROM businesses WHERE id = ? OR uuid = ? LIMIT 1',
      [businessId, businessId]
    ) as any;
    if (row?.id) ids.add(String(row.id));
    if (row?.uuid) ids.add(String(row.uuid));
  } catch { /* businesses table may not exist yet on very fresh installs */ }
  return Array.from(ids);
}

/** SQL fragment + params matching any id/uuid representation of a business. */
function businessIdClause(businessId: string, column = 'business_id'): { sql: string; params: string[] } {
  const variants = businessIdVariants(businessId);
  return {
    sql: `(${variants.map((v) => `${column} = ?`).join(' OR ')})`,
    params: variants,
  };
}


function rowToBusiness(row: any): Business {
  const maxMobile = row.max_mobile ?? 1;
  const maxDesktop = row.max_desktop ?? 0;
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    currency: row.currency ?? 'ETB',
    planLabel: row.plan_label,
    // Platform-neutral allowance: the binding cap is the total (max of the two
    // legacy per-platform columns, which are kept equal at seed time).
    maxDevices: row.max_devices ?? Math.max(maxMobile, maxDesktop),
    maxMobile,
    maxDesktop,
    isDefault: !!row.is_default,
    createdAt: row.created_at,
  };
}

function safeParseJson<T = any>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    // A malformed permission blob must never crash the Business Center — fall
    // back to the role defaults (deny-by-default for anything not granted).
    return fallback;
  }
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    username: row.username ?? undefined,
    avatar: row.avatar ?? undefined,
    role: row.role,
    roleName: row.role_name,
    permissions: row.permissions ? safeParseJson<PermissionSet>(row.permissions, {}) : undefined,
    assignedRegisterId: row.assigned_register_id ?? undefined,
    assignedLocationId: row.assigned_location_id ?? undefined,
    isActive: !!row.is_active,
    isOwner: !!row.is_owner,
    createdAt: row.created_at,
  };
}

function rowToDevice(row: any): Device {
  return {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    name: row.name,
    model: row.model,
    platform: row.platform,
    registerId: row.register_id,
    role: row.role,
    status: row.status,
    pairingCode: row.pairing_code,
    pairingExpiresAt: row.pairing_expires_at,
    lastSeenAt: row.last_seen_at,
    lastSyncAt: row.last_sync_at,
    appVersion: row.app_version,
    isPrimary: !!row.is_primary,
    createdAt: row.created_at,
  };
}

function rowToRegister(row: any): Register {
  return {
    id: row.id,
    businessId: row.business_id,
    locationId: row.location_id,
    name: row.name,
    deviceId: row.device_id,
    printerName: row.printer_name,
    hasDrawer: !!row.has_drawer,
    isActive: !!row.is_active,
    createdAt: row.created_at,
  };
}

function rowToLocation(row: any): Location {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    address: row.address,
    createdAt: row.created_at,
  };
}

// ---------- Business ----------

/**
 * Placeholder names this app used to persist when it had no real business
 * name. They carry no user intent, so they are always safe to replace with a
 * configured name from the account.
 */
const PLACEHOLDER_BUSINESS_NAMES = new Set(['', 'my business', 'shega business', 'business', 'untitled']);

/**
 * True when a name is just an account email address rather than a real
 * business name.
 *
 * This deliberately does NOT treat every '@' as invalid: a business name may
 * legitimately contain one. We only flag values that actually look like an
 * email address, or that are exactly the signed-in account's email.
 */
export function isEmailLikeBusinessName(name: string | null | undefined, accountEmail?: string | null): boolean {
  const raw = (name || '').trim();
  if (!raw) return false;
  const email = (accountEmail || '').trim().toLowerCase();
  if (email && raw.toLowerCase() === email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

/** True when the name is a known placeholder or blank. */
export function isPlaceholderBusinessName(name: string | null | undefined): boolean {
  return PLACEHOLDER_BUSINESS_NAMES.has((name || '').trim().toLowerCase());
}

/**
 * Picks the first candidate that is a real business name — skipping blanks,
 * placeholders and email addresses. `fallback` is used when nothing qualifies.
 */
export function resolveBusinessName(
  candidates: (string | null | undefined)[],
  fallback = 'My Business'
): string {
  for (const candidate of candidates) {
    const value = (candidate || '').trim();
    if (!value) continue;
    if (isPlaceholderBusinessName(value)) continue;
    if (isEmailLikeBusinessName(value)) continue;
    return value;
  }
  return fallback;
}

/**
 * Repairs a local business whose name was never resolved from the account —
 * it is blank, a placeholder, or just the user's email — by applying the
 * configured business name.
 *
 * Non-destructive by design: a business that already has a real, distinct name
 * is never overwritten, so a name the user typed in the setup wizard or profile
 * settings always wins. Returns the resulting business.
 */
export function reconcileBusinessName(
  business: Business,
  candidates: (string | null | undefined)[],
  accountEmail?: string | null
): Business {
  const current = (business.name || '').trim();
  const needsRepair =
    isPlaceholderBusinessName(current) || isEmailLikeBusinessName(current, accountEmail);
  if (!needsRepair) return business;

  const desired = resolveBusinessName(candidates);
  // Never "repair" a name into another placeholder.
  if (isPlaceholderBusinessName(desired) || isEmailLikeBusinessName(desired, accountEmail)) return business;
  if (desired === current) return business;

  try {
    return updateBusiness(business.id, { name: desired });
  } catch {
    return business;
  }
}

export function getBusinesses(): Business[] {
  const db = getDB();
  const rows = db.getAllSync('SELECT * FROM businesses WHERE is_deleted = 0 ORDER BY created_at');
  return (rows as any[]).map(rowToBusiness);
}

export function getBusiness(businessId: string): Business | undefined {
  const db = getDB();
  // Accept either representation: the local `id` or the shared `uuid`. A
  // synced business (e.g. from Desktop) can be referenced by the other value
  // in `active_business_id`, which must still resolve to the right business.
  const row = db.getFirstSync(
    'SELECT * FROM businesses WHERE (id = ? OR uuid = ?) AND is_deleted = 0 LIMIT 1',
    [businessId, businessId]
  );
  return row ? rowToBusiness(row) : undefined;
}

export function getDefaultBusiness(): Business | undefined {
  const db = getDB();
  const row = db.getFirstSync('SELECT * FROM businesses WHERE is_default = 1 AND is_deleted = 0 LIMIT 1');
  if (row) return rowToBusiness(row);
  const all = getBusinesses();
  return all[0];
}

export function getActiveBusiness(): Business | undefined {
  const activeId = getAppSetting('active_business_id', null);
  if (activeId) {
    const b = getBusiness(activeId);
    if (b) return b;
  }
  return getDefaultBusiness();
}

export function setActiveBusiness(businessId: string): void {
  const db = getDB();
  db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['active_business_id', businessId]);
  // The "active business" is part of the app's observable state: screens read
  // it through useBusinessAuth / BusinessScopeContext, so a switch must notify
  // them exactly like a data change does.
  notifyLocalDataChanged();
}

/** Update an existing business's metadata (name, logo, currency) and queue for sync. */
export function updateBusiness(
  businessId: string,
  patch: {
    name?: string;
    logo?: string | null;
    currency?: string;
  }
): Business {
  const db = getDB();
  const current = getBusiness(businessId);
  if (!current) throw new Error('Business not found');

  const name = patch.name?.trim() || current.name;
  const now = new Date().toISOString();

  db.runSync(
    'UPDATE businesses SET name = ?, logo = COALESCE(?, logo), currency = COALESCE(?, currency), updated_at = ?, row_version = row_version + 1, is_synced = 0 WHERE id = ?',
    [name, patch.logo ?? null, patch.currency ?? null, now, businessId]
  );

  notifyLocalDataChanged();
  return getBusiness(businessId)!;
}

/** Soft-delete a business and switch to another business if it was active. */
export function deleteBusiness(businessId: string): { ok: boolean; newActiveId?: string } {
  const db = getDB();
  const all = getBusinesses();
  if (all.length <= 1) {
    throw new Error('Cannot delete the only business. Create another business first.');
  }

  const target = getBusiness(businessId);
  if (!target) throw new Error('Business not found.');

  const now = new Date().toISOString();
  db.runSync(
    'UPDATE businesses SET is_deleted = 1, updated_at = ?, is_synced = 0, row_version = row_version + 1 WHERE id = ?',
    [now, businessId]
  );

  let newActiveId: string | undefined = undefined;
  const activeId = getAppSetting('active_business_id', null);
  if (activeId === businessId) {
    const remaining = getBusinesses();
    if (remaining.length > 0) {
      newActiveId = remaining[0].id;
      setActiveBusiness(newActiveId);
    }
  }

  notifyLocalDataChanged();
  return { ok: true, newActiveId };
}

/**
 * Owner-only: set the business profile image (logo). The change rides the
 * normal sync outbox (businesses UPDATE trigger) so it reaches the desktop,
 * where it lands in `businesses.logo`.
 */
export function setBusinessLogo(businessId: string, logoUri: string | null): { ok: boolean; error?: string } {
  const db = getDB();
  const uid = getCurrentUserId();
  const me = uid ? getUser(uid) : undefined;
  if (!me || !me.isOwner) {
    return { ok: false, error: 'Only the business owner can change the business image.' };
  }
  try {
    db.runSync('UPDATE businesses SET logo = ?, updated_at = ?, row_version = row_version + 1, is_synced = 0 WHERE id = ?', [
      logoUri, new Date().toISOString(), businessId,
    ]);
    notifyLocalDataChanged();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Could not save the business image.' };
  }
}

export function getBusinessLogo(businessId: string): string | null {
  try {
    const row = getDB().getFirstSync('SELECT logo FROM businesses WHERE id = ?', [businessId]) as any;
    return row?.logo ?? null;
  } catch { return null; }
}

/** Id of the user currently using this device (stored per-device). */
export function getCurrentUserId(): string | null {
  return getAppSetting('current_user_id', null);
}

export function setCurrentUserId(userId: string | null): void {
  const db = getDB();
  db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['current_user_id', userId ?? '']);
  // The signed-in membership drives every role/permission check in the UI.
  notifyLocalDataChanged();
}

// ---------- Account membership per business ----------
//
// One person (Shega account) may belong to several businesses, with a DIFFERENT
// membership row per business. These helpers record which row is "me" inside a
// given business so switching business resolves the account's own role instead
// of silently assuming the target business's owner (which would be a privilege
// escalation for a member and an identity mix-up for a multi-business owner).

/** Remember which membership row in `businessId` belongs to this account/device. */
export function setMembershipUserId(businessId: string, userId: string | null): void {
  const db = getDB();
  db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [`membership_user_${businessId}`, userId ?? '']);
}

export function getMembershipUserId(businessId: string): string | null {
  const value = getAppSetting(`membership_user_${businessId}`, null);
  return value || null;
}

/**
 * Resolve the signed-in account's membership row inside `businessId`.
 *
 * Resolution order:
 *  1. the explicit mapping recorded when the business was created/adopted;
 *  2. the current user, when they already belong to this business;
 *  3. a member matched by the account's email or username (same person synced
 *     onto another platform);
 *  4. a single-member business (the per-device owner seed).
 *
 * Returns null when the account genuinely has no membership here — callers MUST
 * treat that as "cannot switch" rather than falling back to the owner.
 */
export function resolveMembershipForBusiness(businessId: string): string | null {
  const db = getDB();
  const isValid = (candidate?: string | null): string | undefined => {
    if (!candidate) return undefined;
    const row = db.getFirstSync('SELECT id FROM users WHERE id = ? AND is_deleted = 0', [candidate]) as any;
    return row?.id ? String(row.id) : undefined;
  };

  const mapped = isValid(getMembershipUserId(businessId));
  if (mapped) return mapped;

  const meId = getCurrentUserId();
  const me = meId ? getUser(meId) : undefined;
  const variants = businessIdVariants(businessId);
  if (me && variants.includes(String(me.businessId))) return me.id;

  const members = getUsers(businessId);
  if (me) {
    const mine = members.find((u) => u.id === me.id);
    if (mine) return mine.id;
    if (me.email) {
      const byEmail = members.find((u) => u.email && u.email.toLowerCase() === me.email!.toLowerCase());
      if (byEmail) return byEmail.id;
    }
    if (me.username) {
      const byUsername = members.find((u) => u.username && u.username.toLowerCase() === me.username!.toLowerCase());
      if (byUsername) return byUsername.id;
    }
  }

  // A business seeded for this device starts with exactly its own membership
  // row; that row is unambiguously the account's.
  if (members.length === 1) return members[0].id;
  return null;
}

/** Id of the physical device that owns this install (from sync_meta). */
export function getThisDeviceId(): string | null {
  const db = getDB();
  const row = db.getFirstSync('SELECT device_id FROM sync_meta WHERE id = 1') as { device_id?: string } | null;
  return row?.device_id ?? null;
}

export interface CreateBusinessInput {
  name: string;
  ownerName: string;
  phone?: string;
  email?: string;
}

/**
 * First-device flow: creates the business and makes the current user + device
 * the Owner + Primary device (spec §1, §3).
 */
export function createBusiness(input: CreateBusinessInput, deviceId: string): Business {
  const db = getDB();
  const bizId = newUuid();
  const userId = newUuid();
  // This install's own device row uses sync_meta.device_id as its primary key
  // so self-identification (getSelfStatus, roster status) works.
  const deviceUuid = deviceId || newUuid();
  const now = new Date().toISOString();
  const plan = PLANS[0]; // default: 1 device, any platform

  db.execSync('BEGIN');
  try {
    // max_mobile / max_desktop are kept equal to the plan's platform-neutral
    // total allowance (maxDevices), so the legacy per-platform columns carry
    // the same binding cap and any mix of mobile+desktop is permitted up to it.
    db.runSync(
      `INSERT INTO businesses (id, name, owner_user_id, currency, plan_label, max_mobile, max_desktop, is_default, business_code, uuid, created_at)
       VALUES (?, ?, ?, 'ETB', ?, ?, ?, ?, ?, ?, ?)`,
      [bizId, input.name.trim(), userId, plan.label, plan.maxDevices, plan.maxDevices, 1, businessCode(input.name), bizId, now]
    );
    db.runSync(
      `INSERT INTO users (id, business_id, name, phone, email, role, role_name, permissions, is_active, is_owner, created_at)
       VALUES (?, ?, ?, ?, ?, 'owner', 'Owner', ?, 1, 1, ?)`,
      [userId, bizId, input.ownerName.trim(), input.phone ?? null, input.email ?? null,
       JSON.stringify(DEFAULT_ROLE_SETS.owner), now]
    );
    db.runSync(
      `INSERT INTO devices (id, business_id, user_id, name, platform, status, is_primary, created_at)
       VALUES (?, ?, ?, ?, 'mobile', 'active', 1, ?)`,
      [deviceUuid, bizId, userId, input.ownerName.trim() + "'s Device", now]
    );
    db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['active_business_id', bizId]);
    db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['user_role', 'owner']);
    db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [`membership_user_${bizId}`, userId]);
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    throw e;
  }
  return getBusiness(bizId)!;
}

/** Simple business "code" used in readable sale ids (e.g. SHOP1). */
function businessCode(name: string): string {
  const cleaned = (name || '').replace(/[^A-Za-z0-9]/gi, '').toUpperCase().slice(0, 5);
  return cleaned || 'SHOP';
}

/**
 * Adopt an EXISTING backend business into this device's local cache.
 *
 * This is the identity-architecture cornerstone: when the same person signs in
 * on a second device (a fresh install), they must NOT get a new per-device owner
 * business. Instead this seeds a local business + the owner membership + THIS
 * device row, all bound to the SAME person/account, so Desktop and Mobile are
 * two devices of one owner — not two owners.
 *
 * The local rows are a cache; cloud sync then populates the full roster/data.
 */
export function adoptRemoteOwnedBusiness(
  remote: { business_name: string; business_id?: number; name?: string; role?: string; isOwner?: boolean }
): Business {
  const db = getDB();
  // The backend business_name is authoritative; only fall back when it is
  // blank or is an email address (which a business name never should be).
  const rawBizName = (remote.business_name || '').trim();
  const safeBizName = isEmailLikeBusinessName(rawBizName) || isPlaceholderBusinessName(rawBizName)
    ? ((remote.name || '').trim() || 'My Business')
    : rawBizName;

  // Adopting a business must reflect the REAL membership: only a membership
  // whose role is `owner` makes this account an owner. Joining a business as a
  // cashier/manager must never create (or leave) an owner row behind.
  const role = remote.role || 'owner';
  const isOwner = remote.isOwner ?? role === 'owner';
  const resolved = resolveRoleForBusiness(role, undefined);

  const existing = getBusinesses().find((b) => b.name.toLowerCase() === safeBizName.toLowerCase());
  if (existing) {
    const memberId = resolveMembershipForBusiness(existing.id);
    if (memberId) setMembershipUserId(existing.id, memberId);
    return existing;
  }

  const bizId = newUuid();
  const userId = newUuid();
  const deviceUuid = getThisDeviceId() ?? newUuid();
  const now = new Date().toISOString();
  const plan = PLANS[0];

  db.execSync('BEGIN');
  try {
    db.runSync(
      `INSERT INTO businesses (id, name, owner_user_id, currency, plan_label, max_mobile, max_desktop, is_default, business_code, uuid, created_at)
       VALUES (?, ?, ?, 'ETB', ?, ?, ?, 1, ?, ?, ?)`,
      [bizId, safeBizName, isOwner ? userId : null, plan.label, plan.maxDevices, plan.maxDevices, businessCode(safeBizName), bizId, now]
    );
    db.runSync(
      `INSERT INTO users (id, business_id, name, phone, email, role, role_name, permissions, is_active, is_owner, created_at)
       VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, 1, ?, ?)`,
      [userId, bizId, remote.name?.trim() || safeBizName, role, resolved.name,
       JSON.stringify(resolved.permissions ?? {}), isOwner ? 1 : 0, now]
    );
    db.runSync(
      `INSERT INTO devices (id, business_id, user_id, name, platform, status, is_primary, created_at)
       VALUES (?, ?, ?, ?, 'mobile', 'active', 0, ?)`,
      [deviceUuid, bizId, userId, (remote.name || remote.business_name).trim() + ' Device', now]
    );
    db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['active_business_id', bizId]);
    db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['user_role', role]);
    db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [`membership_user_${bizId}`, userId]);
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    throw e;
  }
  return getBusiness(bizId)!;
}

/**
 * Seed a fresh install from the account's existing backend memberships.
 * Returns the adopted business, or null when the account has no remote business
 * to attach to (the caller then offers "create a new business").
 */
export function ensureRemoteBusinessSeeded(memberships: {
  owned: Array<{ business_name: string; name?: string }>;
  memberships?: Array<{ business_name: string; role: string; user_name?: string }>;
}): Business | null {
  let first: Business | null = null;
  // Multi-business: seed a local cache for EVERY owned business and EVERY
  // membership so the switcher offers the account's complete business list —
  // not just the first one. Each membership keeps its own role.
  for (const owned of memberships.owned ?? []) {
    const seeded = adoptRemoteOwnedBusiness({ business_name: owned.business_name, name: owned.name });
    if (!first) first = seeded;
  }
  for (const m of memberships.memberships ?? []) {
    if (m.business_name && (memberships.owned ?? []).some((o) => o.business_name === m.business_name)) continue;
    // Seed the cache with the membership's real role; a non-owner membership
    // never becomes Owner (that would silently grant full control).
    const seeded = adoptRemoteOwnedBusiness({
      business_name: m.business_name,
      name: m.user_name,
      role: m.role,
      isOwner: m.role === 'owner',
    });
    const memberId = resolveMembershipForBusiness(seeded.id);
    if (memberId) setMembershipUserId(seeded.id, memberId);
    if (!first) first = seeded;
  }
  return first;
}

/**
 * Lazy bootstrap for the first-install "Create Business → Become Owner" flow.
 * If no business exists on this device yet (a fresh install), it seeds the
 * owner business using the account's business/owner name. Safe to call on every
 * dashboard load — it no-ops once a business exists.
 */
export function ensureOwnerBusiness(
  businessName: string,
  ownerName: string,
  accountEmail?: string | null
): Business | null {
  const existing = getDefaultBusiness();
  if (existing) {
    // Repair only unresolved legacy names (blank/placeholder/email). A name the
    // user actually chose is never overwritten.
    return reconcileBusinessName(existing, [businessName, ownerName], accountEmail);
  }
  const deviceId = getThisDeviceId() ?? newUuid();
  const safeBizName = resolveBusinessName([businessName, ownerName]);
  return createBusiness(
    {
      name: safeBizName,
      ownerName: ownerName || 'Owner',
    },
    deviceId
  );
}

// ---------- Users / Team ----------

export function getUsers(businessId: string): User[] {
  const db = getDB();
  const { sql, params } = businessIdClause(businessId);
  const rows = db.getAllSync(
    `SELECT * FROM users WHERE ${sql} AND is_deleted = 0 ORDER BY is_owner DESC, is_active DESC, created_at`,
    params
  );
  return (rows as any[]).map(rowToUser);
}

export function getUser(userId: string): User | undefined {
  const db = getDB();
  const row = db.getFirstSync('SELECT * FROM users WHERE id = ? AND is_deleted = 0', [userId]);
  return row ? rowToUser(row) : undefined;
}

export function getOwnerOfBusiness(businessId: string): User | undefined {
  const db = getDB();
  const { sql, params } = businessIdClause(businessId);
  const row = db.getFirstSync(
    `SELECT * FROM users WHERE ${sql} AND is_owner = 1 AND is_deleted = 0 ORDER BY created_at LIMIT 1`,
    params
  );
  return row ? rowToUser(row) : undefined;
}

export interface AddUserInput {
  businessId: string;
  name: string;
  role: BuiltinRoleKey | string;
  phone?: string;
  email?: string;
  username?: string;
  avatar?: string;
  pin?: string;
  assignedRegisterId?: string;
  assignedLocationId?: string;
}

export function addUser(input: AddUserInput, overrides?: Partial<Record<string, Parameters<typeof JSON.stringify>[0]>>): User {
  const db = getDB();
  const userId = newUuid();
  const now = new Date().toISOString();
  const resolved = resolveRoleForBusiness(input.role, input.businessId);
  db.runSync(
    `INSERT INTO users (id, business_id, name, phone, email, username, avatar, role, role_name, permissions, assigned_register_id, assigned_location_id, is_active, is_owner, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
    [userId, input.businessId, input.name.trim(), input.phone ?? null, input.email ?? null,
     input.username ?? null, input.avatar ?? null,
     input.role, resolved.name, JSON.stringify(resolved.permissions ?? {}),
     input.assignedRegisterId ?? null, input.assignedLocationId ?? null, now]
  );
  if (input.pin && input.pin.length >= 4) {
    try { setUserPin(userId, input.pin); } catch {}
  }
  notifyLocalDataChanged();
  return getUser(userId)!;
}

/** Pin a person to a register / location, and optionally the device they use. */
export function updateUserAssignment(
  userId: string,
  patch: { registerId?: string | null; locationId?: string | null }
): void {
  const db = getDB();
  db.runSync(
    'UPDATE users SET assigned_register_id = ?, assigned_location_id = ?, updated_at = ? WHERE id = ?',
    [patch.registerId ?? null, patch.locationId ?? null, new Date().toISOString(), userId]
  );
  notifyLocalDataChanged();
}

/** Update member user fields (name, phone, email, username, avatar). */
export function updateUserMemberDetails(
  userId: string,
  patch: { name?: string; phone?: string; email?: string; username?: string; avatar?: string | null }
): void {
  const db = getDB();
  const existing = getUser(userId);
  if (!existing) return;
  const name = patch.name !== undefined ? patch.name.trim() : existing.name;
  const phone = patch.phone !== undefined ? patch.phone.trim() || null : (existing.phone ?? null);
  const email = patch.email !== undefined ? patch.email.trim() || null : (existing.email ?? null);
  const username = patch.username !== undefined ? patch.username.trim() || null : (existing.username ?? null);
  const avatar = patch.avatar !== undefined ? patch.avatar : (existing.avatar ?? null);
  const now = new Date().toISOString();

  db.runSync(
    'UPDATE users SET name = ?, phone = ?, email = ?, username = ?, avatar = ?, updated_at = ? WHERE id = ?',
    [name, phone, email, username, avatar, now, userId]
  );
  notifyLocalDataChanged();
}

/** Persist the current user's profile image so activities can show it. */
export function setUserAvatar(avatarUri: string | null): void {
  const userId = getCurrentUserId();
  if (!userId) return;
  const db = getDB();
  try {
    db.runSync('UPDATE users SET avatar = ?, updated_at = ? WHERE id = ?', [avatarUri, new Date().toISOString(), userId]);
    notifyLocalDataChanged();
  } catch {}
}

/** Persist a user's display name so activities and rosters show it. */
export function setUserName(userId: string | null, name: string): void {
  if (!userId) return;
  const db = getDB();
  try {
    db.runSync('UPDATE users SET name = ?, updated_at = ? WHERE id = ?', [name.trim(), new Date().toISOString(), userId]);
    notifyLocalDataChanged();
  } catch {}
}

/** Business-scoped lookup by username (case-insensitive) for sign-in. */
export function getUserByUsername(businessId: string, username: string): User | undefined {
  const db = getDB();
  const row = db.getFirstSync(
    'SELECT * FROM users WHERE business_id = ? AND LOWER(username) = LOWER(?) AND is_deleted = 0 LIMIT 1',
    [businessId, username.trim()]
  );
  return row ? rowToUser(row) : undefined;
}

/** Set or clear a user's username (must be unique within the business). */
export function setUserUsername(userId: string, username: string | null): boolean {
  const db = getDB();
  const row = db.getFirstSync('SELECT business_id FROM users WHERE id = ?', [userId]) as any;
  if (!row) return false;
  if (username) {
    const duplicate = db.getFirstSync(
      'SELECT id FROM users WHERE business_id = ? AND LOWER(username) = LOWER(?) AND id != ? AND is_deleted = 0',
      [row.business_id, username.trim(), userId]
    );
    if (duplicate) return false;
  }
  db.runSync('UPDATE users SET username = ?, updated_at = ? WHERE id = ?', [username ?? null, new Date().toISOString(), userId]);
  notifyLocalDataChanged();
  return true;
}

/** True when a user has never completed the first-time sign-in setup (username or PIN missing). */
export function needsUserSetup(userId: string): boolean {
  const db = getDB();
  const row = db.getFirstSync('SELECT username, pin_hash, pin_salt FROM users WHERE id = ?', [userId]) as any;
  if (!row) return false;
  return !row.username || (!row.pin_hash && !row.pin_salt);
}

/**
 * Count active owners in a business (excluding `exceptUserId` when given).
 * Used to guard ownership-sensitive actions so a business can never end up
 * with zero owners.
 */
export function countActiveOwners(businessId: string, exceptUserId?: string): number {
  const db = getDB();
  const { sql, params } = businessIdClause(businessId);
  const row = db.getFirstSync(
    'SELECT COUNT(*) AS c FROM users WHERE ' + sql + ' AND is_owner = 1 AND is_active = 1 AND is_deleted = 0' + (exceptUserId ? ' AND id != ?' : ''),
    exceptUserId ? [...params, exceptUserId] : params
  ) as any;
  return row?.c ?? 0;
}

export function updateUserRole(userId: string, role: BuiltinRoleKey | string): void {
  const db = getDB();
  const resolved = resolveRoleForBusiness(role, undefined);
  const permJson = resolved.permissions ? JSON.stringify(resolved.permissions) : null;
  const isOwnerRole = role === 'owner';
  const target = getUser(userId);
  if (target?.businessId && !isOwnerRole && !!target.isOwner) {
    if (countActiveOwners(target.businessId, userId) === 0) {
      throw new Error('Cannot remove the last owner of this business. Promote another owner first.');
    }
  }
  db.runSync(
    'UPDATE users SET role = ?, role_name = ?, is_owner = ?, permissions = COALESCE(?, permissions), updated_at = ? WHERE id = ?',
    [role, resolved.name, isOwnerRole ? 1 : 0, permJson, new Date().toISOString(), userId]
  );
  notifyLocalDataChanged();
}

export function updateUserPermissions(userId: string, permissions: PermissionSet): void {
  const db = getDB();
  db.runSync('UPDATE users SET permissions = ?, updated_at = ?, row_version = row_version + 1, is_synced = 0 WHERE id = ?',
    [JSON.stringify(permissions), new Date().toISOString(), userId]);
  notifyLocalDataChanged();
}

/**
 * Resolve a role key (built-in or a business-owned custom role uuid) to its
 * display name and effective permission set. Unknown keys fall back to the raw
 * key with null permissions (deny-by-default).
 */
function resolveRoleForBusiness(roleKey: string, businessId?: string): { name: string; permissions: PermissionSet | null } {
  const builtin = getBuiltinRole(roleKey as BuiltinRoleKey);
  if (builtin) return { name: builtin.name, permissions: builtin.permissions };
  const db = getDB();
  const row = db.getFirstSync(
    'SELECT name, permissions FROM business_roles WHERE id = ? AND is_deleted = 0' + (businessId ? ' AND business_id = ?' : ''),
    businessId ? [roleKey, businessId] : [roleKey]
  ) as any;
  if (row?.name) {
    return { name: row.name, permissions: row.permissions ? JSON.parse(row.permissions) : {} };
  }
  return { name: roleKey, permissions: null };
}

export function setUserActive(userId: string, active: boolean): void {
  const db = getDB();
  const target = getUser(userId);
  if (target?.businessId && !active && !!target.isOwner) {
    if (countActiveOwners(target.businessId, userId) === 0) {
      throw new Error('Cannot deactivate the last owner of this business.');
    }
  }
  db.runSync('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?', [active ? 1 : 0, new Date().toISOString(), userId]);
  notifyLocalDataChanged();
}

export function removeUser(userId: string): void {
  const db = getDB();
  const target = getUser(userId);
  if (target?.businessId && !!target.isOwner) {
    if (countActiveOwners(target.businessId, userId) === 0) {
      throw new Error('Cannot remove the last owner of this business. Promote another owner first.');
    }
  }
  db.execSync('BEGIN');
  try {
    db.runSync('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), userId]);
    db.runSync('UPDATE devices SET user_id = NULL, status = ? WHERE user_id = ?', ['disabled', userId]);
    db.execSync('COMMIT');
    notifyLocalDataChanged();
  } catch (e) {
    try { db.execSync('ROLLBACK'); } catch {}
    throw e;
  }
}

/**
 * Make sure the business's recorded owner actually holds the Owner role.
 *
 * Migrated or seeded installs can carry a business whose `owner_user_id` points
 * at a membership that never received `is_owner = 1`. This self-heals ONLY when
 * the business currently has no active owner, so the account is never locked
 * out of its own business. It is non-destructive: an existing owner is never
 * changed, and a business with owners is left untouched.
 */
export function ensureBusinessOwnerRole(businessId: string): void {
  const db = getDB();
  const { sql, params } = businessIdClause(businessId);
  const existingOwner = db.getFirstSync(
    `SELECT id FROM users WHERE ${sql} AND is_owner = 1 AND is_active = 1 AND is_deleted = 0 LIMIT 1`,
    params
  ) as any;
  if (existingOwner) return;

  // Only heal a business whose RECORDED owner is known. A business cached by a
  // joining member has no owner_user_id (the real owner lives on the hub), and
  // promoting the joiner would wrongly make them an Owner of someone's business.
  const business = getBusiness(businessId);
  const ownerId = business?.ownerUserId;
  if (!ownerId) return;
  const recorded = db.getFirstSync(
    `SELECT id FROM users WHERE id = ? AND ${sql} AND is_deleted = 0 LIMIT 1`,
    [ownerId, ...params]
  ) as any;
  if (recorded?.id) ensureOwner(String(recorded.id));
}

/**
 * Ensure a person is an owner. Multi-owner safe: every owner is equal — this
 * never demotes any existing owner, so a business can hold many owners at once.
 */
export function ensureOwner(userId: string): void {
  const db = getDB();
  db.runSync(
    'UPDATE users SET is_owner = 1, role = ?, role_name = ?, permissions = ?, updated_at = ?, row_version = row_version + 1, is_synced = 0 WHERE id = ?',
    ['owner', 'Owner', JSON.stringify(DEFAULT_ROLE_SETS.owner), new Date().toISOString(), userId]
  );
  notifyLocalDataChanged();
}

/**
 * Ownership transfer as an ADDITIVE grant: the new owner is promoted and the
 * current owner keeps owner status. Both remain equal owners afterwards.
 * (Destructive single-owner transfer was removed per the multi-owner spec.)
 */
export function transferOwnership(businessId: string, currentOwnerId: string, newOwnerId: string): void {
  const db = getDB();
  db.execSync('BEGIN');
  try {
    ensureOwner(newOwnerId);
    db.execSync('COMMIT');
    notifyLocalDataChanged();
  } catch (e) {
    try { db.execSync('ROLLBACK'); } catch {}
    throw e;
  }
}

// ---------- Devices ----------

export function getDevices(businessId: string): Device[] {
  const db = getDB();
  const { sql, params } = businessIdClause(businessId);
  const rows = db.getAllSync(
    `SELECT * FROM devices WHERE ${sql} AND is_deleted = 0 ORDER BY created_at`,
    params
  );
  return (rows as any[]).map(rowToDevice);
}

export function getDevice(deviceId: string): Device | undefined {
  const db = getDB();
  const row = db.getFirstSync('SELECT * FROM devices WHERE id = ? AND is_deleted = 0', [deviceId]);
  return row ? rowToDevice(row) : undefined;
}

export interface AddDeviceInput {
  businessId: string;
  name: string;
  model?: string;
  platform: 'mobile' | 'desktop';
  userId?: string;
  role?: string;
  registerId?: string;
}

export function addDevice(input: AddDeviceInput, deviceId: string): Device {
  const db = getDB();
  // This install's own devices row carries sync_meta.device_id AS its primary
  // key so self-identification is trivial (deviceEnforcement / status lists
  // look up devices.id === sync_meta.device_id). Other devices get their own row.
  const id = deviceId || newUuid();
  const now = new Date().toISOString();
  // The first device to create the business is primary; devices added by the
  // owner are marked active immediately. Devices from invite/pairing flows are
  // 'pending' until the owner approves.
  const status: Device['status'] = isThisDevice(input.businessId, deviceId) ? 'active' : 'pending';
  db.runSync(
    `INSERT INTO devices (id, business_id, user_id, name, model, platform, register_id, role, status, is_primary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, input.businessId, input.userId ?? null, input.name.trim(), input.model ?? null,
     input.platform, input.registerId ?? null, input.role ?? null, status, now]
  );
  notifyLocalDataChanged();
  return getDevice(id)!;
}

function isThisDevice(businessId: string, deviceId: string): boolean {
  // A device is "this" device if no other active device with its identity exists.
  const db = getDB();
  const row = db.getFirstSync('SELECT COUNT(*) as n FROM devices WHERE business_id = ? AND id = ?', [businessId, deviceId]) as any;
  return !row || row.n === 0;
}

export function approveDevice(deviceId: string, userId: string, role: string, registerId?: string): void {
  const db = getDB();
  db.runSync(
    `UPDATE devices SET status = 'active', user_id = ?, role = ?, register_id = COALESCE(?, register_id), updated_at = ?, is_synced = 0 WHERE id = ?`,
    [userId || null, role || null, registerId ?? null, new Date().toISOString(), deviceId]);
  notifyLocalDataChanged();
}

/**
 * §P5 Unsynced-Data Disable Guard — count records attributable to a device that
 * have not yet been synced to the hub (pending outbox + unresolved conflicts).
 * Outbox rows carry a ``source_device`` of the originating device.
 */
export function countUnsyncedForDevice(deviceId: string): number {
  const db = getDB();
  const outbox = (db.getFirstSync(
    `SELECT COUNT(*) AS c FROM sync_outbox WHERE source_device = ?`,
    [deviceId]
  ) as any)?.c ?? 0;
  return outbox;
}

export function setDeviceStatus(deviceId: string, status: Device['status']): void {
  // §P5 Unsynced-Data Disable Guard — never allow a device to be disabled or
  // removed while it still has unsynced (pending/failed) records, to protect
  // against silently losing not-yet-synced sales, adjustments, etc.
  if (status === 'disabled' || status === 'removed') {
    const unsynced = countUnsyncedForDevice(deviceId);
    if (unsynced > 0) {
      throw new Error(
        `Cannot ${status === 'disabled' ? 'disable' : 'remove'} this device — it still has ${unsynced} unsynced record${unsynced === 1 ? '' : 's'}. Connect to a network and sync first.`
      );
    }
  }
  const db = getDB();
  db.runSync('UPDATE devices SET status = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [status, new Date().toISOString(), deviceId]);
  notifyLocalDataChanged();
}

export function renameDevice(deviceId: string, name: string): void {
  const db = getDB();
  db.runSync('UPDATE devices SET name = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [name.trim(), new Date().toISOString(), deviceId]);
  notifyLocalDataChanged();
}

export function assignDeviceToUser(deviceId: string, userId: string | null): void {
  const db = getDB();
  db.runSync('UPDATE devices SET user_id = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [userId, new Date().toISOString(), deviceId]);
  notifyLocalDataChanged();
}

export interface ReplaceDeviceInput {
  businessId: string;
  oldDeviceId: string;
  name: string;
  model?: string;
  platform: 'mobile' | 'desktop';
  /** When a replacement is for THIS machine, meaning it should be active + primary. */
  setThisAsReplacement?: boolean;
  thisDeviceId?: string;
}

/**
 * §30 Device Replacement Wizard — register a replacement for a lost/broken
 * device while preserving the business/roster/audit history.
 *
 * - Creates a NEW device row carrying over the old device's user, role, and
 *   register, and transfers ``isPrimary`` when the old device was primary.
 * - Deprecates the OLD device (``status='removed'`` + soft-delete) so it no
 *   longer counts against the active roster / §29 device limit, but its row and
 *   historical audit entries are preserved.
 * - The replacement only becomes ``active`` when it is THIS device; otherwise it
 *   lands as ``pending`` until the owner approves (mirrors ``addDevice``).
 *
 * Returns the new Device.
 */
export function replaceDevice(input: ReplaceDeviceInput, fallbackThisDeviceId?: string): Device {
  const db = getDB();
  const old = getDevice(input.oldDeviceId);
  if (!old) throw new Error('Original device not found or already removed');
  if (input.businessId !== old.businessId) throw new Error('Device does not belong to this business');

  // §P5 Unsynced-Data Disable Guard — replacing removes the old device, so block
  // it while the original still has unsynced records (avoid destroying data).
  const unsynced = countUnsyncedForDevice(input.oldDeviceId);
  if (unsynced > 0) {
    throw new Error(
      `Cannot replace this device — it still has ${unsynced} unsynced record${unsynced === 1 ? '' : 's'}. Connect to a network and sync before replacing.`
    );
  }

  const thisDeviceId = input.thisDeviceId ?? fallbackThisDeviceId;
  const isThisDevice =
    input.setThisAsReplacement === true ||
    (!!thisDeviceId && thisDeviceId === input.oldDeviceId);

  const now = new Date().toISOString();
  const newId = newUuid();
  const wasPrimary = !!old.isPrimary;
  const status: Device['status'] = isThisDevice ? 'active' : 'pending';
  const isPrimary = isThisDevice ? 1 : (wasPrimary ? 1 : 0);

  // 1. Insert the replacement, carrying over identity from the old device.
  db.runSync(
    `INSERT INTO devices (id, business_id, user_id, name, model, platform, register_id, role, status, is_primary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId, input.businessId, old.userId ?? null, input.name.trim(), input.model ?? null,
     input.platform, old.registerId ?? null, old.role ?? null, status, isPrimary, now, now]
  );

  // 2. Deprecate the old device (history preserved, removed from active roster).
  db.runSync(
    `UPDATE devices SET status = 'removed', is_deleted = 1, deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?`,
    [now, now, input.oldDeviceId]
  );

  notifyLocalDataChanged();
  return getDevice(newId)!;
}

// ---------- Registers ----------

export function getRegisters(businessId: string): Register[] {
  const db = getDB();
  const { sql, params } = businessIdClause(businessId);
  const rows = db.getAllSync(
    `SELECT * FROM registers WHERE ${sql} AND is_deleted = 0 ORDER BY created_at`,
    params
  );
  return (rows as any[]).map(rowToRegister);
}

export function addRegister(businessId: string, name: string, locationId?: string): Register {
  const db = getDB();
  const id = newUuid();
  const now = new Date().toISOString();
  db.runSync(
    'INSERT INTO registers (id, business_id, location_id, name, has_drawer, is_active, created_at) VALUES (?, ?, ?, ?, 1, 1, ?)',
    [id, businessId, locationId ?? null, name.trim(), now]);
  const row = db.getFirstSync('SELECT * FROM registers WHERE id = ?', [id]);
  return rowToRegister(row);
}

// ---------- Locations ----------

export function getLocations(businessId: string): Location[] {
  const db = getDB();
  const { sql, params } = businessIdClause(businessId);
  const rows = db.getAllSync(
    `SELECT * FROM locations WHERE ${sql} AND is_deleted = 0 ORDER BY created_at`,
    params
  );
  return (rows as any[]).map(rowToLocation);
}

export function addLocation(businessId: string, name: string, address?: string): Location {
  const db = getDB();
  const id = newUuid();
  const now = new Date().toISOString();
  db.runSync('INSERT INTO locations (id, business_id, name, address, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, businessId, name.trim(), address ?? null, now]);
  const row = db.getFirstSync('SELECT * FROM locations WHERE id = ?', [id]);
  return rowToLocation(row);
}

// ---------- Custom roles ----------

export function getCustomRoles(businessId: string): CustomRole[] {
  const db = getDB();
  const { sql, params } = businessIdClause(businessId);
  const rows = db.getAllSync(
    `SELECT * FROM business_roles WHERE ${sql} AND is_system = 0 AND is_deleted = 0 ORDER BY created_at`,
    params
  );
  return (rows as any[]).map((r) => ({
    key: r.id,
    businessId: r.business_id,
    name: r.name,
    description: r.description,
    permissions: r.permissions ? JSON.parse(r.permissions) : {},
    createdAt: r.created_at,
  }));
}

export function getCustomRole(roleKey: string, businessId?: string): CustomRole | undefined {
  const db = getDB();
  let sql = 'SELECT * FROM business_roles WHERE id = ? AND is_system = 0 AND is_deleted = 0';
  let params: string[] = [roleKey];
  if (businessId) {
    const scope = businessIdClause(businessId);
    sql += ` AND ${scope.sql}`;
    params = [roleKey, ...scope.params];
  }
  const row = db.getFirstSync(sql, params) as any;
  if (!row) return undefined;
  return {
    key: row.id,
    businessId: row.business_id,
    name: row.name,
    description: row.description,
    permissions: row.permissions ? JSON.parse(row.permissions) : {},
    createdAt: row.created_at,
  };
}

export function createCustomRole(businessId: string, name: string, permissions: PermissionSet, description?: string): CustomRole {
  const db = getDB();
  const id = newUuid();
  const now = new Date().toISOString();
  db.runSync(
    'INSERT INTO business_roles (id, business_id, name, description, permissions, is_system, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
    [id, businessId, name.trim(), description ?? null, JSON.stringify(permissions), now]);
  notifyLocalDataChanged();
  return { key: id, businessId, name: name.trim(), description, permissions, createdAt: now };
}

/**
 * Edit a custom role. When `permissions` is supplied, every member currently
 * assigned to the role is re-synced to the new set so an owner's change takes
 * effect immediately on all their devices (the role is the source of truth).
 */
export function updateCustomRole(
  roleId: string,
  patch: { name?: string; description?: string | null; permissions?: PermissionSet },
  businessId?: string
): CustomRole | undefined {
  const db = getDB();
  const existing = getCustomRole(roleId, businessId);
  if (!existing) return undefined;
  const now = new Date().toISOString();
  const name = patch.name?.trim() || existing.name;
  const description = patch.description !== undefined ? patch.description : (existing.description ?? null);
  const permissions = patch.permissions ?? existing.permissions;

  db.execSync('BEGIN');
  try {
    db.runSync(
      `UPDATE business_roles SET name = ?, description = ?, permissions = ?, updated_at = ?, row_version = row_version + 1, is_synced = 0 WHERE id = ?`,
      [name, description, JSON.stringify(permissions), now, roleId]
    );
    if (patch.permissions) {
      const business = businessId ?? existing.businessId;
      const { sql, params } = businessIdClause(business);
      const members = db.getAllSync(`SELECT id FROM users WHERE ${sql} AND role = ? AND is_deleted = 0`, [...params, roleId]) as any[];
      for (const m of members) {
        db.runSync('UPDATE users SET permissions = ?, updated_at = ?, row_version = row_version + 1, is_synced = 0 WHERE id = ?',
          [JSON.stringify(permissions), now, m.id]);
      }
    }
    db.execSync('COMMIT');
  } catch (e) {
    try { db.execSync('ROLLBACK'); } catch {}
    throw e;
  }
  notifyLocalDataChanged();
  return getCustomRole(roleId, businessId) ?? { ...existing, name, description: description ?? undefined, permissions };
}

/**
 * Soft-delete a custom role. Members still assigned to it are moved to the
 * safe built-in `cashier` role so nobody is left with a dangling role key.
 * Returns how many members were reassigned.
 */
export function deleteCustomRole(roleId: string, businessId?: string): { ok: boolean; reassigned: number } {
  const db = getDB();
  const existing = getCustomRole(roleId, businessId);
  if (!existing) return { ok: false, reassigned: 0 };
  const business = businessId ?? existing.businessId;
  const { sql, params } = businessIdClause(business);
  const now = new Date().toISOString();
  const cashier = getBuiltinRole('cashier');
  const assigned = db.getAllSync(`SELECT id FROM users WHERE ${sql} AND role = ? AND is_deleted = 0`, [...params, roleId]) as any[];
  const reassigned = assigned.length;

  db.execSync('BEGIN');
  try {
    db.runSync('UPDATE business_roles SET is_deleted = 1, updated_at = ?, row_version = row_version + 1, is_synced = 0 WHERE id = ?', [now, roleId]);
    db.runSync(
      'UPDATE users SET role = ?, role_name = ?, is_owner = 0, permissions = ?, updated_at = ?, row_version = row_version + 1, is_synced = 0 WHERE ' + sql + ' AND role = ?',
      ['cashier', cashier?.name ?? 'Cashier', JSON.stringify(cashier?.permissions ?? {}), now, ...params, roleId]
    );
    db.execSync('COMMIT');
  } catch (e) {
    try { db.execSync('ROLLBACK'); } catch {}
    throw e;
  }
  notifyLocalDataChanged();
  return { ok: true, reassigned };
}

/** Unified role list for a business: built-in templates + owner-defined roles. */
export function getRolesForBusiness(businessId: string): {
  key: string; name: string; description?: string; isSystem: boolean; permissions: PermissionSet; memberCount: number;
}[] {
  const members = getUsers(businessId);
  const countFor = (key: string) => members.filter((u) => u.role === key).length;
  const builtins = BUILTIN_ROLES.map((r) => ({
    key: r.key,
    name: r.name,
    description: r.description,
    isSystem: true,
    permissions: r.permissions,
    memberCount: countFor(r.key),
  }));
  const custom = getCustomRoles(businessId).map((r) => ({
    key: r.key,
    name: r.name,
    description: r.description,
    isSystem: false,
    permissions: r.permissions ?? {},
    memberCount: countFor(r.key),
  }));
  return [...builtins, ...custom];
}

// ---------- Effective permission resolution ----------
/**
 * Returns the effective permission set for a user: role defaults overlaid with
 * any custom/per-user overrides. This mirrors @shega/shared's merge logic but
 * operates on the stored DB role.
 */
export function effectivePermissions(user: User): PermissionSet {
  // Base = built-in role defaults, or a custom role's stored permission set.
  // Per-user overrides (user.permissions) are layered on top of either.
  let base: PermissionSet = {};
  const builtin = getBuiltinRole(user.role as BuiltinRoleKey);
  if (builtin) {
    base = builtin.permissions;
  } else {
    try {
      const custom = getCustomRole(user.role, user.businessId);
      if (custom) base = custom.permissions ?? {};
    } catch { /* unknown role -> deny by default */ }
  }
  if (user.permissions) {
    return { ...base, ...user.permissions };
  }
  return base;
}

/**
 * Change ONE permission for a member, preserving every other effective value.
 * (Writing a single-key set would otherwise wipe the member's other overrides.)
 */
export function setUserPermission(userId: string, key: string, value: PermissionValue): void {
  const target = getUser(userId);
  if (!target) return;
  const next: PermissionSet = { ...effectivePermissions(target), [key]: value };
  updateUserPermissions(userId, next);
}

/** Drop all per-user overrides so the member follows their role again. */
export function resetUserPermissions(userId: string): void {
  const db = getDB();
  db.runSync('UPDATE users SET permissions = NULL, updated_at = ?, row_version = row_version + 1, is_synced = 0 WHERE id = ?',
    [new Date().toISOString(), userId]);
  notifyLocalDataChanged();
}

// ---------- Manager PIN approval (spec §15) ----------
//
// PIN hashes must be cross-platform: the desktop stores `pinSalt` + `pinHash`
// as scrypt (N=16384, r=8, p=1, keylen=64) and those user rows replicate to
// mobile via Yjs. Mobile therefore WRITES scrypt hashes (so a PIN set here
// verifies on desktop) and VERIFIES both scrypt (desktop-origin) and legacy
// SHA-256 `salt:hash` (mobile-origin rows created before this change).

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keyLen: 64 } as const;

async function hashPinScrypt(pin: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(saltBytes);
  } else {
    for (let i = 0; i < saltBytes.length; i++) saltBytes[i] = Math.floor(Math.random() * 256);
  }
  const salt = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const key = await scrypt(
    new TextEncoder().encode(pin),
    saltBytes,
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    SCRYPT_PARAMS.keyLen,
  );
  const keyHex = Array.from(key).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${keyHex}`;
}

async function verifyPinStored(pin: string, stored: string): Promise<boolean> {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  if (expected.length === 128) {
    // scrypt (desktop-compatible, keyLen 64 → 128 hex chars)
    try {
      const saltBytes = new Uint8Array(salt.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
      const key = await scrypt(
        new TextEncoder().encode(pin),
        saltBytes,
        SCRYPT_PARAMS.N,
        SCRYPT_PARAMS.r,
        SCRYPT_PARAMS.p,
        SCRYPT_PARAMS.keyLen,
      );
      const keyHex = Array.from(key).map((b) => b.toString(16).padStart(2, '0')).join('');
      if (keyHex === expected) return true;
    } catch { /* fall through to legacy */ }
  }
  // Legacy mobile SHA-256(pin + salt)
  return verifyPin(pin, stored);
}

/** Set (or reset) a user's PIN for manager-approval, stored as a salted hash. */
export function setUserPin(userId: string, pin: string): void {
  const db = getDB();
  hashPinScrypt(pin).then((stored) => {
    const [salt, pinHash] = stored.split(':');
    db.runSync(
      'UPDATE users SET pin_hash = ?, pin_salt = ?, updated_at = ? WHERE id = ?',
      [pinHash, salt, new Date().toISOString(), userId]
    );
  });
}

/** Raw salted hash (`salt:hash`) for a user, or null if none is set. */
export function getUserPinHash(userId: string): string | null {
  const db = getDB();
  const row = db.getFirstSync('SELECT pin_hash, pin_salt FROM users WHERE id = ?', [userId]) as any;
  if (!row?.pin_hash || !row?.pin_salt) return null;
  return `${row.pin_salt}:${row.pin_hash}`;
}

/**
 * True when the user's stored PIN hash is the modern scrypt format
 * (keyLen 64 → 128 hex chars, desktop-compatible). Modern PINs are always
 * 6 digits. Legacy rows use the old mobile SHA-256 `salt:hash` (64 hex chars).
 * Callers use this to avoid running an expensive scrypt mid-entry just to probe
 * a legacy 4-digit PIN — scrypt blocks the JS thread and freezes the keypad.
 */
export function hasModernScryptPin(userId: string): boolean {
  const stored = getUserPinHash(userId);
  if (!stored) return false;
  const [, expected] = stored.split(':');
  return !!expected && expected.length === 128;
}


/** Verify a PIN against a specific user's stored hash. */
export async function verifyUserPin(userId: string, pin: string): Promise<boolean> {
  const stored = getUserPinHash(userId);
  if (!stored) return false;
  return verifyPinStored(pin, stored);
}

/** True when the user is an owner or manager (may approve sensitive actions). */
export function userCanApprove(user: User): boolean {
  return user.isOwner || user.role === 'owner' || user.role === 'manager';
}

/**
 * Resolve an approval-capable user for a business: an invited manager/owner that
 * has a PIN configured, falling back to the owner then any manager.
 */
export function getApproverForBusiness(businessId: string): User | undefined {
  const db = getDB();
  const rows = db.getAllSync(
    "SELECT * FROM users WHERE business_id = ? AND is_deleted = 0 AND is_active = 1 AND (is_owner = 1 OR role = 'owner' OR role = 'manager') ORDER BY (is_owner = 1 OR role = 'owner') DESC, created_at",
    [businessId]
  ) as any[];
  for (const r of rows) {
    if (r.pin_hash && r.pin_salt) return rowToUser(r);
  }
  return rows.length ? rowToUser(rows[0]) : undefined;
}

/**
 * Build the shared permission-check context (effective set + approver flag) for
 * a user. `canApprove` lets owner/manager act without a second PIN.
 */
export function permissionContext(user: User): PermissionContext {
  return { permissions: effectivePermissions(user), canApprove: userCanApprove(user) };
}

/**
 * State-machine for running a sensitive action (§15):
 *  - 'allowed'            -> the actor may proceed directly (their role grants it)
 *  - 'approval-required'  -> gate the action behind an approver's PIN
 *  - 'denied'             -> the action is blocked for this user
 */
export function approvalState(user: User, permKey: string): PermissionCheckResult {
  return checkPermission(permissionContext(user), permKey);
}

