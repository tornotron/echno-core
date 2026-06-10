/**
 * @module use-indent-item-mutations
 *
 * TanStack mutation hooks for indent line items — create, update,
 * delete, and `mark-converted` (linking a line to a purchase order).
 *
 * Each hook is bound to a single parent `indentId` at construction so
 * `onSuccess` can patch the parent's `detail(indentId)` cache directly.
 * The parent indent's `items` array is the primary source of truth in
 * the current UI (see the cache-strategy note below). Read-side hooks
 * live in {@link useIndentItems}, {@link useIndentItem}, and
 * {@link useIndentItemsByIndent}.
 *
 * Cache-strategy note:
 *
 * No consumer in the codebase currently reads from
 * {@link indentItemKeys} — the indent detail page passes `indent.items`
 * as a prop to its line-item card, and other consumers read
 * `indent.items` directly. These mutations therefore patch the parent
 * indent's `items` array and invalidate the parent
 * `indentsKeys.detail(indentId)` for derived-field refresh. If a
 * dedicated `useIndentItemsByIndent` consumer is wired up later,
 * restore predicate-based item-list patching against
 * {@link indentItemKeys}.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { indentItemsService } from '../../services/indent-items-service';
import { indentsKeys } from '../indents/keys';
import {
  CreateIndentItemRequest,
  UpdateIndentItemRequest,
  Indent,
} from '../../types/indents';
import { logger } from '../../lib/logger';

/**
 * Creates a new line item under the bound parent indent.
 *
 * Backend response: `IndentItemDto` (full).
 *
 * On success:
 * - `setQueryData<Indent>(indentsKeys.detail(indentId), append)` —
 *   appends the new item to the parent's `items` array so the UI
 *   re-renders without a round-trip.
 * - `invalidateQueries(indentsKeys.detail(indentId))` — kept: the
 *   parent indent may carry derived fields (status, ordered totals)
 *   that the server may have advanced as a side-effect of the create.
 *
 * @param indentId - Surrogate ID of the parent indent the line item is
 *   being created under.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreateIndentItemRequest}.
 */
export const useCreateIndentItem = (indentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateIndentItemRequest) =>
      indentItemsService.create(dto),
    onSuccess: (newItem) => {
      // POST /indent-items/web → IndentItemDto (full).
      // Patch the parent indent's items array; invalidate for derived fields.
      queryClient.setQueryData<Indent>(indentsKeys.detail(indentId), (old) =>
        old ? { ...old, items: [...old.items, newItem] } : old
      );
      queryClient.invalidateQueries({ queryKey: indentsKeys.detail(indentId) });
    },
    onError: (error) =>
      logger.error('Failed to add item:', error),
  });
};

/**
 * Updates a line item under the bound parent indent.
 *
 * Backend response: `IndentItemDto` (full).
 *
 * On success:
 * - `setQueryData<Indent>(indentsKeys.detail(indentId), replace)` —
 *   replaces the matching entry in the parent's `items` array.
 * - `invalidateQueries(indentsKeys.detail(indentId))` — kept: the
 *   parent indent may carry derived fields the server may have
 *   recomputed (e.g. ordered totals).
 *
 * @param indentId - Surrogate ID of the parent indent.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; data: UpdateIndentItemRequest }`.
 */
export const useUpdateIndentItem = (indentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateIndentItemRequest }) =>
      indentItemsService.update(id, data),
    onSuccess: (updatedItem, { id }) => {
      // PUT /indent-items/web/{id} → IndentItemDto (full).
      // Replace in the parent indent's items array.
      queryClient.setQueryData<Indent>(indentsKeys.detail(indentId), (old) =>
        old
          ? {
              ...old,
              items: old.items.map((it) => (it.id === id ? updatedItem : it)),
            }
          : old
      );
      queryClient.invalidateQueries({ queryKey: indentsKeys.detail(indentId) });
    },
    onError: (error) =>
      logger.error('Failed to update item:', error),
  });
};

/**
 * Deletes a line item from the bound parent indent.
 *
 * Backend response: `ApiResponse` (ack only — no entity payload).
 *
 * On success:
 * - `setQueryData<Indent>(indentsKeys.detail(indentId), filter)` —
 *   filters the deleted entry out of the parent's `items` array.
 * - `invalidateQueries(indentsKeys.detail(indentId))` — kept: the
 *   parent indent may carry derived fields the server may have
 *   recomputed (e.g. ordered totals).
 *
 * @param indentId - Surrogate ID of the parent indent.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts the line-item ID.
 */
export const useDeleteIndentItem = (indentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => indentItemsService.delete(id),
    onSuccess: (_data, id) => {
      // DELETE /indent-items/web/{id} → ApiResponse (ack).
      // Filter from the parent indent's items array.
      queryClient.setQueryData<Indent>(indentsKeys.detail(indentId), (old) =>
        old ? { ...old, items: old.items.filter((it) => it.id !== id) } : old
      );
      queryClient.invalidateQueries({ queryKey: indentsKeys.detail(indentId) });
    },
    onError: (error) =>
      logger.error('Failed to remove item:', error),
  });
};

/**
 * Flips a line item to the converted state and links it to the named
 * purchase order. The PO number travels as a query-string parameter on
 * the underlying `PUT /indent-items/web/{id}/mark-converted` call.
 *
 * Backend response: `IndentItemDto` (full — with
 * `convertedToPurchaseOrder: true` and `linkedPurchaseOrderNumber`
 * populated).
 *
 * On success:
 * - `setQueryData<Indent>(indentsKeys.detail(indentId), replace)` —
 *   replaces the matching entry in the parent's `items` array so the
 *   converted status flips visibly.
 * - `invalidateQueries(indentsKeys.detail(indentId))` — kept: the
 *   parent indent's status may advance to `ORDERED` server-side as a
 *   side-effect of converting a line.
 *
 * @param indentId - Surrogate ID of the parent indent.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; purchaseOrderNumber: string }`.
 */
export const useMarkIndentItemConverted = (indentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      purchaseOrderNumber,
    }: {
      id: number;
      purchaseOrderNumber: string;
    }) => indentItemsService.markConverted(id, purchaseOrderNumber),
    onSuccess: (updatedItem, { id }) => {
      // PUT /indent-items/web/{id}/mark-converted → IndentItemDto (full).
      // Replace in parent's items array so the converted status flips visibly.
      queryClient.setQueryData<Indent>(indentsKeys.detail(indentId), (old) =>
        old
          ? {
              ...old,
              items: old.items.map((it) => (it.id === id ? updatedItem : it)),
            }
          : old
      );
      queryClient.invalidateQueries({ queryKey: indentsKeys.detail(indentId) });
    },
    onError: (error) =>
      logger.error('Failed to convert item:', error),
  });
};
