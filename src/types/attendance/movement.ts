/**
 * @module types/attendance/movement
 *
 * The {@link MovementRecord} entity, its parser {@link parseMovementRecord},
 * and the {@link DailyMovementSummary} aggregation type. The
 * {@link MovementType} enum and its label/color/icon helpers live in
 * `./movement-type.ts`.
 */

import { z } from "zod";
import { parsePositiveInt } from "../../lib/utils/parse-id";
import {
  parseLocalDateTime,
  parseUTCDate,
} from "../../lib/utils/date-helpers";
import { MovementType } from "./movement-type";
import {
  backendDate,
  nullableBoolean,
  nullableNumber,
  nullableString,
  opaque,
  optionalNumericId,
} from "../../lib/validation/backend-schema";

/**
 * Shape of the backend movement payload at the parse boundary. Only `id` is
 * required; the rest pass through once their types are validated. `attachments`
 * is a list of URL strings (not a nested entity), so it stays a string array.
 */
const MovementRecordResponseSchema = z.object({
  id: opaque,
  attendanceId: optionalNumericId,
  employeeId: optionalNumericId,
  employeeName: nullableString,
  movementType: nullableString,
  fromLocation: nullableString,
  toLocation: nullableString,
  startTime: backendDate,
  endTime: backendDate,
  durationMinutes: nullableNumber,
  distance: nullableNumber,
  purpose: nullableString,
  remarks: nullableString,
  startLatitude: nullableNumber,
  startLongitude: nullableNumber,
  endLatitude: nullableNumber,
  endLongitude: nullableNumber,
  verifiedBy: nullableString,
  verifiedById: optionalNumericId,
  verifiedAt: backendDate,
  isVerified: nullableBoolean,
  attachments: z.array(z.string()).nullish(),
  createdAt: backendDate,
  updatedAt: backendDate,
});


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

  /**
   * Display name of the verifier, if verified. Server-set: echno-backend#635
   * resolves it from the session, so it is a real person in the organization
   * rather than whatever a client sent.
   */
  verifiedBy?: string;
  /**
   * Employee id of the verifier, if verified. Unset where the verifier has no
   * employee record in the organization, which is why {@link verifiedBy} is the
   * field to render and this one the field to link on.
   */
  verifiedById?: number;
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
 * The date fields split by who set them. `startTime` and `endTime` come from
 * the client and their contract is a local wall clock, so a naive value is read
 * as local. `verifiedAt`, `createdAt` and `updatedAt` are set by the server,
 * which runs in UTC, so a naive value there is read as UTC.
 *
 * @param data - The untyped JSON object received from the backend.
 * @returns A `MovementRecord` with date fields hydrated.
 */
export function parseMovementRecord(data: unknown): MovementRecord {
  const raw = MovementRecordResponseSchema.parse(data);
  return {
    ...raw,
    id: parsePositiveInt(raw.id, 'parseMovementRecord.id'),
    startTime:
      parseLocalDateTime(raw.startTime) ?? new Date(raw.startTime as string),
    endTime: parseLocalDateTime(raw.endTime) ?? undefined,
    verifiedById: raw.verifiedById ?? undefined,
    verifiedAt: parseUTCDate(raw.verifiedAt) ?? undefined,
    createdAt: parseUTCDate(raw.createdAt) ?? new Date(raw.createdAt as string),
    updatedAt: parseUTCDate(raw.updatedAt) ?? new Date(raw.updatedAt as string),
  } as MovementRecord;
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
