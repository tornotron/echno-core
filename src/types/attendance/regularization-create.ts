/**
 * @module types/attendance/regularization-create
 *
 * The {@link CreateRegularizationRequest} payload (with its
 * {@link CorrectedClockEvent} elements) and the serializer
 * {@link createRegularizationToJson} for raising a regularization request.
 */

import { toLocalDateTimeString } from '../../lib/utils/date-helpers';
import { ClockEventType, type GeoLocation } from './clock-event';

const CLOCK_EVENT_TO_BACKEND: Record<ClockEventType, string> = {
  [ClockEventType.morningClockIn]: 'MORNING_CLOCK_IN',
  [ClockEventType.lunchBreakStart]: 'LUNCH_BREAK_START',
  [ClockEventType.lunchBreakEnd]: 'LUNCH_BREAK_END',
  [ClockEventType.eveningClockOut]: 'EVENING_CLOCK_OUT',
};

/**
 * Single corrected event included with a regularization request.
 *
 * `projectId` is required by the backend's `ClockEventCreationDto`; callers
 * must always pass the parent attendance's projectId here.
 */
export interface CorrectedClockEvent {
  /** Which punch point is being corrected. */
  eventType: ClockEventType;
  /**
   * The corrected punch time, in the site's local wall-clock time.
   *
   * Serialized with {@link toLocalDateTimeString}, not `toISOString()`: the
   * backend field is a `LocalDateTime` and carries no offset.
   */
  eventTimestamp: Date;
  /** Parent attendance's project id (required by the backend). */
  projectId: number;
  /** Location for the corrected punch, if available. */
  location?: GeoLocation;
  /** Selfie URL for the corrected punch, if available. */
  photoUrl?: string;
}

/**
 * Body of `POST /attendance-regularizations/web/request`. The author identity
 * is passed separately as the `?requestedBy=…` query parameter.
 */
export interface CreateRegularizationRequest {
  /** Attendance day to correct. */
  attendanceId: number;
  /** Justification for the request. */
  reason: string;
  /** Which punch points were missed. */
  missingEvents: ClockEventType[];
  /** Optional corrected punches supplied with the request. */
  correctedEvents?: CorrectedClockEvent[];
}

/**
 * Serializes a {@link CreateRegularizationRequest} into the backend request
 * body.
 *
 * Maps each `missingEvents` entry and each corrected event's `eventType` to the
 * backend's SCREAMING_SNAKE_CASE enum, flattens each corrected event's
 * `location` into `latitude` / `longitude`, and encodes the corrected punch
 * timestamps as naive local wall-clock strings.
 *
 * @param dto - The regularization request to serialize.
 * @returns A plain object matching the backend's expected body shape.
 */
export function createRegularizationToJson(
  dto: CreateRegularizationRequest
): Record<string, unknown> {
  return {
    attendanceId: dto.attendanceId,
    reason: dto.reason,
    missingEvents: dto.missingEvents.map((e) => CLOCK_EVENT_TO_BACKEND[e]),
    correctedEvents: dto.correctedEvents?.map((ce) => ({
      eventType: CLOCK_EVENT_TO_BACKEND[ce.eventType],
      eventTimestamp: toLocalDateTimeString(ce.eventTimestamp),
      projectId: ce.projectId,
      latitude: ce.location?.latitude,
      longitude: ce.location?.longitude,
      photoUrl: ce.photoUrl,
    })),
  };
}
