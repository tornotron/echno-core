/**
 * @module use-purchase-order-items
 *
 * TanStack Query hooks for reading {@link PurchaseOrderItem} line items
 * directly (rather than via the parent PO's embedded `items` array).
 * Mutations live in {@link useCreatePOItem}, {@link useUpdatePOItem}, and
 * {@link useDeletePOItem}.
 *
 * Neither hook spreads a profile from `lib/query/options`; both inherit
 * the host `QueryClient`'s defaults.
 */
import { useQuery } from '@tanstack/react-query';
import { purchaseOrderItemsService } from '../../services/purchase-order-items-service';
import { poItemKeys } from './purchase-order-item-keys';

/**
 * Fetches every line item belonging to the given parent PO. The query is
 * disabled until `purchaseOrderId` is truthy.
 *
 * Note: most consumers read items via `usePurchaseOrder(id).data?.items`
 * since the parent's detail payload already embeds them; reach for this
 * hook when you need an item list independent of the parent's lifecycle.
 *
 * @param purchaseOrderId - Surrogate ID of the parent {@link PurchaseOrder}.
 * @returns A TanStack `UseQueryResult` wrapping `PurchaseOrderItem[]`.
 */
export const usePOItemsByPurchaseOrder = (purchaseOrderId: number) =>
  useQuery({
    queryKey: poItemKeys.byPO(purchaseOrderId),
    queryFn: () =>
      purchaseOrderItemsService.getByPurchaseOrder(purchaseOrderId),
    enabled: !!purchaseOrderId,
  });

/**
 * Fetches a single line item by ID. The query is disabled until `id` is
 * truthy.
 *
 * @param id - Surrogate ID of the line item.
 * @returns A TanStack `UseQueryResult` wrapping a single
 *   `PurchaseOrderItem`.
 */
export const usePOItem = (id: number) =>
  useQuery({
    queryKey: poItemKeys.detail(id),
    queryFn: () => purchaseOrderItemsService.getById(id),
    enabled: !!id,
  });
