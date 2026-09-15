// Cloud QR pairing client (works with the Django backend pairing endpoints).
//
// Owner/Manager issues a short-lived single-use invitation (token+QR), the
// employee scans/enters it, confirms the assignment preview and accepts — which
// creates a *pending* device + pending membership. Only Owner/Manager approval
// activates both. This mirrors the LAN hub join flow but stays authoritative
// through the cloud backend.

import { request } from './api';
import { getDeviceId } from './syncService';

export interface PairingInviteIssued {
  id: string;
  token: string;
  code: string;
  qr_uri: string;
  business_name: string;
  business_id: string;
  employee_name: string | null;
  role: string;
  register: string | null;
  location: string | null;
  expires_at: string;
}

export interface PairingLookup {
  business_id: string;
  business_name: string;
  employee_name: string | null;
  role: string;
  register: string | null;
  location: string | null;
  expires_at: string;
}

export interface PairingInvitation {
  id: string;
  employee_name: string | null;
  role: string;
  register: string | null;
  location: string | null;
  status: 'pending' | 'used' | 'approved' | 'rejected' | 'revoked' | 'cancelled' | 'expired';
  expires_at: string;
  created_at: string;
  business_id: string;
  accepted_by: string | null;
  device_id: string | null;
  device_status: 'active' | 'pending' | 'locked' | 'disabled' | 'removed' | null;
}

export interface PairingAcceptResult {
  received: boolean;
  status: 'active' | 'pending';
  detail: string;
  device_id: string;
  invitation_id: string;
  device_key?: string | null;
}

export interface PairingStatus {
  id: string;
  status: 'pending' | 'used' | 'approved' | 'rejected' | 'revoked' | 'cancelled' | 'expired';
  device_status: 'active' | 'pending' | 'locked' | 'disabled' | 'removed' | null;
  role: string;
  business_name: string;
  business_id: string;
  employee_name: string | null;
  register: string | null;
  location: string | null;
}

/** A pairing request where the authenticated user is the joiner (used_by). */
export interface PairingRequest {
  id: string;
  employee_name: string | null;
  role: string;
  register: string | null;
  location: string | null;
  status: 'pending' | 'used' | 'approved' | 'rejected' | 'revoked' | 'cancelled' | 'expired';
  expires_at: string;
  created_at: string;
  used_at: string | null;
  business_id: string;
  business_name: string;
  accepted_by: string | null;
  device_id: string | null;
  device_name: string | null;
  platform: 'mobile' | 'desktop' | null;
  device_status: 'active' | 'pending' | 'locked' | 'disabled' | 'removed' | null;
  expired: boolean;
  /** true only while the request is still live and within its code window. */
  resumable: boolean;
}

export interface CloudDeviceEntry {
  id: string;
  device_id: string;
  device_name: string;
  platform: 'mobile' | 'desktop' | string;
  status: 'pending' | 'active' | 'locked' | 'disabled' | 'removed';
  is_active: boolean;
  role_key: string | null;
  bound_user_id: string | null;
  bound_user_name: string | null;
  last_seen: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Owner/Manager: issue a pairing invitation for an employee. */
export async function issuePairingInvite(input: {
  employeeName?: string;
  role: string;
  register?: string;
  location?: string;
}): Promise<PairingInviteIssued> {
  const body: Record<string, unknown> = {
    role: input.role,
  };
  if (input.employeeName) body.employee_name = input.employeeName;
  if (input.register) body.register = input.register;
  if (input.location) body.location = input.location;
  return request<PairingInviteIssued>('/api/sync/pairing/invite/', { method: 'POST', body, auth: true });
}

/** Employee (unauthenticated): preview an invitation before accepting. Code or token. */
export async function lookupPairingInvite(input: { token?: string; code?: string }): Promise<PairingLookup> {
  const body = input.token ? { token: input.token } : { code: input.code };
  return request<PairingLookup>('/api/sync/pairing/lookup/', { method: 'POST', body });
}

/** Employee (unauthenticated): preview an invitation from its QR token. */
export async function lookupPairingToken(token: string): Promise<PairingLookup> {
  return lookupPairingInvite({ token });
}

/** Employee (unauthenticated): preview an invitation from its 6-digit manual code. */
export async function lookupPairingCode(code: string): Promise<PairingLookup> {
  return lookupPairingInvite({ code });
}

/** Employee: accept an invitation by token OR manual code. Creates the pending device + membership. */
export async function acceptPairing(input: {
  token?: string;
  code?: string;
  deviceName: string;
  platform?: 'mobile' | 'desktop';
}): Promise<PairingAcceptResult> {
  const body: Record<string, unknown> = {
    device_id: getDeviceId(),
    device_name: input.deviceName,
    platform: input.platform ?? 'mobile',
  };
  if (input.token) body.token = input.token;
  else body.code = input.code;
  return request<PairingAcceptResult>('/api/sync/pairing/accept/', { method: 'POST', body, auth: true });
}

/** Employee: accept an invitation from its QR token. */
export async function acceptPairingToken(input: {
  token: string;
  deviceName: string;
}): Promise<PairingAcceptResult> {
  return acceptPairing({ token: input.token, deviceName: input.deviceName });
}

/** The acceptant (or a manager) polls the status of a specific invitation. */
export async function pairingStatus(id: string): Promise<PairingStatus> {
  return request<PairingStatus>(`/api/sync/pairing/status/${id}/`, { auth: true });
}

/**
 * The authenticated user's own pairing requests (server-backed + resumable).
 *
 * Resume contract: the pairing request survives app restarts, so after signing
 * back in on Mobile or Desktop, this is how a joiner recovers their pending
 * "Waiting for Approval" state — and how an already-approved request completes
 * the join. The single-use code is never re-issued by this endpoint.
 */
export async function myPairingRequests(): Promise<PairingRequest[]> {
  const res = await request<{ pairing_requests: PairingRequest[] }>('/api/sync/pairing/mine/', { auth: true });
  return res?.pairing_requests ?? [];
}

/** Manager with team.manage: all invitations + pending requests for my business. */
export async function listPairingInvitations(): Promise<PairingInvitation[]> {
  const res = await request<{ invitations: PairingInvitation[] }>('/api/sync/pairing/', { auth: true });
  return res?.invitations ?? [];
}

/** Manager: approve (activate device + membership) or reject a used request. */
export async function decidePairing(
  id: string,
  decision: 'approve' | 'reject',
  role?: string,
  permissions?: Record<string, unknown>,
): Promise<void> {
  // Approval-time role assignment: Owner / Cashier / Custom decided by the
  // approving owner; body stays empty so the invite-fixed role is the default.
  const body: Record<string, unknown> = {};
  if (role) body.role = role;
  if (permissions && typeof permissions === 'object') body.permissions = permissions;
  await request(`/api/sync/pairing/${id}/${decision}/`, { method: 'POST', auth: true, body });
}

/** Manager: revoke an invitation that is still pending. */
export async function revokePairing(id: string): Promise<void> {
  await request(`/api/sync/pairing/${id}/revoke/`, { method: 'POST', auth: true });
}

/** Owner/Manager: the full cloud device roster for my business (bound user + platform + status). */
export async function listCloudDevices(): Promise<CloudDeviceEntry[]> {
  const res = await request<{ devices: CloudDeviceEntry[] }>('/api/sync/devices/', { auth: true });
  return res?.devices ?? [];
}

/** Owner/Manager: rename a device or change its status (active/locked/disabled/removed). */
export async function manageDevice(
  id: string,
  patch: { device_name?: string; status?: 'active' | 'locked' | 'disabled' | 'removed' },
): Promise<CloudDeviceEntry> {
  return request<CloudDeviceEntry>(`/api/sync/device/${id}/`, { method: 'PATCH', body: patch, auth: true });
}

/** Owner/Manager: soft-remove a device (sync blocked; audit + user's other devices kept). */
export async function removeCloudDevice(id: string): Promise<void> {
  await request(`/api/sync/device/${id}/`, { method: 'DELETE', auth: true });
}