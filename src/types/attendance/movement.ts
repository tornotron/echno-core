/**
 * @module types/attendance/movement
 *
 * The {@link MovementRecord} entity, its parser {@link parseMovementRecord},
 * and the {@link DailyMovementSummary} aggregation type. The
 * {@link MovementType} enum and its label/color/icon helpers live in
 * `./movement-type.ts`.
 */

import { parsePositiveInt } from "../../lib/utils/parse-id";
import { parseUTCDate } from "../../lib/utils/date-helpers";
import { MovementType } from "./movement-type";


/** A single off-site movement logged against an attendance day. */
export interface MovementRecord {
  /** Unique surrogate identifier. */
  id: number;
  /** Parent attendance record this movement belongs to. */
  attendanceId: number;
  /** Employee who logged the movement. */
  employeeId: number;
  /** Denormalized employee display name. */
  employeeName: string;
  /** Category of the movement. */
  movementType: MovementType;
  /** Where the movement started. */
  fromLocation: string;
  /** Where the movement ended, if recorded. */
  toLocation?: string;
  /** When the movement started. */
  startTime: Date;
  /** When the movement ended, if concluded. */
  endTime?: Date;
  /** Elapsed duration in minutes, if computed. */
  durationMinutes?: number;
  /** Distance in kilometres. */
  distance?: number;
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

  /** Name of the approver who verified the movement, if verified. */
  verifiedBy?: string;
  /** When the movement was verified. */
  verifiedAt?: Date;
  /** Whether the movement has been verified. */
  isVerified: boolean;

  /** URLs to attachments (photos, receipts, etc.). */
  attachments?: string[];

  /** Record creation timestamp. */
  createdAt: Date;
  /** Record last-modified timestamp. */
  updatedAt: Date;
}

/**
 * Parses a raw movement payload into a typed {@link MovementRecord}.
 *
 * Hydrates `startTime`, `endTime`, `verifiedAt`, `createdAt`, and `updatedAt`
 * into `Date` objects; other fields are passed through. Expects the SDK's
 * camelCase shape (backend enum/field mapping is done in the service layer).
 *
 * @param data - The untyped JSON object received from the backend.
 * @returns A `MovementRecord` with date fields hydrated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseMovementRecord(data: any): MovementRecord {
  return {
    ...data,
    id: parsePositiveInt(data.id, 'parseMovementRecord.id'),
    startTime: parseUTCDate(data.startTime) ?? new Date(data.startTime),
    endTime: parseUTCDate(data.endTime) ?? undefined,
    verifiedAt: parseUTCDate(data.verifiedAt) ?? undefined,
    createdAt: parseUTCDate(data.createdAt) ?? new Date(data.createdAt),
    updatedAt: parseUTCDate(data.updatedAt) ?? new Date(data.updatedAt),
  };
}

/** Per-day aggregation of an employee's movement records. */
export interface DailyMovementSummary {
  /** Employee the summary covers. */
  employeeId: number;
  /** The calendar day. */
  date: Date;
  /** Number of movements logged that day. */
  totalMovements: number;
  /** Total travel time, in minutes. */
  totalTravelTime: number;
  /** Total distance covered, in kilometres. */
  totalDistance: number;
  /** The movements included in the aggregation. */
  movements: MovementRecord[];
  /** The most frequent movement type for the day. */
  primaryActivity: MovementType;
}
