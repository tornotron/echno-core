/**
 * @module types/attendance/attendance-profile-create
 *
 * Request payload and serializer for creating an attendance profile (a
 * reusable bundle of check-in, geo-fence, movement, and regularization
 * rules). See `attendance-profile-update.ts` for the patch counterpart.
 */

/** Fields required to create an attendance profile. */
export interface CreateAttendanceProfileRequest {
  /** Display name for the profile. */
  settingName: string;
  /** Project to bind the profile to; omit for an org-wide profile. */
  projectId?: number;
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
  /** Frontend domain name; mapped to backend `defaultShiftTimingId`. */
  defaultShiftId?: number;
}

/**
 * Serializes a {@link CreateAttendanceProfileRequest} into the backend
 * request body.
 *
 * Maps the frontend `defaultShiftId` to the backend `defaultShiftTimingId`,
 * and emits `null` for an omitted `projectId` / `defaultShiftId`.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching the backend's expected body shape.
 */
export function createAttendanceProfileToJson(
  dto: CreateAttendanceProfileRequest
): Record<string, unknown> {
  return {
    settingName: dto.settingName,
    projectId: dto.projectId ?? null,
    checkInOutCycles: dto.checkInOutCycles,
    photoRequiredOnCheckIn: dto.photoRequiredOnCheckIn,
    photoRequiredOnCheckOut: dto.photoRequiredOnCheckOut,
    geolocationRequired: dto.geolocationRequired,
    geofenceRadiusMeters: dto.geofenceRadiusMeters,
    movementTrackingEnabled: dto.movementTrackingEnabled,
    movementPhotoRequired: dto.movementPhotoRequired,
    movementGeolocationRequired: dto.movementGeolocationRequired,
    autoMarkAbsentAfterHours: dto.autoMarkAbsentAfterHours,
    allowSelfRegularization: dto.allowSelfRegularization,
    regularizationApprovalRequired: dto.regularizationApprovalRequired,
    maxRegularizationDaysPerMonth: dto.maxRegularizationDaysPerMonth,
    defaultShiftTimingId: dto.defaultShiftId ?? null,
  };
}
