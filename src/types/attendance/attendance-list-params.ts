/**
 * @module types/attendance/attendance-list-params
 *
 * Query params for the project-scoped attendance list
 * ({@link AttendanceListParams}), its query-string serializer
 * ({@link attendanceListParamsToQuery}), and the {@link PagedAttendance}
 * response wrapper.
 */

import { Attendance } from "./attendance";
import { AttendanceStatus } from "./attendance-status";

const STATUS_TO_BACKEND: Record<AttendanceStatus, string> = {
  present: 'PRESENT',
  halfDay: 'HALF_DAY',
  absent: 'ABSENT',
  leave: 'LEAVE',
  weeklyOff: 'WEEKLY_OFF',
  holiday: 'HOLIDAY',
  late: 'LATE',
  earlyCheckout: 'EARLY_CHECKOUT',
  overtime: 'OVERTIME',
  pendingRegularization: 'PENDING_REGULARIZATION',
};

/**
 * Query params for the project-scoped attendance list endpoint
 * (`GET /attendance/web/project/{projectId}`). `projectId` is taken from the
 * path, the rest go on the query string.
 */
export interface AttendanceListParams {
  /** Project whose attendance to list (taken from the URL path). */
  projectId: number;
  /** Day to list, `YYYY-MM-DD`. */
  date: string;
  /** Optional status filter. */
  status?: AttendanceStatus;
  /** Optional free-text search (employee name, etc.). */
  search?: string;
  /** 0-based page index. */
  page?: number;
  /** Page size. */
  size?: number;
}

/**
 * Serializes {@link AttendanceListParams} into the query-string portion of the
 * project list call.
 *
 * `projectId` is omitted (it is a path parameter) and `status` is mapped to the
 * backend's SCREAMING_SNAKE_CASE enum; only set optional fields are emitted.
 *
 * @param params - The list params to serialize.
 * @returns A flat query-parameter object for the request.
 */
export function attendanceListParamsToQuery(
  params: AttendanceListParams
): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = {
    date: params.date,
  };
  if (params.status) q.status = STATUS_TO_BACKEND[params.status];
  if (params.search) q.search = params.search;
  if (params.page !== undefined) q.page = params.page;
  if (params.size !== undefined) q.size = params.size;
  return q;
}

/**
 * Spring-style `Page<AttendanceResponseDto>` wrapper as parsed by the service.
 */
export interface PagedAttendance {
  /** The records on this page. */
  content: Attendance[];
  /** Total records across all pages. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
  /** 0-based page index. */
  number: number;
  /** Page size. */
  size: number;
}
