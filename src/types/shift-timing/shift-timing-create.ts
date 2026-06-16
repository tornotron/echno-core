/**
 * @module shift-timing-create
 *
 * Request payload and serializer for creating a {@link ShiftTiming}.
 * The four threshold fields are optional in the API; only `shiftName`
 * and the four `HH:MM` time fields are required.
 */

/**
 * Appends `:00` so a `HH:MM` value becomes `HH:MM:SS` for the
 * backend's `LocalTime` columns. Pass-through if the value already
 * includes seconds.
 */
function toBackendTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

/**
 * Request payload to create a new shift timing.
 */
export interface CreateShiftTimingRequest {
  /** Human-readable label (e.g. "Day Shift"). */
  shiftName: string;

  /** Shift start, `HH:MM` 24-hour. */
  startTime: string;

  /** Shift end, `HH:MM` 24-hour. */
  endTime: string;

  /** Lunch-break start, `HH:MM` 24-hour. */
  lunchBreakStart: string;

  /** Lunch-break end, `HH:MM` 24-hour. */
  lunchBreakEnd: string;

  /** Grace period for late arrival, in minutes. Omit to use the server default. */
  gracePeriodMinutes?: number;

  /** Minimum worked hours for a full-day count. Omit to use the server default. */
  minimumWorkHours?: number;

  /** Minimum worked hours for a half-day count. Omit to use the server default. */
  halfDayWorkHours?: number;

  /** Hours after which overtime accrues. Omit to use the server default. */
  overtimeThreshold?: number;
}

/**
 * Serializes a {@link CreateShiftTimingRequest} for the backend.
 *
 * Time fields are upgraded from `HH:MM` to `HH:MM:SS`. The four
 * optional threshold fields are only set on the outgoing payload
 * when explicitly provided — omission lets the server fall back to
 * its own defaults rather than overriding with `undefined`.
 *
 * @param dto - The create payload.
 * @returns A plain object matching the backend's expected request
 *   body shape.
 */
export function createShiftTimingToJson(
  dto: CreateShiftTimingRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    shiftName: dto.shiftName,
    startTime: toBackendTime(dto.startTime),
    endTime: toBackendTime(dto.endTime),
    lunchBreakStart: toBackendTime(dto.lunchBreakStart),
    lunchBreakEnd: toBackendTime(dto.lunchBreakEnd),
  };
  if (dto.gracePeriodMinutes !== undefined)
    json.gracePeriodMinutes = dto.gracePeriodMinutes;
  if (dto.minimumWorkHours !== undefined)
    json.minimumWorkHours = dto.minimumWorkHours;
  if (dto.halfDayWorkHours !== undefined)
    json.halfDayWorkHours = dto.halfDayWorkHours;
  if (dto.overtimeThreshold !== undefined)
    json.overtimeThreshold = dto.overtimeThreshold;
  return json;
}
