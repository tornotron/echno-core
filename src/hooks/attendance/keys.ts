/**
 * @module hooks/attendance/keys
 *
 * React Query key factory for core attendance queries.
 *
 * Key shapes:
 * - `['attendance']` — namespace root ({@link attendanceKeys.all}); used only
 *   as an invalidation prefix, never as a query key.
 * - `['attendance', 'detail', id]` — a single record ({@link attendanceKeys.byId}).
 * - `['attendance', 'employee', employeeId, startDate, endDate]` — an
 *   employee's records over a date range ({@link attendanceKeys.byEmployee}).
 * - `['attendance', 'project', params]` — a project's paged/filtered list
 *   ({@link attendanceKeys.byProject}).
 * - `['attendance', 'summary', employeeId, month, year]` — a monthly summary
 *   ({@link attendanceKeys.summary}).
 *
 * The `project` and `employee` sub-namespaces are what `isAttendanceListCache`
 * predicates match when patching or invalidating list caches.
 *
 * Adjacent key factories:
 *   - Regularization keys: hooks/attendance-regularization/attendance-regularization-keys.ts
 *   - Settings keys:       hooks/attendance-settings/attendance-settings-keys.ts
 *   - Shift keys:          hooks/shift-timing/shift-timing-keys.ts
 *   - Movement keys:       hooks/movement/movement-keys.ts
 */

import type { AttendanceListParams } from '../../types/attendance';

export const attendanceKeys = {
  all: ['attendance'] as const,

  byId: (id: number) => [...attendanceKeys.all, 'detail', id] as const,

  byEmployee: (employeeId: number, startDate: string, endDate: string) =>
    [
      ...attendanceKeys.all,
      'employee',
      employeeId,
      startDate,
      endDate,
    ] as const,

  byProject: (params: AttendanceListParams) =>
    [...attendanceKeys.all, 'project', params] as const,

  summary: (employeeId: number, month: number, year: number) =>
    [...attendanceKeys.all, 'summary', employeeId, month, year] as const,
};
