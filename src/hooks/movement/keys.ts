/**
 * @module hooks/movement/keys
 *
 * React Query key factory for movement-record queries.
 *
 * Key shapes:
 * - `['movements']` — namespace root ({@link movementKeys.all}); invalidation
 *   prefix only, never used as a query key.
 * - `['movements', 'attendance', attendanceId]` — records for one attendance
 *   day ({@link movementKeys.byAttendance}).
 * - `['movements', 'detail', id]` — a single record ({@link movementKeys.detail}).
 */

export const movementKeys = {
  all: ['movements'] as const,

  byAttendance: (attendanceId: number) =>
    [...movementKeys.all, 'attendance', attendanceId] as const,

  detail: (id: number) => [...movementKeys.all, 'detail', id] as const,
};
