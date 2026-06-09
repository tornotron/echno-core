/**
 * @module storage-locations-service
 *
 * Typed client for the storage-location backend endpoints under
 * `/storage-locations/web`. Wraps `api.*` calls and parses raw JSON into
 * strongly-typed {@link StorageLocation} domain objects.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  StorageLocation,
  parseStorageLocation,
  CreateStorageLocationRequest,
  createStorageLocationToJson,
  UpdateStorageLocationRequest,
  updateStorageLocationToJson,
} from '../types/storage-locations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * Backend response shape audit:
 *
 *   GET    /storage-locations/web        → StorageLocationDto[] | { content: StorageLocationDto[] } (full)
 *   GET    /storage-locations/web/{id}   → StorageLocationDto                                       (full)
 *   POST   /storage-locations/web        → StorageLocationDto                                       (full)
 *   PATCH  /storage-locations/web/{id}   → StorageLocationDto                                       (full)
 *   DELETE /storage-locations/web/{id}   → ApiResponse                                              (ack only)
 *
 * `StorageLocation` is a flat domain type (no nested arrays). Every
 * non-delete endpoint returns the full DTO, so direct `setQueryData` writes
 * by mutation hooks need no merge helper and no follow-up invalidation.
 *
 * The list endpoint may return either a bare array or a paginated
 * `{ content: [...] }` wrapper; {@link extractArray} normalises both.
 */

/**
 * Parses a single storage-location payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link StorageLocation}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParse(data: Raw): StorageLocation {
  try {
    return parseStorageLocation(data);
  } catch (error) {
    logger.error('Failed to parse storage location:', error);
    throw new ApiError('Failed to process storage location data.', 422);
  }
}

/**
 * Normalises the list endpoint's response into a raw array. Accepts either
 * a bare `StorageLocationDto[]` or a paginated `{ content: [...] }` wrapper.
 * Logs a contract-violation warning and returns `[]` when neither shape
 * matches, rather than throwing — letting the UI render an empty list.
 *
 * @param data - The raw response body.
 * @returns The contained array, or `[]` when the shape is unrecognised.
 */
function extractArray(data: Raw): Raw[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.content)) return data.content;
  logger.warn('Storage locations API returned unexpected format:', {
    type: typeof data,
    keys: data ? Object.keys(data) : null,
  });
  return [];
}

/**
 * Parses an array of storage-location payloads. Empty inputs short-circuit
 * to `[]`; parser failures are wrapped in {@link ApiError}.
 *
 * @param data - The raw response body from the list endpoint.
 * @returns An array of parsed {@link StorageLocation} objects.
 * @throws {ApiError} When any item fails parsing (HTTP 422).
 */
function safeParseAll(data: Raw): StorageLocation[] {
  const items = extractArray(data);
  if (items.length === 0) return [];
  try {
    return items.map((item) => parseStorageLocation(item));
  } catch (error) {
    logger.error('Failed to parse storage locations:', error);
    throw new ApiError('Failed to process storage locations data.', 422);
  }
}

/**
 * Thin wrapper around the backend storage-location REST endpoints.
 */
export const storageLocationsService = {
  /**
   * Fetches every storage location.
   *
   * `GET /storage-locations/web` → `StorageLocationDto[]` (full). The
   * endpoint may also return a paginated `{ content: [...] }` wrapper,
   * which {@link extractArray} normalises transparently.
   *
   * @returns A resolved array of {@link StorageLocation} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getAll(): Promise<StorageLocation[]> {
    const data = await api.get<Raw>('/storage-locations/web');
    return safeParseAll(data);
  },

  /**
   * Fetches a single storage location by ID.
   *
   * `GET /storage-locations/web/{id}` → `StorageLocationDto` (full).
   *
   * @param id - Surrogate ID of the storage location.
   * @returns The resolved {@link StorageLocation}.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getById(id: number): Promise<StorageLocation> {
    const data = await api.get<Raw>(`/storage-locations/web/${id}`);
    return safeParse(data);
  },

  /**
   * Creates a new storage location.
   *
   * `POST /storage-locations/web` → `StorageLocationDto` (full).
   *
   * @param dto - The create request payload.
   * @returns The newly created {@link StorageLocation}.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async create(dto: CreateStorageLocationRequest): Promise<StorageLocation> {
    const data = await api.post<Raw>(
      '/storage-locations/web',
      createStorageLocationToJson(dto)
    );
    return safeParse(data);
  },

  /**
   * Updates an existing storage location.
   *
   * `PATCH /storage-locations/web/{id}` → `StorageLocationDto` (full).
   * Only the fields supplied in `dto` are changed; the server treats
   * omitted fields as unchanged.
   *
   * @param id - Surrogate ID of the storage location to update.
   * @param dto - The fields to change.
   * @returns The updated {@link StorageLocation}.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async update(
    id: number,
    dto: UpdateStorageLocationRequest
  ): Promise<StorageLocation> {
    const data = await api.patch<Raw>(
      `/storage-locations/web/${id}`,
      updateStorageLocationToJson(dto)
    );
    return safeParse(data);
  },

  /**
   * Deletes a storage location by ID.
   *
   * `DELETE /storage-locations/web/{id}` → `ApiResponse` (ack only — no
   * body to parse).
   *
   * @param id - Surrogate ID of the storage location to delete.
   * @returns A void promise that resolves on a successful ack.
   * @throws {ApiError} On non-2xx response.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/storage-locations/web/${id}`);
  },
};
