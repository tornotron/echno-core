/**
 * @module grn-keys
 *
 * TanStack Query key factory for the goods-received-notes (GRN)
 * domain.
 *
 * Key shapes:
 * - `['grn']` — namespace root, invalidation prefix only; never used
 *   as a query key directly.
 * - `['grn', 'list']` — the unpaginated GRN list, consumed by
 *   {@link useGRNs}.
 * - `['grn', 'detail', id]` — a single GRN by ID, consumed by
 *   {@link useGRN}. The detail cache is the source of truth for
 *   embedded `items`.
 * - `['grn', 'paginated', { pageNo, pageSize }]` — paginated list,
 *   consumed by {@link useGRNsPaginated}.
 * - `['grn', 'vendor', vendorId]` — GRNs filtered by vendor, consumed
 *   by {@link useGRNsByVendor}.
 * - `['grn', 'date-range', startDate, endDate]` — GRNs whose
 *   `receivedOn` falls in an inclusive ISO date range, consumed by
 *   {@link useGRNsByDateRange}.
 *
 * The mutation file's `isGrnListCache` predicate matches every
 * `GoodsReceivedNote[]` list cache (`list`, `paginated`, `vendor`,
 * `date-range`) but excludes `detail` — see the mutation hooks for the
 * cache-strategy details.
 */

export const grnKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['grn'] as const,

  /** Query key for the unpaginated GRN list. */
  lists: () => [...grnKeys.all, 'list'] as const,

  /** Query key for a single GRN by ID (carries the embedded `items` array). */
  detail: (id: number) => [...grnKeys.all, 'detail', id] as const,

  /** Query key for a paginated GRN list. */
  paginated: (pageNo: number, pageSize: number) =>
    [...grnKeys.all, 'paginated', { pageNo, pageSize }] as const,

  /** Query key for GRNs filtered by vendor. */
  byVendor: (vendorId: number) => [...grnKeys.all, 'vendor', vendorId] as const,

  /** Query key for GRNs whose `receivedOn` falls in an inclusive ISO date range. */
  byDateRange: (startDate: string, endDate: string) =>
    [...grnKeys.all, 'date-range', startDate, endDate] as const,
};
