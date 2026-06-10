/**
 * @module purchase-order-keys
 *
 * TanStack Query key factory for the purchase-orders domain.
 *
 * Key shapes:
 * - `['purchase-orders']` — namespace root, invalidation prefix only;
 *   never used as a query key directly.
 * - `['purchase-orders', 'list']` — the unpaginated PO list, consumed by
 *   {@link usePurchaseOrders}.
 * - `['purchase-orders', 'detail', id]` — a single PO by ID, consumed by
 *   {@link usePurchaseOrder}. The detail cache is the source of truth for
 *   embedded `items`; line-item mutations patch this entry.
 * - `['purchase-orders', 'paginated', { pageNo, pageSize }]` — paginated
 *   list, consumed by {@link usePurchaseOrdersPaginated}.
 * - `['purchase-orders', 'vendor', vendorId]` — POs filtered by vendor,
 *   consumed by {@link usePOsByVendor}.
 * - `['purchase-orders', 'indent', indentId]` — POs originating from one
 *   indent, consumed by {@link usePOsByIndent}.
 * - `['purchase-orders', 'status', status]` — POs in a given lifecycle
 *   state, consumed by {@link usePOsByStatus}.
 *
 * The mutation file's `isPurchaseOrderListCache` predicate matches every
 * `PurchaseOrder[]` list cache (`list`, `paginated`, `vendor`, `indent`,
 * `status`) but excludes `detail` — see the mutation hooks for the
 * cache-strategy details.
 */
import { PurchaseOrderStatus } from '../../types/purchase-orders';

export const poKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['purchase-orders'] as const,

  /** Query key for the unpaginated PO list. */
  lists: () => [...poKeys.all, 'list'] as const,

  /** Query key for a single PO by ID (carries the embedded `items` array). */
  detail: (id: number) => [...poKeys.all, 'detail', id] as const,

  /** Query key for a paginated PO list. */
  paginated: (pageNo: number, pageSize: number) =>
    [...poKeys.all, 'paginated', { pageNo, pageSize }] as const,

  /** Query key for POs filtered by vendor. */
  byVendor: (vendorId: number) => [...poKeys.all, 'vendor', vendorId] as const,

  /** Query key for POs filtered by originating indent. */
  byIndent: (indentId: number) => [...poKeys.all, 'indent', indentId] as const,

  /** Query key for POs in a given {@link PurchaseOrderStatus} bucket. */
  byStatus: (status: PurchaseOrderStatus) =>
    [...poKeys.all, 'status', status] as const,
};
