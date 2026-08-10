/**
 * @module types/attendance/regularization
 *
 * The {@link AttendanceRegularization} request entity (and its enriched
 * variant {@link RegularizationDetail}) plus the parser
 * {@link parseAttendanceRegularization}. A regularization lets an employee
 * correct missed clock events (e.g. a forgotten clock-out); managers approve or
 * reject them from a pending queue.
 */

import { parsePositiveInt } from "../../lib/utils/parse-id";
import { parseUTCDate } from "../../lib/utils/date-helpers";


/** A request to correct one attendance day's missing or wrong clock events. */
export interface AttendanceRegularization {
  /** Unique surrogate identifier. */
  id: number;
  /** Attendance record the request corrects. */
  attendanceId: number;
  /** Justification supplied by the requester. */
  reason: string;
  /** Name/identifier of the requesting employee. */
  requestedBy: string;
  /** When the request was raised. */
  requestedAt: Date;
  /** Name of the approver, once decided. */
  approvedBy?: string;
  /** When the decision was made. */
  approvedAt?: Date;
  /** Current decision state. */
  status: 'pending' | 'approved' | 'rejected';
  /** Reason recorded on rejection. */
  rejectionReason?: string;
  /** Which clock events were missed (SCREAMING_SNAKE_CASE backend strings). */
  missingEvents: string[];
}

/**
 * Enriched regularization — extends the base with optional attendance context
 * fields that may or may not be present depending on the endpoint. The
 * `/pending` list typically includes them; the freshly-created response does
 * not.
 */
export interface RegularizationDetail extends AttendanceRegularization {
  employeeId?: number;
  employeeName?: string;
  attendanceDate?: Date;
  projectId?: number;
  projectName?: string;
}

/**
 * Parses a raw regularization payload into a typed
 * {@link AttendanceRegularization}.
 *
 * Validates `id`/`attendanceId` as positive ints and hydrates `requestedAt` /
 * `approvedAt` into `Date` objects; `missingEvents` defaults to an empty array.
 *
 * @param data - The untyped JSON object received from the backend.
 * @returns A validated `AttendanceRegularization` domain object.
 * @throws {Error} If `id` or `attendanceId` is missing or not a positive int.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAttendanceRegularization(
  data: any
): AttendanceRegularization {
  return {
    id: parsePositiveInt(data.id, 'parseAttendanceRegularization.id'),
    attendanceId: parsePositiveInt(
      data.attendanceId,
      'parseAttendanceRegularization.attendanceId'
    ),
    reason: data.reason,
    requestedBy: data.requestedBy,
    requestedAt: parseUTCDate(data.requestedAt) ?? new Date(data.requestedAt),
    approvedBy: data.approvedBy ?? undefined,
    approvedAt: parseUTCDate(data.approvedAt) ?? undefined,
    status: data.status,
    rejectionReason: data.rejectionReason ?? undefined,
    missingEvents: data.missingEvents ?? [],
  };
}
