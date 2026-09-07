/**
 * @module types/attendance/attendance-list-params
 *
 * Query params for the project-scoped attendance list
 * ({@link AttendanceListParams}), its query-string serializer
 * ({@link attendanceListParamsToQuery}), and the {@link PagedAttendance}
 * response wrapper.
 */

import { Attendance, AttendanceApprovalStatus } from "./attendance";
import { AttendanceStatus } from "./attendance-status";

const APPROVAL_STATUS_TO_BACKEND: Record<AttendanceApprovalStatus, string> = {
  pending: 'PENDING',
  approved: 'APPROVED',
  rejected: 'REJECTED',
};

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
  /**
   * Narrows to the days that were held for a decision, or to the days that
   * were not: a day is held when the employee marked a punch from outside the
   * project's site boundary and gave a reason for it
   * ({@link Attendance.requiresGeofenceApproval}).
   *
   * This is the selective half of the pair. `false` is emitted as readily as
   * `true`, so "only the ordinary days" is askable too; leave it unset to ask
   * for both.
   */
  requiresApproval?: boolean;
  /**
   * Narrows to a point in the approval workflow, and is the only way to ask
   * for the days that have already been decided.
   *
   * `'pending'` is much weaker than it looks: a check-in creates every record
   * pending and nothing moves it until somebody decides, so on a normal day
   * this matches nearly the whole list. {@link requiresApproval} is the filter
   * that separates the days worth looking at, and the two are deliberately
   * independent so that "held, and already approved" stays askable.
   */
  approvalStatus?: AttendanceApprovalStatus;
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
 * `projectId` is omitted (it is a path parameter) and `status` and
 * `approvalStatus` are mapped to the backend's SCREAMING_SNAKE_CASE enums;
 * only set optional fields are emitted, so a caller that passes none of them
 * sends the same request it always did.
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
  // Compared against undefined rather than tested for truth: `false` is a
  // filter in its own right (the days nobody has to look at), and a truthiness
  // test would drop it and silently return every day instead.
  if (params.requiresApproval !== undefined) {
    q.requiresApproval = params.requiresApproval;
  }
  if (params.approvalStatus) {
    q.approvalStatus = APPROVAL_STATUS_TO_BACKEND[params.approvalStatus];
  }
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
