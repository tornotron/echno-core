/**
 * @module shift-timing
 *
 * Domain entity for a configured shift template — start/end times,
 * lunch break window, and the threshold knobs (grace period, minimum
 * hours, half-day hours, overtime threshold) used by attendance,
 * scheduling, and payroll to classify clock events.
 *
 * Lives outside the attendance module because shift timings are
 * referenced by attendance, scheduling, payroll, and any future
 * roster-based feature — none of which should pull in the broader
 * attendance domain.
 *
 * Time fields are serialized as `HH:MM` strings (24-hour). The
 * backend stores them as `LocalTime` (`HH:MM:SS`); request
 * serializers append `:00` on the way out.
 */

import { parsePositiveInt } from "../../lib/utils/parse-id";


/**
 * A configured shift template.
 */
export interface ShiftTiming {
  /** Unique surrogate identifier. */
  id: number;

  /** Human-readable label (e.g. "Day Shift", "Night Shift"). */
  shiftName: string;

  /** Shift start, `HH:MM` 24-hour (e.g. `"09:00"`). */
  startTime: string;

  /** Shift end, `HH:MM` 24-hour (e.g. `"18:00"`). */
  endTime: string;

  /** Lunch-break start, `HH:MM` 24-hour (e.g. `"13:00"`). */
  lunchBreakStart: string;

  /** Lunch-break end, `HH:MM` 24-hour (e.g. `"14:00"`). */
  lunchBreakEnd: string;

  /** Grace period for late arrival, in minutes after `startTime`. */
  gracePeriodMinutes: number;

  /** Minimum worked hours required for a full-day count. */
  minimumWorkHours: number;

  /** Minimum worked hours required for a half-day count. */
  halfDayWorkHours: number;

  /** Hours after which overtime starts accruing. */
  overtimeThreshold: number;
}

/**
 * Parses a raw API payload into a typed {@link ShiftTiming}.
 *
 * @param raw - The untyped JSON object received from the backend.
 * @returns A validated `ShiftTiming` domain object.
 * @throws {Error} If `id` is missing or not a positive integer (via
 *   {@link parsePositiveInt}).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseShiftTiming(raw: any): ShiftTiming {
  return {
    id: parsePositiveInt(raw.id, 'parseShiftTiming.id'),
    shiftName: raw.shiftName,
    startTime: raw.startTime,
    endTime: raw.endTime,
    lunchBreakStart: raw.lunchBreakStart,
    lunchBreakEnd: raw.lunchBreakEnd,
    gracePeriodMinutes: raw.gracePeriodMinutes,
    minimumWorkHours: raw.minimumWorkHours,
    halfDayWorkHours: raw.halfDayWorkHours,
    overtimeThreshold: raw.overtimeThreshold,
  };
}

/**
 * Returns `true` when the clock-in time falls after the shift's
 * `startTime` plus its configured grace period.
 *
 * Comparison is done in minutes-since-midnight on the local Date's
 * clock components — the result is unaffected by the calendar date
 * but does depend on the Date's local timezone.
 *
 * @param clockInTime - The employee's clock-in timestamp.
 * @param shiftTiming - The shift to compare against.
 * @returns `true` if `clockInTime` is later than
 *   `shiftTiming.startTime + shiftTiming.gracePeriodMinutes`.
 */
export function isLateArrival(
  clockInTime: Date,
  shiftTiming: ShiftTiming
): boolean {
  const clockInMinutes = clockInTime.getHours() * 60 + clockInTime.getMinutes();
  const [shiftHour, shiftMinute] = shiftTiming.startTime.split(':').map(Number);
  const shiftStartMinutes = shiftHour * 60 + shiftMinute;
  const graceEndMinutes = shiftStartMinutes + shiftTiming.gracePeriodMinutes;
  return clockInMinutes > graceEndMinutes;
}

/**
 * Returns `true` when the clock-out time is more than 30 minutes
 * before the shift's `endTime`.
 *
 * The 30-minute cushion is hard-coded — it is intentionally not
 * tied to `gracePeriodMinutes` (which applies to arrival only) or
 * exposed as a shift field.
 *
 * @param clockOutTime - The employee's clock-out timestamp.
 * @param shiftTiming - The shift to compare against.
 * @returns `true` if `clockOutTime` is earlier than
 *   `shiftTiming.endTime - 30 minutes`.
 */
export function isEarlyCheckout(
  clockOutTime: Date,
  shiftTiming: ShiftTiming
): boolean {
  const clockOutMinutes =
    clockOutTime.getHours() * 60 + clockOutTime.getMinutes();
  const [shiftHour, shiftMinute] = shiftTiming.endTime.split(':').map(Number);
  const shiftEndMinutes = shiftHour * 60 + shiftMinute;
  return clockOutMinutes < shiftEndMinutes - 30;
}
