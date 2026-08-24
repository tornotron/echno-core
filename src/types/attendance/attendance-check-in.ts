/**
 * @module types/attendance/attendance-check-in
 *
 * The {@link AttendanceCheckInRequest} payload and its serializer
 * {@link attendanceCheckInToJson} for the first check-in of an attendance day.
 */

import { GeoLocation } from "./clock-event";

/**
 * Frontend representation of a check-in submission.
 *
 * Wire format: this DTO is JSON-stringified and sent as the `?data=…` query
 * parameter of `POST /attendance/web/check-in`. The selfie travels in the
 * multipart body under the `photo` field.
 */
export interface AttendanceCheckInRequest {
  /** Employee checking in. */
  employeeId: number;
  /** Project the check-in is logged against. */
  projectId: number;
  /**
   * Shift the day is measured against. Optional: the backend prefers the
   * employee's assigned {@link ShiftTiming} and falls back to this id only
   * when the employee has none.
   */
  shiftTimingId?: number | null;
  /** When the check-in occurred. */
  eventTimestamp: Date;
  /** Where the check-in occurred, if captured. */
  location?: GeoLocation;
  /** Selfie captured via front camera; sent as multipart. */
  photo?: File;
  /** Fallback: pre-existing URL (used when no fresh capture is available). */
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
 * Serializes an {@link AttendanceCheckInRequest} into the JSON payload sent in
 * the `?data=` query parameter.
 *
 * Flattens `location` into `latitude` / `longitude` / `gpsAccuracy` /
 * `altitude` and ISO-encodes `eventTimestamp`; the `photo` file is not included
 * (it is sent separately in the multipart body).
 *
 * @param dto - The check-in request to serialize.
 * @returns A plain object matching the backend's expected `data` shape.
 */
export function attendanceCheckInToJson(
  dto: AttendanceCheckInRequest
): Record<string, unknown> {
  return {
    employeeId: dto.employeeId,
    projectId: dto.projectId,
    shiftTimingId: dto.shiftTimingId,
    eventTimestamp: dto.eventTimestamp.toISOString(),
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
