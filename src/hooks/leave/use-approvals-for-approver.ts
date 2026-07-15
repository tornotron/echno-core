/**
 * @module hooks/leave/use-approvals-for-approver
 *
 * Derived hook for the manager approvals dashboard:
 * {@link useApprovalsForApprover}. Composes {@link usePendingApprovals} and
 * {@link usePendingApprovalsCount} and splits the result into urgent and
 * non-urgent buckets.
 */

import { useMemo, useState } from 'react';
import {
  usePendingApprovals,
  usePendingApprovalsCount,
} from './use-leave';

/**
 * Encapsulates business logic for the manager approvals dashboard.
 *
 * Fetches pending approvals for the given approver, filters to those
 * assigned to them (`currentApproverId === employeeId`), and splits results
 * into urgent (starting in 0–3 days) and non-urgent buckets. "Now" is
 * captured once on mount so the split is stable during render.
 *
 * @param employeeId - Surrogate id of the approver.
 * @returns An object with `pendingApprovals`, `urgentApprovals`,
 *   `nonUrgentApprovals`, the server `pendingCount`, and `approvalsLoading`.
 */
export function useApprovalsForApprover(employeeId: number) {
  const { data: pendingApprovalsRaw, isLoading: approvalsLoading } =
    usePendingApprovals(employeeId);
  const { data: pendingCount } = usePendingApprovalsCount(employeeId);

  // Capture current time once on mount (pure during render)
  const [now] = useState(() => Date.now());

  // Filter approvals matching approverId = employee.id
  const pendingApprovals = useMemo(() => {
    return (
      pendingApprovalsRaw?.filter((r) => r.currentApproverId === employeeId) ||
      []
    );
  }, [pendingApprovalsRaw, employeeId]);

  // Calculate urgent approvals (starting in 0–3 days)
  const urgentApprovals = useMemo(() => {
    return pendingApprovals.filter((r) => {
      const daysUntilStart = Math.ceil(
        (r.startDate.getTime() - now) / (1000 * 60 * 60 * 24)
      );
      return daysUntilStart >= 0 && daysUntilStart <= 3;
    });
  }, [pendingApprovals, now]);

  // Non-urgent approvals (to avoid duplicates)
  const nonUrgentApprovals = useMemo(() => {
    const urgentIds = new Set(urgentApprovals.map((r) => r.id));
    return pendingApprovals.filter((r) => !urgentIds.has(r.id));
  }, [pendingApprovals, urgentApprovals]);

  return {
    pendingApprovals,
    urgentApprovals,
    nonUrgentApprovals,
    pendingCount,
    approvalsLoading,
  };
}
