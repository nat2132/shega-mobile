import { getDB, getAppSetting } from '@/database/db';
import {
  Business, User, Device, Register, Location, CustomRole,
  PermissionSet, BuiltinRoleKey, getBuiltinRole, DEFAULT_ROLE_SETS,
  PLANS,
} from '@shega/shared';
import { checkPermission, PermissionContext, PermissionCheckResult } from '@shega/shared';
import { hashPin, verifyPin } from './sqlcipher';

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

function rowToBusiness(row: any): Business {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    currency: row.currency ?? 'ETB',
    planLabel: row.plan_label,
    maxMobile: row.max_mobile ?? 1,
    maxDesktop: row.max_desktop ?? 0,
    isDefault: !!row.is_default,
    createdAt: row.created_at,
  };
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    role: row.role,
    roleName: row.role_name,
    permissions: row.permissions ? JSON.parse(row.permissions) : undefined,
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

export function getBusinesses(): Business[] {
  const db = getDB();
  const rows = db.getAllSync('SELECT * FROM businesses WHERE is_deleted = 0 ORDER BY created_at');
  return (rows as any[]).map(rowToBusiness);
}

export function getBusiness(businessId: string): Business | undefined {
  const db = getDB();
  const row = db.getFirstSync('SELECT * FROM businesses WHERE id = ? AND is_deleted = 0', [businessId]);
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
}

/** Id of the user currently using this device (stored per-device). */
export function getCurrentUserId(): string | null {
  return getAppSetting('current_user_id', null);
}

export function setCurrentUserId(userId: string | null): void {
  const db = getDB();
  db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['current_user_id', userId ?? '']);
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
  const deviceUuid = newUuid();
  const now = new Date().toISOString();
  const plan = PLANS[0]; // default: 1 Mobile

  db.execSync('BEGIN');
  try {
    db.runSync(
      `INSERT INTO businesses (id, name, owner_user_id, currency, plan_label, max_mobile, max_desktop, is_default, business_code, uuid, created_at)
       VALUES (?, ?, ?, 'ETB', ?, ?, ?, ?, ?, ?, ?)`,
      [bizId, input.name.trim(), userId, plan.label, plan.maxMobile, plan.maxDesktop, 1, businessCode(input.name), bizId, now]
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
 * Lazy bootstrap for the first-install "Create Business → Become Owner" flow.
 * If no business exists on this device yet (a fresh install), it seeds the
 * owner business using the account's business/owner name. Safe to call on every
 * dashboard load — it no-ops once a business exists.
 */
export function ensureOwnerBusiness(businessName: string, ownerName: string): Business | null {
  const existing = getDefaultBusiness();
  if (existing) return existing;
  const deviceId = getThisDeviceId() ?? newUuid();
  return createBusiness(
    {
      name: businessName || ownerName || 'My Business',
      ownerName: ownerName || businessName || 'Owner',
    },
    deviceId
  );
}

// ---------- Users / Team ----------

export function getUsers(businessId: string): User[] {
  const db = getDB();
  const rows = db.getAllSync('SELECT * FROM users WHERE business_id = ? AND is_deleted = 0 ORDER BY is_owner DESC, created_at', [businessId]);
  return (rows as any[]).map(rowToUser);
}

export function getUser(userId: string): User | undefined {
  const db = getDB();
  const row = db.getFirstSync('SELECT * FROM users WHERE id = ? AND is_deleted = 0', [userId]);
  return row ? rowToUser(row) : undefined;
}

export function getOwnerOfBusiness(businessId: string): User | undefined {
  const db = getDB();
  const row = db.getFirstSync('SELECT * FROM users WHERE business_id = ? AND is_owner = 1 AND is_deleted = 0 LIMIT 1', [businessId]);
  return row ? rowToUser(row) : undefined;
}

export interface AddUserInput {
  businessId: string;
  name: string;
  role: BuiltinRoleKey | string;
  phone?: string;
  email?: string;
  assignedRegisterId?: string;
  assignedLocationId?: string;
}

export function addUser(input: AddUserInput, overrides?: Partial<Record<string, Parameters<typeof JSON.stringify>[0]>>): User {
  const db = getDB();
  const userId = newUuid();
  const now = new Date().toISOString();
  const role = getBuiltinRole(input.role as BuiltinRoleKey);
  const permissions = role ? role.permissions : {};
  db.runSync(
    `INSERT INTO users (id, business_id, name, phone, email, role, role_name, permissions, assigned_register_id, assigned_location_id, is_active, is_owner, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
    [userId, input.businessId, input.name.trim(), input.phone ?? null, input.email ?? null,
     input.role, role?.name ?? input.role, JSON.stringify(permissions),
     input.assignedRegisterId ?? null, input.assignedLocationId ?? null, now]
  );
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
}

export function updateUserRole(userId: string, role: BuiltinRoleKey | string): void {
  const db = getDB();
  const permissionSet = getBuiltinRole(role as BuiltinRoleKey);
  const permJson = permissionSet ? JSON.stringify(permissionSet.permissions) : null;
  db.runSync(
    'UPDATE users SET role = ?, role_name = ?, permissions = COALESCE(?, permissions), updated_at = ? WHERE id = ?',
    [role, permissionSet?.name ?? role, permJson, new Date().toISOString(), userId]
  );
}

export function updateUserPermissions(userId: string, permissions: PermissionSet): void {
  const db = getDB();
  db.runSync('UPDATE users SET permissions = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(permissions), new Date().toISOString(), userId]);
}

export function setUserActive(userId: string, active: boolean): void {
  const db = getDB();
  db.runSync('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?', [active ? 1 : 0, new Date().toISOString(), userId]);
}

export function removeUser(userId: string): void {
  // Preserve historical transactions; only deactivate the user's access and
  // their devices (spec §31).
  const db = getDB();
  db.execSync('BEGIN');
  try {
    db.runSync('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), userId]);
    db.runSync('UPDATE devices SET user_id = NULL, status = ? WHERE user_id = ?', ['disabled', userId]);
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    throw e;
  }
}

export function transferOwnership(businessId: string, currentOwnerId: string, newOwnerId: string): void {
  const db = getDB();
  db.execSync('BEGIN');
  try {
    db.runSync('UPDATE businesses SET owner_user_id = ?, updated_at = ? WHERE id = ?', [newOwnerId, new Date().toISOString(), businessId]);
    db.runSync('UPDATE users SET is_owner = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), currentOwnerId]);
    db.runSync('UPDATE users SET is_owner = 1, role = ?, role_name = ?, permissions = ?, updated_at = ? WHERE id = ?',
      ['owner', 'Owner', JSON.stringify(DEFAULT_ROLE_SETS.owner), new Date().toISOString(), newOwnerId]);
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    throw e;
  }
}

// ---------- Devices ----------

export function getDevices(businessId: string): Device[] {
  const db = getDB();
  const rows = db.getAllSync('SELECT * FROM devices WHERE business_id = ? AND is_deleted = 0 ORDER BY created_at', [businessId]);
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
  const id = newUuid();
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
    `UPDATE devices SET status = 'active', user_id = ?, role = ?, register_id = COALESCE(?, register_id), updated_at = ? WHERE id = ?`,
    [userId, role, registerId ?? null, new Date().toISOString(), deviceId]);
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
  // against silently losing not-yet-synced sales, expenses, etc.
  if (status === 'disabled' || status === 'removed') {
    const unsynced = countUnsyncedForDevice(deviceId);
    if (unsynced > 0) {
      throw new Error(
        `Cannot ${status === 'disabled' ? 'disable' : 'remove'} this device — it still has ${unsynced} unsynced record${unsynced === 1 ? '' : 's'}. Connect to a network and sync first.`
      );
    }
  }
  const db = getDB();
  db.runSync('UPDATE devices SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), deviceId]);
}

export function renameDevice(deviceId: string, name: string): void {
  const db = getDB();
  db.runSync('UPDATE devices SET name = ?, updated_at = ? WHERE id = ?', [name, new Date().toISOString(), deviceId]);
}

export function assignDeviceToUser(deviceId: string, userId: string | null): void {
  const db = getDB();
  db.runSync('UPDATE devices SET user_id = ?, updated_at = ? WHERE id = ?', [userId, new Date().toISOString(), deviceId]);
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
    `UPDATE devices SET status = 'removed', is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, input.oldDeviceId]
  );

  return getDevice(newId)!;
}

// ---------- Registers ----------

export function getRegisters(businessId: string): Register[] {
  const db = getDB();
  const rows = db.getAllSync('SELECT * FROM registers WHERE business_id = ? AND is_deleted = 0 ORDER BY created_at', [businessId]);
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
  const rows = db.getAllSync('SELECT * FROM locations WHERE business_id = ? AND is_deleted = 0 ORDER BY created_at', [businessId]);
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
  const rows = db.getAllSync('SELECT * FROM business_roles WHERE business_id = ? AND is_system = 0 AND is_deleted = 0 ORDER BY created_at', [businessId]);
  return (rows as any[]).map((r) => ({
    key: r.id,
    businessId: r.business_id,
    name: r.name,
    description: r.description,
    permissions: r.permissions ? JSON.parse(r.permissions) : {},
    createdAt: r.created_at,
  }));
}

export function createCustomRole(businessId: string, name: string, permissions: PermissionSet, description?: string): CustomRole {
  const db = getDB();
  const id = newUuid();
  const now = new Date().toISOString();
  db.runSync(
    'INSERT INTO business_roles (id, business_id, name, description, permissions, is_system, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
    [id, businessId, name.trim(), description ?? null, JSON.stringify(permissions), now]);
  return { key: id, businessId, name: name.trim(), description, permissions, createdAt: now };
}

// ---------- Effective permission resolution ----------
/**
 * Returns the effective permission set for a user: role defaults overlaid with
 * any custom/per-user overrides. This mirrors @shega/shared's merge logic but
 * operates on the stored DB role.
 */
export function effectivePermissions(user: User): PermissionSet {
  const role = getBuiltinRole(user.role as BuiltinRoleKey);
  const base = role ? role.permissions : {};
  if (user.permissions) {
    return { ...base, ...user.permissions };
  }
  return base;
}

// ---------- Manager PIN approval (spec §15) ----------

/** Set (or reset) a user's PIN for manager-approval, stored as a salted hash. */
export function setUserPin(userId: string, pin: string): void {
  const db = getDB();
  hashPin(pin).then((hash) => {
    const [salt, pinHash] = hash.split(':');
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

/** Verify a PIN against a specific user's stored hash. */
export async function verifyUserPin(userId: string, pin: string): Promise<boolean> {
  const stored = getUserPinHash(userId);
  if (!stored) return false;
  return verifyPin(pin, stored);
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

