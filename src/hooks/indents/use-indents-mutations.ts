/**
 * @module use-indents-mutations
 *
 * TanStack mutation hooks for the indents (parent entity) domain —
 * create, update, and delete. Line-item mutations belong to the
 * indent-items module and live in {@link useCreateIndentItem},
 * {@link useUpdateIndentItem}, {@link useDeleteIndentItem}, and
 * {@link useMarkIndentItemConverted}.
 *
 * Read-side hooks live in {@link useIndents},
 * {@link useIndentsPaginated}, and {@link useIndent}.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { indentsService } from '../../services/indents-service';
import { indentsKeys } from './keys';
import { indentItemKeys } from '../indent-items/keys';
import { poKeys } from '../../hooks/purchase-orders/keys';
import {
  CreateIndentRequest,
  UpdateIndentRequest,
  Indent,
} from '../../types/indents';
import { logger } from '../../lib/logger';

/**
 * Matches every `Indent[]` list cache under the `indents` namespace —
 * `lists()` and `paginated({...})`. The service flattens paginated
 * responses to `Indent[]` so both share the same data shape. Excludes
 * `detail(id)` (patched directly by ID) and the `items` sub-namespace
 * (owned by the indent-items module — see {@link indentItemKeys}).
 *
 * @param query - The TanStack query whose key is being tested.
 * @returns `true` when the key belongs to an indent list cache.
 */
function isIndentListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) &&
    key[0] === 'indents' &&
    key[1] !== 'detail' &&
    key[1] !== 'items'
  );
}

/**
 * Creates a new indent together with its line items.
 *
 * Backend response: `IndentDto` (full, with `items` populated).
 *
 * On success:
 * - `setQueryData(indentsKeys.detail(newIndent.id), newIndent)` — seeds
 *   the detail cache (including embedded items) so an immediate
 *   navigation to the new indent renders without a refetch.
 * - `setQueryData(indentsKeys.lists(), append)` — appends the new
 *   indent to the unpaginated list.
 * - `invalidateQueries({ predicate: key[1] === 'paginated' })` — kept:
 *   paginated views depend on sort/page semantics that direct append
 *   can't reproduce safely; the next observer of any page will refetch.
 *
 * Errors are logged via {@link logger}; the mutation result still
 * surfaces the error to the caller via `onError`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreateIndentRequest}.
 */
export const useCreateIndent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateIndentRequest) => indentsService.create(dto),
    onSuccess: (newIndent) => {
      // POST /indents/web → IndentDto (full).
      // Seed detail + append to main list. Paginated invalidated separately
      // (sort/page semantics make direct append unsafe).
      queryClient.setQueryData(indentsKeys.detail(newIndent.id), newIndent);
      queryClient.setQueryData<Indent[]>(indentsKeys.lists(), (old) =>
        old ? [...old, newIndent] : [newIndent]
      );
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'indents' &&
          q.queryKey[1] === 'paginated',
      });
    },
    onError: (error) =>
      logger.error('Failed to create indent:', error),
  });
};

/**
 * Updates an indent.
 *
 * Backend response: `IndentDto` (full).
 *
 * On success:
 * - `setQueryData(indentsKeys.detail(id), updatedIndent)` — direct
 *   patch of the detail cache (preserves embedded `items`).
 * - `setQueriesData({ predicate: isIndentListCache }, replace)` —
 *   mirrors the update across every `Indent[]` list cache (`list`,
 *   `paginated`) in a single pass.
 * - `invalidateQueries(poKeys.byIndent(id))` — kept (cross-namespace):
 *   purchase-order entries carry denormalised `indentNumber` /
 *   `indentId` references; the indent-scoped PO list must refetch so
 *   the refreshed indent details propagate.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; dto: UpdateIndentRequest }`.
 */
export const useUpdateIndent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateIndentRequest }) =>
      indentsService.update(id, dto),
    onSuccess: (updatedIndent, { id }) => {
      // PATCH /indents/web/{id} → IndentDto (full).
      // Patch detail + every Indent[] list cache in one pass.
      queryClient.setQueryData(indentsKeys.detail(id), updatedIndent);
      queryClient.setQueriesData<Indent[]>(
        { predicate: isIndentListCache },
        (old) => old?.map((i) => (i.id === id ? updatedIndent : i))
      );
      // Cross-namespace: PO entries carry denormalized `indentNumber` /
      // `indentId` references. Invalidate the indent-scoped PO list so the
      // refreshed indent details propagate.
      queryClient.invalidateQueries({ queryKey: poKeys.byIndent(id) });
    },
    onError: (error) =>
      logger.error('Failed to update indent:', error),
  });
};

/**
 * Deletes an indent.
 *
 * Backend response: `ApiResponse` (ack only — no entity payload).
 *
 * On success:
 * - `removeQueries(indentsKeys.detail(id))` — evicts the detail cache;
 *   the entity is gone, no refetch is possible.
 * - `removeQueries(indentItemKeys.byIndent(id))` — evicts the
 *   indent-scoped items list owned by the indent-items module so a
 *   deleted parent doesn't leave its items cached.
 * - `setQueriesData({ predicate: isIndentListCache }, filter)` —
 *   filters the deleted entry out of every `Indent[]` list cache in a
 *   single pass.
 * - `invalidateQueries(poKeys.byIndent(id))` — kept (cross-namespace):
 *   purchase orders raised from this indent are not auto-deleted by
 *   the backend (deletion semantics unspecified); invalidate the
 *   indent-scoped PO list so any stale link is surfaced on the next
 *   observer fetch.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts the indent ID.
 */
export const useDeleteIndent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => indentsService.delete(id),
    onSuccess: (_data, id) => {
      // DELETE /indents/web/{id} → ApiResponse (ack).
      // Indent gone — evict detail + filter from every list. Also evict the
      // indent-scoped items list owned by the indent-items module so a
      // deleted parent doesn't leave its items cached.
      queryClient.removeQueries({ queryKey: indentsKeys.detail(id) });
      queryClient.removeQueries({ queryKey: indentItemKeys.byIndent(id) });
      queryClient.setQueriesData<Indent[]>(
        { predicate: isIndentListCache },
        (old) => old?.filter((i) => i.id !== id)
      );
      // Cross-namespace: PO byIndent(id) cache may still hold references.
      // POs aren't deleted with their source indent (deletion semantics
      // unclear from spec) — invalidate so a stale link is surfaced if any.
      queryClient.invalidateQueries({ queryKey: poKeys.byIndent(id) });
    },
    onError: (error) =>
      logger.error('Failed to delete indent:', error),
  });
};
