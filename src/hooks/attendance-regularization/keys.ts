/**
 * @module hooks/attendance-regularization/keys
 *
 * React Query key factory for attendance-regularization queries.
 *
 * Key shapes:
 * - `['attendance-regularizations']` — namespace root
 *   ({@link attendanceRegularizationKeys.all}); invalidation prefix only.
 * - `['attendance-regularizations', 'pending']` — the pending-request queue
 *   ({@link attendanceRegularizationKeys.pending}).
 * - `['attendance-regularizations', 'detail', id]` — a single request
 *   ({@link attendanceRegularizationKeys.detail}).
 * - `['attendance-regularizations', 'calendar', employeeId, year, month]` —
 *   one month of an employee's calendar
 *   ({@link attendanceRegularizationKeys.calendar}); the prefix without the
 *   month invalidates every month.
 */

export const attendanceRegularizationKeys = {
  all: ['attendance-regularizations'] as const,

  pending: () => [...attendanceRegularizationKeys.all, 'pending'] as const,

  detail: (id: number) =>
    [...attendanceRegularizationKeys.all, 'detail', id] as const,

  calendars: () => [...attendanceRegularizationKeys.all, 'calendar'] as const,

  calendar: (employeeId: number, year: number, month: number) =>
    [
      ...attendanceRegularizationKeys.calendars(),
      employeeId,
      year,
      month,
    ] as const,
};
