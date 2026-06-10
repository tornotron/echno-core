/**
 * @module use-labour-mutations
 *
 * TanStack mutation hooks for the labour domain. Read-side hooks live in
 * {@link useLabour} and {@link useLabourById}.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { labourService } from '../../services/labour-service';
import { labourKeys } from './labour-keys';
import type {
  Labour,
  LabourCreateRequest,
  LabourUpdateRequest,
} from '../../types/labour';
import { logger } from '../../lib/logger';

/**
 * Matches every cache entry under the `labour` namespace except detail
 * entries. The labour key factory only exposes `all`, `lists`, and
 * `detail`, so the predicate currently resolves to {@link labourKeys.lists}
 * — the predicate shape is kept (rather than collapsing to a direct
 * `lists()` reference) so future scoped list variants
 * (e.g. `byProject`, `byStatus`) are covered automatically.
 */
function isLabourListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return Array.isArray(key) && key[0] === 'labour' && key[1] !== 'detail';
}

/**
 * Creates a new labour record.
 *
 * Backend response: `LabourSimpleDto` (partial — the SimpleDto carries the
 * `labourId` / `emergencyContactPhone` field-name variants and may add or
 * omit denormalised org/project context fields relative to the canonical
 * `LabourDto`).
 *
 * On success:
 * - `setQueryData(labourKeys.lists(), append)` — appends the new record to
 *   the cached list without a network round-trip.
 * - `setQueryData(labourKeys.detail(newLabour.id), newLabour)` — seeds the
 *   detail cache with the SimpleDto response so an immediate read returns
 *   a value rather than triggering a fetch.
 * - `invalidateQueries(labourKeys.detail(newLabour.id))` — kept so the
 *   next observer of the detail key pulls the canonical `LabourDto`,
 *   reconciling the `labourID`/`labourId` and
 *   `emergencyContactNumber`/`emergencyContactPhone` field-name drift the
 *   SimpleDto seed leaves behind.
 *
 * Errors are logged via {@link logger}; the mutation result still surfaces
 * the error to the caller via `onError`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   a {@link LabourCreateRequest}.
 */
export function useCreateLabour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LabourCreateRequest) => labourService.create(data),
    onSuccess: (newLabour) => {
      // POST /labour/web → LabourSimpleDto (partial). Labour is a flat type
      // with no nested arrays, so merging degenerates to overwrite — but
      // the SimpleDto may omit scalar fields the full LabourDto returns
      // (`labourID` casing, `emergencyContactPhone` vs `emergencyContactNumber`,
      // plus the org/project context naming). Seed list + detail with the
      // SimpleDto, then invalidate detail so the next observer pulls the
      // canonical LabourDto from GET /labour/web/{id}.
      queryClient.setQueryData<Labour[]>(labourKeys.lists(), (old) =>
        old ? [...old, newLabour] : [newLabour]
      );
      queryClient.setQueryData<Labour>(
        labourKeys.detail(newLabour.id),
        newLabour
      );
      queryClient.invalidateQueries({
        queryKey: labourKeys.detail(newLabour.id),
      });
    },
    onError: (error) => {
      logger.error('Failed to create labour:', {
        message: error instanceof Error ? error.message : String(error),
        errors:
          error instanceof Error && 'errors' in error
            ? (error as { errors?: unknown }).errors
            : undefined,
      });
    },
  });
}

/**
 * Updates a labour record by ID.
 *
 * Backend response: `ApiResponse` (ack only — no payload to patch).
 *
 * On success:
 * - `invalidateQueries(labourKeys.detail(id))` — kept: ack response carries
 *   no DTO; canonical refetch is the only way to reflect the change.
 * - `invalidateQueries({ predicate: isLabourListCache })` — kept: list
 *   entries may reflect updated fields (status, project assignment) that
 *   are only visible after a refetch.
 *
 * Errors are logged via {@link logger}; the mutation result still surfaces
 * the error to the caller via `onError`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; data: LabourUpdateRequest }`.
 */
export function useUpdateLabour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: LabourUpdateRequest }) =>
      labourService.update(id, data),
    onSuccess: (_void, { id }) => {
      // PATCH /labour/web/{id} → ApiResponse (ack) — invalidate to refetch.
      queryClient.invalidateQueries({ queryKey: labourKeys.detail(id) });
      queryClient.invalidateQueries({ predicate: isLabourListCache });
    },
    onError: (error) => {
      logger.error('Failed to update labour:', error);
    },
  });
}

/**
 * Deletes a labour record by ID.
 *
 * Backend response: `ApiResponse` (ack only).
 *
 * Optimistic update:
 * - `onMutate` cancels in-flight detail and list queries, snapshots
 *   `previousDetail` and `previousListEntries`, then applies the deletion
 *   immediately: `setQueriesData({ predicate: isLabourListCache }, filter)`
 *   strips the row from every list cache and
 *   `removeQueries(labourKeys.detail(id))` evicts the detail entry.
 *
 * Rollback:
 * - `onError` restores list caches from `previousListEntries` and re-seeds
 *   the detail entry from `previousDetail` if it was present.
 *
 * No `onSuccess` cache work is needed: with the entity gone, every
 * consequence of the delete is local-cache cleanup already applied in
 * `onMutate`. No invalidations are kept; the ack response carries no
 * payload and there is nothing to reconcile.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   the numeric ID of the labour record to delete.
 */
export function useDeleteLabour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => labourService.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: labourKeys.detail(id) });
      await queryClient.cancelQueries({ predicate: isLabourListCache });

      const previousDetail = queryClient.getQueryData<Labour>(
        labourKeys.detail(id)
      );
      const previousListEntries = queryClient.getQueriesData<Labour[]>({
        predicate: isLabourListCache,
      });

      queryClient.setQueriesData<Labour[]>(
        { predicate: isLabourListCache },
        (old) => old?.filter((l) => l.id !== id)
      );
      queryClient.removeQueries({ queryKey: labourKeys.detail(id) });

      return { previousDetail, previousListEntries };
    },
    onError: (error, id, context) => {
      for (const [key, value] of context?.previousListEntries ?? []) {
        queryClient.setQueryData<Labour[]>(key, value);
      }
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData<Labour>(
          labourKeys.detail(id),
          context.previousDetail
        );
      }
      logger.error('Failed to delete labour:', error);
    },
  });
}
