/**
 * @module types/attendance/attendance-profile
 *
 * The {@link AttendanceProfile} entity and its parser
 * {@link parseAttendanceProfile}. A profile is the bundle of check-in,
 * geo-fence, movement, and regularization rules applied to an organization or a
 * specific project; it drives validation for check-ins, clock events,
 * regularizations, and movement records. See `attendance-profile-create.ts` /
 * `attendance-profile-update.ts` for the write payloads.
 */

import { z } from "zod";
import { parsePositiveInt } from "../../lib/utils/parse-id";
import {
  nullableString,
  opaque,
  optionalNumericId,
} from "../../lib/validation/backend-schema";

/**
 * Shape of the backend attendance-profile payload at the parse boundary. The
 * rule fields are required (the profile is meaningless without them) so a
 * malformed response fails fast instead of fabricating an `undefined` rule.
 */
const AttendanceProfileResponseSchema = z.object({
  id: opaque,
  organizationId: optionalNumericId,
  settingName: z.string(),
  projectId: optionalNumericId,
  projectName: nullableString,
  checkInOutCycles: z.number(),
  photoRequiredOnCheckIn: z.boolean(),
  photoRequiredOnCheckOut: z.boolean(),
  geolocationRequired: z.boolean(),
  geofenceRadiusMeters: z.number(),
  movementTrackingEnabled: z.boolean(),
  movementPhotoRequired: z.boolean(),
  movementGeolocationRequired: z.boolean(),
  autoMarkAbsentAfterHours: z.number(),
  allowSelfRegularization: z.boolean(),
  regularizationApprovalRequired: z.boolean(),
  maxRegularizationDaysPerMonth: z.number(),
  defaultShiftId: optionalNumericId,
  isActive: z.boolean(),
});


/** A resolved bundle of attendance rules for an org or a project. */
export interface AttendanceProfile {
  /** Unique surrogate identifier. */
  id: number;
  /** Owning organization; absent on some project-scoped responses. */
  organizationId?: number;
  /** Display name for the profile. */
  settingName: string;
  /** When set, this profile overrides the org default for that project. */
  projectId?: number;
  /** Denormalized project display name, when project-scoped. */
  projectName?: string;
  /** Number of check-in/check-out cycles expected per day. */
  checkInOutCycles: number;
  /** Whether a selfie is required on check-in. */
  photoRequiredOnCheckIn: boolean;
  /** Whether a selfie is required on check-out. */
  photoRequiredOnCheckOut: boolean;
  /** Whether geolocation must be captured at clock time. */
  geolocationRequired: boolean;
  /** Geo-fence radius in meters around the project location. */
  geofenceRadiusMeters: number;
  /** Whether off-site movement tracking is enabled. */
  movementTrackingEnabled: boolean;
  /** Whether a photo is required when logging a movement. */
  movementPhotoRequired: boolean;
  /** Whether geolocation is required when logging a movement. */
  movementGeolocationRequired: boolean;
  /** Hours after shift start before the day is auto-marked absent. */
  autoMarkAbsentAfterHours: number;
  /** Whether employees may raise their own regularization requests. */
  allowSelfRegularization: boolean;
  /** Whether regularization requests need approval. */
  regularizationApprovalRequired: boolean;
  /** Cap on self-regularizations an employee may use per month. */
  maxRegularizationDaysPerMonth: number;
  /** Default shift bound to the profile (backend `defaultShiftTimingId`). */
  defaultShiftId?: number;
  /** Whether the profile is currently active. */
  isActive: boolean;
}

/**
 * Parses a raw attendance-profile payload into a typed
 * {@link AttendanceProfile}.
 *
 * Validates `id` as a positive int and normalizes absent optional fields to
 * `undefined`; other fields are passed through.
 *
 * @param data - The untyped JSON object received from the backend.
 * @returns A validated `AttendanceProfile` domain object.
 * @throws {Error} If `id` is missing or not a positive int, or a required rule
 *   field is missing or of the wrong type.
 */
export function parseAttendanceProfile(data: unknown): AttendanceProfile {
  const raw = AttendanceProfileResponseSchema.parse(data);
  return {
    id: parsePositiveInt(raw.id, 'parseAttendanceProfile.id'),
    organizationId: raw.organizationId ?? undefined,
    settingName: raw.settingName,
    projectId: raw.projectId ?? undefined,
    projectName: raw.projectName ?? undefined,
    checkInOutCycles: raw.checkInOutCycles,
    photoRequiredOnCheckIn: raw.photoRequiredOnCheckIn,
    photoRequiredOnCheckOut: raw.photoRequiredOnCheckOut,
    geolocationRequired: raw.geolocationRequired,
    geofenceRadiusMeters: raw.geofenceRadiusMeters,
    movementTrackingEnabled: raw.movementTrackingEnabled,
    movementPhotoRequired: raw.movementPhotoRequired,
    movementGeolocationRequired: raw.movementGeolocationRequired,
    autoMarkAbsentAfterHours: raw.autoMarkAbsentAfterHours,
    allowSelfRegularization: raw.allowSelfRegularization,
    regularizationApprovalRequired: raw.regularizationApprovalRequired,
    maxRegularizationDaysPerMonth: raw.maxRegularizationDaysPerMonth,
    defaultShiftId: raw.defaultShiftId ?? undefined,
    isActive: raw.isActive,
  };
}
