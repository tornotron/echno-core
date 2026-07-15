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

import { parsePositiveInt } from "../../lib/utils/parse-id";


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
 * @throws {Error} If `id` is missing or not a positive int.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAttendanceProfile(data: any): AttendanceProfile {
  return {
    id: parsePositiveInt(data.id, 'parseAttendanceProfile.id'),
    organizationId: data.organizationId ?? undefined,
    settingName: data.settingName,
    projectId: data.projectId ?? undefined,
    projectName: data.projectName ?? undefined,
    checkInOutCycles: data.checkInOutCycles,
    photoRequiredOnCheckIn: data.photoRequiredOnCheckIn,
    photoRequiredOnCheckOut: data.photoRequiredOnCheckOut,
    geolocationRequired: data.geolocationRequired,
    geofenceRadiusMeters: data.geofenceRadiusMeters,
    movementTrackingEnabled: data.movementTrackingEnabled,
    movementPhotoRequired: data.movementPhotoRequired,
    movementGeolocationRequired: data.movementGeolocationRequired,
    autoMarkAbsentAfterHours: data.autoMarkAbsentAfterHours,
    allowSelfRegularization: data.allowSelfRegularization,
    regularizationApprovalRequired: data.regularizationApprovalRequired,
    maxRegularizationDaysPerMonth: data.maxRegularizationDaysPerMonth,
    defaultShiftId: data.defaultShiftId ?? undefined,
    isActive: data.isActive,
  };
}
