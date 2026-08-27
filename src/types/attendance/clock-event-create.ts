/**
 * @module types/attendance/clock-event-create
 *
 * The {@link CreateClockEventRequest} payload and its serializer
 * {@link createClockEventToJson} for follow-up clock events on an existing
 * attendance day.
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
 * Frontend representation of a follow-up clock event on an existing
 * attendance record (lunch start/end, evening clock-out).
 *
 * Wire format: JSON-stringified into the `?data=…` query parameter of
 * `POST /attendance/web/clock-event`. Optional selfie travels in the
 * multipart body under the `photo` field.
 */
export interface CreateClockEventRequest {
  /** Attendance record this event is added to. */
  attendanceId: number;
  /** Which punch point this event represents. */
  eventType: ClockEventType;
  /**
   * When the punch occurred, in the site's local wall-clock time.
   *
   * Serialized with {@link toLocalDateTimeString}, not `toISOString()`: the
   * backend field is a `LocalDateTime` and carries no offset.
   */
  eventTimestamp: Date;
  /** Where the punch occurred, if captured. */
  location?: GeoLocation;
  /** Selfie captured at punch time; sent as multipart. */
  photo?: File;
  /** Fallback: pre-existing URL when no fresh capture is available. */
  photoUrl?: string;
  /** Originating platform — `iOS`, `Android`, or `Web`. */
  devicePlatform?: string;
  /** Device identifier, if captured. */
  deviceId?: string;
  /** Originating IP address, if captured. */
  ipAddress?: string;
  /** Free-text remarks. */
  remarks?: string;
}

/**
 * Serializes a {@link CreateClockEventRequest} into the JSON payload sent in
 * the `?data=` query parameter.
 *
 * Maps `eventType` to the backend's SCREAMING_SNAKE_CASE enum, flattens
 * `location` into `latitude` / `longitude` / `gpsAccuracy` / `altitude`, and
 * encodes `eventTimestamp` as a naive local wall-clock string; the `photo` file
 * is sent separately in the multipart body.
 *
 * @param dto - The clock-event request to serialize.
 * @returns A plain object matching the backend's expected `data` shape.
 */
export function createClockEventToJson(
  dto: CreateClockEventRequest
): Record<string, unknown> {
  return {
    attendanceId: dto.attendanceId,
    eventType: CLOCK_EVENT_TO_BACKEND[dto.eventType],
    eventTimestamp: toLocalDateTimeString(dto.eventTimestamp),
    latitude: dto.location?.latitude,
    longitude: dto.location?.longitude,
    gpsAccuracy: dto.location?.accuracy,
    altitude: dto.location?.altitude,
    photoUrl: dto.photoUrl,
    devicePlatform: dto.devicePlatform,
    deviceId: dto.deviceId,
    ipAddress: dto.ipAddress,
    remarks: dto.remarks,
  };
}
