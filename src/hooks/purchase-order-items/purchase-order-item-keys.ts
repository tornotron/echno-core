/**
 * @module purchase-order-item-keys
 *
 * TanStack Query key factory for the purchase-order-items domain. Items
 * are a sub-resource of {@link PurchaseOrder}; the parent PO already
 * embeds its `items` array, so most UI flows read items through the
 * parent's `detail` cache rather than these keys directly.
 *
 * Key shapes:
 * - `['purchase-order-items']` — namespace root, invalidation prefix
 *   only; never used as a query key directly.
 * - `['purchase-order-items', 'detail', id]` — a single line item by ID,
 *   consumed by {@link usePOItem}.
 * - `['purchase-order-items', 'purchase-order', purchaseOrderId]` —
 *   items belonging to one parent PO, consumed by
 *   {@link usePOItemsByPurchaseOrder}.
 * - `['purchase-order-items', 'material', materialId]` — items
 *   referencing one material across all POs, no dedicated read hook yet
 *   but addressable via {@link purchaseOrderItemsService.getByMaterial}.
 *
 * Current line-item mutations
 * ({@link useCreatePOItem}/{@link useUpdatePOItem}/{@link useDeletePOItem})
 * patch the parent PO's `detail` cache rather than these caches, since no
 * UI consumer reads `byPO` or `detail` directly yet. Restore predicate
 * patching here when a dedicated item-list consumer lands.
 */
export const poItemKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['purchase-order-items'] as const,

  /** Query key for a single line item by ID. */
  detail: (id: number) => [...poItemKeys.all, 'detail', id] as const,

  /** Query key for every line item belonging to a parent PO. */
  byPO: (purchaseOrderId: number) =>
    [...poItemKeys.all, 'purchase-order', purchaseOrderId] as const,

  /** Query key for every line item referencing a given material. */
  byMaterial: (materialId: number) =>
    [...poItemKeys.all, 'material', materialId] as const,
};
