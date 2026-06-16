/**
 * @module use-shift-timing
 *
 * TanStack Query hooks for reading shift timings. Mutations live in
 * {@link useCreateShift}, {@link useUpdateShift}, and
 * {@link useDeleteShift}.
 *
 * Neither hook below spreads a profile from `lib/query/options`;
 * they inherit the host `QueryClient`'s defaults (mirroring the
 * **standard** profile of `staleTime` 60 s / `gcTime` 5 min when the
 * host uses the recommended setup).
 */

import { useQuery } from '@tanstack/react-query';
import { shiftTimingService } from '../../services/shift-timing-service';
import { shiftTimingKeys } from './keys';

/**
 * Fetches the flat list of every configured shift timing.
 *
 * @returns A TanStack `UseQueryResult` wrapping `ShiftTiming[]`.
 */
export function useShifts() {
  return useQuery({
    queryKey: shiftTimingKeys.lists(),
    queryFn: () => shiftTimingService.getAll(),
  });
}

/**
 * Fetches a single shift timing by ID. The query is disabled until
 * `id` is a positive integer.
 *
 * @param id - Surrogate ID of the shift timing. Pass `undefined` or
 *   a non-positive value to defer the query until the ID is
 *   available.
 * @returns A TanStack `UseQueryResult` wrapping `ShiftTiming`.
 */
export function useShift(id: number | undefined) {
  return useQuery({
    queryKey: shiftTimingKeys.detail(id ?? 0),
    queryFn: () => shiftTimingService.getById(id!),
    enabled: id !== undefined && id > 0,
  });
}

export { shiftTimingKeys } from './keys';
