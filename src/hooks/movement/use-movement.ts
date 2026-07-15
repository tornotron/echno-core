/**
 * @module hooks/movement/use-movement
 *
 * React Query query hooks for movement records:
 * {@link useMovementsByAttendance} and {@link useMovementById}. Keyed via
 * {@link movementKeys}. Both hooks inherit the default query-client
 * configuration (no per-hook option profile).
 */

import { useQuery } from '@tanstack/react-query';
import { movementService } from '../../services/movement-service';
import { movementKeys } from './keys';

/**
 * Fetches all movement records logged against an attendance day.
 *
 * Keyed by `movementKeys.byAttendance(attendanceId)`. Disabled until
 * `attendanceId` is defined and greater than `0`.
 *
 * @param attendanceId - Surrogate id of the parent attendance record. Pass
 *   `undefined` to defer the query.
 * @returns A TanStack `UseQueryResult` wrapping a {@link MovementRecord} array.
 */
export function useMovementsByAttendance(attendanceId: number | undefined) {
  return useQuery({
    queryKey: movementKeys.byAttendance(attendanceId ?? 0),
    queryFn: () => movementService.getMovementsByAttendance(attendanceId!),
    enabled: attendanceId !== undefined && attendanceId > 0,
  });
}

/**
 * Fetches a single movement record by id.
 *
 * Keyed by `movementKeys.detail(id)`. Disabled until `id` is defined and
 * greater than `0`.
 *
 * @param id - Surrogate id of the movement record. Pass `undefined` to defer
 *   the query.
 * @returns A TanStack `UseQueryResult` wrapping a {@link MovementRecord}.
 */
export function useMovementById(id: number | undefined) {
  return useQuery({
    queryKey: movementKeys.detail(id ?? 0),
    queryFn: () => movementService.getMovementById(id!),
    enabled: id !== undefined && id > 0,
  });
}

export { movementKeys } from './keys';
