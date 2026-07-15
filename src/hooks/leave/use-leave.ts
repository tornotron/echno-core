/**
 * @module hooks/leave/use-leave
 *
 * React Query key factory ({@link leaveKeys}) and query hooks for fetching
 * leave data: policies, balances and transactions, requests, approvals,
 * calendar views, and notifications. Mutation hooks live in
 * `use-leave-mutations.ts`. All query hooks inherit the default query-client
 * configuration (no per-hook option profile).
 */

import { useQuery } from '@tanstack/react-query';
import { leaveService } from '../../services/leave-service';
import { LeaveStatus } from '../../types/leave';

// ==================== Query Keys ====================

/**
 * TanStack Query key factory for the leave domain.
 *
 * Key shapes (grouped by sub-namespace):
 * - `['leave']` — namespace root (`all`); invalidation prefix only, never a
 *   query key.
 * - `['leave', 'policies', …]` — policy list (`policies()`), one policy
 *   (`policy(id)`), and an employee's applicable policies
 *   (`policiesByEmployee(employeeId)`).
 * - `['leave', 'balances', …]` — an employee's balances
 *   (`employeeBalances(employeeId, year?)`), one policy's balance
 *   (`employeePolicyBalance(employeeId, policyId)`), the cross-policy summary
 *   (`employeeBalanceSummary(employeeId, year?)`), and the transaction list
 *   (`transactions(employeeId)`).
 * - `['leave', 'requests', …]` — request list (`requests()`), one request
 *   (`request(id)`), employee-scoped lists (`employeeRequests`,
 *   `employeeRequestsByStatus`), org list (`organizationRequests`), and
 *   approver views (`approverRequests`, `pendingApprovals`,
 *   `pendingApprovalsCount`).
 * - `['leave', 'approvals', …]` — approval history (`approvalHistory`), chain
 *   (`approvalChain`), and the can-approve check (`canApprove`).
 * - `['leave', 'calendar', …]` — organization / department / employee / team /
 *   grouped calendars and the on-leave count (`leaveCount`).
 * - `['leave', 'notifications', …]` — paged list (`employeeNotifications`),
 *   unread list (`unreadNotifications`), and unread count (`unreadCount`).
 *
 * `isLeavePolicyListCache` / `isLeaveRequestListCache` in the mutations module
 * rely on these sub-namespace shapes to batch-patch or invalidate list caches.
 *
 * @see {@link useAllLeavePolicies} for a canonical query consumer.
 */
export const leaveKeys = {
  all: ['leave'] as const,

  // Leave Policies
  policies: () => [...leaveKeys.all, 'policies'] as const,
  policy: (id: number) => [...leaveKeys.policies(), id] as const,
  policiesByEmployee: (employeeId: number) =>
    [...leaveKeys.policies(), 'employee', employeeId] as const,

  // Leave Balances
  balances: () => [...leaveKeys.all, 'balances'] as const,
  employeeBalances: (employeeId: number, year?: number) =>
    [...leaveKeys.balances(), 'employee', employeeId, year] as const,
  employeePolicyBalance: (employeeId: number, policyId: number) =>
    [
      ...leaveKeys.balances(),
      'employee',
      employeeId,
      'policy',
      policyId,
    ] as const,
  employeeBalanceSummary: (employeeId: number, year?: number) =>
    [...leaveKeys.balances(), 'employee', employeeId, 'summary', year] as const,
  transactions: (employeeId: number) =>
    [...leaveKeys.balances(), 'transactions', employeeId] as const,

  // Leave Requests
  requests: () => [...leaveKeys.all, 'requests'] as const,
  request: (id: number) => [...leaveKeys.requests(), id] as const,
  employeeRequests: (employeeId: number, page?: number, size?: number) =>
    [...leaveKeys.requests(), 'employee', employeeId, { page, size }] as const,
  employeeRequestsByStatus: (employeeId: number, status: LeaveStatus) =>
    [
      ...leaveKeys.requests(),
      'employee',
      employeeId,
      'status',
      status,
    ] as const,
  organizationRequests: (page?: number, size?: number) =>
    [...leaveKeys.requests(), 'organization', { page, size }] as const,
  approverRequests: (approverId: number) =>
    [...leaveKeys.requests(), 'approver', approverId] as const,
  pendingApprovals: (approverId: number) =>
    [...leaveKeys.requests(), 'pending', approverId] as const,
  pendingApprovalsCount: (approverId: number) =>
    [...leaveKeys.requests(), 'pending', approverId, 'count'] as const,

  // Leave Approvals
  approvals: () => [...leaveKeys.all, 'approvals'] as const,
  approvalHistory: (requestId: number) =>
    [...leaveKeys.approvals(), 'history', requestId] as const,
  approvalChain: (requestId: number) =>
    [...leaveKeys.approvals(), 'chain', requestId] as const,
  canApprove: (requestId: number, employeeId: number) =>
    [...leaveKeys.approvals(), 'can-approve', requestId, employeeId] as const,

  // Leave Calendar
  calendar: () => [...leaveKeys.all, 'calendar'] as const,
  organizationCalendar: (orgId: number, startDate: string, endDate: string) =>
    [
      ...leaveKeys.calendar(),
      'organization',
      orgId,
      startDate,
      endDate,
    ] as const,
  departmentCalendar: (
    orgId: number,
    department: string,
    startDate: string,
    endDate: string
  ) =>
    [
      ...leaveKeys.calendar(),
      'department',
      orgId,
      department,
      startDate,
      endDate,
    ] as const,
  employeeCalendar: (employeeId: number, startDate: string, endDate: string) =>
    [
      ...leaveKeys.calendar(),
      'employee',
      employeeId,
      startDate,
      endDate,
    ] as const,
  teamCalendar: (managerId: number, startDate: string, endDate: string) =>
    [...leaveKeys.calendar(), 'team', managerId, startDate, endDate] as const,
  groupedCalendar: (orgId: number, startDate: string, endDate: string) =>
    [...leaveKeys.calendar(), 'grouped', orgId, startDate, endDate] as const,
  leaveCount: (orgId: number, date: string) =>
    [...leaveKeys.calendar(), 'count', orgId, date] as const,

  // Notifications
  notifications: () => [...leaveKeys.all, 'notifications'] as const,
  employeeNotifications: (employeeId: number, page?: number, size?: number) =>
    [...leaveKeys.notifications(), employeeId, { page, size }] as const,
  unreadNotifications: (employeeId: number) =>
    [...leaveKeys.notifications(), 'unread', employeeId] as const,
  unreadCount: (employeeId: number) =>
    [...leaveKeys.notifications(), 'unread-count', employeeId] as const,
};

// ==================== Leave Policy Hooks ====================

/**
 * Fetches a single leave policy by id.
 *
 * Keyed by `leaveKeys.policy(policyId)`; disabled until `policyId` is truthy.
 *
 * @param policyId - Surrogate id of the policy.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeavePolicy}.
 */
export const useLeavePolicy = (policyId: number) => {
  return useQuery({
    queryKey: leaveKeys.policy(policyId),
    queryFn: () => leaveService.getPolicyById(policyId),
    enabled: !!policyId,
  });
};

/**
 * Fetches all leave policies for the organization.
 *
 * Keyed by `leaveKeys.policies()`; always enabled.
 *
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeavePolicy} array.
 */
export const useAllLeavePolicies = () => {
  return useQuery({
    queryKey: leaveKeys.policies(),
    queryFn: () => leaveService.getAllPolicies(),
  });
};

/**
 * Fetches the leave policies applicable to an employee.
 *
 * Keyed by `leaveKeys.policiesByEmployee(employeeId)`; disabled until
 * `employeeId` is truthy.
 *
 * @param employeeId - Surrogate id of the employee.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeavePolicy} array.
 */
export const useLeavePoliciesByEmployee = (employeeId: number) => {
  return useQuery({
    queryKey: leaveKeys.policiesByEmployee(employeeId),
    queryFn: () => leaveService.getPoliciesByEmployee(employeeId),
    enabled: !!employeeId,
  });
};

// ==================== Leave Balance Hooks ====================

/**
 * Fetches all leave balances for an employee.
 *
 * Keyed by `leaveKeys.employeeBalances(employeeId, year)`; disabled until
 * `employeeId` is truthy.
 *
 * @param employeeId - Surrogate id of the employee.
 * @param year - Optional year filter.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveBalance} array.
 */
export const useEmployeeBalances = (employeeId: number, year?: number) => {
  return useQuery({
    queryKey: leaveKeys.employeeBalances(employeeId, year),
    queryFn: () => leaveService.getEmployeeBalances(employeeId, year),
    enabled: !!employeeId,
  });
};

/**
 * Fetches an employee's balance under a specific policy.
 *
 * Keyed by `leaveKeys.employeePolicyBalance(employeeId, policyId)`; disabled
 * until both `employeeId` and `policyId` are truthy.
 *
 * @param employeeId - Surrogate id of the employee.
 * @param policyId - Surrogate id of the leave policy.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveBalance}.
 */
export const useEmployeePolicyBalance = (
  employeeId: number,
  policyId: number
) => {
  return useQuery({
    queryKey: leaveKeys.employeePolicyBalance(employeeId, policyId),
    queryFn: () => leaveService.getEmployeePolicyBalance(employeeId, policyId),
    enabled: !!employeeId && !!policyId,
  });
};

/**
 * Fetches an employee's cross-policy balance summary.
 *
 * Keyed by `leaveKeys.employeeBalanceSummary(employeeId, year)`; disabled
 * until `employeeId` is truthy.
 *
 * @param employeeId - Surrogate id of the employee.
 * @param year - Optional year filter.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveBalanceSummary}.
 */
export const useEmployeeBalanceSummary = (
  employeeId: number,
  year?: number
) => {
  return useQuery({
    queryKey: leaveKeys.employeeBalanceSummary(employeeId, year),
    queryFn: () => leaveService.getEmployeeBalanceSummary(employeeId, year),
    enabled: !!employeeId,
  });
};

/**
 * Fetches an employee's leave-transaction history.
 *
 * Keyed by `leaveKeys.transactions(employeeId)`; disabled until `employeeId`
 * is truthy.
 *
 * @param employeeId - Surrogate id of the employee.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveTransaction}
 *   array.
 */
export const useTransactionHistory = (employeeId: number) => {
  return useQuery({
    queryKey: leaveKeys.transactions(employeeId),
    queryFn: () => leaveService.getTransactionHistory(employeeId),
    enabled: !!employeeId,
  });
};

// ==================== Leave Request Hooks ====================

/**
 * Fetches a single leave request by id.
 *
 * Keyed by `leaveKeys.request(requestId)`; disabled unless `requestId` is
 * truthy and the caller-supplied `enabled` flag is `true`.
 *
 * @param requestId - Surrogate id of the request.
 * @param enabled - Caller gate to defer the query; defaults to `true`.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveRequest}.
 */
export const useLeaveRequest = (requestId: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: leaveKeys.request(requestId),
    queryFn: () => leaveService.getRequestById(requestId),
    enabled: !!requestId && enabled,
  });
};

/**
 * Fetches an employee's leave requests (paginated).
 *
 * Keyed by `leaveKeys.employeeRequests(employeeId, page, size)`; disabled
 * unless `employeeId` is truthy and the caller-supplied `enabled` flag is
 * `true`.
 *
 * @param employeeId - Surrogate id of the employee.
 * @param page - Optional 0-based page index.
 * @param size - Optional page size.
 * @param enabled - Caller gate to defer the query; defaults to `true`.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveRequest} array.
 */
export const useEmployeeRequests = (
  employeeId: number,
  page?: number,
  size?: number,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: leaveKeys.employeeRequests(employeeId, page, size),
    queryFn: () => leaveService.getEmployeeRequests(employeeId, page, size),
    enabled: !!employeeId && enabled,
  });
};

/**
 * Fetches an employee's leave requests filtered by status.
 *
 * Keyed by `leaveKeys.employeeRequestsByStatus(employeeId, status)`; disabled
 * until both `employeeId` and `status` are truthy.
 *
 * @param employeeId - Surrogate id of the employee.
 * @param status - The {@link LeaveStatus} to filter by.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveRequest} array.
 */
export const useEmployeeRequestsByStatus = (
  employeeId: number,
  status: LeaveStatus
) => {
  return useQuery({
    queryKey: leaveKeys.employeeRequestsByStatus(employeeId, status),
    queryFn: () => leaveService.getEmployeeRequestsByStatus(employeeId, status),
    enabled: !!employeeId && !!status,
  });
};

/**
 * Fetches all leave requests across the organization (paginated).
 *
 * Keyed by `leaveKeys.organizationRequests(page, size)`; always enabled.
 *
 * @param page - Optional 0-based page index.
 * @param size - Optional page size.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveRequest} array.
 */
export const useOrganizationRequests = (page?: number, size?: number) => {
  return useQuery({
    queryKey: leaveKeys.organizationRequests(page, size),
    queryFn: () => leaveService.getOrganizationRequests(page, size),
  });
};

/**
 * Fetches every leave request routed to an approver.
 *
 * Keyed by `leaveKeys.approverRequests(approverId)`; disabled until
 * `approverId` is truthy.
 *
 * @param approverId - Surrogate id of the approver.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveRequest} array.
 */
export const useApproverRequests = (approverId: number) => {
  return useQuery({
    queryKey: leaveKeys.approverRequests(approverId),
    queryFn: () => leaveService.getApproverRequests(approverId),
    enabled: !!approverId,
  });
};

/**
 * Fetches the requests awaiting an approver's decision.
 *
 * Keyed by `leaveKeys.pendingApprovals(approverId)`; disabled until
 * `approverId` is truthy.
 *
 * @param approverId - Surrogate id of the approver.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveRequest} array.
 */
export const usePendingApprovals = (approverId: number) => {
  return useQuery({
    queryKey: leaveKeys.pendingApprovals(approverId),
    queryFn: () => leaveService.getPendingApprovals(approverId),
    enabled: !!approverId,
  });
};

/**
 * Fetches the count of requests awaiting an approver's decision.
 *
 * Keyed by `leaveKeys.pendingApprovalsCount(approverId)`; disabled until
 * `approverId` is truthy.
 *
 * @param approverId - Surrogate id of the approver.
 * @returns A TanStack `UseQueryResult` wrapping the pending-approval count
 *   (`number`).
 */
export const usePendingApprovalsCount = (approverId: number) => {
  return useQuery({
    queryKey: leaveKeys.pendingApprovalsCount(approverId),
    queryFn: () => leaveService.getPendingApprovalsCount(approverId),
    enabled: !!approverId,
  });
};

// ==================== Leave Approval Hooks ====================

/**
 * Fetches the approval history for a request.
 *
 * Keyed by `leaveKeys.approvalHistory(requestId)`; disabled unless `requestId`
 * is truthy and the caller-supplied `enabled` flag is `true`.
 *
 * @param requestId - Surrogate id of the request.
 * @param enabled - Caller gate to defer the query; defaults to `true`.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveApproval} array.
 */
export const useApprovalHistory = (
  requestId: number,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: leaveKeys.approvalHistory(requestId),
    queryFn: () => leaveService.getApprovalHistory(requestId),
    enabled: !!requestId && enabled,
  });
};

/**
 * Fetches the full approval chain for a request.
 *
 * Keyed by `leaveKeys.approvalChain(requestId)`; disabled until `requestId` is
 * truthy.
 *
 * @param requestId - Surrogate id of the request.
 * @returns A TanStack `UseQueryResult` wrapping an {@link ApprovalChainResponse}.
 */
export const useApprovalChain = (requestId: number) => {
  return useQuery({
    queryKey: leaveKeys.approvalChain(requestId),
    queryFn: () => leaveService.getApprovalChain(requestId),
    enabled: !!requestId,
  });
};

/**
 * Checks whether an employee may approve a given request.
 *
 * Keyed by `leaveKeys.canApprove(requestId, employeeId)`; disabled unless both
 * `requestId` and `employeeId` are truthy and the caller-supplied `enabled`
 * flag is `true`.
 *
 * @param requestId - Surrogate id of the request.
 * @param employeeId - Surrogate id of the prospective approver.
 * @param enabled - Caller gate to defer the query; defaults to `true`.
 * @returns A TanStack `UseQueryResult` wrapping a {@link CanApproveResponse}.
 */
export const useCanApprove = (
  requestId: number,
  employeeId: number,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: leaveKeys.canApprove(requestId, employeeId),
    queryFn: () => leaveService.canApprove(requestId, employeeId),
    enabled: !!requestId && !!employeeId && enabled,
  });
};

// ==================== Leave Calendar Hooks ====================

/**
 * Fetches the org-wide leave calendar for a date range.
 *
 * Keyed by `leaveKeys.organizationCalendar(organizationId, startDate,
 * endDate)`; disabled until `organizationId`, `startDate`, and `endDate` are
 * all truthy.
 *
 * @param organizationId - Surrogate id of the organization.
 * @param startDate - Inclusive range start (ISO date string).
 * @param endDate - Inclusive range end (ISO date string).
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveCalendarEntry}
 *   array.
 */
export const useOrganizationCalendar = (
  organizationId: number,
  startDate: string,
  endDate: string
) => {
  return useQuery({
    queryKey: leaveKeys.organizationCalendar(
      organizationId,
      startDate,
      endDate
    ),
    queryFn: () =>
      leaveService.getOrganizationCalendar(organizationId, startDate, endDate),
    enabled: !!organizationId && !!startDate && !!endDate,
  });
};

/**
 * Fetches a department's leave calendar for a date range.
 *
 * Keyed by `leaveKeys.departmentCalendar(organizationId, department,
 * startDate, endDate)`; disabled until `organizationId`, `department`,
 * `startDate`, and `endDate` are all truthy.
 *
 * @param organizationId - Surrogate id of the organization.
 * @param department - Department name to scope the calendar to.
 * @param startDate - Inclusive range start (ISO date string).
 * @param endDate - Inclusive range end (ISO date string).
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveCalendarEntry}
 *   array.
 */
export const useDepartmentCalendar = (
  organizationId: number,
  department: string,
  startDate: string,
  endDate: string
) => {
  return useQuery({
    queryKey: leaveKeys.departmentCalendar(
      organizationId,
      department,
      startDate,
      endDate
    ),
    queryFn: () =>
      leaveService.getDepartmentCalendar(
        organizationId,
        department,
        startDate,
        endDate
      ),
    enabled: !!organizationId && !!department && !!startDate && !!endDate,
  });
};

/**
 * Fetches one employee's leave calendar for a date range.
 *
 * Keyed by `leaveKeys.employeeCalendar(employeeId, startDate, endDate)`;
 * disabled until `employeeId`, `startDate`, and `endDate` are all truthy.
 *
 * @param employeeId - Surrogate id of the employee.
 * @param startDate - Inclusive range start (ISO date string).
 * @param endDate - Inclusive range end (ISO date string).
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveCalendarEntry}
 *   array.
 */
export const useEmployeeCalendar = (
  employeeId: number,
  startDate: string,
  endDate: string
) => {
  return useQuery({
    queryKey: leaveKeys.employeeCalendar(employeeId, startDate, endDate),
    queryFn: () =>
      leaveService.getEmployeeCalendar(employeeId, startDate, endDate),
    enabled: !!employeeId && !!startDate && !!endDate,
  });
};

/**
 * Fetches a manager's team leave calendar for a date range.
 *
 * Keyed by `leaveKeys.teamCalendar(managerId, startDate, endDate)`; disabled
 * until `managerId`, `startDate`, and `endDate` are all truthy.
 *
 * @param managerId - Surrogate id of the managing employee.
 * @param startDate - Inclusive range start (ISO date string).
 * @param endDate - Inclusive range end (ISO date string).
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveCalendarEntry}
 *   array.
 */
export const useTeamCalendar = (
  managerId: number,
  startDate: string,
  endDate: string
) => {
  return useQuery({
    queryKey: leaveKeys.teamCalendar(managerId, startDate, endDate),
    queryFn: () => leaveService.getTeamCalendar(managerId, startDate, endDate),
    enabled: !!managerId && !!startDate && !!endDate,
  });
};

/**
 * Fetches the org calendar grouped by date for a range.
 *
 * Keyed by `leaveKeys.groupedCalendar(organizationId, startDate, endDate)`;
 * disabled until `organizationId`, `startDate`, and `endDate` are all truthy.
 *
 * @param organizationId - Surrogate id of the organization.
 * @param startDate - Inclusive range start (ISO date string).
 * @param endDate - Inclusive range end (ISO date string).
 * @returns A TanStack `UseQueryResult` wrapping a
 *   {@link GroupedLeaveCalendarEntry} array.
 */
export const useGroupedCalendar = (
  organizationId: number,
  startDate: string,
  endDate: string
) => {
  return useQuery({
    queryKey: leaveKeys.groupedCalendar(organizationId, startDate, endDate),
    queryFn: () =>
      leaveService.getGroupedCalendar(organizationId, startDate, endDate),
    enabled: !!organizationId && !!startDate && !!endDate,
  });
};

/**
 * Fetches how many employees are on leave on a given date.
 *
 * Keyed by `leaveKeys.leaveCount(organizationId, date)`; disabled until both
 * `organizationId` and `date` are truthy.
 *
 * @param organizationId - Surrogate id of the organization.
 * @param date - The day to count (ISO date string).
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveCountResponse}.
 */
export const useLeaveCount = (organizationId: number, date: string) => {
  return useQuery({
    queryKey: leaveKeys.leaveCount(organizationId, date),
    queryFn: () => leaveService.getLeaveCount(organizationId, date),
    enabled: !!organizationId && !!date,
  });
};

// ==================== Notification Hooks ====================

/**
 * Fetches an employee's leave notifications (paginated).
 *
 * Keyed by `leaveKeys.employeeNotifications(employeeId, page, size)`; disabled
 * until `employeeId` is truthy.
 *
 * @param employeeId - Surrogate id of the employee.
 * @param page - Optional 0-based page index.
 * @param size - Optional page size.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveNotification}
 *   array.
 */
export const useLeaveNotifications = (
  employeeId: number,
  page?: number,
  size?: number
) => {
  return useQuery({
    queryKey: leaveKeys.employeeNotifications(employeeId, page, size),
    queryFn: () => leaveService.getNotifications(employeeId, page, size),
    enabled: !!employeeId,
  });
};

/**
 * Fetches an employee's unread leave notifications.
 *
 * Keyed by `leaveKeys.unreadNotifications(employeeId)`; disabled until
 * `employeeId` is truthy.
 *
 * @param employeeId - Surrogate id of the employee.
 * @returns A TanStack `UseQueryResult` wrapping a {@link LeaveNotification}
 *   array.
 */
export const useUnreadNotifications = (employeeId: number) => {
  return useQuery({
    queryKey: leaveKeys.unreadNotifications(employeeId),
    queryFn: () => leaveService.getUnreadNotifications(employeeId),
    enabled: !!employeeId,
  });
};

/**
 * Fetches an employee's unread notification count.
 *
 * Keyed by `leaveKeys.unreadCount(employeeId)`; disabled until `employeeId` is
 * truthy.
 *
 * @param employeeId - Surrogate id of the employee.
 * @returns A TanStack `UseQueryResult` wrapping the unread count (`number`).
 */
export const useUnreadNotificationsCount = (employeeId: number) => {
  return useQuery({
    queryKey: leaveKeys.unreadCount(employeeId),
    queryFn: () => leaveService.getUnreadCount(employeeId),
    enabled: !!employeeId,
  });
};
