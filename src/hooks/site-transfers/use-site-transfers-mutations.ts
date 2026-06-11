/**
 * @module use-site-transfers-mutations
 *
 * TanStack mutation hooks for the site-transfers domain — create,
 * status transition, and a deprecated delete stub. Read-side hooks
 * live in {@link useSiteTransfers}, {@link useSiteTransfersPaginated},
 * {@link useSiteTransfer}, {@link useSiteTransfersByStatus},
 * {@link useSiteTransfersBySendingProject}, and
 * {@link useSiteTransfersByReceivingProject}.
 *
 * Creating a transfer decrements stock at the sending location and a
 * subsequent status transition can increment stock at the destination;
 * each side-effect writes inventory-transaction ledger entries. The
 * `onSuccess` of the affected mutations invalidates the relevant
 * materials-stock and inventory-transactions caches accordingly.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { siteTransfersService } from '../../services/site-transfers-service';
import { siteTransferKeys } from './keys';
import { ApiError } from '../../lib/api/api-client';
import {
  CreateSiteTransferRequest,
  SiteTransfer,
  SiteTransferStatus,
} from '../../types/site-transfers';
import { logger } from '../../lib/logger';
import { materialsKeys } from '../materials';
import { inventoryTransactionKeys } from '../inventory-transactions';

/**
 * Matches every `SiteTransfer[]` list cache under the `site-transfers`
 * namespace — `lists()`, `paginated({...})`, `byStatus(s)`,
 * `bySendingProject(id)`, and `byReceivingProject(id)`. Excludes only
 * `detail(id)`, which is patched directly by ID.
 *
 * @param query - The TanStack query whose key is being tested.
 * @returns `true` when the key belongs to a site-transfer list cache.
 */
function isSiteTransferListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) && key[0] === 'site-transfers' && key[1] !== 'detail'
  );
}

/**
 * Non-functional stub. The backend does not expose
 * `DELETE /site-transfers/web/{id}`, so this hook rejects with a
 * descriptive error the moment it is invoked — no request is issued.
 *
 * @returns A TanStack `UseMutationResult` whose `mutate` always rejects.
 *
 * @deprecated Backend has no delete endpoint (audited 2026-06-01).
 *   Deletion would require server-side stock unwinding — the source
 *   decrement on create, plus the destination increment if the
 *   transfer has already advanced to {@link SiteTransferStatus.completed} —
 *   and those reversals cannot be silently inferred. Coordinate with
 *   the backend team to add either a true delete with reversal
 *   semantics or a `CANCELLED` status transition before reviving this
 *   hook. This stub will be removed once all consumers migrate.
 */
export const useDeleteSiteTransfer = () => {
  return useMutation({
    mutationFn: async (_id: number): Promise<void> => {
      throw new Error(
        'Delete is not supported by the backend (no DELETE /site-transfers/web/{id} endpoint). Deletion would require stock unwinding at source and destination; coordinate with the backend team.'
      );
    },
    onError: (error) =>
      logger.error('Failed to delete site transfer:', error),
  });
};

/**
 * Creates a new site transfer together with its line items. Posting
 * the transfer decrements stock at the sending location and writes
 * inventory-transaction ledger entries server-side; the `onSuccess`
 * invalidates every cache those side-effects can have touched.
 *
 * Backend response: `SiteTransferDto` (full, with `items` populated).
 *
 * On success:
 * - `setQueryData(siteTransferKeys.detail(newTransfer.id), newTransfer)` —
 *   seeds the detail cache (including embedded items) so an immediate
 *   navigation to the new transfer renders without a refetch.
 * - `setQueryData(siteTransferKeys.lists(), append)` — appends the
 *   new transfer to the unpaginated list.
 * - `invalidateQueries({ predicate: paginated OR status OR sending-project OR receiving-project })` —
 *   kept: each scoped list applies a server-side filter that direct
 *   append can't reproduce safely (paginated views depend on
 *   sort/page; `byStatus` depends on the new transfer's status bucket;
 *   `sending-project` / `receiving-project` require scope-id match).
 * - `invalidateQueries(materialsKeys.stock(materialId))` for every
 *   item — kept (cross-namespace): the material stock view is a
 *   different shape than `Material` (it carries
 *   `MaterialWithStockDto` fields); only a refetch can produce the new
 *   sending-location-decremented stock levels.
 * - `invalidateQueries(inventoryTransactionKeys.all)` — kept
 *   (cross-namespace): the transfer writes one inventory-transaction
 *   row per item at the source, and those rows can land in any of the
 *   inventory-transactions sub-namespaces (`byMaterial`,
 *   `byStorageLocation`, `byDateRange`, `paginated`, …). Invalidating
 *   the namespace root is broad but correct.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreateSiteTransferRequest}.
 */
export const useCreateSiteTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSiteTransferRequest) =>
      siteTransfersService.create(dto),
    onSuccess: (newTransfer) => {
      // POST /site-transfers/web → SiteTransferDto (full).
      // Seed detail + append to main list. Scoped lists invalidated because
      // each has different semantics (sort/page for paginated; status of new
      // transfer for byStatus; project scope for sending/receiving).
      queryClient.setQueryData(
        siteTransferKeys.detail(newTransfer.id),
        newTransfer
      );
      queryClient.setQueryData<SiteTransfer[]>(
        siteTransferKeys.lists(),
        (old) => (old ? [...old, newTransfer] : [newTransfer])
      );
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'site-transfers' &&
          (q.queryKey[1] === 'paginated' ||
            q.queryKey[1] === 'status' ||
            q.queryKey[1] === 'sending-project' ||
            q.queryKey[1] === 'receiving-project'),
      });

      // Cross-namespace: creating a site transfer decrements stock at the
      // source storage location. Invalidate material stock for each item's
      // material; `MaterialWithStockDto` shape differs from `Material`, so
      // can't be patched from a SiteTransfer response.
      for (const item of newTransfer.items) {
        if (item.materialId !== undefined) {
          queryClient.invalidateQueries({
            queryKey: materialsKeys.stock(item.materialId),
          });
        }
      }

      // Cross-namespace: a site transfer writes new inventory-transaction
      // rows for the source decrement. Invalidate the inventory-transactions
      // namespace so byMaterial / byStorageLocation / byProject scoped views
      // refresh.
      queryClient.invalidateQueries({
        queryKey: inventoryTransactionKeys.all,
      });
    },
    onError: (error) => {
      logger.error('Failed to create site transfer:', error);
    },
  });
};

/**
 * Transitions a site transfer to a new lifecycle state via the
 * dedicated status endpoint.
 *
 * Backend response per spec: `ApiResponse` (ack only). The service
 * tolerantly parses the response through {@link parseSiteTransfer} in
 * case the backend upgrades to returning the full entity; this hook
 * branches on `data.id` at runtime to handle either shape.
 *
 * On success — full-entity branch (`data.id` is a number):
 * - `setQueryData(siteTransferKeys.detail(id), data)` — patches the
 *   detail cache directly with the server-returned transfer.
 * - `setQueriesData({ predicate: isSiteTransferListCache }, replace)` —
 *   mirrors the update across every `SiteTransfer[]` list cache
 *   (`list`, `paginated`, `status`, `sending-project`,
 *   `receiving-project`) in a single pass.
 *
 * On success — ack-only branch (server returned no usable entity):
 * - Reads the cached detail; if present, builds a `patched` transfer
 *   with the new `status` and applies the same detail + list patch as
 *   above.
 * - If no cached detail exists, falls back to
 *   `invalidateQueries(siteTransferKeys.detail(id))` so the next
 *   observer fetches.
 *
 * Always:
 * - `invalidateQueries({ predicate: key[1] === 'status' })` — kept:
 *   the transfer has likely moved between `byStatus(old)` and
 *   `byStatus(new)` buckets. `setQueriesData` only mutates entries
 *   already cached in a list, so the destination bucket needs a
 *   refetch to pull the entry in.
 * - `invalidateQueries(materialsKeys.stock(materialId))` for every
 *   item on the cached detail — kept (cross-namespace): a transition
 *   to {@link SiteTransferStatus.completed} (or back) changes
 *   destination stock and may also undo the source decrement;
 *   `MaterialWithStockDto` is a different shape than `Material` and
 *   can't be patched from a `SiteTransfer` response.
 * - `invalidateQueries(inventoryTransactionKeys.all)` — kept
 *   (cross-namespace): a transition can write destination-increment
 *   inventory-transaction rows (and other transitions may also append
 *   to the log); invalidating the namespace root keeps every scoped
 *   view consistent.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; status: SiteTransferStatus }`.
 */
export const useUpdateSiteTransferStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: SiteTransferStatus }) =>
      siteTransfersService.updateStatus(id, status),
    onSuccess: (data, { id, status }) => {
      // PATCH /site-transfers/web/{id}/status → ApiResponse (ack) per spec.
      // Service `updateStatus` parses the response as SiteTransfer — same
      // drift pattern as useActivateLeavePolicy / useUpdatePOStatus.
      // Three-way fallback:
      //   1. If `data.id` is present, treat as the updated transfer + patch.
      //   2. Otherwise patch the status field on the cached detail.
      //   3. If neither has a usable shape, invalidate the detail.
      // FIXME: confirm backend response shape; align service signature
      // (Promise<void>) if spec is authoritative.
      const cachedDetail = queryClient.getQueryData<SiteTransfer>(
        siteTransferKeys.detail(id)
      );

      if (data && typeof data.id === 'number') {
        queryClient.setQueryData(siteTransferKeys.detail(id), data);
        queryClient.setQueriesData<SiteTransfer[]>(
          { predicate: isSiteTransferListCache },
          (old) => old?.map((t) => (t.id === id ? data : t))
        );
      } else if (cachedDetail) {
        const patched: SiteTransfer = { ...cachedDetail, status };
        queryClient.setQueryData(siteTransferKeys.detail(id), patched);
        queryClient.setQueriesData<SiteTransfer[]>(
          { predicate: isSiteTransferListCache },
          (old) => old?.map((t) => (t.id === id ? patched : t))
        );
      } else {
        queryClient.invalidateQueries({
          queryKey: siteTransferKeys.detail(id),
        });
      }

      // Status changed — the transfer may have moved between byStatus(old)
      // and byStatus(new) buckets. predicate-replace updates wherever the
      // transfer is currently cached but doesn't insert into the new bucket;
      // invalidate all byStatus caches as the safety net.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'site-transfers' &&
          q.queryKey[1] === 'status',
      });

      // Cross-namespace: a status transition to RECEIVED (or back) changes
      // destination stock. Without knowing the exact state machine, invalidate
      // stock for every item's material on any status change — both source
      // and destination are this material's stock view.
      const itemsForStock = cachedDetail?.items ?? [];
      for (const item of itemsForStock) {
        if (item.materialId !== undefined) {
          queryClient.invalidateQueries({
            queryKey: materialsKeys.stock(item.materialId),
          });
        }
      }

      // Cross-namespace: a RECEIVED transition writes destination-increment
      // inventory-transaction rows. Other transitions may also affect the
      // log depending on the backend. Invalidate the entire namespace.
      queryClient.invalidateQueries({
        queryKey: inventoryTransactionKeys.all,
      });
    },
    onError: (error) =>
      logger.error('Failed to update site transfer status:', error),
  });
};
