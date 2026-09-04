// usePinApproval — runtime for spec §15 "Manager PIN approval".
//
// Sensitive actions carry a permission value of `'approval'` in the shared
// engine (e.g. sales.refund, inventory.adjust, sales.priceOverride). This hook
// turns that state into a real second-factor prompt:
//
//   const { request, modal } = usePinApproval();
//   const ok = await request('inventory.adjust', 'Adjust stock');
//   if (ok === 'approved') { /* run the action */ }
//   // ... render {modal} in the screen's JSX.
//
// Flow:
//  1. approvalState(actor, key):
//       - 'allowed'           -> owner/manager acting with the right role; no prompt.
//       - 'denied'            -> actor is blocked outright; no prompt.
//       - 'approval-required' -> open the PIN prompt.
//  2. The actor types a PIN; we verify it against an approval-capable user
//     (a manager/owner with a configured PIN) via verifyUserPin.
//  3. 'approved' only if the PIN verifies; otherwise the prompt stays open
//     with an inline error (like a wrong-PIN retry).

import { useCallback, useMemo, useRef, useState } from 'react';
import PinApprovalModal from '@/components/PinApprovalModal';
import {
  approvalState,
  getActiveBusiness,
  getApproverForBusiness,
  getCurrentUserId,
  getUser,
  verifyUserPin,
} from '@/services/businessService';

export type ApprovalOutcome = 'approved' | 'denied' | 'cancelled';

export function usePinApproval() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [approverName, setApproverName] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const pendingRef = useRef<{
    resolve: (o: ApprovalOutcome) => void;
    approverId: string;
  } | null>(null);

  const resolve = useCallback((outcome: ApprovalOutcome) => {
    setVisible(false);
    setVerifying(false);
    const p = pendingRef.current;
    pendingRef.current = null;
    if (p) p.resolve(outcome);
  }, []);

  const handleConfirm = useCallback(
    async (pin: string) => {
      const p = pendingRef.current;
      if (!p || pin.length === 0 || verifying) return;
      setVerifying(true);
      setError(null);
      const ok = await verifyUserPin(p.approverId, pin);
      if (ok) {
        resolve('approved');
      } else {
        setVerifying(false);
        setError('PIN is incorrect. Try again.');
      }
    },
    [resolve, verifying],
  );

  const request = useCallback(
    (permKey: string, actionLabel?: string, customTitle?: string): Promise<ApprovalOutcome> => {
      const actorId = getCurrentUserId();
      const actor = actorId ? getUser(actorId) : undefined;
      const business = getActiveBusiness();

      return new Promise<ApprovalOutcome>((resolvePromise) => {
        // No identity or business context -> fail closed (deny).
        if (!actor || !business) {
          resolvePromise('denied');
          return;
        }
        const result = approvalState(actor, permKey);
        if (result.allowed) {
          resolvePromise('approved');
          return;
        }
        if (result.reason !== 'approval-required') {
          resolvePromise('denied');
          return;
        }

        // Find an approval-capable user who can confirm (manager/owner with PIN).
        const approver = getApproverForBusiness(business.id);
        if (!approver || !business.id) {
          resolvePromise('denied');
          return;
        }

        pendingRef.current = { resolve: resolvePromise, approverId: approver.id };
        setApproverName(approver.name);
        setTitle(customTitle ?? `${actionLabel ?? 'This action'} requires manager approval`);
        setMessage(customTitle
          ? undefined
          : `Enter the manager or owner PIN to approve ${actionLabel ?? 'this action'}.`);
        setError(null);
        setVisible(true);
      });
    },
    [],
  );

  const modal = useMemo(
    () => (
      <PinApprovalModal
        visible={visible}
        title={title}
        message={message}
        approverName={approverName}
        error={error}
        verifying={verifying}
        onConfirm={handleConfirm}
        onCancel={() => resolve('cancelled')}
      />
    ),
    [visible, title, message, approverName, error, verifying, handleConfirm, resolve],
  );

  return { request, modal };
}
