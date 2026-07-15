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
 */

export const attendanceRegularizationKeys = {
  all: ['attendance-regularizations'] as const,

  pending: () => [...attendanceRegularizationKeys.all, 'pending'] as const,

  detail: (id: number) =>
    [...attendanceRegularizationKeys.all, 'detail', id] as const,
};
