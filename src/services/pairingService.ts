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
  status: 'pending' | 'used' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
  business_id: string;
  accepted_by: string | null;
  device_id: string | null;
  device_status: 'active' | 'pending' | 'disabled' | null;
}

export interface PairingAcceptResult {
  received: boolean;
  status: 'active' | 'pending';
  detail: string;
  device_id: string;
  invitation_id: string;
}

export interface PairingStatus {
  id: string;
  status: 'pending' | 'used' | 'revoked' | 'expired';
  device_status: 'active' | 'pending' | 'disabled' | null;
  role: string;
  business_name: string;
  business_id: string;
  employee_name: string | null;
  register: string | null;
  location: string | null;
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

/** Employee (unauthenticated): preview an invitation before accepting. */
export async function lookupPairingToken(token: string): Promise<PairingLookup> {
  return request<PairingLookup>('/api/sync/pairing/lookup/', { method: 'POST', body: { token } });
}

/** Employee: accept an invitation (creates the pending device + membership). */
export async function acceptPairingToken(input: {
  token: string;
  deviceName: string;
}): Promise<PairingAcceptResult> {
  const body = { token: input.token, device_id: getDeviceId(), device_name: input.deviceName };
  return request<PairingAcceptResult>('/api/sync/pairing/accept/', { method: 'POST', body, auth: true });
}

/** The acceptant (or a manager) polls the status of a specific invitation. */
export async function pairingStatus(id: string): Promise<PairingStatus> {
  return request<PairingStatus>(`/api/sync/pairing/status/${id}/`, { auth: true });
}

/** Manager with team.manage: all invitations + pending requests for my business. */
export async function listPairingInvitations(): Promise<PairingInvitation[]> {
  const res = await request<{ invitations: PairingInvitation[] }>('/api/sync/pairing/', { auth: true });
  return res?.invitations ?? [];
}

/** Manager: approve (activate device + membership) or reject a used request. */
export async function decidePairing(id: string, decision: 'approve' | 'reject'): Promise<void> {
  await request(`/api/sync/pairing/${id}/${decision}/`, { method: 'POST', auth: true });
}

/** Manager: revoke an invitation that is still pending. */
export async function revokePairing(id: string): Promise<void> {
  await request(`/api/sync/pairing/${id}/revoke/`, { method: 'POST', auth: true });
}