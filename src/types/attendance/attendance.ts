/**
 * @module types/attendance/attendance
 *
 * Core {@link Attendance} entity — one record per (employee, date, project) —
 * plus its status-derivation helper, parser, and serializer.
 *
 * Adjacent concepts live in sibling files: `AttendanceProfile`
 * (`./attendance-profile.ts`), {@link WorkDuration} (`./work-duration.ts`),
 * `AttendanceRegularization` (`./regularization.ts`), `AttendanceSummary`
 * (`./attendance-summary.ts`), `AttendanceReport` (`./attendance-report.ts`),
 * {@link MovementRecord} (`./movement.ts`), and {@link ShiftTiming}
 * (`@/types/shift-timing`).
 */

import { parsePositiveInt } from "../../lib/utils/parse-id";
import { parseShiftTiming, ShiftTiming } from "../shift-timing";
import { AttendanceStatus } from "./attendance-status";
import { ClockEvent, parseClockEvent } from "./clock-event";
import { MovementRecord, parseMovementRecord } from "./movement";
import { AttendanceRegularization, parseAttendanceRegularization } from "./regularization";
import { WorkDuration } from "./work-duration";


/**
 * A single day's attendance for one employee on one project.
 *
 * Aggregates the day's clock events, derived work duration and flags, any
 * leave linkage, an optional open regularization request, off-site
 * movements, and the approval workflow state.
 */
export interface Attendance {
  /** Unique surrogate identifier. */
  id: number;

  /** Employee this record belongs to. */
  employeeId: number;

  /** Denormalized employee display name. */
  employeeName: string;

  /** Calendar day this record covers (time component is not significant). */
  date: Date;

  /** Project the employee was assigned to for this day. */
  projectId: number;

  /** Denormalized project display name. */
  projectName: string;

  /** Computed attendance state for the day. */
  status: AttendanceStatus;

  /** Shift the day is measured against (thresholds for late/half-day/overtime). */
  shiftTiming: ShiftTiming;

  /** Morning clock-in event, if recorded. */
  morningClockIn?: ClockEvent;

  /** Start of the lunch break, if recorded. */
  lunchBreakStart?: ClockEvent;

  /** End of the lunch break, if recorded. */
  lunchBreakEnd?: ClockEvent;

  /** Evening clock-out event, if recorded. */
  eveningClockOut?: ClockEvent;

  /** Computed work duration breakdown for the day. */
  workDuration: WorkDuration;

  /** Whether the morning clock-in was after the shift grace period. */
  isLateArrival: boolean;

  /** Whether the evening clock-out was before the shift end. */
  isEarlyCheckout: boolean;

  /** Whether worked hours exceeded the shift's overtime threshold. */
  isOvertime: boolean;

  /** Linked leave request id, when the day is covered by approved leave. */
  leaveId?: number;

  /** Denormalized leave type label, when {@link leaveId} is set. */
  leaveType?: string;

  /** Open regularization request for this record (at most one). */
  regularization?: AttendanceRegularization;

  /** Off-site activity records logged against this day. */
  movements?: MovementRecord[];

  /** Approval workflow state for the day. */
  approvalStatus: 'pending' | 'approved' | 'rejected';

  /** Name of the approver, once approved or rejected. */
  approvedBy?: string;

  /** When the approval decision was made. */
  approvedAt?: Date;

  /** Free-text remarks attached to the record. */
  remarks?: string;

  /** Record creation timestamp. */
  createdAt: Date;

  /** Record last-modified timestamp. */
  updatedAt: Date;
}

/**
 * Derives the {@link AttendanceStatus} for a record from its clock events and
 * computed work duration.
 *
 * Resolution priority: linked leave → Sunday weekly-off → absent (no
 * morning clock-in) → overtime → late / early-checkout / present → half-day
 * → pending regularization (clocked in but no clock-out) → absent.
 * Thresholds (`overtimeThreshold`, `minimumWorkHours`, `halfDayWorkHours`)
 * come from `attendance.shiftTiming`.
 *
 * @param attendance - The record to classify; `shiftTiming`, `leaveId`,
 *   `date`, and the clock-event fields are read.
 * @param workDuration - Pre-computed work duration whose `hours` + `minutes`
 *   determine which threshold band the day falls into.
 * @returns The resolved status for the day.
 */
export function determineAttendanceStatus(
  attendance: Attendance,
  workDuration: WorkDuration
): AttendanceStatus {
  if (attendance.leaveId) return AttendanceStatus.leave;

  const dayOfWeek = attendance.date.getDay();
  if (dayOfWeek === 0) return AttendanceStatus.weeklyOff; // Sunday

  if (!attendance.morningClockIn) return AttendanceStatus.absent;

  const totalHours = workDuration.hours + workDuration.minutes / 60;

  if (totalHours >= attendance.shiftTiming.overtimeThreshold) {
    return AttendanceStatus.overtime;
  }

  if (totalHours >= attendance.shiftTiming.minimumWorkHours) {
    if (attendance.isLateArrival) return AttendanceStatus.late;
    if (attendance.isEarlyCheckout) return AttendanceStatus.earlyCheckout;
    return AttendanceStatus.present;
  }

  if (totalHours >= attendance.shiftTiming.halfDayWorkHours) {
    return AttendanceStatus.halfDay;
  }

  if (!attendance.eveningClockOut) {
    return AttendanceStatus.pendingRegularization;
  }

  return AttendanceStatus.absent;
}

/**
 * Parses a raw attendance payload into a typed {@link Attendance}.
 *
 * Hydrates `date`, `createdAt`, `updatedAt`, and `approvedAt` into `Date`
 * objects and recursively parses the embedded `shiftTiming`, clock events,
 * `regularization`, and `movements`. Assumes a payload already in the SDK's
 * camelCase field shape; backend SCREAMING_SNAKE_CASE / field-rename mapping
 * is handled separately by `attendance-service.ts`.
 *
 * @param data - The untyped JSON object received from the backend.
 * @returns A validated `Attendance` domain object.
 * @throws {Error} If the required `shiftTiming` field is missing — downstream
 *   helpers dereference it unconditionally, so the failure is raised here
 *   rather than at first access.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAttendance(data: any): Attendance {
  // `Attendance.shiftTiming` is non-optional and downstream helpers
  // (determineAttendanceStatus, calculateWorkDuration) dereference it
  // unconditionally. Fail loudly here rather than silently producing an
  // object that throws on first access elsewhere.
  if (!data.shiftTiming) {
    throw new Error(
      'parseAttendance: required field `shiftTiming` is missing on the response'
    );
  }
  return {
    ...data,
    id: parsePositiveInt(data.id, 'parseAttendance.id'),
    date: new Date(data.date),
    shiftTiming: parseShiftTiming(data.shiftTiming),
    morningClockIn: data.morningClockIn
      ? parseClockEvent(data.morningClockIn)
      : undefined,
    lunchBreakStart: data.lunchBreakStart
      ? parseClockEvent(data.lunchBreakStart)
      : undefined,
    lunchBreakEnd: data.lunchBreakEnd
      ? parseClockEvent(data.lunchBreakEnd)
      : undefined,
    eveningClockOut: data.eveningClockOut
      ? parseClockEvent(data.eveningClockOut)
      : undefined,
    regularization: data.regularization
      ? parseAttendanceRegularization(data.regularization)
      : undefined,
    movements: data.movements
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data.movements as any[]).map((m) => parseMovementRecord(m))
      : undefined,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    approvedAt: data.approvedAt ? new Date(data.approvedAt) : undefined,
  };
}

/**
 * Serializes an {@link Attendance} for transmission to the backend.
 *
 * Converts the `Date` fields (`date`, `createdAt`, `updatedAt`, `approvedAt`)
 * to ISO 8601 strings; all other fields are passed through unchanged.
 *
 * @param attendance - The domain object to serialize.
 * @returns A plain object with date fields ISO-encoded.
 */
export function attendanceToJson(
  attendance: Attendance
): Record<string, unknown> {
  return {
    ...attendance,
    date: attendance.date.toISOString(),
    createdAt: attendance.createdAt.toISOString(),
    updatedAt: attendance.updatedAt.toISOString(),
    approvedAt: attendance.approvedAt?.toISOString(),
  };
}
