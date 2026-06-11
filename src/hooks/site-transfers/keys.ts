/**
 * @module site-transfer-keys
 *
 * TanStack Query key factory for the site-transfers domain.
 *
 * Key shapes:
 * - `['site-transfers']` — namespace root, invalidation prefix only;
 *   never used as a query key directly.
 * - `['site-transfers', 'list']` — the unpaginated transfer list,
 *   consumed by {@link useSiteTransfers}.
 * - `['site-transfers', 'detail', id]` — a single transfer by ID,
 *   consumed by {@link useSiteTransfer}. The detail cache is the
 *   source of truth for embedded `items`.
 * - `['site-transfers', 'paginated', { pageNo, pageSize }]` —
 *   paginated list, consumed by {@link useSiteTransfersPaginated}.
 * - `['site-transfers', 'status', status]` — transfers in a given
 *   lifecycle bucket, consumed by {@link useSiteTransfersByStatus}.
 * - `['site-transfers', 'sending-project', projectId]` — transfers
 *   originating from one project, consumed by
 *   {@link useSiteTransfersBySendingProject}.
 * - `['site-transfers', 'receiving-project', projectId]` — transfers
 *   destined for one project, consumed by
 *   {@link useSiteTransfersByReceivingProject}.
 *
 * The mutation file's `isSiteTransferListCache` predicate matches
 * every `SiteTransfer[]` list cache (`list`, `paginated`, `status`,
 * `sending-project`, `receiving-project`) but excludes `detail` — see
 * the mutation hooks for the cache-strategy details.
 */
import { SiteTransferStatus } from '../../types/site-transfers';

export const siteTransferKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['site-transfers'] as const,

  /** Query key for the unpaginated transfer list. */
  lists: () => [...siteTransferKeys.all, 'list'] as const,

  /** Query key for a single transfer by ID (carries the embedded `items` array). */
  detail: (id: number) => [...siteTransferKeys.all, 'detail', id] as const,

  /** Query key for a paginated transfer list. */
  paginated: (pageNo: number, pageSize: number) =>
    [...siteTransferKeys.all, 'paginated', { pageNo, pageSize }] as const,

  /** Query key for transfers in a given {@link SiteTransferStatus} bucket. */
  byStatus: (status: SiteTransferStatus) =>
    [...siteTransferKeys.all, 'status', status] as const,

  /** Query key for transfers originating from a given project. */
  bySendingProject: (projectId: number) =>
    [...siteTransferKeys.all, 'sending-project', projectId] as const,

  /** Query key for transfers destined for a given project. */
  byReceivingProject: (projectId: number) =>
    [...siteTransferKeys.all, 'receiving-project', projectId] as const,
};
