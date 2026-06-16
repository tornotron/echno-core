/**
 * @module shift-timing-update
 *
 * Request payload and serializer for partially updating a
 * {@link ShiftTiming}. Every field is optional — only the set ones
 * are sent, so the backend can perform a true patch.
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
 * Request payload to patch an existing shift timing. Every field is
 * optional; omitted fields are left untouched server-side.
 */
export interface UpdateShiftTimingRequest {
  /** New label. Omit to leave unchanged. */
  shiftName?: string;

  /** New shift start, `HH:MM` 24-hour. Omit to leave unchanged. */
  startTime?: string;

  /** New shift end, `HH:MM` 24-hour. Omit to leave unchanged. */
  endTime?: string;

  /** New lunch-break start, `HH:MM` 24-hour. Omit to leave unchanged. */
  lunchBreakStart?: string;

  /** New lunch-break end, `HH:MM` 24-hour. Omit to leave unchanged. */
  lunchBreakEnd?: string;

  /** New grace period, in minutes. Omit to leave unchanged. */
  gracePeriodMinutes?: number;

  /** New minimum hours for a full-day count. Omit to leave unchanged. */
  minimumWorkHours?: number;

  /** New minimum hours for a half-day count. Omit to leave unchanged. */
  halfDayWorkHours?: number;

  /** New overtime threshold, in hours. Omit to leave unchanged. */
  overtimeThreshold?: number;
}

/**
 * Serializes an {@link UpdateShiftTimingRequest} for the backend.
 *
 * Only set fields appear on the outgoing payload — `undefined`
 * never crosses the wire. Time fields that are set are upgraded
 * from `HH:MM` to `HH:MM:SS`.
 *
 * @param dto - The update payload.
 * @returns A plain object matching the backend's expected request
 *   body shape; contains only the fields the caller provided.
 */
export function updateShiftTimingToJson(
  dto: UpdateShiftTimingRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  if (dto.shiftName !== undefined) json.shiftName = dto.shiftName;
  if (dto.startTime !== undefined)
    json.startTime = toBackendTime(dto.startTime);
  if (dto.endTime !== undefined) json.endTime = toBackendTime(dto.endTime);
  if (dto.lunchBreakStart !== undefined)
    json.lunchBreakStart = toBackendTime(dto.lunchBreakStart);
  if (dto.lunchBreakEnd !== undefined)
    json.lunchBreakEnd = toBackendTime(dto.lunchBreakEnd);
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
