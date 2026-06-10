/**
 * @module use-purchase-orders-mutations
 *
 * TanStack mutation hooks for the purchase-orders domain — create,
 * update, status transition, and a deprecated delete stub. Line-item
 * mutations live in {@link useCreatePOItem}, {@link useUpdatePOItem},
 * and {@link useDeletePOItem}.
 *
 * Read-side hooks live in {@link usePurchaseOrders},
 * {@link usePurchaseOrdersPaginated}, {@link usePurchaseOrder},
 * {@link usePOsByVendor}, {@link usePOsByIndent}, and
 * {@link usePOsByStatus}.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersService } from '../../services/purchase-orders-service';
import { poKeys } from './purchase-order-keys';
import {
  CreatePurchaseOrderRequest,
  UpdatePurchaseOrderRequest,
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../../types/purchase-orders';
import { vendorKeys } from '../vendor';
import { logger } from '../../lib/logger';

/**
 * Matches every `PurchaseOrder[]` list cache under the `purchase-orders`
 * namespace — `lists()`, `paginated({...})`, `byVendor(id)`,
 * `byIndent(id)`, and `byStatus(s)`. Excludes only `detail(id)`, which is
 * patched directly by ID.
 *
 * @param query - The TanStack query whose key is being tested.
 * @returns `true` when the key belongs to a PO list cache.
 */
function isPurchaseOrderListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) && key[0] === 'purchase-orders' && key[1] !== 'detail'
  );
}

/**
 * Creates a new purchase order together with its inline line items.
 *
 * Backend response: `PurchaseOrderDto` (full, with `items` populated).
 *
 * On success:
 * - `setQueryData(poKeys.detail(newPO.id), newPO)` — seeds the detail
 *   cache (including embedded items) so an immediate navigation to the
 *   new PO renders without a refetch.
 * - `setQueryData(poKeys.lists(), append)` — appends the new PO to the
 *   unpaginated list.
 * - `invalidateQueries({ predicate: paginated OR vendor OR indent OR status })` —
 *   kept: each scoped list applies a server-side filter that direct
 *   append can't reproduce safely (paginated views depend on sort/page;
 *   `byVendor` and `byIndent` require scope-id match; `byStatus` depends
 *   on the new PO's status bucket).
 * - `invalidateQueries(vendorKeys.summary(vendorId))` — kept
 *   (cross-namespace): the vendor summary rolls up PO counts and
 *   outstanding amounts; only refetch can produce the new totals.
 *
 * Errors are logged via {@link logger}; the mutation result still
 * surfaces the error to the caller via `onError`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreatePurchaseOrderRequest}.
 */
export const useCreatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePurchaseOrderRequest) =>
      purchaseOrdersService.create(dto),
    onSuccess: (newPO) => {
      // POST /purchase-orders/web → PurchaseOrderDto (full).
      // Seed detail + append to main list. Scoped lists (byVendor, byIndent,
      // byStatus, paginated) are invalidated because direct append isn't
      // semantically safe (status-scoped lists depend on the new PO's status;
      // paginated views depend on sort/page; byVendor/byIndent require the
      // scope id to match).
      queryClient.setQueryData(poKeys.detail(newPO.id), newPO);
      queryClient.setQueryData<PurchaseOrder[]>(poKeys.lists(), (old) =>
        old ? [...old, newPO] : [newPO]
      );
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'purchase-orders' &&
          (q.queryKey[1] === 'paginated' ||
            q.queryKey[1] === 'vendor' ||
            q.queryKey[1] === 'indent' ||
            q.queryKey[1] === 'status'),
      });
      // Cross-namespace: vendor summary may roll up PO counts / outstanding
      // amounts. Invalidate the affected vendor's summary cache.
      if (newPO.vendorId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: vendorKeys.summary(newPO.vendorId),
        });
      }
    },
    onError: (error) =>
      logger.error('Failed to create purchase order:', error),
  });
};

/**
 * Updates a purchase order.
 *
 * Backend response: `PurchaseOrderDto` (full).
 *
 * On success:
 * - `setQueryData(poKeys.detail(updatedPO.id), updatedPO)` — direct patch
 *   of the detail cache (preserves embedded `items`).
 * - `setQueriesData({ predicate: isPurchaseOrderListCache }, replace)` —
 *   mirrors the update across every `PurchaseOrder[]` list cache (`list`,
 *   `paginated`, `vendor`, `indent`, `status`) in a single pass.
 * - `invalidateQueries(vendorKeys.summary(vendorId))` — kept
 *   (cross-namespace): edits to `totalAmount` or status can affect vendor
 *   rollups, and those values aren't part of `PurchaseOrderDto`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts an {@link UpdatePurchaseOrderRequest} (which carries `id` in
 *   the body).
 */
export const useUpdatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdatePurchaseOrderRequest) =>
      purchaseOrdersService.update(dto),
    onSuccess: (updatedPO) => {
      // PATCH /purchase-orders/web/{id} → PurchaseOrderDto (full).
      // Note: PATCH carries the id in the body (no path param). Patch detail
      // + every PurchaseOrder[] list cache (lists, paginated, byVendor,
      // byIndent, byStatus) in one pass.
      queryClient.setQueryData(poKeys.detail(updatedPO.id), updatedPO);
      queryClient.setQueriesData<PurchaseOrder[]>(
        { predicate: isPurchaseOrderListCache },
        (old) => old?.map((p) => (p.id === updatedPO.id ? updatedPO : p))
      );
      // Cross-namespace: vendor summary may include PO totals / counts.
      if (updatedPO.vendorId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: vendorKeys.summary(updatedPO.vendorId),
        });
      }
    },
    onError: (error) =>
      logger.error('Failed to update purchase order:', error),
  });
};

/**
 * Non-functional stub. The backend does not expose
 * `DELETE /purchase-orders/web/{id}`, so this hook rejects with a
 * descriptive error the moment it is invoked — no request is issued.
 *
 * Callers should transition the PO to {@link PurchaseOrderStatus.cancelled}
 * via {@link useUpdatePOStatus} instead.
 *
 * @returns A TanStack `UseMutationResult` whose `mutate` always rejects.
 *
 * @deprecated Backend has no delete endpoint (audited 2026-06-01). Use
 *   {@link useUpdatePOStatus} with `PurchaseOrderStatus.cancelled` to
 *   achieve the same user-facing outcome. This hook will be removed once
 *   all consumers migrate.
 */
export const useDeletePurchaseOrder = () => {
  return useMutation({
    mutationFn: async (_id: number): Promise<void> => {
      throw new Error(
        'Delete is not supported by the backend (no DELETE /purchase-orders/web/{id} endpoint). Use status transition CANCELLED via useUpdatePOStatus instead.'
      );
    },
    onError: (error) =>
      logger.error('Failed to delete purchase order:', error),
  });
};

/**
 * Transitions a purchase order to a new lifecycle state via the dedicated
 * status endpoint.
 *
 * Backend response per spec: `ApiResponse` (ack only). The service
 * tolerantly parses the response through {@link parsePurchaseOrder} in
 * case the backend upgrades to returning the full entity; this hook
 * branches on `data.id` at runtime to handle either shape.
 *
 * On success — full-entity branch (`data.id` is a number):
 * - `setQueryData(poKeys.detail(id), data)` — patches the detail cache
 *   directly.
 * - `setQueriesData({ predicate: isPurchaseOrderListCache }, replace)` —
 *   mirrors the update across every `PurchaseOrder[]` list cache.
 * - `invalidateQueries(vendorKeys.summary(vendorId))` — kept
 *   (cross-namespace): status change can shift vendor rollups.
 *
 * On success — ack-only branch (server returned no usable entity):
 * - Reads the cached detail; if present, builds a `patched` PO with the
 *   new `status` and applies the same detail + list patch as above, then
 *   invalidates the vendor summary using the cached `vendorId`.
 * - If no cached detail exists, falls back to
 *   `invalidateQueries(poKeys.detail(id))` so the next observer fetches.
 *
 * Always:
 * - `invalidateQueries({ predicate: q.queryKey[1] === 'status' })` —
 *   kept: the PO has likely moved between `byStatus(old)` and
 *   `byStatus(new)` buckets. `setQueriesData` only mutates entries
 *   already cached in a list, so the destination bucket needs a refetch
 *   to pull the entry in.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; status: PurchaseOrderStatus }`.
 */
export const useUpdatePOStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: PurchaseOrderStatus }) =>
      purchaseOrdersService.updateStatus(id, status),
    onSuccess: (data, { id, status }) => {
      // PATCH /purchase-orders/web/{id}/status → ApiResponse (ack) per spec.
      // Service `updateStatus` parses the response as PurchaseOrder — same
      // drift pattern as useActivateLeavePolicy. Guard the patch:
      //   - If `data.id` is present, treat as the updated PO and patch.
      //   - Otherwise, patch the status field locally + invalidate the
      //     status-scoped list (entry should move between byStatus buckets).
      // FIXME: confirm backend response shape; align service signature
      // (Promise<void>) if spec is authoritative.
      const cachedDetail = queryClient.getQueryData<PurchaseOrder>(
        poKeys.detail(id)
      );

      if (data && typeof data.id === 'number') {
        queryClient.setQueryData(poKeys.detail(id), data);
        queryClient.setQueriesData<PurchaseOrder[]>(
          { predicate: isPurchaseOrderListCache },
          (old) => old?.map((p) => (p.id === id ? data : p))
        );
        if (data.vendorId !== undefined) {
          queryClient.invalidateQueries({
            queryKey: vendorKeys.summary(data.vendorId),
          });
        }
      } else if (cachedDetail) {
        // Service drift fallback: patch the status field on the cached PO.
        const patched: PurchaseOrder = { ...cachedDetail, status };
        queryClient.setQueryData(poKeys.detail(id), patched);
        queryClient.setQueriesData<PurchaseOrder[]>(
          { predicate: isPurchaseOrderListCache },
          (old) => old?.map((p) => (p.id === id ? patched : p))
        );
        if (cachedDetail.vendorId !== undefined) {
          queryClient.invalidateQueries({
            queryKey: vendorKeys.summary(cachedDetail.vendorId),
          });
        }
      } else {
        // No cached detail to patch from — invalidate scoped lists.
        queryClient.invalidateQueries({ queryKey: poKeys.detail(id) });
      }

      // The PO may have moved between byStatus(old) and byStatus(new) buckets.
      // setQueriesData replace works wherever it's currently cached, but the
      // OTHER status bucket (the new one) won't get the entry inserted by a
      // replace — invalidate all byStatus caches so they refetch the next time
      // they're observed.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'purchase-orders' &&
          q.queryKey[1] === 'status',
      });
    },
    onError: (error) =>
      logger.error('Failed to update purchase order status:', error),
  });
};
