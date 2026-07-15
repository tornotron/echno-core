/**
 * hooks/leave/use-leave-mutations.ts
 *
 * React Query mutation hooks for leave-related operations.
 *
 * This module provides mutation hooks for:
 * - Creating, updating, and deleting leave policies
 * - Adjusting leave balances
 * - Creating, updating, and managing leave requests
 * - Approving, rejecting, and delegating leave approvals
 * - Managing notifications
 *
 * Errors are logged via {@link logger}; the mutation result still
 * surfaces the error to the caller via `onError`. Success/error toasts
 * are the caller's responsibility (echno-web feature components) — this
 * platform-agnostic module carries no UI feedback.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveService } from '../../services/leave-service';
import { leaveKeys } from './use-leave';
import { logger } from '../../lib/logger';
import type {
  LeavePolicy,
  LeaveRequest,
  LeaveNotification,
} from '../../types/leave';
import {
  CreateLeavePolicyRequest,
  UpdateLeavePolicyRequest,
  AdjustLeaveBalanceRequest,
  CreateLeaveRequestRequest,
  UpdateLeaveRequestRequest,
  LeaveApprovalAction,
  CalculateDays,
} from '../../types/leave';

/**
 * Matches every LeavePolicy[] list cache under the 'leave/policies' namespace,
 * including `policies()` and `policiesByEmployee(id)`. Used by `setQueriesData`
 * to batch-patch all policy list views.
 */
function isLeavePolicyListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) &&
    key[0] === 'leave' &&
    key[1] === 'policies' &&
    // Exclude `policy(id)` shape: ['leave', 'policies', <number>]
    typeof key[2] !== 'number'
  );
}

/**
 * Matches every LeaveRequest[] list cache under the 'leave/requests' namespace.
 *
 * Explicitly excludes:
 *   - `request(id)` detail caches (numeric third segment),
 *   - `pendingApprovals(approverId)` and `pendingApprovalsCount(approverId)`
 *     caches — those are managed by approval mutations, and the count cache
 *     stores a number (not a LeaveRequest[]), so blindly patching it would
 *     throw at runtime.
 */
function isLeaveRequestListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  if (
    !Array.isArray(key) ||
    key[0] !== 'leave' ||
    key[1] !== 'requests' ||
    typeof key[2] === 'number'
  ) {
    return false;
  }
  // pendingApprovals → ['leave', 'requests', 'pending', approverId]
  // pendingApprovalsCount → ['leave', 'requests', 'pending', approverId, 'count']
  if (key[2] === 'pending') return false;
  // Defensive: ignore any future count-style key under the requests namespace.
  if (key.includes('count')) return false;
  return true;
}

/**
 * Removes a leave request from the approver's `pendingApprovals` list cache
 * and decrements the `pendingApprovalsCount` cache by 1. Used by approve /
 * reject / delegate `onSuccess` so the approver dashboard updates instantly
 * without a refetch.
 */
function patchPendingApprovalRemoval(
  queryClient: ReturnType<typeof useQueryClient>,
  approverId: number,
  requestId: number
): void {
  queryClient.setQueryData<LeaveRequest[]>(
    leaveKeys.pendingApprovals(approverId),
    (old) => old?.filter((r) => r.id !== requestId)
  );
  patchPendingApprovalCountDelta(queryClient, approverId, -1);
}

/**
 * Increments / decrements the cached `pendingApprovalsCount` for an approver.
 * No-op if the count isn't cached (functional updater returns undefined).
 */
function patchPendingApprovalCountDelta(
  queryClient: ReturnType<typeof useQueryClient>,
  approverId: number,
  delta: number
): void {
  queryClient.setQueryData<number>(
    leaveKeys.pendingApprovalsCount(approverId),
    (old) => (typeof old === 'number' ? Math.max(0, old + delta) : undefined)
  );
}

// ==================== Leave Policy Mutations ====================

/**
 * Creates a leave policy.
 *
 * Backend response: `LeavePolicyDto` (full).
 *
 * On success:
 * - `setQueryData(leaveKeys.policy(id), newPolicy)` — seeds the detail cache.
 * - `setQueryData(leaveKeys.policies(), append)` — appends to the policy list.
 *   No follow-up invalidation is needed.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts a
 *   {@link CreateLeavePolicyRequest}.
 */
export const useCreateLeavePolicy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateLeavePolicyRequest) =>
      leaveService.createPolicy(dto),
    onSuccess: (newPolicy) => {
      // POST /leave-policies/web → LeavePolicyDto (full).
      // Seed detail + append to lists; no follow-up refetch needed.
      queryClient.setQueryData(leaveKeys.policy(newPolicy.id), newPolicy);
      queryClient.setQueryData<LeavePolicy[]>(leaveKeys.policies(), (old) =>
        old ? [...old, newPolicy] : [newPolicy]
      );
    },
    onError: (error) => logger.error('Failed to Create Leave Policy:', error),
  });
};

/**
 * Updates a leave policy.
 *
 * Backend response: `LeavePolicyDto` (full).
 *
 * On success:
 * - `setQueryData(leaveKeys.policy(id), data)` — replaces the detail cache.
 * - `setQueriesData({ predicate: isLeavePolicyListCache }, replace)` — replaces
 *   the policy by id across every policy-list cache. No invalidation needed.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ policyId: number; updates: UpdateLeavePolicyRequest }`.
 */
export const useUpdateLeavePolicy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      policyId,
      updates,
    }: {
      policyId: number;
      updates: UpdateLeavePolicyRequest;
    }) => leaveService.updatePolicy(policyId, updates),
    onSuccess: (data) => {
      // PATCH /leave-policies/web/update → LeavePolicyDto (full).
      // Patch detail + every policy-list cache directly; no invalidations needed.
      queryClient.setQueryData(leaveKeys.policy(data.id), data);
      queryClient.setQueriesData<LeavePolicy[]>(
        { predicate: isLeavePolicyListCache },
        (old) => old?.map((p) => (p.id === data.id ? data : p))
      );
    },
    onError: (error) => logger.error('Failed to Update Leave Policy:', error),
  });
};

/**
 * Deactivates a leave policy (soft delete).
 *
 * Backend response: `ApiResponse` (ack).
 *
 * On success:
 * - `removeQueries(leaveKeys.policy(policyId))` — evicts the detail entry.
 * - `setQueriesData({ predicate: isLeavePolicyListCache }, filter)` — filters
 *   the policy out of every policy-list cache.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts the
 *   policy `id` (`number`).
 */
export const useDeleteLeavePolicy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (policyId: number) => leaveService.deletePolicy(policyId),
    onSuccess: (_, policyId) => {
      // DELETE /leave-policies/web/deactivate → ApiResponse (ack).
      // Entity removed — evict detail and filter from list caches.
      queryClient.removeQueries({ queryKey: leaveKeys.policy(policyId) });
      queryClient.setQueriesData<LeavePolicy[]>(
        { predicate: isLeavePolicyListCache },
        (old) => old?.filter((p) => p.id !== policyId)
      );
    },
    onError: (error) => logger.error('Failed to Delete Leave Policy:', error),
  });
};

/**
 * Reactivates a deactivated leave policy.
 *
 * Backend response: `ApiResponse` (ack) per the API spec, though the service
 * currently parses the response as a {@link LeavePolicy}.
 *
 * On success:
 * - When the parsed response carries a numeric `id`:
 *   `setQueryData(leaveKeys.policy(id), data)` seeds the detail cache and
 *   `setQueriesData({ predicate: isLeavePolicyListCache }, replace)` replaces
 *   the policy across list caches.
 * - Otherwise `invalidateQueries(leaveKeys.policies())` — kept as a fallback so
 *   the list refetches when the response can't be patched in.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts the
 *   policy `id` (`number`).
 */
export const useActivateLeavePolicy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (policyId: number) => leaveService.activatePolicy(policyId),
    onSuccess: (data) => {
      // POST /leave-policies/web/activate → ApiResponse (ack) per spec, but
      // leaveService.activatePolicy parses the response as LeavePolicy. If
      // the spec is correct, `data` may be empty/malformed; fall back to
      // invalidate when patching with `data` isn't viable.
      // FIXME: confirm backend response shape; update service signature
      // (Promise<void>) if spec is authoritative.
      if (data && typeof data.id === 'number') {
        queryClient.setQueryData(leaveKeys.policy(data.id), data);
        queryClient.setQueriesData<LeavePolicy[]>(
          { predicate: isLeavePolicyListCache },
          (old) => old?.map((p) => (p.id === data.id ? data : p))
        );
      } else {
        queryClient.invalidateQueries({ queryKey: leaveKeys.policies() });
      }
    },
    onError: (error) => logger.error('Failed to Activate Leave Policy:', error),
  });
};

/**
 * Duplicates a leave policy into another organization.
 *
 * Backend response: `LeavePolicyDto` (full).
 *
 * On success:
 * - `setQueryData(leaveKeys.policy(id), newPolicy)` — seeds the detail cache.
 * - `setQueryData(leaveKeys.policies(), append)` — appends to the policy list
 *   (same pattern as create).
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ policyId: number; targetOrganizationId: number }`.
 */
export const useDuplicateLeavePolicy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      policyId,
      targetOrganizationId,
    }: {
      policyId: number;
      targetOrganizationId: number;
    }) => leaveService.duplicatePolicy(policyId, targetOrganizationId),
    onSuccess: (newPolicy) => {
      // POST /leave-policies/web/duplicate → LeavePolicyDto (full).
      // Seed detail + append to lists; same pattern as create.
      queryClient.setQueryData(leaveKeys.policy(newPolicy.id), newPolicy);
      queryClient.setQueryData<LeavePolicy[]>(leaveKeys.policies(), (old) =>
        old ? [...old, newPolicy] : [newPolicy]
      );
    },
    onError: (error) => logger.error('Failed to Duplicate Leave Policy:', error),
  });
};

// ==================== Leave Balance Mutations ====================

/**
 * Triggers a server-side recalculation of an employee's balances.
 *
 * Backend response: `LeaveBalanceDto` per the API spec, but the service
 * discards it (returns `void`) — balances are recomputed server-side.
 *
 * On success:
 * - `invalidateQueries(leaveKeys.employeeBalances(employeeId))` — kept
 *   (server-side computation); scoped to this employee so other caches stay
 *   warm.
 * - `invalidateQueries(leaveKeys.employeeBalanceSummary(employeeId))` — kept
 *   (server-recomputed rollup).
 * - `invalidateQueries(leaveKeys.transactions(employeeId))` — kept
 *   (recalculation may append transactions).
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts the
 *   employee `id` (`number`).
 */
export const useRecalculateBalances = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (employeeId: number) =>
      leaveService.recalculateBalances(employeeId),
    onSuccess: (_, employeeId) => {
      // POST /leave-balances/web/recalculate → LeaveBalanceDto per spec, but
      // leaveService.recalculateBalances returns Promise<void> (discarded).
      // Balances are server-recomputed; targeted invalidation is the right tool.
      // Scoped to this employee — other employees' caches stay warm.
      queryClient.invalidateQueries({
        queryKey: leaveKeys.employeeBalances(employeeId),
      });
      queryClient.invalidateQueries({
        queryKey: leaveKeys.employeeBalanceSummary(employeeId),
      });
      queryClient.invalidateQueries({
        queryKey: leaveKeys.transactions(employeeId),
      });
    },
    onError: (error) => logger.error('Failed to Recalculate Balances:', error),
  });
};

/**
 * Applies a manual adjustment to a leave balance.
 *
 * Backend response: `LeaveTransactionDto` per the API spec; the service parses
 * it as the updated {@link LeaveBalance} for the adjusted policy.
 *
 * On success:
 * - `setQueryData(leaveKeys.employeePolicyBalance(employeeId, leavePolicyId),
 *   data)` — patches the policy-specific balance directly.
 * - `invalidateQueries(leaveKeys.employeeBalances(employeeId))` — kept: the
 *   per-employee list rollup is recomputed server-side.
 * - `invalidateQueries(leaveKeys.employeeBalanceSummary(employeeId))` — kept
 *   (server-recomputed rollup).
 * - `invalidateQueries(leaveKeys.transactions(employeeId))` — kept: the
 *   adjustment appends a transaction.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts an
 *   {@link AdjustLeaveBalanceRequest}.
 */
export const useAdjustBalance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: AdjustLeaveBalanceRequest) =>
      leaveService.adjustBalance(dto),
    onSuccess: (data) => {
      // POST /leave-balances/web/adjust → LeaveTransactionDto per spec; the
      // service parses as LeaveBalance (returns the updated balance for the
      // adjusted policy). Patch the policy-specific balance directly; invalidate
      // the rollups (summary + transactions list) since server recomputes them.
      queryClient.setQueryData(
        leaveKeys.employeePolicyBalance(data.employeeId, data.leavePolicyId),
        data
      );
      queryClient.invalidateQueries({
        queryKey: leaveKeys.employeeBalances(data.employeeId),
      });
      queryClient.invalidateQueries({
        queryKey: leaveKeys.employeeBalanceSummary(data.employeeId),
      });
      queryClient.invalidateQueries({
        queryKey: leaveKeys.transactions(data.employeeId),
      });
    },
    onError: (error) => logger.error('Failed to Adjust Balance:', error),
  });
};

// ==================== Leave Request Mutations ====================

/**
 * Creates a leave request (draft).
 *
 * Backend response: `LeaveRequestDto` (full).
 *
 * On success:
 * - `setQueryData(leaveKeys.request(id), data)` — seeds the detail cache.
 * - `setQueriesData({ predicate: isLeaveRequestListCache }, append)` — appends
 *   to every request-list cache.
 * - `invalidateQueries(['leave', 'balances', 'employee', employeeId])` — kept:
 *   pending balances are recomputed server-side; scoped to this employee.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts a
 *   {@link CreateLeaveRequestRequest}.
 */
export const useCreateLeaveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateLeaveRequestRequest) =>
      leaveService.createRequest(dto),
    onSuccess: (data) => {
      // POST /leave-requests/web → LeaveRequestDto (full).
      // Seed detail + append to every request list cache via predicate. Balance
      // recompute happens server-side; scope invalidation to this employee.
      queryClient.setQueryData(leaveKeys.request(data.id), data);
      queryClient.setQueriesData<LeaveRequest[]>(
        { predicate: isLeaveRequestListCache },
        (old) => (old ? [...old, data] : undefined)
      );
      queryClient.invalidateQueries({
        queryKey: [...leaveKeys.balances(), 'employee', data.employeeId],
      });
    },
    onError: (error) => logger.error('Failed to Create Leave Request:', error),
  });
};

/**
 * Updates a draft leave request.
 *
 * Backend response: `LeaveRequestDto` (full).
 *
 * On success:
 * - `setQueryData(leaveKeys.request(id), data)` — replaces the detail cache.
 * - `setQueriesData({ predicate: isLeaveRequestListCache }, replace)` —
 *   replaces the request by id across every request-list cache. No
 *   invalidation needed.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ requestId: number; employeeId: number; dto: UpdateLeaveRequestRequest }`.
 */
export const useUpdateLeaveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      employeeId,
      dto,
    }: {
      requestId: number;
      employeeId: number;
      dto: UpdateLeaveRequestRequest;
    }) => leaveService.updateRequest(requestId, employeeId, dto),
    onSuccess: (data) => {
      // PATCH /leave-requests/web/update → LeaveRequestDto (full).
      // Patch detail + every request-list cache directly; no invalidations.
      queryClient.setQueryData(leaveKeys.request(data.id), data);
      queryClient.setQueriesData<LeaveRequest[]>(
        { predicate: isLeaveRequestListCache },
        (old) => old?.map((r) => (r.id === data.id ? data : r))
      );
    },
    onError: (error) => logger.error('Failed to Update Leave Request:', error),
  });
};

/**
 * Submits a draft request into the approval workflow.
 *
 * Backend response: `LeaveRequestDto` (full).
 *
 * On success:
 * - `setQueryData(leaveKeys.request(id), data)` — replaces the detail cache.
 * - `setQueriesData({ predicate: isLeaveRequestListCache }, replace)` —
 *   replaces the request across request-list caches.
 * - `invalidateQueries(['leave', 'balances', 'employee', employeeId])` — kept:
 *   pending balances are recomputed server-side.
 * - `invalidateQueries(leaveKeys.requests())` — kept: the target approver set
 *   is opaque to this employee context, so the whole request namespace is
 *   invalidated to refresh approver views.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ employeeId: number; requestId: number }`.
 */
export const useSubmitLeaveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employeeId,
      requestId,
    }: {
      employeeId: number;
      requestId: number;
    }) => leaveService.submitRequest(employeeId, requestId),
    onSuccess: (data) => {
      // POST /leave-requests/web/employeeId/{employeeId}/submit → LeaveRequestDto (full).
      // Patch detail + lists; balance recompute is server-side; pending
      // approvals are scoped per approver and the approver set is opaque to
      // this employee context — invalidate the request-list namespace to
      // refresh approver views.
      queryClient.setQueryData(leaveKeys.request(data.id), data);
      queryClient.setQueriesData<LeaveRequest[]>(
        { predicate: isLeaveRequestListCache },
        (old) => old?.map((r) => (r.id === data.id ? data : r))
      );
      queryClient.invalidateQueries({
        queryKey: [...leaveKeys.balances(), 'employee', data.employeeId],
      });
      // Keep: approvers are not known from this context.
      queryClient.invalidateQueries({ queryKey: leaveKeys.requests() });
    },
    onError: (error) => logger.error('Failed to Submit Leave Request:', error),
  });
};

/**
 * Cancels a leave request.
 *
 * Backend response: `LeaveRequestDto` per the API spec, but the service
 * currently discards it (returns `void`), so `onSuccess` invalidates rather
 * than patching.
 *
 * On success:
 * - `invalidateQueries(leaveKeys.request(requestId))` — kept: no response body
 *   to patch the detail with.
 * - `invalidateQueries({ predicate: isLeaveRequestListCache })` — kept: list
 *   entries' status changes.
 * - `invalidateQueries(['leave', 'balances', 'employee', employeeId])` — kept:
 *   cancelling frees the reserved balance server-side.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ requestId: number; employeeId: number; reason?: string }`.
 */
export const useCancelLeaveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      employeeId,
      reason,
    }: {
      requestId: number;
      employeeId: number;
      reason?: string;
    }) => leaveService.cancelRequest(requestId, employeeId, reason),
    onSuccess: (_data, { requestId, employeeId }) => {
      // POST /leave-requests/web/cancel → LeaveRequestDto per spec, but
      // leaveService.cancelRequest returns Promise<void>.
      // FIXME: capture the response and patch caches like useUpdateLeaveRequest.
      // For now, scope-narrow the invalidations to this employee.
      queryClient.invalidateQueries({ queryKey: leaveKeys.request(requestId) });
      queryClient.invalidateQueries({ predicate: isLeaveRequestListCache });
      queryClient.invalidateQueries({
        queryKey: [...leaveKeys.balances(), 'employee', employeeId],
      });
    },
    onError: (error) => logger.error('Failed to Cancel Leave Request:', error),
  });
};

/**
 * Withdraws a pending (already-submitted) leave request.
 *
 * Backend response: `LeaveRequestDto` per the API spec, but the service
 * currently discards it (returns `void`), so `onSuccess` invalidates rather
 * than patching.
 *
 * On success:
 * - `invalidateQueries(leaveKeys.request(requestId))` — kept: no response body
 *   to patch the detail with.
 * - `invalidateQueries({ predicate: isLeaveRequestListCache })` — kept: list
 *   entries' status changes.
 * - `invalidateQueries(leaveKeys.balances())` — kept: withdrawal frees the
 *   reserved balance; invalidated at the namespace level because the mutation
 *   input carries no employee id.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts the
 *   request `id` (`number`).
 */
export const useWithdrawLeaveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: number) => leaveService.withdrawRequest(requestId),
    onSuccess: (_, requestId) => {
      // POST /leave-requests/web/employeeId/{employeeId}/withdraw → LeaveRequestDto per spec,
      // but leaveService.withdrawRequest returns Promise<void>.
      // FIXME: capture the response and patch instead of invalidating; would
      // also need to add employeeId to the mutation input for scoped balance
      // invalidation.
      queryClient.invalidateQueries({ queryKey: leaveKeys.request(requestId) });
      queryClient.invalidateQueries({ predicate: isLeaveRequestListCache });
      queryClient.invalidateQueries({ queryKey: leaveKeys.balances() });
    },
    onError: (error) => logger.error('Failed to Withdraw Leave Request:', error),
  });
};

/**
 * Checks whether a proposed leave range conflicts with existing requests.
 *
 * Backend response: `ConflictCheckResponse`. This is a read-only computation
 * exposed as a mutation (imperative, on-demand); it performs no cache writes,
 * evictions, or invalidations.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ employeeId: number; startDate: string; endDate: string }` and resolves
 *   to a {@link ConflictCheckResponse}.
 */
export const useCheckConflicts = () => {
  return useMutation({
    mutationFn: ({
      employeeId,
      startDate,
      endDate,
    }: {
      employeeId: number;
      startDate: string;
      endDate: string;
    }) => leaveService.checkConflicts(employeeId, startDate, endDate),
  });
};

/**
 * Calculates the total leave days for a proposed range.
 *
 * Backend response: `CalculateDaysResponse`. This is a read-only computation
 * exposed as a mutation (imperative, on-demand); it performs no cache writes,
 * evictions, or invalidations.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts a
 *   {@link CalculateDays} payload and resolves to a
 *   {@link CalculateDaysResponse}.
 */
export const useCalculateDays = () => {
  return useMutation({
    mutationFn: (dto: CalculateDays) => leaveService.calculateDays(dto),
  });
};

// ==================== Leave Approval Mutations ====================

/**
 * Approves a leave request at the current approval step.
 *
 * Backend response: `LeaveRequestDto` per the API spec, but the service
 * currently discards it (returns `void`), so the detail/list caches are
 * invalidated rather than patched.
 *
 * On success:
 * - {@link patchPendingApprovalRemoval} — removes the request from the
 *   approver's `pendingApprovals` list and decrements `pendingApprovalsCount`.
 * - `invalidateQueries(leaveKeys.request(requestId))` — kept: no response body
 *   to patch the detail with.
 * - `invalidateQueries(leaveKeys.approvalHistory(requestId))` and
 *   `invalidateQueries(leaveKeys.approvalChain(requestId))` — kept: approving
 *   appends to the history/chain.
 * - `invalidateQueries(leaveKeys.balances())` and
 *   `invalidateQueries(leaveKeys.calendar())` — kept: balance recompute and
 *   calendar entries are server-side and cross-employee.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ requestId: number; dto: LeaveApprovalAction }`.
 */
export const useApproveLeaveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      dto,
    }: {
      requestId: number;
      dto: LeaveApprovalAction;
    }) => leaveService.approveRequest(requestId, dto),
    onSuccess: (_data, { requestId, dto }) => {
      // POST /leave-approvals/web/approve → LeaveRequestDto per spec, but
      // leaveService.approveRequest returns Promise<void>.
      // FIXME: capture the response, patch leaveKeys.request(data.id) and
      // the lists. For now, patch what we know deterministically:
      // remove from this approver's pending list and decrement the count.
      patchPendingApprovalRemoval(queryClient, dto.approverId, requestId);
      queryClient.invalidateQueries({ queryKey: leaveKeys.request(requestId) });
      queryClient.invalidateQueries({
        queryKey: leaveKeys.approvalHistory(requestId),
      });
      queryClient.invalidateQueries({
        queryKey: leaveKeys.approvalChain(requestId),
      });
      // Keep: balance recompute + calendar are server-side / cross-employee.
      queryClient.invalidateQueries({ queryKey: leaveKeys.balances() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.calendar() });
    },
    onError: (error) => logger.error('Failed to Approve Leave Request:', error),
  });
};

/**
 * Rejects a leave request at the current approval step.
 *
 * Backend response: `LeaveRequestDto` per the API spec, but the service
 * currently discards it (returns `void`), so caches are invalidated rather
 * than patched.
 *
 * On success:
 * - {@link patchPendingApprovalRemoval} — removes the request from the
 *   approver's `pendingApprovals` list and decrements `pendingApprovalsCount`.
 * - `invalidateQueries(leaveKeys.request(requestId))` — kept: no response body
 *   to patch with.
 * - `invalidateQueries(leaveKeys.approvalHistory(requestId))` and
 *   `invalidateQueries(leaveKeys.approvalChain(requestId))` — kept: rejecting
 *   appends to the history/chain.
 * - `invalidateQueries(leaveKeys.balances())` — kept: rejection releases the
 *   reserved balance server-side.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ requestId: number; dto: LeaveApprovalAction }`.
 */
export const useRejectLeaveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      dto,
    }: {
      requestId: number;
      dto: LeaveApprovalAction;
    }) => leaveService.rejectRequest(requestId, dto),
    onSuccess: (_data, { requestId, dto }) => {
      // POST /leave-approvals/web/reject → LeaveRequestDto per spec.
      // Same shape as approve: decrement pending count, remove from pending list.
      patchPendingApprovalRemoval(queryClient, dto.approverId, requestId);
      queryClient.invalidateQueries({ queryKey: leaveKeys.request(requestId) });
      queryClient.invalidateQueries({
        queryKey: leaveKeys.approvalHistory(requestId),
      });
      queryClient.invalidateQueries({
        queryKey: leaveKeys.approvalChain(requestId),
      });
      queryClient.invalidateQueries({ queryKey: leaveKeys.balances() });
    },
    onError: (error) => logger.error('Failed to Reject Leave Request:', error),
  });
};

/**
 * Delegates a request's approval to another approver.
 *
 * Backend response: `LeaveRequestDto` per the API spec, but the service
 * currently discards it (returns `void`), so caches are invalidated rather
 * than patched.
 *
 * On success:
 * - {@link patchPendingApprovalRemoval} — removes the request from the current
 *   approver's `pendingApprovals` list and decrements their count.
 * - `invalidateQueries(leaveKeys.request(requestId))`,
 *   `invalidateQueries(leaveKeys.approvalHistory(requestId))`, and
 *   `invalidateQueries(leaveKeys.approvalChain(requestId))` — kept: delegation
 *   updates the request's routing and appends to the history/chain.
 * - When `dto.delegateToId` is set: {@link patchPendingApprovalCountDelta}
 *   bumps the delegate's count by 1, and
 *   `invalidateQueries(leaveKeys.pendingApprovals(delegateToId))` is kept as a
 *   fallback because appending to the delegate's list needs the full request
 *   entity, which this context doesn't hold.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ requestId: number; dto: LeaveApprovalAction }`.
 */
export const useDelegateApproval = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      dto,
    }: {
      requestId: number;
      dto: LeaveApprovalAction;
    }) => leaveService.delegateApproval(requestId, dto),
    onSuccess: (_data, { requestId, dto }) => {
      // POST /leave-approvals/web/delegate → LeaveRequestDto per spec.
      // Removes from current approver, conditionally adds to delegate target.
      patchPendingApprovalRemoval(queryClient, dto.approverId, requestId);
      queryClient.invalidateQueries({ queryKey: leaveKeys.request(requestId) });
      queryClient.invalidateQueries({
        queryKey: leaveKeys.approvalHistory(requestId),
      });
      queryClient.invalidateQueries({
        queryKey: leaveKeys.approvalChain(requestId),
      });
      if (dto.delegateToId !== undefined) {
        // Bump the delegate's count by 1 if it's cached; their pending list
        // requires the full LeaveRequest entity to append, which we don't have
        // until the service captures the response. Invalidate as fallback.
        patchPendingApprovalCountDelta(queryClient, dto.delegateToId, +1);
        queryClient.invalidateQueries({
          queryKey: leaveKeys.pendingApprovals(dto.delegateToId),
        });
      }
    },
    onError: (error) => logger.error('Failed to Delegate Approval:', error),
  });
};

// ==================== Notification Mutations ====================

/**
 * Marks a single notification as read.
 *
 * Backend response: `void`.
 *
 * On success:
 * - `setQueryData(leaveKeys.unreadNotifications(employeeId), filter)` — removes
 *   the notification from the unread list.
 * - `setQueryData(leaveKeys.unreadCount(employeeId), decrement)` — decrements
 *   the unread count (floored at 0).
 * - `setQueriesData({ predicate: employee notifications }, flag-as-read)` —
 *   flags the entry `isRead` across any paginated employee-notification cache.
 *   No invalidations needed on the happy path.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ notificationId: number; employeeId: number }`.
 */
export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Accept employeeId in addition to id so we can patch the employee's
    // notification list, unread list, and unread count directly.
    mutationFn: ({
      notificationId,
    }: {
      notificationId: number;
      employeeId: number;
    }) => leaveService.markAsRead(notificationId),
    onSuccess: (_, { notificationId, employeeId }) => {
      // POST notifications/{id}/read → void.
      // Remove from unread list, decrement count, flag the entry in the
      // full employee list as read. No invalidations needed for the happy path.
      queryClient.setQueryData<LeaveNotification[]>(
        leaveKeys.unreadNotifications(employeeId),
        (old) => old?.filter((n) => n.id !== notificationId)
      );
      queryClient.setQueryData<number>(
        leaveKeys.unreadCount(employeeId),
        (old) => (typeof old === 'number' ? Math.max(0, old - 1) : undefined)
      );
      // Patch the entry in any paginated employee notifications cache; predicate
      // since key shape includes pagination params.
      queryClient.setQueriesData<LeaveNotification[]>(
        {
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[0] === 'leave' &&
            q.queryKey[1] === 'notifications' &&
            q.queryKey[2] === employeeId,
        },
        (old) =>
          old?.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          )
      );
    },
  });
};

/**
 * Marks all of an employee's notifications as read.
 *
 * Backend response: `void`.
 *
 * On success:
 * - `setQueryData(leaveKeys.unreadNotifications(employeeId), [])` — empties the
 *   unread list.
 * - `setQueryData(leaveKeys.unreadCount(employeeId), 0)` — zeroes the count.
 * - `setQueriesData({ predicate: employee notifications }, flag-all-read)` —
 *   flags every entry `isRead` across paginated employee-notification caches.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts the
 *   employee `id` (`number`).
 */
export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (employeeId: number) => leaveService.markAllAsRead(employeeId),
    onSuccess: (_, employeeId) => {
      // POST notifications/read-all → void.
      // Clear unread list, zero the count, mark all entries in the paginated
      // employee notifications cache as read.
      queryClient.setQueryData<LeaveNotification[]>(
        leaveKeys.unreadNotifications(employeeId),
        []
      );
      queryClient.setQueryData<number>(leaveKeys.unreadCount(employeeId), 0);
      queryClient.setQueriesData<LeaveNotification[]>(
        {
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[0] === 'leave' &&
            q.queryKey[1] === 'notifications' &&
            q.queryKey[2] === employeeId,
        },
        (old) => old?.map((n) => ({ ...n, isRead: true }))
      );
    },
  });
};
