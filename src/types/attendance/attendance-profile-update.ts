/**
 * @module types/attendance/attendance-profile-update
 *
 * Patch payload and serializer for updating an attendance profile. Every
 * field is optional; only set fields are sent. See
 * `attendance-profile-create.ts` for the create counterpart.
 */

/**
 * Patch fields for an attendance profile. Each property is optional; an
 * omitted field is left unchanged. `projectId` is intentionally absent — a
 * profile stays bound to the project (or org) it was created for.
 */
export interface UpdateAttendanceProfileRequest {
  /** New display name. */
  settingName?: string;
  /** New check-in/check-out cycle count. */
  checkInOutCycles?: number;
  /** New check-in selfie requirement. */
  photoRequiredOnCheckIn?: boolean;
  /** New check-out selfie requirement. */
  photoRequiredOnCheckOut?: boolean;
  /** New geolocation-at-clock requirement. */
  geolocationRequired?: boolean;
  /** New geo-fence radius in meters. */
  geofenceRadiusMeters?: number;
  /** New movement-tracking toggle. */
  movementTrackingEnabled?: boolean;
  /** New movement-photo requirement. */
  movementPhotoRequired?: boolean;
  /** New movement-geolocation requirement. */
  movementGeolocationRequired?: boolean;
  /** New auto-mark-absent threshold in hours. */
  autoMarkAbsentAfterHours?: number;
  /** New self-regularization toggle. */
  allowSelfRegularization?: boolean;
  /** New regularization-approval requirement. */
  regularizationApprovalRequired?: boolean;
  /** New monthly self-regularization cap. */
  maxRegularizationDaysPerMonth?: number;
  /** Frontend domain name; mapped to backend `defaultShiftTimingId`. */
  defaultShiftId?: number;
}

/**
 * Serializes an {@link UpdateAttendanceProfileRequest} into the backend patch
 * body.
 *
 * Emits only the fields that are set (sparse patch), and maps the frontend
 * `defaultShiftId` to the backend `defaultShiftTimingId`. `projectId` is
 * never sent — the profile's project binding is immutable.
 *
 * @param dto - The patch request to serialize.
 * @returns A plain object containing only the provided fields.
 */
export function updateAttendanceProfileToJson(
  dto: UpdateAttendanceProfileRequest
): Record<string, unknown> {
  // AttendanceSettingsPatchDto does not include `projectId` — a setting
  // record stays bound to the project (or org) it was created for.
  const json: Record<string, unknown> = {};
  if (dto.settingName !== undefined) json.settingName = dto.settingName;
  if (dto.checkInOutCycles !== undefined)
    json.checkInOutCycles = dto.checkInOutCycles;
  if (dto.photoRequiredOnCheckIn !== undefined)
    json.photoRequiredOnCheckIn = dto.photoRequiredOnCheckIn;
  if (dto.photoRequiredOnCheckOut !== undefined)
    json.photoRequiredOnCheckOut = dto.photoRequiredOnCheckOut;
  if (dto.geolocationRequired !== undefined)
    json.geolocationRequired = dto.geolocationRequired;
  if (dto.geofenceRadiusMeters !== undefined)
    json.geofenceRadiusMeters = dto.geofenceRadiusMeters;
  if (dto.movementTrackingEnabled !== undefined)
    json.movementTrackingEnabled = dto.movementTrackingEnabled;
  if (dto.movementPhotoRequired !== undefined)
    json.movementPhotoRequired = dto.movementPhotoRequired;
  if (dto.movementGeolocationRequired !== undefined)
    json.movementGeolocationRequired = dto.movementGeolocationRequired;
  if (dto.autoMarkAbsentAfterHours !== undefined)
    json.autoMarkAbsentAfterHours = dto.autoMarkAbsentAfterHours;
  if (dto.allowSelfRegularization !== undefined)
    json.allowSelfRegularization = dto.allowSelfRegularization;
  if (dto.regularizationApprovalRequired !== undefined)
    json.regularizationApprovalRequired = dto.regularizationApprovalRequired;
  if (dto.maxRegularizationDaysPerMonth !== undefined)
    json.maxRegularizationDaysPerMonth = dto.maxRegularizationDaysPerMonth;
  if (dto.defaultShiftId !== undefined)
    json.defaultShiftTimingId = dto.defaultShiftId;
  return json;
}
