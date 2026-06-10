/**
 * @module use-purchase-order-item-mutations
 *
 * TanStack mutation hooks for line items on a {@link PurchaseOrder}.
 *
 * Cache strategy: line items live as an embedded `items` array inside the
 * parent PO's detail cache. Each mutation patches that array in place on
 * `poKeys.detail(purchaseOrderId)` and then invalidates the same key so
 * server-derived fields (notably `totalAmount`) refetch with the
 * up-to-date totals.
 *
 * These hooks do **not** touch `poItemKeys.*` directly — no UI consumer
 * reads from the item-namespace caches yet. When a dedicated
 * {@link usePOItemsByPurchaseOrder} consumer is wired up, add
 * predicate-based patching against `poItemKeys.byPO(purchaseOrderId)`
 * here.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrderItemsService } from '../../services/purchase-order-items-service';
import {
  CreatePurchaseOrderItemRequest,
  UpdatePurchaseOrderItemRequest,
  PurchaseOrder,
} from '../../types/purchase-orders';
import { poKeys } from '../purchase-orders';
import { logger } from '../../lib/logger';

/**
 * Adds a new line item to an existing purchase order.
 *
 * Backend response: `PurchaseOrderItemDto` (full).
 *
 * On success:
 * - `setQueryData(poKeys.detail(purchaseOrderId), append-to-items)` —
 *   appends the new item to the parent PO's embedded `items` array so the
 *   items table updates instantly.
 * - `invalidateQueries(poKeys.detail(purchaseOrderId))` — kept: derived
 *   server-side fields on the parent (notably `totalAmount`) cannot be
 *   recomputed locally with confidence; canonical refetch picks up the
 *   new totals.
 *
 * Errors are logged via {@link logger}; the mutation result still
 * surfaces the error to the caller via `onError`.
 *
 * @param purchaseOrderId - Surrogate ID of the parent
 *   {@link PurchaseOrder} whose detail cache will be patched.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreatePurchaseOrderItemRequest}.
 */
export const useCreatePOItem = (purchaseOrderId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePurchaseOrderItemRequest) =>
      purchaseOrderItemsService.create(dto),
    onSuccess: (newItem) => {
      // POST /purchase-order-items/web → PurchaseOrderItemResponseDto (full).
      // Patch the parent PO's `items` array so the items table updates
      // instantly; invalidate so derived server fields (totalAmount) refetch.
      queryClient.setQueryData<PurchaseOrder>(
        poKeys.detail(purchaseOrderId),
        (old) => (old ? { ...old, items: [...old.items, newItem] } : old)
      );
      queryClient.invalidateQueries({
        queryKey: poKeys.detail(purchaseOrderId),
      });
    },
    onError: (error) =>
      logger.error('Failed to add purchase order item:', error),
  });
};

/**
 * Updates a line item on a purchase order.
 *
 * Backend response: `PurchaseOrderItemDto` (full).
 *
 * On success:
 * - `setQueryData(poKeys.detail(purchaseOrderId), replace-in-items)` —
 *   replaces the matching item by `id` inside the parent PO's embedded
 *   `items` array.
 * - `invalidateQueries(poKeys.detail(purchaseOrderId))` — kept: derived
 *   server-side fields on the parent (notably `totalAmount`) need to
 *   reflect the edited line.
 *
 * @param purchaseOrderId - Surrogate ID of the parent
 *   {@link PurchaseOrder} whose detail cache will be patched.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; data: UpdatePurchaseOrderItemRequest }`.
 */
export const useUpdatePOItem = (purchaseOrderId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdatePurchaseOrderItemRequest;
    }) => purchaseOrderItemsService.update(id, data),
    onSuccess: (updatedItem, { id }) => {
      // PATCH /purchase-order-items/web → PurchaseOrderItemResponseDto (full).
      // Replace in the parent PO's items array; invalidate for derived totals.
      queryClient.setQueryData<PurchaseOrder>(
        poKeys.detail(purchaseOrderId),
        (old) =>
          old
            ? {
                ...old,
                items: old.items.map((it) => (it.id === id ? updatedItem : it)),
              }
            : old
      );
      queryClient.invalidateQueries({
        queryKey: poKeys.detail(purchaseOrderId),
      });

    },
    onError: (error) =>
      logger.error('Failed to update purchase order item:', error),
  });
};

/**
 * Removes a line item from a purchase order.
 *
 * Backend response: `ApiResponse` (ack only).
 *
 * On success:
 * - `setQueryData(poKeys.detail(purchaseOrderId), filter-items)` — drops
 *   the removed item from the parent PO's embedded `items` array.
 * - `invalidateQueries(poKeys.detail(purchaseOrderId))` — kept: derived
 *   server-side fields on the parent (notably `totalAmount`) need to
 *   reflect the deletion.
 *
 * No item-namespace caches are touched — no UI consumer reads them. Add
 * `removeQueries(poItemKeys.detail(id))` here if a direct item-detail
 * consumer is wired up later.
 *
 * @param purchaseOrderId - Surrogate ID of the parent
 *   {@link PurchaseOrder} whose detail cache will be patched.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts the numeric ID of the line item to delete.
 */
export const useDeletePOItem = (purchaseOrderId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => purchaseOrderItemsService.delete(id),
    onSuccess: (_data, id) => {
      // DELETE /purchase-order-items/web/{id} → ApiResponse (ack).
      // Filter from the parent PO's items array; invalidate for derived totals.
      queryClient.setQueryData<PurchaseOrder>(
        poKeys.detail(purchaseOrderId),
        (old) =>
          old ? { ...old, items: old.items.filter((it) => it.id !== id) } : old
      );
      queryClient.invalidateQueries({
        queryKey: poKeys.detail(purchaseOrderId),
      });
    },
    onError: (error) =>
      logger.error('Failed to remove purchase order item:', error),
  });
};
