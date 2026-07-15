/**
 * @module use-attendance-settings
 *
 * Query hooks for attendance profiles and effective settings:
 * {@link useAttendanceProfiles}, {@link useOrgSettings}, and
 * {@link useProjectSettings}. Keyed via {@link attendanceSettingsKeys}.
 * Shift-timing hooks live in `hooks/shift-timing/`. All three hooks inherit
 * the default query-client configuration (no per-hook option profile).
 */

import { useQuery } from '@tanstack/react-query';
import { attendanceSettingsService } from '../../services/attendance-settings-service';
import { attendanceSettingsKeys } from './keys';

// ─── Attendance Profiles ──────────────────────────────────────────────────────

/**
 * Fetches all attendance profiles.
 *
 * Keyed by `attendanceSettingsKeys.profiles()`; always enabled.
 *
 * @returns A TanStack `UseQueryResult` wrapping the attendance profiles from
 *   `attendanceSettingsService.getProfiles()`.
 */
export function useAttendanceProfiles() {
  return useQuery({
    queryKey: attendanceSettingsKeys.profiles(),
    queryFn: () => attendanceSettingsService.getProfiles(),
  });
}

// ─── Effective settings ───────────────────────────────────────────────────────

/**
 * Fetches the org-level effective attendance settings.
 *
 * Keyed by `attendanceSettingsKeys.orgSettings()`; always enabled.
 *
 * @returns A TanStack `UseQueryResult` wrapping the org settings from
 *   `attendanceSettingsService.getOrgSettings()`.
 */
export function useOrgSettings() {
  return useQuery({
    queryKey: attendanceSettingsKeys.orgSettings(),
    queryFn: () => attendanceSettingsService.getOrgSettings(),
  });
}

/**
 * Fetches the effective attendance settings for a project.
 *
 * Keyed by `attendanceSettingsKeys.projectSettings(projectId)`. Disabled
 * until `projectId` is defined and greater than `0`.
 *
 * @param projectId - Surrogate id of the project. Pass `undefined` to defer
 *   the query until the id is available.
 * @returns A TanStack `UseQueryResult` wrapping the project settings from
 *   `attendanceSettingsService.getSettingsByProject()`.
 */
export function useProjectSettings(projectId: number | undefined) {
  return useQuery({
    queryKey: attendanceSettingsKeys.projectSettings(projectId ?? 0),
    queryFn: () => attendanceSettingsService.getSettingsByProject(projectId!),
    enabled: projectId !== undefined && projectId > 0,
  });
}

export { attendanceSettingsKeys } from './keys';
