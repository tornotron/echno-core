/**
 * @module inventory-transactions-service
 *
 * Read-only client for the inventory-transactions backend endpoints
 * under `/inventory-transactions/web`. Wraps `api.*` calls and parses
 * raw JSON into strongly-typed {@link InventoryTransaction} ledger
 * entries plus the {@link MaterialStock} / {@link StorageLocationStock}
 * roll-ups returned by the stock-summary endpoints.
 *
 * Transactions are written automatically by backend events (GRN,
 * consumption, site transfer, stock-take, …). No write endpoints
 * exist; this service exposes read operations only.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  InventoryTransaction,
  InventoryTransactionType,
  MaterialMovementHistoryEntry,
  MaterialStock,
  StorageLocationStock,
  parseInventoryTransaction,
  parseMaterialMovementHistoryEntry,
  parseMaterialStock,
  parseStorageLocationStock,
} from '../types/inventory-transactions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * Backend response shape audit:
 *
 *   GET    /inventory-transactions/web                                                                                  → InventoryTransactionDto[]  (full list)
 *   GET    /inventory-transactions/web/all?pageNo&pageSize                                                              → InventoryTransactionDto[]  (paginated; returned as plain array, no envelope)
 *   GET    /inventory-transactions/web/{id}                                                                             → InventoryTransactionDto    (full)
 *   GET    /inventory-transactions/web/material/{materialId}                                                            → InventoryTransactionDto[]  (full; filtered server-side by material, unordered)
 *   GET    /inventory-transactions/web/material/{materialId}/history?pageNo&pageSize                                    → Page<MaterialMovementHistoryDto> (timeline; ordered oldest first, paged)
 *   GET    /inventory-transactions/web/material/{materialId}/stock                                                      → MaterialStockDto           (per-location roll-up for one material)
 *   GET    /inventory-transactions/web/type/{type}                                                                      → InventoryTransactionDto[]  (full; filtered server-side by transaction type)
 *   GET    /inventory-transactions/web/date-range?startDate&endDate                                                     → InventoryTransactionDto[]  (full; filtered server-side by transactionDate range)
 *   GET    /inventory-transactions/web/storage-location/{storageLocationId}                                             → InventoryTransactionDto[]  (full; filtered server-side by storage location)
 *   GET    /inventory-transactions/web/storage-location/{storageLocationId}/stock                                       → StorageLocationStockDto    (per-material roll-up for one location)
 *   GET    /inventory-transactions/web/storage-location/{slId}/material/{matId}/project/{projId}                        → InventoryTransactionDto[]  (full; filtered server-side by location + material + project)
 *
 * No POST / PATCH / PUT / DELETE endpoints exist — transactions are
 * write-only from the server's side. Hooks intentionally omit
 * mutation factories.
 */

/**
 * Parses a single inventory-transaction payload, wrapping parser
 * failures in {@link ApiError} so callers receive a uniform error
 * shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link InventoryTransaction}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParse(data: Raw): InventoryTransaction {
  try {
    return parseInventoryTransaction(data);
  } catch (error) {
    logger.error('Failed to parse inventory transaction:', error);
    throw new ApiError('Failed to process inventory transaction data.', 422);
  }
}

/**
 * Parses an array of inventory-transaction payloads. Returns `[]` for
 * any non-array input (defensive against backend shape drift).
 *
 * @param data - The raw JSON array from the backend.
 * @returns An array of parsed {@link InventoryTransaction} objects.
 * @throws {ApiError} When any item fails parsing (HTTP 422).
 */
function safeParseAll(data: Raw[]): InventoryTransaction[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseInventoryTransaction(item));
  } catch (error) {
    logger.error('Failed to parse inventory transactions:', error);
    throw new ApiError('Failed to process inventory transactions data.', 422);
  }
}

/**
 * A parsed page of movement-history entries, mirroring the Spring
 * `Page<MaterialMovementHistoryDto>` envelope. Entries are ordered
 * oldest movement first, as served.
 */
export interface PagedMaterialMovementHistory {
  /** The movements on this page, oldest first. */
  content: MaterialMovementHistoryEntry[];
  /** Total movements recorded for the material across all pages. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
  /** Zero-based page index. */
  number: number;
  /** Page size. */
  size: number;
}

/**
 * Normalises a Spring `Page<MaterialMovementHistoryDto>` body (or a
 * bare array, for resilience) into a
 * {@link PagedMaterialMovementHistory} so callers always receive page
 * metadata.
 *
 * @param data - The raw JSON body from the backend.
 * @param pageSize - The page size that was requested, used as the
 *   fallback for a missing `size`.
 * @returns The parsed page.
 * @throws {ApiError} When an entry fails parsing (HTTP 422).
 */
function safeParseHistoryPage(
  data: Raw,
  pageSize: number
): PagedMaterialMovementHistory {
  const parseAll = (items: Raw[]): MaterialMovementHistoryEntry[] => {
    if (!Array.isArray(items)) return [];
    try {
      return items.map((item) => parseMaterialMovementHistoryEntry(item));
    } catch (error) {
      logger.error('Failed to parse material movement history:', error);
      throw new ApiError(
        'Failed to process material movement history data.',
        422
      );
    }
  };

  if (Array.isArray(data)) {
    const content = parseAll(data);
    return {
      content,
      totalElements: content.length,
      totalPages: 1,
      number: 0,
      size: pageSize,
    };
  }

  return {
    content: parseAll(data?.content ?? []),
    totalElements: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 0,
    number: data?.number ?? 0,
    size: data?.size ?? pageSize,
  };
}

export const inventoryTransactionsService = {
  /**
   * Fetches every inventory transaction unpaginated
   * (`GET /inventory-transactions/web`).
   *
   * @returns Every {@link InventoryTransaction} in the organisation.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getAll(): Promise<InventoryTransaction[]> {
    const data = await api.get<Raw[]>('/inventory-transactions/web');
    return safeParseAll(data);
  },

  /**
   * Fetches a page of inventory transactions
   * (`GET /inventory-transactions/web/all`). The backend returns a
   * plain array (no envelope); pagination metadata is not exposed.
   *
   * @param pageNo - Zero-based page number. Defaults to `0`.
   * @param pageSize - Number of entries per page. Defaults to `10`.
   * @returns The {@link InventoryTransaction}s for the requested page.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getAllPaginated(
    pageNo = 0,
    pageSize = 10
  ): Promise<InventoryTransaction[]> {
    const data = await api.get<Raw[]>('/inventory-transactions/web/all', {
      pageNo,
      pageSize,
    });
    return safeParseAll(data);
  },

  /**
   * Fetches a single inventory transaction by ID
   * (`GET /inventory-transactions/web/{id}`).
   *
   * @param id - Surrogate ID of the transaction.
   * @returns The {@link InventoryTransaction}.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getById(id: number): Promise<InventoryTransaction> {
    const data = await api.get<Raw>(`/inventory-transactions/web/${id}`);
    return safeParse(data);
  },

  /**
   * Fetches every transaction recorded against a given material
   * (`GET /inventory-transactions/web/material/{materialId}`).
   *
   * @param materialId - Surrogate ID of the material.
   * @returns The matching {@link InventoryTransaction}s.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getByMaterial(materialId: number): Promise<InventoryTransaction[]> {
    const data = await api.get<Raw[]>(
      `/inventory-transactions/web/material/${materialId}`
    );
    return safeParseAll(data);
  },

  /**
   * Fetches a page of a material's movement history
   * (`GET /inventory-transactions/web/material/{materialId}/history`).
   *
   * The server orders the movements oldest first and returns them one
   * page at a time, so the caller renders a forward-running timeline
   * without sorting client-side. Each entry is narrower than a full
   * {@link InventoryTransaction}: it carries the location, project,
   * movement type and its direction, the quantity changed, the stock
   * level either side of it, the timestamp, the source reference and
   * the name of whoever booked it, but no cost basis, remarks or task
   * link.
   *
   * @param materialId - Surrogate ID of the material.
   * @param pageNo - Zero-based page number. Defaults to `0`.
   * @param pageSize - Number of movements per page. Defaults to `10`.
   * @returns The requested page of movement-history entries.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getMaterialMovementHistory(
    materialId: number,
    pageNo = 0,
    pageSize = 10
  ): Promise<PagedMaterialMovementHistory> {
    const data = await api.get<Raw>(
      `/inventory-transactions/web/material/${materialId}/history`,
      { pageNo, pageSize }
    );
    return safeParseHistoryPage(data, pageSize);
  },

  /**
   * Fetches every transaction in a given lifecycle classification
   * (`GET /inventory-transactions/web/type/{type}`).
   *
   * @param type - The {@link InventoryTransactionType} bucket to
   *   filter by.
   * @returns The matching {@link InventoryTransaction}s.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getByType(
    type: InventoryTransactionType
  ): Promise<InventoryTransaction[]> {
    const data = await api.get<Raw[]>(
      `/inventory-transactions/web/type/${type}`
    );
    return safeParseAll(data);
  },

  /**
   * Fetches every transaction whose `transactionDate` falls within an
   * inclusive ISO-8601 date range
   * (`GET /inventory-transactions/web/date-range`).
   *
   * @param startDate - ISO 8601 lower bound (inclusive).
   * @param endDate - ISO 8601 upper bound (inclusive).
   * @returns The matching {@link InventoryTransaction}s.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getByDateRange(
    startDate: string,
    endDate: string
  ): Promise<InventoryTransaction[]> {
    const data = await api.get<Raw[]>(
      '/inventory-transactions/web/date-range',
      { startDate, endDate }
    );
    return safeParseAll(data);
  },

  /**
   * Fetches the per-location stock roll-up for a single material
   * (`GET /inventory-transactions/web/material/{materialId}/stock`).
   *
   * @param materialId - Surrogate ID of the material.
   * @returns The {@link MaterialStock} roll-up.
   * @throws {ApiError} On a non-2xx response.
   * @throws {Error} When the response is not an object (propagated
   *   from {@link parseMaterialStock}).
   */
  async getMaterialStock(materialId: number): Promise<MaterialStock> {
    const data = await api.get<Raw>(
      `/inventory-transactions/web/material/${materialId}/stock`
    );
    return parseMaterialStock(data);
  },

  /**
   * Fetches every transaction recorded against a given storage
   * location
   * (`GET /inventory-transactions/web/storage-location/{storageLocationId}`).
   *
   * @param storageLocationId - Surrogate ID of the storage location.
   * @returns The matching {@link InventoryTransaction}s.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getByStorageLocation(
    storageLocationId: number
  ): Promise<InventoryTransaction[]> {
    const data = await api.get<Raw[]>(
      `/inventory-transactions/web/storage-location/${storageLocationId}`
    );
    return safeParseAll(data);
  },

  /**
   * Fetches the per-material stock roll-up for a single storage
   * location
   * (`GET /inventory-transactions/web/storage-location/{storageLocationId}/stock`).
   *
   * @param storageLocationId - Surrogate ID of the storage location.
   * @returns The {@link StorageLocationStock} roll-up.
   * @throws {ApiError} On a non-2xx response.
   */
  async getStorageLocationStock(
    storageLocationId: number
  ): Promise<StorageLocationStock> {
    const data = await api.get<Raw>(
      `/inventory-transactions/web/storage-location/${storageLocationId}/stock`
    );
    return parseStorageLocationStock(data);
  },

  /**
   * Fetches every transaction matching the full scope tuple of
   * (storage location, material, project)
   * (`GET /inventory-transactions/web/storage-location/{slId}/material/{matId}/project/{projId}`).
   * Used for narrow audit listings where all three scopes are pinned.
   *
   * @param storageLocationId - Surrogate ID of the storage location.
   * @param materialId - Surrogate ID of the material.
   * @param projectId - Surrogate ID of the project.
   * @returns The matching {@link InventoryTransaction}s.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getByStorageLocationAndMaterial(
    storageLocationId: number,
    materialId: number,
    projectId: number
  ): Promise<InventoryTransaction[]> {
    const data = await api.get<Raw[]>(
      `/inventory-transactions/web/storage-location/${storageLocationId}/material/${materialId}/project/${projectId}`
    );
    return safeParseAll(data);
  },
};
