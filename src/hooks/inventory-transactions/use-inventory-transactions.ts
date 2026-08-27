/**
 * @module use-inventory-transactions
 *
 * TanStack Query hooks for reading inventory transactions and stock
 * roll-ups. The domain is read-only — transactions are written by
 * backend events (GRN, consumption, site transfer, stock-take, …) and
 * there are no mutation hooks.
 *
 * None of the query hooks below spread a profile from
 * `lib/query/options`; they inherit the host `QueryClient`'s defaults
 * (mirroring the **standard** profile of `staleTime` 60 s / `gcTime`
 * 5 min when the host uses the recommended setup).
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { inventoryTransactionsService } from '../../services/inventory-transactions-service';
import { InventoryTransactionType } from '../../types/inventory-transactions';
import { inventoryTransactionKeys } from './keys';

/**
 * Fetches a page of inventory transactions.
 *
 * @param pageNo - Zero-based page number. Defaults to `0`.
 * @param pageSize - Number of entries per page. Defaults to `10`.
 * @returns A TanStack `UseQueryResult` wrapping
 *   `InventoryTransaction[]` for the page.
 */
export const useInventoryTransactions = (pageNo = 0, pageSize = 10) =>
  useQuery({
    queryKey: inventoryTransactionKeys.paginated(pageNo, pageSize),
    queryFn: () =>
      inventoryTransactionsService.getAllPaginated(pageNo, pageSize),
  });

/**
 * Fetches a single inventory transaction by ID. The query is disabled
 * until `id` is truthy.
 *
 * @param id - Surrogate ID of the transaction. Pass `0` (or any falsy
 *   value) to defer the query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping a single
 *   `InventoryTransaction`.
 */
export const useInventoryTransaction = (id: number) =>
  useQuery({
    queryKey: inventoryTransactionKeys.detail(id),
    queryFn: () => inventoryTransactionsService.getById(id),
    enabled: !!id,
  });

/**
 * Fetches every transaction recorded against a given material. The
 * query is disabled until `materialId` is truthy.
 *
 * @param materialId - Surrogate ID of the material.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `InventoryTransaction[]`.
 */
export const useInventoryTransactionsByMaterial = (materialId: number) =>
  useQuery({
    queryKey: inventoryTransactionKeys.byMaterial(materialId),
    queryFn: () => inventoryTransactionsService.getByMaterial(materialId),
    enabled: !!materialId,
  });

/**
 * Fetches a page of a material's movement history, ordered oldest
 * movement first by the server. The query is disabled until
 * `materialId` is truthy.
 *
 * `keepPreviousData` keeps the movements already on screen visible
 * while a larger page or the next page loads, so the timeline grows
 * rather than blanking out.
 *
 * @param materialId - Surrogate ID of the material.
 * @param pageNo - Zero-based page number. Defaults to `0`.
 * @param pageSize - Number of movements per page. Defaults to `10`.
 * @returns A TanStack `UseQueryResult` wrapping a
 *   `PagedMaterialMovementHistory`.
 */
export const useMaterialMovementHistory = (
  materialId: number,
  pageNo = 0,
  pageSize = 10
) =>
  useQuery({
    queryKey: inventoryTransactionKeys.materialHistory(
      materialId,
      pageNo,
      pageSize
    ),
    queryFn: () =>
      inventoryTransactionsService.getMaterialMovementHistory(
        materialId,
        pageNo,
        pageSize
      ),
    enabled: !!materialId,
    placeholderData: keepPreviousData,
  });

/**
 * Fetches every transaction in a given lifecycle classification. The
 * query is disabled until `type` is truthy.
 *
 * @param type - The {@link InventoryTransactionType} bucket to filter
 *   by.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `InventoryTransaction[]`.
 */
export const useInventoryTransactionsByType = (
  type: InventoryTransactionType
) =>
  useQuery({
    queryKey: inventoryTransactionKeys.byType(type),
    queryFn: () => inventoryTransactionsService.getByType(type),
    enabled: !!type,
  });

/**
 * Fetches every transaction whose `transactionDate` falls within an
 * inclusive ISO-8601 date range. The query is disabled until both
 * dates are truthy.
 *
 * @param startDate - ISO 8601 lower bound (inclusive).
 * @param endDate - ISO 8601 upper bound (inclusive).
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `InventoryTransaction[]`.
 */
export const useInventoryTransactionsByDateRange = (
  startDate: string,
  endDate: string
) =>
  useQuery({
    queryKey: inventoryTransactionKeys.byDateRange(startDate, endDate),
    queryFn: () =>
      inventoryTransactionsService.getByDateRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });

/**
 * Fetches the per-location stock roll-up for a single material. The
 * query is disabled until `materialId` is truthy.
 *
 * @param materialId - Surrogate ID of the material.
 * @returns A TanStack `UseQueryResult` wrapping a {@link MaterialStock}.
 */
export const useMaterialStock = (materialId: number) =>
  useQuery({
    queryKey: inventoryTransactionKeys.materialStock(materialId),
    queryFn: () => inventoryTransactionsService.getMaterialStock(materialId),
    enabled: !!materialId,
  });

/**
 * Fetches the per-material stock roll-up for a single storage
 * location. The query is disabled until `storageLocationId` is truthy.
 *
 * @param storageLocationId - Surrogate ID of the storage location.
 * @returns A TanStack `UseQueryResult` wrapping a
 *   {@link StorageLocationStock}.
 */
export const useStorageLocationStock = (storageLocationId: number) =>
  useQuery({
    queryKey: inventoryTransactionKeys.storageLocationStock(storageLocationId),
    queryFn: () =>
      inventoryTransactionsService.getStorageLocationStock(storageLocationId),
    enabled: !!storageLocationId,
  });

/**
 * Fetches every transaction recorded against a given storage location.
 * The query is disabled until `storageLocationId` is truthy.
 *
 * @param storageLocationId - Surrogate ID of the storage location.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `InventoryTransaction[]`.
 */
export const useInventoryTransactionsByStorageLocation = (
  storageLocationId: number
) =>
  useQuery({
    queryKey: inventoryTransactionKeys.byStorageLocation(storageLocationId),
    queryFn: () =>
      inventoryTransactionsService.getByStorageLocation(storageLocationId),
    enabled: !!storageLocationId,
  });

/**
 * Fetches every transaction matching the full scope tuple of
 * (storage location, material, project). The query is disabled until
 * all three IDs are truthy.
 *
 * @param storageLocationId - Surrogate ID of the storage location.
 * @param materialId - Surrogate ID of the material.
 * @param projectId - Surrogate ID of the project.
 * @returns A TanStack `UseQueryResult` wrapping the matching
 *   `InventoryTransaction[]`.
 */
export const useInventoryTransactionsByStorageLocationAndMaterial = (
  storageLocationId: number,
  materialId: number,
  projectId: number
) =>
  useQuery({
    queryKey: inventoryTransactionKeys.byStorageLocationAndMaterial(
      storageLocationId,
      materialId,
      projectId
    ),
    queryFn: () =>
      inventoryTransactionsService.getByStorageLocationAndMaterial(
        storageLocationId,
        materialId,
        projectId
      ),
    enabled: !!storageLocationId && !!materialId && !!projectId,
  });

export { inventoryTransactionKeys } from './keys';
