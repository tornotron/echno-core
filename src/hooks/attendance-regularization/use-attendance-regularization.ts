/**
 * @module hooks/attendance-regularization/use-attendance-regularization
 *
 * React Query query hooks for attendance-regularization data:
 * {@link usePendingRegularizations} and {@link useRegularizationById}. Keyed
 * via {@link attendanceRegularizationKeys}. Both hooks inherit the default
 * query-client configuration (no per-hook option profile).
 */

import { useQuery } from '@tanstack/react-query';
import { attendanceRegularizationService } from '../../services/attendance-regularization-service';
import { attendanceRegularizationKeys } from './keys';

/**
 * Fetches the queue of pending regularization requests awaiting a decision.
 *
 * Keyed by `attendanceRegularizationKeys.pending()`; always enabled.
 *
 * @returns A TanStack `UseQueryResult` wrapping a {@link RegularizationDetail}
 *   array.
 */
export function usePendingRegularizations() {
  return useQuery({
    queryKey: attendanceRegularizationKeys.pending(),
    queryFn: () => attendanceRegularizationService.getPending(),
  });
}

/**
 * Fetches a single regularization request by id.
 *
 * Keyed by `attendanceRegularizationKeys.detail(id)`. Disabled until `id` is
 * defined and greater than `0`.
 *
 * @param id - Surrogate id of the regularization request. Pass `undefined` to
 *   defer the query.
 * @returns A TanStack `UseQueryResult` wrapping a {@link RegularizationDetail}.
 */
export function useRegularizationById(id: number | undefined) {
  return useQuery({
    queryKey: attendanceRegularizationKeys.detail(id ?? 0),
    queryFn: () => attendanceRegularizationService.getById(id!),
    enabled: id !== undefined && id > 0,
  });
}

// NOTE: No dedicated "regularizations by employee" hook — derive from
// useAttendanceByEmployee + .regularization on each record (see
// EmployeeRegularizationView).

export { attendanceRegularizationKeys } from './keys';
