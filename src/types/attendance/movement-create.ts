/**
 * @module types/attendance/movement-create
 *
 * The {@link CreateMovementRequest} payload and its serializer
 * {@link createMovementToJson} for logging an off-site movement.
 */

import { MovementType } from "./movement-type";

const MOVEMENT_TYPE_TO_BACKEND: Record<MovementType, string> = {
  [MovementType.siteTravel]: 'SITE_TRAVEL',
  [MovementType.clientMeeting]: 'CLIENT_MEETING',
  [MovementType.vendorMeeting]: 'VENDOR_MEETING',
  [MovementType.workFromHome]: 'WORK_FROM_HOME',
  [MovementType.onFieldWork]: 'ON_FIELD_WORK',
  [MovementType.training]: 'TRAINING',
  [MovementType.officeWork]: 'OFFICE_WORK',
  [MovementType.inspection]: 'INSPECTION',
  [MovementType.materialProcurement]: 'MATERIAL_PROCUREMENT',
  [MovementType.supervisoryVisit]: 'SUPERVISORY_VISIT',
  [MovementType.other]: 'OTHER',
};

/**
 * Body of `POST /movement-records/web`. The author identity is sent on the
 * query string as `?employeeId=…`.
 */
export interface CreateMovementRequest {
  /** Attendance day the movement is logged against. */
  attendanceId: number;
  /** Category of the movement. */
  movementType: MovementType;
  /** Where the movement started. */
  fromLocation: string;
  /** Where the movement ended, if known. */
  toLocation?: string;
  /** When the movement started. */
  startTime: Date;
  /** When the movement ended, if concluded. */
  endTime?: Date;
  /** Reason for the movement. */
  purpose: string;
  /** Free-text remarks. */
  remarks?: string;
  /** Latitude at the start of the movement, if captured. */
  startLatitude?: number;
  /** Longitude at the start of the movement, if captured. */
  startLongitude?: number;
  /** Latitude at the end of the movement, if captured. */
  endLatitude?: number;
  /** Longitude at the end of the movement, if captured. */
  endLongitude?: number;
  /** Distance covered, in kilometres. */
  distanceKm?: number;
  /** URLs to attachments (photos, receipts, etc.). */
  attachments?: string[];
}

/**
 * Serializes a {@link CreateMovementRequest} into the backend request body.
 *
 * Maps `movementType` to the backend's SCREAMING_SNAKE_CASE enum and
 * ISO-encodes `startTime` / `endTime`; other fields are passed through.
 *
 * @param dto - The movement request to serialize.
 * @returns A plain object matching the backend's expected body shape.
 */
export function createMovementToJson(
  dto: CreateMovementRequest
): Record<string, unknown> {
  return {
    attendanceId: dto.attendanceId,
    movementType: MOVEMENT_TYPE_TO_BACKEND[dto.movementType],
    fromLocation: dto.fromLocation,
    toLocation: dto.toLocation,
    startTime: dto.startTime.toISOString(),
    endTime: dto.endTime?.toISOString(),
    purpose: dto.purpose,
    remarks: dto.remarks,
    startLatitude: dto.startLatitude,
    startLongitude: dto.startLongitude,
    endLatitude: dto.endLatitude,
    endLongitude: dto.endLongitude,
    distanceKm: dto.distanceKm,
    attachments: dto.attachments,
  };
}
