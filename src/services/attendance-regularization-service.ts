/**
 * services/attendance-regularization-service.ts
 *
 * Typed client for the attendance-regularization endpoints
 * (`/api/v1/attendance-regularizations/web`). Lives in its own module so
 * the regularization queue UI can depend on just this surface without
 * pulling in the broader attendance-core service.
 *
 * Request-body conversion lives in `types/attendance/regularization-create.ts`.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { parsePositiveInt } from '../lib/utils/parse-id';
import { parseLocalDate, parseUTCDate } from '../lib/utils/date-helpers';
import {
  createRegularizationToJson,
  type CreateRegularizationRequest,
  type RegularizationDetail,
} from '../types/attendance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

// ─── Parser ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRegularizationDetail(raw: any): RegularizationDetail {
  return {
    id: parsePositiveInt(raw.id, 'parseRegularizationDetail.id'),
    attendanceId: parsePositiveInt(
      raw.attendanceId,
      'parseRegularizationDetail.attendanceId'
    ),
    reason: raw.reason ?? '',
    requestedBy: raw.requestedBy ?? '',
    requestedById: raw.requestedById ?? undefined,
    // Server-set, so UTC.
    requestedAt: parseUTCDate(raw.requestedAt) ?? new Date(),
    approvedBy: raw.approvedBy ?? undefined,
    approvedById: raw.approvedById ?? undefined,
    approvedAt: parseUTCDate(raw.approvedAt) ?? undefined,
    status: (raw.status?.toLowerCase() ?? 'pending') as
      | 'pending'
      | 'approved'
      | 'rejected',
    rejectionReason: raw.rejectionReason ?? undefined,
    missingEvents: Array.isArray(raw.missingEvents) ? raw.missingEvents : [],
    // Optional context fields — only present when the endpoint enriches them.
    employeeId: raw.employeeId ?? undefined,
    employeeName: raw.employeeName ?? undefined,
    // A backend LocalDate, a bare 'YYYY-MM-DD'.
    attendanceDate: parseLocalDate(raw.attendanceDate) ?? undefined,
    projectId: raw.projectId ?? undefined,
    projectName: raw.projectName ?? undefined,
  };
}

function safeRegularization(raw: Raw): RegularizationDetail {
  try {
    return parseRegularizationDetail(raw);
  } catch (error) {
    logger.error('Failed to parse regularization:', error);
    throw new ApiError('Failed to process regularization data.', 422);
  }
}

function safeRegularizations(data: Raw[]): RegularizationDetail[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((element) => parseRegularizationDetail(element));
  } catch (error) {
    logger.error('Failed to parse regularization list:', error);
    throw new ApiError('Failed to process regularization data.', 422);
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const attendanceRegularizationService = {
  /**
   * Raises a regularization request for an attendance day.
   *
   * `POST /attendance-regularizations/web/request?requestedBy={requestedBy}` →
   * `AttendanceRegularizationDto`. The author identity is sent on the query
   * string. The response is the base DTO; the enriched context fields of
   * {@link RegularizationDetail} may be absent.
   *
   * @param dto - Request details ({@link CreateRegularizationRequest}).
   * @param requestedBy - Name/identifier of the requesting employee.
   * @returns The created {@link RegularizationDetail}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async request(
    dto: CreateRegularizationRequest,
    requestedBy: string
  ): Promise<RegularizationDetail> {
    const data = await api.post<Raw>(
      '/attendance-regularizations/web/request',
      createRegularizationToJson(dto),
      { requestedBy }
    );
    return safeRegularization(data);
  },

  /**
   * Approves or rejects a pending regularization request.
   *
   * `POST /attendance-regularizations/web/{id}/process?approvedBy={approvedBy}`
   * → `AttendanceRegularizationDto`. The approver identity is sent on the query
   * string.
   *
   * @param id - Surrogate id of the regularization request.
   * @param status - The decision: `'APPROVED'` or `'REJECTED'`.
   * @param approvedBy - Name/identifier of the deciding approver.
   * @param rejectionReason - Optional reason, supplied on rejection.
   * @returns The updated {@link RegularizationDetail}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async process(
    id: number,
    status: 'APPROVED' | 'REJECTED',
    approvedBy: string,
    rejectionReason?: string
  ): Promise<RegularizationDetail> {
    const data = await api.post<Raw>(
      `/attendance-regularizations/web/${id}/process`,
      { status, rejectionReason },
      { approvedBy }
    );
    return safeRegularization(data);
  },

  /**
   * Fetches the queue of pending regularization requests.
   *
   * `GET /attendance-regularizations/web/pending`. Responses on this endpoint
   * typically carry the enriched context fields of {@link RegularizationDetail}.
   *
   * @returns The pending {@link RegularizationDetail} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getPending(): Promise<RegularizationDetail[]> {
    const data = await api.get<Raw[]>(
      '/attendance-regularizations/web/pending'
    );
    return safeRegularizations(data);
  },

  /**
   * Fetches a single regularization request by id.
   *
   * `GET /attendance-regularizations/web/{id}`
   *
   * @param id - Surrogate id of the regularization request.
   * @returns The {@link RegularizationDetail}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: number): Promise<RegularizationDetail> {
    const data = await api.get<Raw>(`/attendance-regularizations/web/${id}`);
    return safeRegularization(data);
  },
};
