/**
 * @module types/attendance/regularization-calendar
 *
 * The regularization calendar: one {@link RegularizationCalendarDay} per day of
 * an employee's month, read from
 * `GET /attendance-regularizations/web/calendar`, and the
 * {@link RegularizationByDateRequest} an employee raises for a day that may
 * have no attendance record at all.
 */

import { parseLocalDate } from '../../lib/utils/date-helpers';

/**
 * What the calendar shows for a day. The backend decides it, first match
 * wins: future, then leave, then a pending request, then what the attendance
 * records say, then whether the day is a working day.
 */
export type RegularizationCalendarState =
  | 'FUTURE'
  | 'LEAVE'
  | 'LEAVE_PENDING'
  | 'PENDING'
  | 'REGULARIZED'
  | 'COMPLETE'
  | 'INCOMPLETE'
  | 'MISSING'
  | 'NON_WORKING';

const STATES: ReadonlySet<string> = new Set<RegularizationCalendarState>([
  'FUTURE',
  'LEAVE',
  'LEAVE_PENDING',
  'PENDING',
  'REGULARIZED',
  'COMPLETE',
  'INCOMPLETE',
  'MISSING',
  'NON_WORKING',
]);

/** One day of the calendar. */
export interface RegularizationCalendarDay {
  /** The day, at local midnight. */
  date: Date;
  /** The day as the backend sent it, `YYYY-MM-DD`; stable as a map key. */
  dateKey: string;
  /** What the calendar shows. */
  state: RegularizationCalendarState;
  /** Whether the employee can raise a regularization or apply for leave. */
  actionable: boolean;
  /** The day's attendance record, when there is one. */
  attendanceId?: number;
  projectId?: number;
  projectName?: string;
  /** The most recent regularization request for the day, when there is one. */
  regularizationId?: number;
  regularizationStatus?: 'pending' | 'approved' | 'rejected';
  /** Why that request was rejected, when it was. */
  rejectionReason?: string;
  /** Leave type on a leave day, when known. */
  leaveType?: string;
}

/**
 * Parses one day of `RegularizationCalendarDayDto`.
 *
 * An unknown state is read as `COMPLETE` with `actionable` false, so a state
 * added on the server later shows as a day needing nothing rather than
 * inviting a request the server may refuse.
 *
 * @param raw - The untyped JSON object.
 * @returns The typed day.
 * @throws {Error} If `date` is missing or not a calendar date.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseRegularizationCalendarDay(raw: any): RegularizationCalendarDay {
  const date = parseLocalDate(raw?.date);
  if (!date || typeof raw.date !== 'string') {
    throw new Error(`parseRegularizationCalendarDay.date: invalid ${String(raw?.date)}`);
  }
  const known = typeof raw.state === 'string' && STATES.has(raw.state);
  const status =
    typeof raw.regularizationStatus === 'string'
      ? (raw.regularizationStatus.toLowerCase() as 'pending' | 'approved' | 'rejected')
      : undefined;
  return {
    date,
    dateKey: raw.date,
    state: known ? (raw.state as RegularizationCalendarState) : 'COMPLETE',
    actionable: known ? raw.actionable === true : false,
    attendanceId: raw.attendanceId ?? undefined,
    projectId: raw.projectId ?? undefined,
    projectName: raw.projectName ?? undefined,
    regularizationId: raw.regularizationId ?? undefined,
    regularizationStatus: status,
    rejectionReason: raw.rejectionReason ?? undefined,
    leaveType: raw.leaveType ?? undefined,
  };
}

/**
 * Body of `POST /attendance-regularizations/web/request-by-date`.
 *
 * The server finds the attendance record for the employee, project and date,
 * creating it when there is none, and files the request against it.
 */
export interface RegularizationByDateRequest {
  /** The employee: the signed-in one, unless the caller manages attendance. */
  employeeId: number;
  /** Project the day was worked on. */
  projectId: number;
  /** The day. Its local calendar date is sent; the time part is ignored. */
  attendanceDate: Date;
  /** Why the attendance is missing. */
  reason: string;
  /** Requested clock-in, site-local wall-clock time, `HH:mm`. */
  clockInTime: string;
  /** Requested clock-out, `HH:mm`, when known. Must be after the clock-in. */
  clockOutTime?: string;
}

/** Formats a `Date` as its local calendar date, `YYYY-MM-DD`. */
function toLocalDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Serializes a {@link RegularizationByDateRequest} into the backend body.
 *
 * The date goes out as the local calendar date, not `toISOString()`, which
 * would move a date picked in India to the previous day.
 *
 * @param dto - The request.
 * @returns The body the backend reads.
 */
export function regularizationByDateToJson(
  dto: RegularizationByDateRequest
): Record<string, unknown> {
  return {
    employeeId: dto.employeeId,
    projectId: dto.projectId,
    attendanceDate: toLocalDateString(dto.attendanceDate),
    reason: dto.reason,
    clockInTime: dto.clockInTime,
    clockOutTime: dto.clockOutTime || undefined,
  };
}
