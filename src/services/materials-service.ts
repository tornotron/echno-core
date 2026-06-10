/**
 * @module materials-service
 *
 * Typed client for the materials backend endpoints under `/materials/web`.
 * Wraps `api.*` calls and parses raw JSON into strongly-typed
 * {@link Material} and {@link MaterialStock} domain objects.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */
import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Material,
  MaterialStock,
  parseMaterial,
  parseMaterialWithStock,
  CreateMaterialRequest,
  createMaterialToJson,
  UpdateMaterialRequest,
  updateMaterialToJson,
} from '../types/materials';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * Backend response shape audit:
 *
 *   POST   /materials/web                              → MaterialDto             (full)
 *   GET    /materials/web                              → MaterialDto[]           (full list)
 *   GET    /materials/web/all?pageNo&pageSize          → PageMaterialDto         (paginated; flattened to MaterialDto[])
 *   GET    /materials/web/search?name                  → MaterialDto[]           (full)
 *   GET    /materials/web/{id}                         → MaterialDto             (full)
 *   GET    /materials/web/{id}/stock                   → MaterialWithStockDto    (full + non-null currentStock)
 *   PATCH  /materials/web/{id}                         → MaterialDto             (full)
 *   DELETE /materials/web/{id}                         → ApiResponse             (ack only)
 *
 * Every mutation endpoint returns the full {@link Material} (or an ack on
 * delete), so the mutation hooks can patch caches directly without a
 * follow-up refetch. The `/stock` read returns {@link MaterialStock}, a
 * superset of `Material` with a guaranteed `currentStock`; it is keyed
 * separately by the hook layer.
 */

/**
 * Parses a single material payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link Material}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseMaterial(data: Raw): Material {
  try {
    return parseMaterial(data);
  } catch (error) {
    logger.error('Failed to parse material:', error);
    throw new ApiError('Failed to process material data.', 422);
  }
}

/**
 * Coerces a material-list payload into a plain array. Accepts either a
 * raw array (returned by the unpaginated `GET /materials/web` and
 * `/search`) or a paged envelope `{ content: MaterialDto[], ... }`
 * (returned by `GET /materials/web/all`). Logs a warning and returns
 * `[]` for any other shape so a partial outage doesn't break consumers.
 *
 * @param data - The raw JSON value from the backend.
 * @returns The extracted array, or `[]` when the payload shape is
 *   unrecognised.
 */
function extractArray(data: Raw): Raw[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.content)) return data.content;
  logger.warn('Materials API returned unexpected format:', {
    type: typeof data,
    keys: data ? Object.keys(data) : null,
  });
  return [];
}

/**
 * Parses an array of material payloads. Accepts the same shapes
 * {@link extractArray} accepts and silently yields `[]` for an empty
 * input.
 *
 * @param data - The raw JSON array or paged envelope from the backend.
 * @returns An array of parsed {@link Material} objects.
 * @throws {ApiError} When any item fails parsing (HTTP 422).
 */
function safeParseMaterials(data: Raw): Material[] {
  const items = extractArray(data);
  if (items.length === 0) return [];
  try {
    return items.map((item) => parseMaterial(item));
  } catch (error) {
    logger.error('Failed to parse materials:', error);
    throw new ApiError('Failed to process materials data.', 422);
  }
}

/**
 * Parses a single stock-aware material payload, wrapping parser failures
 * in {@link ApiError}.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link MaterialStock}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseMaterialWithStock(data: Raw): MaterialStock {
  try {
    return parseMaterialWithStock(data);
  } catch (error) {
    logger.error('Failed to parse material with stock:', error);
    throw new ApiError('Failed to process material stock data.', 422);
  }
}

export const materialsService = {
  /**
   * Creates a new material.
   *
   * `POST /materials/web` → `MaterialDto` (full).
   *
   * @param dto - The fields to populate on the new material.
   * @returns The created {@link Material} as returned by the backend.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async create(dto: CreateMaterialRequest): Promise<Material> {
    const data = await api.post<Raw>(
      '/materials/web',
      createMaterialToJson(dto)
    );
    return safeParseMaterial(data);
  },

  /**
   * Fetches every material (unpaginated).
   *
   * `GET /materials/web` → `MaterialDto[]` (full).
   *
   * @returns An array of {@link Material} objects.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getAll(): Promise<Material[]> {
    const data = await api.get<Raw[]>('/materials/web');
    return safeParseMaterials(data);
  },

  /**
   * Fetches a page of materials. The paginated envelope is flattened to a
   * plain {@link Material} array so consumers share a single response
   * shape with {@link getAll}.
   *
   * `GET /materials/web/all?pageNo&pageSize` → `PageMaterialDto`
   * (flattened to `MaterialDto[]`).
   *
   * @param pageNo - Zero-based page number. Defaults to `0`.
   * @param pageSize - Number of materials per page. Defaults to `10`.
   * @returns An array of {@link Material} objects for the page.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getAllPaginated(pageNo = 0, pageSize = 10): Promise<Material[]> {
    const data = await api.get<Raw>('/materials/web/all', { pageNo, pageSize });
    return safeParseMaterials(data);
  },

  /**
   * Searches materials by name.
   *
   * `GET /materials/web/search?name` → `MaterialDto[]` (full).
   *
   * @param name - Substring to match against `materialName`.
   * @returns The matching {@link Material} array.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async search(name: string): Promise<Material[]> {
    const data = await api.get<Raw[]>('/materials/web/search', { name });
    return safeParseMaterials(data);
  },

  /**
   * Fetches a single material by ID.
   *
   * `GET /materials/web/{id}` → `MaterialDto` (full).
   *
   * @param id - Surrogate ID of the material.
   * @returns The {@link Material}.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getById(id: number): Promise<Material> {
    const data = await api.get<Raw>(`/materials/web/${id}`);
    return safeParseMaterial(data);
  },

  /**
   * Fetches a material with its current stock guaranteed non-null.
   *
   * `GET /materials/web/{id}/stock` → `MaterialWithStockDto` (full +
   * resolved `currentStock`).
   *
   * @param id - Surrogate ID of the material.
   * @returns The {@link MaterialStock}.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getWithStock(id: number): Promise<MaterialStock> {
    const data = await api.get<Raw>(`/materials/web/${id}/stock`);
    return safeParseMaterialWithStock(data);
  },

  /**
   * Updates a material. The backend returns the full updated entity so
   * the caller (or downstream mutation hook) can patch caches directly.
   *
   * `PATCH /materials/web/{id}` → `MaterialDto` (full).
   *
   * @param id - Surrogate ID of the material to update.
   * @param dto - Fields to update; only set fields are sent.
   * @returns The updated {@link Material}.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async update(id: number, dto: UpdateMaterialRequest): Promise<Material> {
    const data = await api.patch<Raw>(
      `/materials/web/${id}`,
      updateMaterialToJson(dto)
    );
    return safeParseMaterial(data);
  },

  /**
   * Deletes a material by ID. The backend returns only an
   * acknowledgement; the mutation hook is responsible for evicting cache
   * entries.
   *
   * `DELETE /materials/web/{id}` → `ApiResponse` (ack only).
   *
   * @param id - Surrogate ID of the material to delete.
   * @throws {ApiError} On non-2xx HTTP responses.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/materials/web/${id}`);
  },
};
