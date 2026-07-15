/**
 * @module types/attendance/attendance-status
 *
 * The {@link AttendanceStatus} enum and its presentation / payroll helpers
 * ({@link getAttendanceStatusLabel}, {@link getAttendanceStatusColor},
 * {@link getAttendanceWeight}).
 */

/**
 * Computed state of an employee's day, derived by
 * {@link determineAttendanceStatus}.
 *
 * Values are the SDK's camelCase form; the backend's SCREAMING_SNAKE_CASE
 * equivalents are mapped in `attendance-service.ts`.
 */
export enum AttendanceStatus {
  /** Worked at least the minimum hours, on time and to shift end. */
  present = 'present',
  /** Worked at least the half-day band but below the full-day minimum. */
  halfDay = 'halfDay',
  /** No qualifying attendance for the day. */
  absent = 'absent',
  /** Day covered by an approved leave request. */
  leave = 'leave',
  /** Non-working day per the weekly schedule (e.g. Sunday). */
  weeklyOff = 'weeklyOff',
  /** Company / public holiday. */
  holiday = 'holiday',
  /** Clocked in after the shift grace period. */
  late = 'late',
  /** Clocked out before the shift end time. */
  earlyCheckout = 'earlyCheckout',
  /** Worked beyond the shift's overtime threshold. */
  overtime = 'overtime',
  /** Clocked in but missing a clock-out; awaits a regularization request. */
  pendingRegularization = 'pendingRegularization',
}

/**
 * Returns the human-readable display label for a status.
 *
 * @param status - The status to format.
 * @returns The display label (e.g. `'Half Day'`).
 */
export function getAttendanceStatusLabel(status: AttendanceStatus): string {
  const labels: Record<AttendanceStatus, string> = {
    [AttendanceStatus.present]: 'Present',
    [AttendanceStatus.halfDay]: 'Half Day',
    [AttendanceStatus.absent]: 'Absent',
    [AttendanceStatus.leave]: 'On Leave',
    [AttendanceStatus.weeklyOff]: 'Weekly Off',
    [AttendanceStatus.holiday]: 'Holiday',
    [AttendanceStatus.late]: 'Late Arrival',
    [AttendanceStatus.earlyCheckout]: 'Early Checkout',
    [AttendanceStatus.overtime]: 'Overtime',
    [AttendanceStatus.pendingRegularization]: 'Pending Regularization',
  };
  return labels[status];
}

/**
 * Returns a semantic color name for rendering a status badge.
 *
 * @param status - The status to map.
 * @returns A color token (e.g. `'green'`, `'red'`).
 */
export function getAttendanceStatusColor(status: AttendanceStatus): string {
  const colors: Record<AttendanceStatus, string> = {
    [AttendanceStatus.present]: 'green',
    [AttendanceStatus.halfDay]: 'yellow',
    [AttendanceStatus.absent]: 'red',
    [AttendanceStatus.leave]: 'blue',
    [AttendanceStatus.weeklyOff]: 'gray',
    [AttendanceStatus.holiday]: 'purple',
    [AttendanceStatus.late]: 'orange',
    [AttendanceStatus.earlyCheckout]: 'orange',
    [AttendanceStatus.overtime]: 'teal',
    [AttendanceStatus.pendingRegularization]: 'amber',
  };
  return colors[status];
}

/**
 * Returns the payroll weight for a status, used in salary calculation.
 *
 * Full day = `1`, half day = `0.5`, absent / pending = `0`; paid statuses
 * (leave, weekly off, holiday) = `1`; late and early-checkout carry a 10%
 * deduction (`0.9`); overtime = `1.5`.
 *
 * @param status - The status to weight.
 * @returns The day's payroll multiplier.
 */
export function getAttendanceWeight(status: AttendanceStatus): number {
  const weights: Record<AttendanceStatus, number> = {
    [AttendanceStatus.present]: 1,
    [AttendanceStatus.halfDay]: 0.5,
    [AttendanceStatus.absent]: 0,
    [AttendanceStatus.leave]: 1, // Paid leave
    [AttendanceStatus.weeklyOff]: 1,
    [AttendanceStatus.holiday]: 1,
    [AttendanceStatus.late]: 0.9, // 10% deduction for late arrival
    [AttendanceStatus.earlyCheckout]: 0.9, // 10% deduction for early checkout
    [AttendanceStatus.overtime]: 1.5, // 1.5x for overtime
    [AttendanceStatus.pendingRegularization]: 0, // No pay until regularized
  };
  return weights[status];
}
