/**
 * @module inventory-transaction-keys
 *
 * TanStack Query key factory for the inventory-transactions domain.
 *
 * Key shapes:
 * - `['inventory-transactions']` — namespace root, invalidation prefix
 *   only; never used as a query key directly.
 * - `['inventory-transactions', 'list']` — the unpaginated transaction
 *   list (no consumer currently calls
 *   `inventoryTransactionsService.getAll`; reserved for future use).
 * - `['inventory-transactions', 'detail', id]` — a single transaction
 *   by ID, consumed by {@link useInventoryTransaction}.
 * - `['inventory-transactions', 'paginated', { pageNo, pageSize }]` —
 *   paginated list, consumed by {@link useInventoryTransactions}.
 * - `['inventory-transactions', 'material', materialId]` — transactions
 *   for one material, consumed by
 *   {@link useInventoryTransactionsByMaterial}.
 * - `['inventory-transactions', 'material', materialId, 'stock']` —
 *   per-location stock roll-up for one material, consumed by
 *   {@link useMaterialStock}.
 * - `['inventory-transactions', 'storage-location', storageLocationId]` —
 *   transactions for one storage location, consumed by
 *   {@link useInventoryTransactionsByStorageLocation}.
 * - `['inventory-transactions', 'storage-location', storageLocationId,
 *   'stock']` — per-material stock roll-up for one location, consumed
 *   by {@link useStorageLocationStock}.
 * - `['inventory-transactions', 'storage-location', slId, 'material',
 *   matId, 'project', projId]` — transactions matching the full
 *   (location, material, project) scope tuple, consumed by
 *   {@link useInventoryTransactionsByStorageLocationAndMaterial}.
 * - `['inventory-transactions', 'type', type]` — transactions in a
 *   given lifecycle bucket, consumed by
 *   {@link useInventoryTransactionsByType}.
 * - `['inventory-transactions', 'date-range', startDate, endDate]` —
 *   transactions whose `transactionDate` falls in an inclusive ISO
 *   date range, consumed by
 *   {@link useInventoryTransactionsByDateRange}.
 *
 * The domain has no mutation hooks (transactions are write-only from
 * the backend); there is no list-cache predicate to define here.
 */
import { InventoryTransactionType } from '../../types/inventory-transactions';

export const inventoryTransactionKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['inventory-transactions'] as const,

  /** Query key for the unpaginated transaction list. */
  lists: () => [...inventoryTransactionKeys.all, 'list'] as const,

  /** Query key for a single transaction by ID. */
  detail: (id: number) =>
    [...inventoryTransactionKeys.all, 'detail', id] as const,

  /** Query key for a paginated transaction list. */
  paginated: (pageNo: number, pageSize: number) =>
    [
      ...inventoryTransactionKeys.all,
      'paginated',
      { pageNo, pageSize },
    ] as const,

  /** Query key for transactions filtered by material. */
  byMaterial: (materialId: number) =>
    [...inventoryTransactionKeys.all, 'material', materialId] as const,

  /** Query key for the per-location stock roll-up for one material. */
  materialStock: (materialId: number) =>
    [...inventoryTransactionKeys.all, 'material', materialId, 'stock'] as const,

  /** Query key for transactions filtered by storage location. */
  byStorageLocation: (storageLocationId: number) =>
    [
      ...inventoryTransactionKeys.all,
      'storage-location',
      storageLocationId,
    ] as const,

  /** Query key for the per-material stock roll-up for one location. */
  storageLocationStock: (storageLocationId: number) =>
    [
      ...inventoryTransactionKeys.all,
      'storage-location',
      storageLocationId,
      'stock',
    ] as const,

  /**
   * Query key for the narrow (location, material, project) scope tuple
   * used by audit listings.
   */
  byStorageLocationAndMaterial: (
    storageLocationId: number,
    materialId: number,
    projectId: number
  ) =>
    [
      ...inventoryTransactionKeys.all,
      'storage-location',
      storageLocationId,
      'material',
      materialId,
      'project',
      projectId,
    ] as const,

  /** Query key for transactions in a given {@link InventoryTransactionType} bucket. */
  byType: (type: InventoryTransactionType) =>
    [...inventoryTransactionKeys.all, 'type', type] as const,

  /** Query key for transactions whose `transactionDate` falls in an inclusive ISO date range. */
  byDateRange: (startDate: string, endDate: string) =>
    [
      ...inventoryTransactionKeys.all,
      'date-range',
      startDate,
      endDate,
    ] as const,
};
