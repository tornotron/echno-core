/**
 * services/attendance-settings-service.ts
 *
 * Typed client for the attendance-settings endpoints
 * (`/api/v1/attendance-settings/web`) — covers attendance profiles plus the
 * org-level and per-project effective settings.
 *
 * Shift timings live in their own module (`shift-timing-service.ts`) because
 * they're consumed by attendance, scheduling, payroll, and rosters.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  createAttendanceProfileToJson,
  updateAttendanceProfileToJson,
  parseAttendanceProfile,
  type AttendanceProfile,
  type CreateAttendanceProfileRequest,
  type UpdateAttendanceProfileRequest,
} from '../types/attendance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

function safeProfile(raw: Raw): AttendanceProfile {
  try {
    return parseAttendanceProfile(raw);
  } catch (error) {
    logger.error('Failed to parse attendance profile:', error);
    throw new ApiError('Failed to process attendance profile data.', 422);
  }
}

function safeProfiles(data: Raw[]): AttendanceProfile[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseAttendanceProfile(item));
  } catch (error) {
    logger.error('Failed to parse attendance profile list:', error);
    throw new ApiError('Failed to process attendance profile data.', 422);
  }
}

export const attendanceSettingsService = {
  // ── Attendance Profiles ────────────────────────────────────────────────────

  /**
   * Fetches all attendance profiles for the organization.
   *
   * `GET /attendance-settings/web`
   *
   * @returns The organization's {@link AttendanceProfile} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getProfiles(): Promise<AttendanceProfile[]> {
    const data = await api.get<Raw[]>('/attendance-settings/web');
    return safeProfiles(data);
  },

  /**
   * Creates an attendance profile.
   *
   * `POST /attendance-settings/web` → `AttendanceSettingsDto` (full).
   *
   * @param dto - Profile fields ({@link CreateAttendanceProfileRequest}).
   * @returns The created {@link AttendanceProfile}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async createProfile(
    dto: CreateAttendanceProfileRequest
  ): Promise<AttendanceProfile> {
    const data = await api.post<Raw>(
      '/attendance-settings/web',
      createAttendanceProfileToJson(dto)
    );
    return safeProfile(data);
  },

  /**
   * Updates an attendance profile.
   *
   * `PATCH /attendance-settings/web/{id}` → `AttendanceSettingsDto` (full).
   *
   * @param id - Surrogate id of the profile.
   * @param dto - Patch fields; only set fields are sent
   *   ({@link UpdateAttendanceProfileRequest}).
   * @returns The updated {@link AttendanceProfile}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async updateProfile(
    id: number,
    dto: UpdateAttendanceProfileRequest
  ): Promise<AttendanceProfile> {
    const data = await api.patch<Raw>(
      `/attendance-settings/web/${id}`,
      updateAttendanceProfileToJson(dto)
    );
    return safeProfile(data);
  },

  /**
   * Deletes an attendance profile.
   *
   * `DELETE /attendance-settings/web/{id}` → `ApiResponse` (ack).
   *
   * @param id - Surrogate id of the profile.
   * @returns Resolves once the profile is deleted.
   * @throws {ApiError} On non-2xx responses.
   */
  async deleteProfile(id: number): Promise<void> {
    await api.delete(`/attendance-settings/web/${id}`);
  },

  // ── Effective settings ─────────────────────────────────────────────────────

  /**
   * Fetches the resolved org-level effective attendance settings.
   *
   * `GET /attendance-settings/web/org`
   *
   * @returns The org-level {@link AttendanceProfile}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getOrgSettings(): Promise<AttendanceProfile> {
    const data = await api.get<Raw>('/attendance-settings/web/org');
    return safeProfile(data);
  },

  /**
   * Fetches the resolved effective attendance settings for a project.
   *
   * `GET /attendance-settings/web/project/{projectId}`. The backend falls back
   * to the org default when the project has no dedicated profile.
   *
   * @param projectId - Surrogate id of the project.
   * @returns The effective {@link AttendanceProfile} for the project.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getSettingsByProject(projectId: number): Promise<AttendanceProfile> {
    const data = await api.get<Raw>(
      `/attendance-settings/web/project/${projectId}`
    );
    return safeProfile(data);
  },
};
