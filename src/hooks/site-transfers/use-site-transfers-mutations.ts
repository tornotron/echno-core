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
import { isSiteTransferListCache } from './cache-predicates';
import { ApiError } from '../../lib/api/api-client';
import {
  CreateSiteTransferRequest,
  SiteTransfer,
  SiteTransferStatus,
  ReceiveSiteTransferRequest,
  CancelSiteTransferRequest,
} from '../../types/site-transfers';
import { logger } from '../../lib/logger';
import { materialsKeys } from '../materials';
import { inventoryTransactionKeys } from '../inventory-transactions';

/**
 * Applies a transfer the server has just returned to every cache that can hold
 * it, and drops everything the movements it wrote have invalidated.
 *
 * Shared by the receipt and the cancellation because the two have identical
 * cache consequences: both move the transfer's status, both write inventory
 * movements against the lines' materials, and both append to the status trail.
 *
 * @param queryClient - The client to patch.
 * @param transfer - The transfer as the server now reports it.
 */
function applyMovedTransfer(
  queryClient: ReturnType<typeof useQueryClient>,
  transfer: SiteTransfer
): void {
  queryClient.setQueryData(siteTransferKeys.detail(transfer.id), transfer);
  queryClient.setQueriesData<SiteTransfer[]>(
    { predicate: isSiteTransferListCache },
    (old) => old?.map((t) => (t.id === transfer.id ? transfer : t))
  );

  // The transfer has moved between byStatus buckets. setQueriesData only
  // rewrites entries already cached in a list; the destination bucket has to
  // refetch to pull it in.
  queryClient.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) &&
      q.queryKey[0] === 'site-transfers' &&
      q.queryKey[1] === 'status',
  });

  // The status moved, so the trail has a new entry. It is append-only and
  // paged, so refetch rather than guess at the entry the server wrote.
  queryClient.invalidateQueries({
    queryKey: siteTransferKeys.statusHistories(transfer.id),
  });

  // Cross-namespace: both a receipt and a cancellation post real movements.
  // MaterialWithStockDto is a different shape from anything a SiteTransfer
  // carries, so only a refetch produces the new balances.
  for (const item of transfer.items) {
    if (item.materialId !== undefined) {
      queryClient.invalidateQueries({
        queryKey: materialsKeys.stock(item.materialId),
      });
    }
  }
  queryClient.invalidateQueries({ queryKey: inventoryTransactionKeys.all });
}

/**
 * Drops the cached copy of a transfer whose mutation the server refused.
 *
 * Nothing was written, but the server has just read the transfer to judge the
 * request, and the refusal is usually about a figure the client was reasoning
 * from: an over-receipt is judged against what has already arrived, and a
 * cancellation against whether anything has. Leaving the stale copy in place
 * is how a page goes on offering an action the server has already refused, and
 * how an acknowledgement gets given against figures that have since moved.
 *
 * @param queryClient - The client to invalidate against.
 * @param id - Surrogate ID of the transfer the request named.
 */
function dropRefusedTransfer(
  queryClient: ReturnType<typeof useQueryClient>,
  id: number
): void {
  queryClient.invalidateQueries({ queryKey: siteTransferKeys.detail(id) });
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
 * @deprecated Since echno-backend#660 this endpoint refuses every status it
 *   is handed, so this hook can only ever reach its `onError`. A transfer is
 *   moved on by recording what arrived ({@link useReceiveSiteTransfer}) or by
 *   abandoning it in transit ({@link useCancelSiteTransfer}). Kept so an
 *   existing caller still compiles while it migrates.
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

/**
 * Records what the receiving site took delivery of, posting the stock that
 * arrived and letting the server derive the transfer's new status.
 *
 * Backend response: `SiteTransferDto` (full, with `receivedQuantity` and
 * `inTransitQuantity` on every line).
 *
 * Two refusals need different handling by the caller, and neither is a fault
 * this hook can resolve on its own:
 *
 * - **Over-receipt** comes back as a 400 whose message names `allowOverReceipt`
 *   along with the line and the figures. It is a decision to put to the person
 *   filing the receipt, who resubmits the same payload with
 *   {@link ReceiveSiteTransferRequest.allowOverReceipt} set.
 * - **A shortfall is not refused at all** and needs no acknowledgement. The gap
 *   comes back as each line's `inTransitQuantity`, an open variance a stock
 *   adjustment closes.
 *
 * On success it applies the returned transfer to the detail and list caches,
 * invalidates the byStatus buckets, the status trail, every line's material
 * stock and the inventory-transactions namespace.
 *
 * On failure it drops the cached detail, so the next render reasons from what
 * the server actually holds rather than from the figures that provoked the
 * refusal.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts
 *   `{ id: number; receipt: ReceiveSiteTransferRequest }`.
 */
export const useReceiveSiteTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      receipt,
    }: {
      id: number;
      receipt: ReceiveSiteTransferRequest;
    }) => siteTransfersService.receive(id, receipt),
    onSuccess: (transfer) => applyMovedTransfer(queryClient, transfer),
    onError: (error: ApiError, { id }) => {
      dropRefusedTransfer(queryClient, id);
      logger.error('Failed to record a site transfer receipt:', error);
    },
  });
};

/**
 * Abandons a transfer that never arrived, returning the whole sent quantity to
 * the sending location.
 *
 * Backend response: `SiteTransferDto` (full), now
 * {@link SiteTransferStatus.cancelled}.
 *
 * Only a {@link SiteTransferStatus.pending} transfer can be cancelled; any
 * other state is refused with a 400. On failure the cached detail is dropped,
 * because a refusal here usually means somebody else has received against the
 * transfer since the page loaded, and the stale copy is exactly what would
 * keep the cancel button on screen.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts
 *   `{ id: number; cancellation: CancelSiteTransferRequest }`.
 */
export const useCancelSiteTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      cancellation,
    }: {
      id: number;
      cancellation: CancelSiteTransferRequest;
    }) => siteTransfersService.cancel(id, cancellation),
    onSuccess: (transfer) => applyMovedTransfer(queryClient, transfer),
    onError: (error: ApiError, { id }) => {
      dropRefusedTransfer(queryClient, id);
      logger.error('Failed to cancel a site transfer:', error);
    },
  });
};
