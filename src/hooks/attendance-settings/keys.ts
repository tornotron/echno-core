/**
 * @module hooks/attendance-settings/keys
 *
 * React Query key factory for attendance profile + effective-settings queries.
 * Shift-timing keys live in `hooks/shift-timing/shift-timing-keys.ts`.
 *
 * Key shapes:
 * - `['attendance-settings']` — namespace root
 *   ({@link attendanceSettingsKeys.all}); invalidation prefix only.
 * - `['attendance-settings', 'profiles']` — the full profile list
 *   ({@link attendanceSettingsKeys.profiles}).
 * - `['attendance-settings', 'org']` — resolved org-level settings
 *   ({@link attendanceSettingsKeys.orgSettings}).
 * - `['attendance-settings', 'project', projectId]` — resolved settings for
 *   one project ({@link attendanceSettingsKeys.projectSettings}).
 */

export const attendanceSettingsKeys = {
  all: ['attendance-settings'] as const,

  profiles: () => [...attendanceSettingsKeys.all, 'profiles'] as const,

  orgSettings: () => [...attendanceSettingsKeys.all, 'org'] as const,

  projectSettings: (projectId: number) =>
    [...attendanceSettingsKeys.all, 'project', projectId] as const,
};
