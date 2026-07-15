/**
 * @module leave-service
 *
 * Typed client for the leave-management backend endpoints, spanning policies
 * (`/leave-policies/web`), balances and transactions (`/leave-balances/web`),
 * requests (`/leave-requests/web`), approvals (`/leave-approvals/web`),
 * calendar views (`/leave-calendar/web`), and notifications
 * (`/notifications/web`).
 *
 * Each method wraps a lower-level `api.*` call and parses the raw JSON into a
 * strongly-typed domain object via the module's safe-parse helpers. Parse
 * failures are logged and rethrown as {@link ApiError} with status `422`; all
 * methods also throw {@link ApiError} on non-2xx HTTP responses.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  LeavePolicy,
  parseLeavePolicy,
  CreateLeavePolicyRequest,
  createLeavePolicyToJson,
  UpdateLeavePolicyRequest,
  updateLeavePolicyToJson,
  LeaveBalance,
  parseLeaveBalance,
  parseLeaveBalanceSummary,
  LeaveBalanceSummary,
  LeaveTransaction,
  parseLeaveTransaction,
  AdjustLeaveBalanceRequest,
  LeaveRequest,
  parseLeaveRequest,
  CreateLeaveRequestRequest,
  UpdateLeaveRequestRequest,
  createLeaveRequestToJson,
  updateLeaveRequestToJson,
  CalculateDays,
  CalculateDaysResponse,
  ConflictCheckResponse,
  LeaveApproval,
  parseLeaveApproval,
  LeaveApprovalAction,
  approvalActionToJson,
  ApprovalChainResponse,
  CanApproveResponse,
  LeaveCalendarEntry,
  parseLeaveCalendarEntry,
  GroupedLeaveCalendarEntry,
  parseGroupedLeaveCalendarEntry,
  LeaveCountResponse,
  LeaveNotification,
  parseLeaveNotification,
  LeaveStatus,
} from '../types/leave';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

/**
 * Safely parse leave policy with error handling.
 */
function safeParseLeavePolicy(data: ApiResponse): LeavePolicy {
  try {
    return parseLeavePolicy(data);
  } catch (error) {
    logger.error('Failed to parse leave policy data:', error);
    throw new ApiError(
      'Failed to process leave policy data. Please try again.',
      422
    );
  }
}

/**
 * Safely parse leave policy array with error handling.
 */
function safeParseLeavePolicies(data: ApiResponse[]): LeavePolicy[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseLeavePolicy(item));
  } catch (error) {
    logger.error('Failed to parse leave policies data:', error);
    throw new ApiError(
      'Failed to process leave policies data. Please try again.',
      422
    );
  }
}

/**
 * Safely parse leave balance with error handling.
 */
function safeParseLeaveBalance(data: ApiResponse): LeaveBalance {
  try {
    return parseLeaveBalance(data);
  } catch (error) {
    logger.error('Failed to parse leave balance data:', error);
    throw new ApiError(
      'Failed to process leave balance data. Please try again.',
      422
    );
  }
}

/**
 * Safely parse leave balance array with error handling.
 */
function safeParseLeaveBalances(data: ApiResponse[]): LeaveBalance[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseLeaveBalance(item));
  } catch (error) {
    logger.error('Failed to parse leave balances data:', error);
    throw new ApiError(
      'Failed to process leave balances data. Please try again.',
      422
    );
  }
}

/**
 * Safely parse leave request with error handling.
 */
function safeParseLeaveRequest(data: ApiResponse): LeaveRequest {
  try {
    return parseLeaveRequest(data);
  } catch (error) {
    logger.error('Failed to parse leave request data:', error);
    throw new ApiError(
      'Failed to process leave request data. Please try again.',
      422
    );
  }
}

/**
 * Safely parse leave request array with error handling.
 */
function safeParseLeaveRequests(data: ApiResponse[]): LeaveRequest[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseLeaveRequest(item));
  } catch (error) {
    logger.error('Failed to parse leave requests data:', error);
    throw new ApiError(
      'Failed to process leave requests data. Please try again.',
      422
    );
  }
}

/**
 * Safely parse leave approval with error handling.
 */
function safeParseLeaveApproval(data: ApiResponse): LeaveApproval {
  try {
    return parseLeaveApproval(data);
  } catch (error) {
    logger.error('Failed to parse leave approval data:', error);
    throw new ApiError(
      'Failed to process leave approval data. Please try again.',
      422
    );
  }
}

/**
 * Safely parse leave approval array with error handling.
 */
function safeParseLeaveApprovals(data: ApiResponse[]): LeaveApproval[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseLeaveApproval(item));
  } catch (error) {
    logger.error('Failed to parse leave approvals data:', error);
    throw new ApiError(
      'Failed to process leave approvals data. Please try again.',
      422
    );
  }
}

/**
 * Leave Service
 *
 * Comprehensive service for managing leave policies, balances, requests,
 * approvals, calendar, and notifications.
 */
export const leaveService = {
  // ==================== Leave Policies ====================

  /**
   * Creates a new leave policy.
   *
   * `POST /leave-policies/web` → `LeavePolicyDto` (full).
   *
   * @param dto - Policy fields ({@link CreateLeavePolicyRequest}).
   * @returns The created {@link LeavePolicy}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async createPolicy(dto: CreateLeavePolicyRequest): Promise<LeavePolicy> {
    const data = await api.post<ApiResponse>(
      '/leave-policies/web',
      createLeavePolicyToJson(dto)
    );
    return safeParseLeavePolicy(data);
  },

  /**
   * Fetches a single leave policy by id.
   *
   * `GET /leave-policies/web/policy?policyId={policyId}`
   *
   * @param policyId - Surrogate id of the policy.
   * @returns The {@link LeavePolicy}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getPolicyById(policyId: number): Promise<LeavePolicy> {
    const data = await api.get<ApiResponse>(`/leave-policies/web/policy`, {
      policyId,
    });
    return safeParseLeavePolicy(data);
  },

  /**
   * Fetches all leave policies for the organization.
   *
   * `GET /leave-policies/web`
   *
   * @returns The organization's {@link LeavePolicy} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getAllPolicies(): Promise<LeavePolicy[]> {
    const data = await api.get<ApiResponse[]>('/leave-policies/web');
    return safeParseLeavePolicies(data);
  },

  /**
   * Fetches the leave policies applicable to an employee.
   *
   * `GET /leave-policies/web/employee?employeeId={employeeId}`
   *
   * @param employeeId - Surrogate id of the employee.
   * @returns The applicable {@link LeavePolicy} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getPoliciesByEmployee(employeeId: number): Promise<LeavePolicy[]> {
    const data = await api.get<ApiResponse[]>(`/leave-policies/web/employee`, {
      employeeId,
    });
    return safeParseLeavePolicies(data);
  },

  /**
   * Updates a leave policy.
   *
   * `PATCH /leave-policies/web/update?policyId={policyId}` → `LeavePolicyDto`
   * (full).
   *
   * @param policyId - Surrogate id of the policy.
   * @param updates - Patch fields; only set fields are sent
   *   ({@link UpdateLeavePolicyRequest}).
   * @returns The updated {@link LeavePolicy}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async updatePolicy(
    policyId: number,
    updates: UpdateLeavePolicyRequest
  ): Promise<LeavePolicy> {
    const payload = updateLeavePolicyToJson(updates);
    const data = await api.patch<ApiResponse>(
      `/leave-policies/web/update`,
      payload,
      { policyId }
    );
    return safeParseLeavePolicy(data);
  },

  /**
   * Deactivates a leave policy (soft delete).
   *
   * `DELETE /leave-policies/web/deactivate?policyId={policyId}` → `ApiResponse`
   * (ack).
   *
   * @param policyId - Surrogate id of the policy.
   * @returns Resolves once the policy is deactivated.
   * @throws {ApiError} On non-2xx responses.
   */
  async deletePolicy(policyId: number): Promise<void> {
    await api.delete(`/leave-policies/web/deactivate`, { policyId });
  },

  /**
   * Reactivates a previously deactivated leave policy.
   *
   * `POST /leave-policies/web/activate?policyId={policyId}`. The response is
   * parsed as the reactivated policy.
   *
   * @param policyId - Surrogate id of the policy.
   * @returns The reactivated {@link LeavePolicy}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async activatePolicy(policyId: number): Promise<LeavePolicy> {
    const data = await api.post<ApiResponse>(
      `/leave-policies/web/activate`,
      {},
      { policyId }
    );
    return safeParseLeavePolicy(data);
  },

  /**
   * Duplicates a leave policy into another organization.
   *
   * `POST /leave-policies/web/duplicate?policyId={policyId}&targetOrganizationId={targetOrganizationId}`
   * → `LeavePolicyDto` (full).
   *
   * @param policyId - Surrogate id of the source policy.
   * @param targetOrganizationId - Organization to copy the policy into.
   * @returns The newly created {@link LeavePolicy}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async duplicatePolicy(
    policyId: number,
    targetOrganizationId: number
  ): Promise<LeavePolicy> {
    const data = await api.post<ApiResponse>(
      `/leave-policies/web/duplicate`,
      {},
      { policyId, targetOrganizationId }
    );
    return safeParseLeavePolicy(data);
  },

  // ==================== Leave Balances ====================

  /**
   * Fetches all leave balances for an employee.
   *
   * `GET /leave-balances/web?employeeId={employeeId}[&year]`
   *
   * @param employeeId - Surrogate id of the employee.
   * @param year - Optional year filter; defaults to the current accrual year
   *   server-side when omitted.
   * @returns The employee's {@link LeaveBalance} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getEmployeeBalances(
    employeeId: number,
    year?: number
  ): Promise<LeaveBalance[]> {
    const params: Record<string, number> = { employeeId };
    if (year) params.year = year;
    const data = await api.get<ApiResponse[]>(`/leave-balances/web`, params);
    return safeParseLeaveBalances(data);
  },

  /**
   * Fetches the balance for one employee under one policy.
   *
   * `GET /leave-balances/web/specific?employeeId={employeeId}&policyId={policyId}[&year]`
   *
   * @param employeeId - Surrogate id of the employee.
   * @param policyId - Surrogate id of the leave policy.
   * @param year - Optional year filter.
   * @returns The {@link LeaveBalance} for the employee/policy pair.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getEmployeePolicyBalance(
    employeeId: number,
    policyId: number,
    year?: number
  ): Promise<LeaveBalance> {
    const params: Record<string, number> = { employeeId, policyId };
    if (year) params.year = year;
    const data = await api.get<ApiResponse>(
      `/leave-balances/web/specific`,
      params
    );
    return safeParseLeaveBalance(data);
  },

  /**
   * Fetches an employee's balance summary with cross-policy totals.
   *
   * `GET /leave-balances/web/summary?employeeId={employeeId}[&year]`
   *
   * @param employeeId - Surrogate id of the employee.
   * @param year - Optional year filter.
   * @returns The {@link LeaveBalanceSummary}.
   * @throws {ApiError} On non-2xx responses or if the summary fails to parse.
   */
  async getEmployeeBalanceSummary(
    employeeId: number,
    year?: number
  ): Promise<LeaveBalanceSummary> {
    const params: Record<string, number> = { employeeId };
    if (year) params.year = year;
    const data = await api.get<ApiResponse>(
      `/leave-balances/web/summary`,
      params
    );
    try {
      return parseLeaveBalanceSummary(data);
    } catch (error) {
      logger.error('Failed to parse leave balance summary:', error);
      throw new ApiError(
        'Failed to process leave balance summary. Please try again.',
        422
      );
    }
  },

  /**
   * Forces a server-side recalculation of an employee's balances.
   *
   * `POST /leave-balances/web/recalculate?employeeId={employeeId}[&year]`. The
   * response body is discarded; callers refetch the affected balance caches.
   *
   * @param employeeId - Surrogate id of the employee.
   * @param year - Optional year to recalculate.
   * @returns Resolves once the recalculation is triggered.
   * @throws {ApiError} On non-2xx responses.
   */
  async recalculateBalances(employeeId: number, year?: number): Promise<void> {
    const params: Record<string, number> = { employeeId };
    if (year) params.year = year;
    await api.post(`/leave-balances/web/recalculate`, {}, params);
  },

  /**
   * Applies a manual adjustment to a leave balance.
   *
   * `POST /leave-balances/web/adjust` (body) → `LeaveTransactionDto` per spec;
   * the response is parsed as the updated {@link LeaveBalance} for the adjusted
   * policy.
   *
   * @param dto - Adjustment details ({@link AdjustLeaveBalanceRequest}).
   * @returns The updated {@link LeaveBalance}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async adjustBalance(dto: AdjustLeaveBalanceRequest): Promise<LeaveBalance> {
    const data = await api.post<ApiResponse>('/leave-balances/web/adjust', dto);
    return safeParseLeaveBalance(data);
  },

  /**
   * Fetches an employee's leave-transaction history.
   *
   * `GET /leave-balances/web/transactions?employeeId={employeeId}`
   *
   * @param employeeId - Surrogate id of the employee.
   * @returns The employee's {@link LeaveTransaction} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getTransactionHistory(employeeId: number): Promise<LeaveTransaction[]> {
    const data = await api.get<ApiResponse[]>(
      `/leave-balances/web/transactions`,
      { employeeId }
    );
    if (!Array.isArray(data)) return [];
    try {
      return data.map((item) => parseLeaveTransaction(item));
    } catch (error) {
      logger.error('Failed to parse leave transactions:', error);
      throw new ApiError(
        'Failed to process leave transactions. Please try again.',
        422
      );
    }
  },

  /**
   * Fetches the transaction history for a specific balance.
   *
   * `GET /leave-balances/web/transactions-by-balance?balanceId={balanceId}`
   *
   * @param balanceId - Surrogate id of the leave balance.
   * @returns The balance's {@link LeaveTransaction} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getTransactionHistoryByBalanceId(
    balanceId: number
  ): Promise<LeaveTransaction[]> {
    const data = await api.get<ApiResponse[]>(
      `/leave-balances/web/transactions-by-balance`,
      { balanceId }
    );
    if (!Array.isArray(data)) return [];
    try {
      return data.map((item) => parseLeaveTransaction(item));
    } catch (error) {
      logger.error('Failed to parse leave transactions:', error);
      throw new ApiError(
        'Failed to process leave transactions. Please try again.',
        422
      );
    }
  },

  // ==================== Leave Requests ====================

  /**
   * Creates a leave request (draft).
   *
   * `POST /leave-requests/web?employeeId={dto.employeeId}` (body) →
   * `LeaveRequestDto` (full).
   *
   * @param dto - Request fields ({@link CreateLeaveRequestRequest}); its
   *   `employeeId` is also sent on the query string.
   * @returns The created {@link LeaveRequest}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async createRequest(dto: CreateLeaveRequestRequest): Promise<LeaveRequest> {
    const payload = createLeaveRequestToJson(dto);
    const data = await api.post<ApiResponse>('/leave-requests/web', payload, {
      employeeId: dto.employeeId,
    });
    return safeParseLeaveRequest(data);
  },

  /**
   * Fetches a single leave request by id.
   *
   * `GET /leave-requests/web/request?requestId={requestId}`
   *
   * @param requestId - Surrogate id of the request.
   * @returns The {@link LeaveRequest}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getRequestById(requestId: number): Promise<LeaveRequest> {
    const data = await api.get<ApiResponse>(`/leave-requests/web/request`, {
      requestId,
    });
    return safeParseLeaveRequest(data);
  },

  /**
   * Fetches an employee's leave requests (paginated).
   *
   * `GET /leave-requests/web/employee?employeeId={employeeId}[&page][&size]`
   *
   * @param employeeId - Surrogate id of the employee.
   * @param page - Optional 0-based page index.
   * @param size - Optional page size.
   * @returns The matching {@link LeaveRequest} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getEmployeeRequests(
    employeeId: number,
    page?: number,
    size?: number
  ): Promise<LeaveRequest[]> {
    const params: Record<string, number> = { employeeId };
    if (page !== undefined) params.page = page;
    if (size !== undefined) params.size = size;

    const data = await api.get<ApiResponse[]>(
      `/leave-requests/web/employee`,
      params
    );
    return safeParseLeaveRequests(data);
  },

  /**
   * Fetches an employee's leave requests filtered by status.
   *
   * `GET /leave-requests/web/employee-by-status?employeeId={employeeId}&status={status}`
   *
   * @param employeeId - Surrogate id of the employee.
   * @param status - The {@link LeaveStatus} to filter by.
   * @returns The matching {@link LeaveRequest} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getEmployeeRequestsByStatus(
    employeeId: number,
    status: LeaveStatus
  ): Promise<LeaveRequest[]> {
    const data = await api.get<ApiResponse[]>(
      `/leave-requests/web/employee-by-status`,
      { employeeId, status }
    );
    return safeParseLeaveRequests(data);
  },

  /**
   * Fetches all leave requests across the organization (paginated).
   *
   * `GET /leave-requests/web/organization[?page][&size]`
   *
   * @param page - Optional 0-based page index.
   * @param size - Optional page size.
   * @returns The organization's {@link LeaveRequest} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getOrganizationRequests(
    page?: number,
    size?: number
  ): Promise<LeaveRequest[]> {
    const params: Record<string, number> = {};
    if (page !== undefined) params.page = page;
    if (size !== undefined) params.size = size;

    const data = await api.get<ApiResponse[]>(
      `/leave-requests/web/organization`,
      Object.keys(params).length > 0 ? params : undefined
    );
    return safeParseLeaveRequests(data);
  },

  /**
   * Fetches every leave request routed to an approver.
   *
   * `GET /leave-requests/web/approver?approverId={approverId}`
   *
   * @param approverId - Surrogate id of the approver.
   * @returns The {@link LeaveRequest} records assigned to the approver.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getApproverRequests(approverId: number): Promise<LeaveRequest[]> {
    const data = await api.get<ApiResponse[]>(`/leave-requests/web/approver`, {
      approverId,
    });
    return safeParseLeaveRequests(data);
  },

  /**
   * Fetches the requests currently awaiting an approver's decision.
   *
   * `GET /leave-requests/web/pending-approvals?approverId={approverId}`
   *
   * @param approverId - Surrogate id of the approver.
   * @returns The pending {@link LeaveRequest} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getPendingApprovals(approverId: number): Promise<LeaveRequest[]> {
    const data = await api.get<ApiResponse[]>(
      `/leave-requests/web/pending-approvals`,
      { approverId }
    );
    return safeParseLeaveRequests(data);
  },

  /**
   * Fetches the count of requests awaiting an approver's decision.
   *
   * `GET /leave-requests/web/pending-approvals/count?approverId={approverId}`
   *
   * @param approverId - Surrogate id of the approver.
   * @returns The pending-approval count (`0` when the field is absent).
   * @throws {ApiError} On non-2xx responses.
   */
  async getPendingApprovalsCount(approverId: number): Promise<number> {
    const data = await api.get<{ count: number }>(
      `/leave-requests/web/pending-approvals/count`,
      { approverId }
    );
    return data.count ?? 0;
  },

  /**
   * Updates a draft leave request.
   *
   * `PATCH /leave-requests/web/update?requestId={requestId}&employeeId={employeeId}`
   * → `LeaveRequestDto` (full).
   *
   * @param requestId - Surrogate id of the request.
   * @param employeeId - Surrogate id of the owning employee.
   * @param dto - Patch fields ({@link UpdateLeaveRequestRequest}).
   * @returns The updated {@link LeaveRequest}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async updateRequest(
    requestId: number,
    employeeId: number,
    dto: UpdateLeaveRequestRequest
  ): Promise<LeaveRequest> {
    const payload = updateLeaveRequestToJson(dto);
    const data = await api.patch<ApiResponse>(
      `/leave-requests/web/update`,
      payload,
      { requestId, employeeId }
    );
    return safeParseLeaveRequest(data);
  },

  /**
   * Submits a draft request into the approval workflow.
   *
   * `POST /leave-requests/web/employeeId/{employeeId}/submit?requestId={requestId}`
   * → `LeaveRequestDto` (full).
   *
   * @param employeeId - Surrogate id of the owning employee (path segment).
   * @param requestId - Surrogate id of the request to submit.
   * @returns The submitted {@link LeaveRequest}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async submitRequest(
    employeeId: number,
    requestId: number
  ): Promise<LeaveRequest> {
    const data = await api.post<ApiResponse>(
      `/leave-requests/web/employeeId/${employeeId}/submit`,
      {},
      { requestId }
    );
    return safeParseLeaveRequest(data);
  },

  /**
   * Cancels a leave request.
   *
   * `POST /leave-requests/web/cancel?requestId={requestId}&employeeId={employeeId}`
   * (body carries the optional reason). The response body is discarded.
   *
   * @param requestId - Surrogate id of the request.
   * @param employeeId - Surrogate id of the owning employee.
   * @param reason - Optional cancellation reason.
   * @returns Resolves once the request is cancelled.
   * @throws {ApiError} On non-2xx responses.
   */
  async cancelRequest(
    requestId: number,
    employeeId: number,
    reason?: string
  ): Promise<void> {
    await api.post(
      `/leave-requests/web/cancel`,
      { reason },
      { requestId, employeeId }
    );
  },

  /**
   * Withdraws a pending (already-submitted) leave request.
   *
   * `POST /leave-requests/web/withdraw?requestId={requestId}`. The response body
   * is discarded.
   *
   * @param requestId - Surrogate id of the request.
   * @returns Resolves once the request is withdrawn.
   * @throws {ApiError} On non-2xx responses.
   */
  async withdrawRequest(requestId: number): Promise<void> {
    await api.post(`/leave-requests/web/withdraw`, {}, { requestId });
  },

  /**
   * Checks whether a proposed leave range conflicts with existing requests.
   *
   * `GET /leave-requests/web/conflicts?employeeId={employeeId}&startDate={startDate}&endDate={endDate}`
   *
   * @param employeeId - Surrogate id of the employee.
   * @param startDate - Proposed inclusive start (ISO date string).
   * @param endDate - Proposed inclusive end (ISO date string).
   * @returns A {@link ConflictCheckResponse} with any conflicting requests
   *   parsed into {@link LeaveRequest} objects.
   * @throws {ApiError} On non-2xx responses or if a conflict fails to parse.
   */
  async checkConflicts(
    employeeId: number,
    startDate: string,
    endDate: string
  ): Promise<ConflictCheckResponse> {
    const data = await api.get<ApiResponse>(`/leave-requests/web/conflicts`, {
      employeeId,
      startDate,
      endDate,
    });
    return {
      hasConflict: data.hasConflict ?? false,
      conflictingRequests: data.conflictingRequests
        ? safeParseLeaveRequests(data.conflictingRequests)
        : [],
    };
  },

  /**
   * Calculates the total leave days for a proposed range.
   *
   * `POST /leave-requests/web/calculate-days` (body). Accounts for weekends,
   * holidays, and half-day options server-side.
   *
   * @param dto - The range and options to evaluate ({@link CalculateDays}).
   * @returns A {@link CalculateDaysResponse} with the computed `totalDays`.
   * @throws {ApiError} On non-2xx responses.
   */
  async calculateDays(dto: CalculateDays): Promise<CalculateDaysResponse> {
    const data = await api.post<ApiResponse>(
      '/leave-requests/web/calculate-days',
      dto
    );
    return {
      totalDays: data.totalDays ?? 0,
    };
  },

  // ==================== Leave Approvals ====================

  /**
   * Approves a leave request at the current approval step.
   *
   * `POST /leave-approvals/web/approve?requestId={requestId}` (body). The
   * response body is discarded.
   *
   * @param requestId - Surrogate id of the request.
   * @param dto - Approval action details ({@link LeaveApprovalAction}).
   * @returns Resolves once the approval is recorded.
   * @throws {ApiError} On non-2xx responses.
   */
  async approveRequest(
    requestId: number,
    dto: LeaveApprovalAction
  ): Promise<void> {
    const payload = approvalActionToJson(dto);
    await api.post(`/leave-approvals/web/approve`, payload, { requestId });
  },

  /**
   * Rejects a leave request at the current approval step.
   *
   * `POST /leave-approvals/web/reject?requestId={requestId}` (body). The
   * response body is discarded.
   *
   * @param requestId - Surrogate id of the request.
   * @param dto - Rejection action details ({@link LeaveApprovalAction}).
   * @returns Resolves once the rejection is recorded.
   * @throws {ApiError} On non-2xx responses.
   */
  async rejectRequest(
    requestId: number,
    dto: LeaveApprovalAction
  ): Promise<void> {
    const payload = approvalActionToJson(dto);
    await api.post(`/leave-approvals/web/reject`, payload, { requestId });
  },

  /**
   * Delegates a request's approval to another approver.
   *
   * `POST /leave-approvals/web/delegate?requestId={requestId}` (body). The
   * response body is discarded.
   *
   * @param requestId - Surrogate id of the request.
   * @param dto - Delegation action details, including the delegate target
   *   ({@link LeaveApprovalAction}).
   * @returns Resolves once the delegation is recorded.
   * @throws {ApiError} On non-2xx responses.
   */
  async delegateApproval(
    requestId: number,
    dto: LeaveApprovalAction
  ): Promise<void> {
    const payload = approvalActionToJson(dto);
    await api.post(`/leave-approvals/web/delegate`, payload, { requestId });
  },

  /**
   * Fetches the approval history for a request.
   *
   * `GET /leave-approvals/web/history?requestId={requestId}`
   *
   * @param requestId - Surrogate id of the request.
   * @returns The {@link LeaveApproval} records in history order.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getApprovalHistory(requestId: number): Promise<LeaveApproval[]> {
    const data = await api.get<ApiResponse[]>(`/leave-approvals/web/history`, {
      requestId,
    });
    return safeParseLeaveApprovals(data);
  },

  /**
   * Fetches the full approval chain for a request.
   *
   * `GET /leave-approvals/web/chain?requestId={requestId}`
   *
   * @param requestId - Surrogate id of the request.
   * @returns An {@link ApprovalChainResponse} whose `approvals` are parsed into
   *   {@link LeaveApproval} objects.
   * @throws {ApiError} On non-2xx responses or if an approval fails to parse.
   */
  async getApprovalChain(requestId: number): Promise<ApprovalChainResponse> {
    const data = await api.get<ApiResponse>(`/leave-approvals/web/chain`, {
      requestId,
    });
    return {
      requestId: data.requestId ?? requestId,
      approvals: data.approvals ? safeParseLeaveApprovals(data.approvals) : [],
    };
  },

  /**
   * Checks whether an employee may approve a given request.
   *
   * `GET /leave-approvals/web/can-approve?requestId={requestId}&employeeId={employeeId}`
   *
   * @param requestId - Surrogate id of the request.
   * @param employeeId - Surrogate id of the prospective approver.
   * @returns A {@link CanApproveResponse} with the decision and an optional
   *   reason.
   * @throws {ApiError} On non-2xx responses.
   */
  async canApprove(
    requestId: number,
    employeeId: number
  ): Promise<CanApproveResponse> {
    const data = await api.get<ApiResponse>(
      `/leave-approvals/web/can-approve`,
      { requestId, employeeId }
    );
    return {
      canApprove: data.canApprove ?? false,
      reason: data.reason,
    };
  },

  // ==================== Leave Calendar ====================

  /**
   * Fetches the org-wide leave calendar for a date range.
   *
   * `GET /leave-calendar/web/organization?organizationId={organizationId}&startDate={startDate}&endDate={endDate}`
   *
   * @param organizationId - Surrogate id of the organization.
   * @param startDate - Inclusive range start (ISO date string).
   * @param endDate - Inclusive range end (ISO date string).
   * @returns The {@link LeaveCalendarEntry} records in range.
   * @throws {ApiError} On non-2xx responses or if an entry fails to parse.
   */
  async getOrganizationCalendar(
    organizationId: number,
    startDate: string,
    endDate: string
  ): Promise<LeaveCalendarEntry[]> {
    const data = await api.get<ApiResponse[]>(
      `/leave-calendar/web/organization`,
      { organizationId, startDate, endDate }
    );
    if (!Array.isArray(data)) return [];
    try {
      return data.map((item) => parseLeaveCalendarEntry(item));
    } catch (error) {
      logger.error('Failed to parse leave calendar entries:', error);
      throw new ApiError(
        'Failed to process leave calendar. Please try again.',
        422
      );
    }
  },

  /**
   * Fetches a department's leave calendar for a date range.
   *
   * `GET /leave-calendar/web/department?organizationId={organizationId}&department={department}&startDate={startDate}&endDate={endDate}`
   *
   * @param organizationId - Surrogate id of the organization.
   * @param department - Department name to scope the calendar to.
   * @param startDate - Inclusive range start (ISO date string).
   * @param endDate - Inclusive range end (ISO date string).
   * @returns The {@link LeaveCalendarEntry} records in range.
   * @throws {ApiError} On non-2xx responses or if an entry fails to parse.
   */
  async getDepartmentCalendar(
    organizationId: number,
    department: string,
    startDate: string,
    endDate: string
  ): Promise<LeaveCalendarEntry[]> {
    const data = await api.get<ApiResponse[]>(
      `/leave-calendar/web/department`,
      { organizationId, department, startDate, endDate }
    );
    if (!Array.isArray(data)) return [];
    try {
      return data.map((item) => parseLeaveCalendarEntry(item));
    } catch (error) {
      logger.error('Failed to parse department calendar entries:', error);
      throw new ApiError(
        'Failed to process department calendar. Please try again.',
        422
      );
    }
  },

  /**
   * Fetches one employee's leave calendar for a date range.
   *
   * `GET /leave-calendar/web/employee?employeeId={employeeId}&startDate={startDate}&endDate={endDate}`
   *
   * @param employeeId - Surrogate id of the employee.
   * @param startDate - Inclusive range start (ISO date string).
   * @param endDate - Inclusive range end (ISO date string).
   * @returns The {@link LeaveCalendarEntry} records in range.
   * @throws {ApiError} On non-2xx responses or if an entry fails to parse.
   */
  async getEmployeeCalendar(
    employeeId: number,
    startDate: string,
    endDate: string
  ): Promise<LeaveCalendarEntry[]> {
    const data = await api.get<ApiResponse[]>(`/leave-calendar/web/employee`, {
      employeeId,
      startDate,
      endDate,
    });
    if (!Array.isArray(data)) return [];
    try {
      return data.map((item) => parseLeaveCalendarEntry(item));
    } catch (error) {
      logger.error('Failed to parse employee calendar entries:', error);
      throw new ApiError(
        'Failed to process employee calendar. Please try again.',
        422
      );
    }
  },

  /**
   * Fetches a manager's team leave calendar for a date range.
   *
   * `GET /leave-calendar/web/team?managerId={managerId}&startDate={startDate}&endDate={endDate}`
   *
   * @param managerId - Surrogate id of the managing employee.
   * @param startDate - Inclusive range start (ISO date string).
   * @param endDate - Inclusive range end (ISO date string).
   * @returns The {@link LeaveCalendarEntry} records in range.
   * @throws {ApiError} On non-2xx responses or if an entry fails to parse.
   */
  async getTeamCalendar(
    managerId: number,
    startDate: string,
    endDate: string
  ): Promise<LeaveCalendarEntry[]> {
    const data = await api.get<ApiResponse[]>(`/leave-calendar/web/team`, {
      managerId,
      startDate,
      endDate,
    });
    if (!Array.isArray(data)) return [];
    try {
      return data.map((item) => parseLeaveCalendarEntry(item));
    } catch (error) {
      logger.error('Failed to parse team calendar entries:', error);
      throw new ApiError(
        'Failed to process team calendar. Please try again.',
        422
      );
    }
  },

  /**
   * Fetches the org calendar grouped by date for a range.
   *
   * `GET /leave-calendar/web/grouped?organizationId={organizationId}&startDate={startDate}&endDate={endDate}`
   *
   * @param organizationId - Surrogate id of the organization.
   * @param startDate - Inclusive range start (ISO date string).
   * @param endDate - Inclusive range end (ISO date string).
   * @returns The {@link GroupedLeaveCalendarEntry} records in range.
   * @throws {ApiError} On non-2xx responses or if an entry fails to parse.
   */
  async getGroupedCalendar(
    organizationId: number,
    startDate: string,
    endDate: string
  ): Promise<GroupedLeaveCalendarEntry[]> {
    const data = await api.get<ApiResponse[]>(`/leave-calendar/web/grouped`, {
      organizationId,
      startDate,
      endDate,
    });
    if (!Array.isArray(data)) return [];
    try {
      return data.map((item) => parseGroupedLeaveCalendarEntry(item));
    } catch (error) {
      logger.error('Failed to parse grouped calendar entries:', error);
      throw new ApiError(
        'Failed to process grouped calendar. Please try again.',
        422
      );
    }
  },

  /**
   * Fetches how many employees are on leave on a given date.
   *
   * `GET /leave-calendar/web/count?organizationId={organizationId}&date={date}`
   *
   * @param organizationId - Surrogate id of the organization.
   * @param date - The day to count (ISO date string).
   * @returns A {@link LeaveCountResponse} with the parsed `date` and `count`.
   * @throws {ApiError} On non-2xx responses.
   */
  async getLeaveCount(
    organizationId: number,
    date: string
  ): Promise<LeaveCountResponse> {
    const data = await api.get<ApiResponse>(`/leave-calendar/web/count`, {
      organizationId,
      date,
    });
    return {
      date: data.date ? new Date(data.date) : new Date(date),
      count: data.count ?? 0,
    };
  },

  // ==================== Notifications ====================

  /**
   * Fetches an employee's leave notifications (paginated).
   *
   * `GET /notifications/web?employeeId={employeeId}[&page][&size]`
   *
   * @param employeeId - Surrogate id of the employee.
   * @param page - Optional 0-based page index.
   * @param size - Optional page size.
   * @returns The {@link LeaveNotification} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getNotifications(
    employeeId: number,
    page?: number,
    size?: number
  ): Promise<LeaveNotification[]> {
    const params: Record<string, number> = { employeeId };
    if (page !== undefined) params.page = page;
    if (size !== undefined) params.size = size;

    const data = await api.get<ApiResponse[]>(`/notifications/web`, params);
    if (!Array.isArray(data)) return [];
    try {
      return data.map((item) => parseLeaveNotification(item));
    } catch (error) {
      logger.error('Failed to parse leave notifications:', error);
      throw new ApiError(
        'Failed to process notifications. Please try again.',
        422
      );
    }
  },

  /**
   * Fetches an employee's unread leave notifications.
   *
   * `GET /notifications/web/unread?employeeId={employeeId}`
   *
   * @param employeeId - Surrogate id of the employee.
   * @returns The unread {@link LeaveNotification} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getUnreadNotifications(
    employeeId: number
  ): Promise<LeaveNotification[]> {
    const data = await api.get<ApiResponse[]>(`/notifications/web/unread`, {
      employeeId,
    });
    if (!Array.isArray(data)) return [];
    try {
      return data.map((item) => parseLeaveNotification(item));
    } catch (error) {
      logger.error('Failed to parse unread notifications:', error);
      throw new ApiError(
        'Failed to process unread notifications. Please try again.',
        422
      );
    }
  },

  /**
   * Fetches an employee's unread notification count.
   *
   * `GET /notifications/web/unread-count?employeeId={employeeId}`
   *
   * @param employeeId - Surrogate id of the employee.
   * @returns The unread count (`0` when the field is absent).
   * @throws {ApiError} On non-2xx responses.
   */
  async getUnreadCount(employeeId: number): Promise<number> {
    const data = await api.get<{ count: number }>(
      `/notifications/web/unread-count`,
      { employeeId }
    );
    return data.count ?? 0;
  },

  /**
   * Marks a single notification as read.
   *
   * `PATCH /notifications/web/read?notificationId={notificationId}`. The
   * response body is discarded.
   *
   * @param notificationId - Surrogate id of the notification.
   * @returns Resolves once the notification is marked read.
   * @throws {ApiError} On non-2xx responses.
   */
  async markAsRead(notificationId: number): Promise<void> {
    await api.patch(`/notifications/web/read`, {}, { notificationId });
  },

  /**
   * Marks all of an employee's notifications as read.
   *
   * `POST /notifications/web/mark-all-read?employeeId={employeeId}`. The
   * response body is discarded.
   *
   * @param employeeId - Surrogate id of the employee.
   * @returns Resolves once all notifications are marked read.
   * @throws {ApiError} On non-2xx responses.
   */
  async markAllAsRead(employeeId: number): Promise<void> {
    await api.post(`/notifications/web/mark-all-read`, {}, { employeeId });
  },
};
