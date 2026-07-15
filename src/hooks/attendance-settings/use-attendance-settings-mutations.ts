/**
 * @module hooks/attendance-settings/use-attendance-settings-mutations
 *
 * React Query mutation hooks for attendance profiles:
 * {@link useCreateAttendanceProfile}, {@link useUpdateAttendanceProfile}, and
 * {@link useDeleteAttendanceProfile}. Shift-timing mutations live in
 * `hooks/shift-timing/`.
 *
 * Cache discipline: create/update/delete patch the profile list cache
 * directly. All three also invalidate the org-level and per-project
 * effective-settings caches, because those hold the backend's resolved
 * settings (project → org fallback) and must refetch the canonical view.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceSettingsService } from '../../services/attendance-settings-service';
import type { AttendanceProfile } from '../../types/attendance';
import { attendanceSettingsKeys } from './keys';

/**
 * Creates an attendance profile.
 *
 * Backend response: `AttendanceSettingsDto` (full).
 *
 * On success:
 * - `setQueryData(attendanceSettingsKeys.profiles(), append)` — appends the
 *   new profile to the profile list cache.
 * - `invalidateQueries(attendanceSettingsKeys.orgSettings())` — kept: a new
 *   profile can change the resolved org default; the backend recomputes it.
 * - `invalidateQueries(attendanceSettingsKeys.projectSettings(projectId))` —
 *   kept, conditional on the profile being project-scoped: a project profile
 *   shadows the org default in the project resolver.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts a
 *   {@link CreateAttendanceProfileRequest}.
 */
export function useCreateAttendanceProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: attendanceSettingsService.createProfile,
    onSuccess: (profile) => {
      // POST /attendance-settings/web → AttendanceSettingsDto (full).
      queryClient.setQueryData<AttendanceProfile[]>(
        attendanceSettingsKeys.profiles(),
        (old) => (old ? [...old, profile] : undefined)
      );
      // Cross-key: a new org-level profile is the resolved org default; a new
      // project-scoped profile may also shadow the org default for the project
      // resolver (the API falls back from project → org). Invalidate the
      // org-level cache unconditionally and the per-project cache when the
      // profile is project-scoped, mirroring useUpdate/useDelete.
      queryClient.invalidateQueries({
        queryKey: attendanceSettingsKeys.orgSettings(),
      });
      if (profile.projectId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: attendanceSettingsKeys.projectSettings(profile.projectId),
        });
      }
    },
  });
}

/**
 * Updates an attendance profile.
 *
 * Backend response: `AttendanceSettingsDto` (full).
 *
 * On success:
 * - `setQueryData(attendanceSettingsKeys.profiles(), replace)` — replaces the
 *   profile in the list cache by id.
 * - `invalidateQueries(attendanceSettingsKeys.orgSettings())` — kept: the
 *   org-level resolved settings depend on this profile.
 * - `invalidateQueries(attendanceSettingsKeys.projectSettings(projectId))` —
 *   kept, conditional on the profile being project-scoped.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; dto: UpdateAttendanceProfileRequest }`.
 */
export function useUpdateAttendanceProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: number;
      dto: Parameters<typeof attendanceSettingsService.updateProfile>[1];
    }) => attendanceSettingsService.updateProfile(id, dto),
    onSuccess: (profile) => {
      // PATCH /attendance-settings/web/{id} → AttendanceSettingsDto (full).
      queryClient.setQueryData<AttendanceProfile[]>(
        attendanceSettingsKeys.profiles(),
        (old) => old?.map((p) => (p.id === profile.id ? profile : p))
      );
      // Cross-key: org-level and per-project resolved settings depend on
      // this profile — invalidate so they refetch the canonical view.
      queryClient.invalidateQueries({
        queryKey: attendanceSettingsKeys.orgSettings(),
      });
      if (profile.projectId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: attendanceSettingsKeys.projectSettings(profile.projectId),
        });
      }
    },
  });
}

/**
 * Deletes an attendance profile.
 *
 * Backend response: `ApiResponse` (ack).
 *
 * On success:
 * - `setQueryData(attendanceSettingsKeys.profiles(), filter)` — filters the
 *   deleted profile out of the list cache (the removed entry is read first so
 *   its `projectId` can drive the conditional invalidation below).
 * - `invalidateQueries(attendanceSettingsKeys.orgSettings())` — kept: removing
 *   an override can switch the resolved org settings back to the default.
 * - `invalidateQueries(attendanceSettingsKeys.projectSettings(projectId))` —
 *   kept, conditional on the removed profile having been project-scoped.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts the
 *   profile `id` (`number`).
 */
export function useDeleteAttendanceProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => attendanceSettingsService.deleteProfile(id),
    onSuccess: (_void, id) => {
      // DELETE /attendance-settings/web/{id} → ApiResponse (ack).
      const removed = queryClient
        .getQueryData<AttendanceProfile[]>(attendanceSettingsKeys.profiles())
        ?.find((p) => p.id === id);
      queryClient.setQueryData<AttendanceProfile[]>(
        attendanceSettingsKeys.profiles(),
        (old) => old?.filter((p) => p.id !== id)
      );
      // Org/project resolved settings can switch from the deleted override
      // back to the default — invalidate the affected caches.
      queryClient.invalidateQueries({
        queryKey: attendanceSettingsKeys.orgSettings(),
      });
      if (removed?.projectId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: attendanceSettingsKeys.projectSettings(removed.projectId),
        });
      }
    },
  });
}
