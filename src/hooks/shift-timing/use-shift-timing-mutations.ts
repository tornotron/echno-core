/**
 * @module use-shift-timing-mutations
 *
 * TanStack mutation hooks for shift-timing writes — create, update,
 * and delete. Read-side hooks live in {@link useShifts} and
 * {@link useShift}.
 *
 * Cache discipline:
 *
 * - Backend returns the full `ShiftTimingDto` on create and update;
 *   delete returns no body. The mutations therefore patch the list
 *   cache (`shiftTimingKeys.lists()`) and, on update, the detail
 *   cache (`shiftTimingKeys.detail(id)`) directly from the response
 *   without any follow-up invalidations.
 *
 * - Delete removes the row from the list cache and evicts the
 *   per-detail entry via `removeQueries` — there is no server row
 *   left to refetch.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shiftTimingService } from '../../services/shift-timing-service';
import type { ShiftTiming } from '../../types/shift-timing';
import { shiftTimingKeys } from './keys';

/**
 * Creates a new shift timing.
 *
 * Backend response: `ShiftTimingDto` (full).
 *
 * On success:
 * - `setQueryData(shiftTimingKeys.lists(), append)` — appends the
 *   server-returned object to the list cache without a network
 *   round-trip. No-op if the list cache has not been hydrated
 *   (returns `undefined` to leave the cache absent).
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreateShiftTimingRequest}.
 */
export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: shiftTimingService.create,
    onSuccess: (shift) => {
      // POST /shift-timings/web → ShiftTimingDto (Rule A, full).
      queryClient.setQueryData<ShiftTiming[]>(shiftTimingKeys.lists(), (old) =>
        old ? [...old, shift] : undefined
      );
    },
  });
}

/**
 * Updates an existing shift timing.
 *
 * Backend response: `ShiftTimingDto` (full).
 *
 * On success:
 * - `setQueryData(shiftTimingKeys.lists(), replace-by-id)` — swaps
 *   the matching entry in the list cache for the server-returned
 *   object.
 * - `setQueryData(shiftTimingKeys.detail(id), replace)` — overwrites
 *   the per-detail cache with the full DTO.
 *
 * No invalidations — the full DTO carries every field consumers
 * read, so no refetch is needed.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; dto: UpdateShiftTimingRequest }`.
 */
export function useUpdateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: number;
      dto: Parameters<typeof shiftTimingService.update>[1];
    }) => shiftTimingService.update(id, dto),
    onSuccess: (shift) => {
      // PATCH /shift-timings/web/{id} → ShiftTimingDto (Rule A, full).
      queryClient.setQueryData<ShiftTiming[]>(shiftTimingKeys.lists(), (old) =>
        old?.map((s) => (s.id === shift.id ? shift : s))
      );
      queryClient.setQueryData<ShiftTiming>(
        shiftTimingKeys.detail(shift.id),
        shift
      );
    },
  });
}

/**
 * Deletes a shift timing.
 *
 * Backend response: void (no body).
 *
 * On success:
 * - `setQueryData(shiftTimingKeys.lists(), filter-by-id)` — drops
 *   the row from the list cache so consumers don't see a stale
 *   entry.
 * - `removeQueries(shiftTimingKeys.detail(id))` — evicts the
 *   per-detail cache; the entity no longer exists server-side, so
 *   any future `useShift(id)` would 404.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts the shift-timing `id` as a `number`.
 */
export function useDeleteShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => shiftTimingService.delete(id),
    onSuccess: (_void, id) => {
      // DELETE /shift-timings/web/{id} → no body (Rule C, void).
      queryClient.setQueryData<ShiftTiming[]>(shiftTimingKeys.lists(), (old) =>
        old?.filter((s) => s.id !== id)
      );
      queryClient.removeQueries({ queryKey: shiftTimingKeys.detail(id) });
    },
  });
}
