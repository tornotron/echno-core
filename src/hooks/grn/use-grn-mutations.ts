/**
 * @module use-grn-mutations
 *
 * TanStack mutation hooks for the goods-received-notes domain —
 * create, update, and a deprecated delete stub. Read-side hooks live
 * in {@link useGRNs}, {@link useGRNsPaginated}, {@link useGRN},
 * {@link useGRNsByVendor}, and {@link useGRNsByDateRange}.
 *
 * Creating a GRN has multiple cross-namespace side-effects server-side
 * (stock increment, PO line `receivedQuantity` advance, possible PO
 * status flip, inventory-transaction ledger writes). The `onSuccess`
 * of {@link useCreateGRN} therefore invalidates the affected
 * materials-stock, purchase-orders, and inventory-transactions caches.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { grnService } from '../../services/grn-service';
import { grnKeys } from './keys';
import { logger } from '../../lib/logger';
import {
  CreateGrnRequest,
  UpdateGrnRequest,
  GoodsReceivedNote,
} from '../../types/grn';
import { materialsKeys } from '../materials';
import { poKeys } from '../purchase-orders';
import { poItemKeys } from '../purchase-order-items';
import { inventoryTransactionKeys } from '../inventory-transactions';

/**
 * Matches every `GoodsReceivedNote[]` list cache under the `grn`
 * namespace — `lists()`, `paginated({...})`, `byVendor(id)`, and
 * `byDateRange(start, end)`. Excludes only `detail(id)`, which is
 * patched directly by ID.
 *
 * @param query - The TanStack query whose key is being tested.
 * @returns `true` when the key belongs to a GRN list cache.
 */
function isGrnListCache(query: { queryKey: ReadonlyArray<unknown> }): boolean {
  const key = query.queryKey;
  return Array.isArray(key) && key[0] === 'grn' && key[1] !== 'detail';
}

/**
 * Non-functional stub. The backend does not expose
 * `DELETE /grns/web/{id}`, so this hook rejects with a descriptive
 * error the moment it is invoked — no request is issued.
 *
 * @returns A TanStack `UseMutationResult` whose `mutate` always rejects.
 *
 * @deprecated Backend has no delete endpoint (audited 2026-06-01).
 *   Deletion would require server-side stock unwinding (the GRN's
 *   stock increments and inventory-transaction ledger entries cannot
 *   be silently reversed); coordinate with the backend team to add
 *   either a true delete with reversal semantics or a `VOIDED` status
 *   transition before reviving this hook. This stub will be removed
 *   once all consumers migrate.
 */
export const useDeleteGRN = () => {
  return useMutation({
    mutationFn: async (_id: number): Promise<void> => {
      throw new Error(
        'Delete is not supported by the backend (no DELETE /grns/web/{id} endpoint). Deletion would require stock unwinding; coordinate with the backend team.'
      );
    },
    onError: (error) =>
      logger.error('Failed to delete GRN:', error),
  });
};

/**
 * Records a new GRN together with its line items. Posting the GRN
 * increments material stock and writes inventory-transaction ledger
 * entries server-side; the `onSuccess` invalidates every cache those
 * side-effects can have touched.
 *
 * Backend response: `GoodsReceivedNoteDto` (full, with `items`
 * populated).
 *
 * On success:
 * - `setQueryData(grnKeys.detail(newGrn.id), newGrn)` — seeds the
 *   detail cache (including embedded items) so an immediate navigation
 *   to the new GRN renders without a refetch.
 * - `setQueryData(grnKeys.lists(), append)` — appends the new GRN to
 *   the unpaginated list.
 * - `invalidateQueries({ predicate: paginated OR vendor OR date-range })` —
 *   kept: each scoped list applies a server-side filter that direct
 *   append can't reproduce safely (paginated views depend on
 *   sort/page; `byVendor` requires scope-id match; `byDateRange`
 *   depends on the new GRN's `receivedOn`).
 * - `invalidateQueries(materialsKeys.stock(materialId))` for every item —
 *   kept (cross-namespace): the material stock view is a different
 *   shape than `Material` (it carries `MaterialWithStockDto` fields);
 *   only a refetch can produce the new stock levels.
 * - `invalidateQueries(poKeys.detail(purchaseOrderId))` and
 *   `invalidateQueries(poItemKeys.byPO(purchaseOrderId))` when the
 *   GRN is linked to a PO — kept (cross-namespace): each PO line's
 *   `receivedQuantity` advances and the PO may flip to a fully- /
 *   partially-received status server-side.
 * - `invalidateQueries(inventoryTransactionKeys.all)` — kept
 *   (cross-namespace): GRN posting writes one inventory-transaction
 *   row per item, and those rows can land in any of the
 *   inventory-transactions sub-namespaces (`byMaterial`,
 *   `byStorageLocation`, `byDateRange`, `paginated`, …). Invalidating
 *   the namespace root is broad but correct — narrower per-key
 *   invalidations would still need to span every scoped variant.
 *
 * Errors are logged via {@link logger}; the mutation result still
 * surfaces the error to the caller via `onError`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreateGrnRequest}.
 */
export const useCreateGRN = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateGrnRequest) => grnService.create(dto),
    onSuccess: (newGrn) => {
      // POST /grns/web → GoodsReceivedNoteDto (full).
      // Seed detail + append to main list. Scoped lists (paginated, byVendor,
      // byDateRange) are invalidated rather than appended — each has different
      // semantics (sort/page, vendor scope, date filter) that direct append
      // would not satisfy.
      queryClient.setQueryData(grnKeys.detail(newGrn.id), newGrn);
      queryClient.setQueryData<GoodsReceivedNote[]>(grnKeys.lists(), (old) =>
        old ? [...old, newGrn] : [newGrn]
      );
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'grn' &&
          (q.queryKey[1] === 'paginated' ||
            q.queryKey[1] === 'vendor' ||
            q.queryKey[1] === 'date-range'),
      });

      // Cross-namespace: GRN posting increases stock for each item's material.
      // Material stock view (`MaterialWithStockDto`) is a different shape than
      // Material; invalidate to refetch fresh stock levels.
      for (const item of newGrn.items) {
        if (item.materialId !== undefined) {
          queryClient.invalidateQueries({
            queryKey: materialsKeys.stock(item.materialId),
          });
        }
      }

      // Cross-namespace: receiving against a PO increments each PO item's
      // `receivedQuantity` and may flip the PO status when fully received.
      // Invalidate the parent PO detail + its items list.
      if (newGrn.purchaseOrderId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: poKeys.detail(newGrn.purchaseOrderId),
        });
        queryClient.invalidateQueries({
          queryKey: poItemKeys.byPO(newGrn.purchaseOrderId),
        });
      }

      // Cross-namespace: GRN posting writes new inventory-transaction rows
      // (one per item). Invalidate the entire inventory-transactions
      // namespace — broad but correct, since byMaterial / byStorageLocation /
      // byProject / byStorageLocationAndMaterial / paginated etc. are all
      // potentially affected and the per-item enumeration would still need
      // to span every scoped variant.
      queryClient.invalidateQueries({
        queryKey: inventoryTransactionKeys.all,
      });

    },
    onError: (error) =>
      logger.error('Failed to record GRN:', error),
  });
};

/**
 * Updates a GRN's header fields. Line items are not editable via this
 * endpoint and the underlying stock / ledger entries are unaffected,
 * so no cross-namespace invalidations are needed.
 *
 * Backend response: `GoodsReceivedNoteDto` (full). The surrogate `id`
 * travels in the request body.
 *
 * On success:
 * - `setQueryData(grnKeys.detail(updatedGrn.id), updatedGrn)` — direct
 *   patch of the detail cache (preserves embedded `items`).
 * - `setQueriesData({ predicate: isGrnListCache }, replace)` —
 *   mirrors the update across every `GoodsReceivedNote[]` list cache
 *   (`list`, `paginated`, `vendor`, `date-range`) in a single pass.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts an {@link UpdateGrnRequest} (which carries `id` in the
 *   body).
 */
export const useUpdateGRN = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateGrnRequest) => grnService.update(dto),
    onSuccess: (updatedGrn) => {
      // PATCH /grns/web → GoodsReceivedNoteDto (full). Id is carried in the
      // request body, same pattern as PO update.
      // Patch detail + every GRN[] list cache in one predicate pass.
      queryClient.setQueryData(grnKeys.detail(updatedGrn.id), updatedGrn);
      queryClient.setQueriesData<GoodsReceivedNote[]>(
        { predicate: isGrnListCache },
        (old) => old?.map((g) => (g.id === updatedGrn.id ? updatedGrn : g))
      );
    },
    onError: (error) =>
      logger.error('Failed to update GRN:', error),
  });
};
