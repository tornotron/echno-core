/**
 * @module materials-service
 *
 * Typed client for the materials backend endpoints under `/materials/web`.
 * Wraps `api.*` calls and parses raw JSON into strongly-typed
 * {@link Material} and {@link MaterialWithStock} domain objects.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */
import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Material,
  MaterialWithStock,
  parseMaterial,
  parseMaterialWithStock,
  CreateMaterialRequest,
  createMaterialToJson,
  UpdateMaterialRequest,
  updateMaterialToJson,
  MaterialLocationThreshold,
  parseMaterialLocationThreshold,
  MaterialLocationThresholdUpsert,
  materialLocationThresholdToJson,
  LowStockMaterial,
  parseLowStockMaterial,
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
 *   GET    /materials/web/low-stock?pageNo&pageSize    → PageLowStockMaterialDto (paginated; envelope kept)
 *   GET    /materials/web/{id}/stock                   → MaterialWithStockDto    (full + non-null currentStock)
 *   PATCH  /materials/web/{id}                         → MaterialDto             (full)
 *   DELETE /materials/web/{id}                         → ApiResponse             (ack only)
 *   GET    /materials/web/{id}/location-thresholds     → MaterialLocationThresholdDto[]
 *   PUT    /materials/web/{id}/location-thresholds/{loc} → MaterialLocationThresholdDto
 *   DELETE /materials/web/{id}/location-thresholds/{loc} → ApiResponse           (ack only)
 *
 * Every mutation endpoint returns the full {@link Material} (or an ack on
 * delete), so the mutation hooks can patch caches directly without a
 * follow-up refetch. The `/stock` read returns {@link MaterialWithStock}, a
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
 * @returns The parsed {@link MaterialWithStock}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseMaterialWithStock(data: Raw): MaterialWithStock {
  try {
    return parseMaterialWithStock(data);
  } catch (error) {
    logger.error('Failed to parse material with stock:', error);
    throw new ApiError('Failed to process material stock data.', 422);
  }
}

/**
 * Parses a single per-location threshold payload, wrapping parser failures
 * in {@link ApiError}.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link MaterialLocationThreshold}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseLocationThreshold(data: Raw): MaterialLocationThreshold {
  try {
    return parseMaterialLocationThreshold(data);
  } catch (error) {
    logger.error('Failed to parse material location threshold:', error);
    throw new ApiError('Failed to process material threshold data.', 422);
  }
}

/**
 * Parses an array of per-location threshold payloads. Accepts either a raw
 * array or a paged `{ content: [...] }` envelope and yields `[]` for an
 * empty input.
 *
 * @param data - The raw JSON array or paged envelope from the backend.
 * @returns An array of parsed {@link MaterialLocationThreshold} objects.
 * @throws {ApiError} When any item fails parsing (HTTP 422).
 */
function safeParseLocationThresholds(data: Raw): MaterialLocationThreshold[] {
  const items = extractArray(data);
  if (items.length === 0) return [];
  try {
    return items.map((item) => parseMaterialLocationThreshold(item));
  } catch (error) {
    logger.error('Failed to parse material location thresholds:', error);
    throw new ApiError('Failed to process material thresholds data.', 422);
  }
}

/**
 * A parsed page of low-stock materials, mirroring the Spring
 * `Page<LowStockMaterialDto>` envelope.
 *
 * `totalElements` is the whole point of keeping the envelope: it is how
 * many materials are at or below their level across the scope, not how
 * many happened to fit on the page that was asked for. A caller wanting
 * only the number can ask for `pageSize: 1` and read it.
 */
export interface PagedLowStockMaterials {
  /** The low-stock materials on this page, most depleted first. */
  content: LowStockMaterial[];
  /** How many materials are low across the whole scope. */
  totalElements: number;
  /** Total number of pages at the requested page size. */
  totalPages: number;
  /** 0-based page index. */
  number: number;
  /** Page size. */
  size: number;
}

/** Scope and paging options for {@link materialsService.getLowStock}. */
export interface LowStockParams {
  /**
   * Total stock over this project's storage locations, and only materials
   * the project holds. Omit for an organization total, which also counts a
   * material holding nothing anywhere.
   */
  projectId?: number;
  /**
   * Read stock at this one storage location, where its threshold override
   * replaces the material's global level. Requires `projectId`.
   */
  storageLocationId?: number;
  /** 0-based page index. Defaults to `0` on the backend. */
  pageNo?: number;
  /** Rows per page. Defaults to `10` on the backend, capped at 500. */
  pageSize?: number;
}

/**
 * Normalizes a Spring `Page<LowStockMaterialDto>` body into a
 * {@link PagedLowStockMaterials}.
 *
 * A payload without a page envelope is rejected rather than counted. The
 * length of a page is not the size of the set behind it, and reporting one
 * as the other is the defect this endpoint exists to remove: an alert
 * count that is short is an alert count that reassures.
 *
 * @param data - The raw JSON value from the backend.
 * @returns The parsed page.
 * @throws {ApiError} When the payload carries no `totalElements`, or a row
 *   fails to parse (HTTP 422).
 */
function safeParseLowStockPage(data: Raw): PagedLowStockMaterials {
  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray(data.content) ||
    typeof data.totalElements !== 'number'
  ) {
    logger.error('Low-stock API returned no page envelope:', {
      type: typeof data,
      keys: data && typeof data === 'object' ? Object.keys(data) : null,
    });
    throw new ApiError(
      'Failed to process low-stock data: the total count is missing.',
      422
    );
  }
  try {
    return {
      content: data.content.map((item: Raw) => parseLowStockMaterial(item)),
      totalElements: data.totalElements,
      totalPages: data.totalPages ?? 0,
      number: data.number ?? 0,
      size: data.size ?? data.content.length,
    };
  } catch (error) {
    logger.error('Failed to parse low-stock materials:', error);
    throw new ApiError('Failed to process low-stock data.', 422);
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
   * Fetches the materials at or below the reorder level in force, most
   * depleted first as a fraction of that level.
   *
   * `GET /materials/web/low-stock` → `Page<LowStockMaterialDto>`. The page
   * envelope is kept rather than flattened, because `totalElements` is the
   * true count of low-stock materials and the only number a "Low Stock
   * Alert" may be built from. Filtering a fetched material list in the
   * browser cannot produce it: that list is capped at 500 rows, it carries
   * only organization-wide aggregates, and it cannot see a per-location
   * threshold override at all.
   *
   * Three scopes, matching `GET /materials/web/{id}/stock`: neither id
   * totals across the organization and treats every catalogue material as
   * a candidate; `projectId` totals over that project's locations; both
   * ids read one location, where its override replaces the material's
   * global level.
   *
   * A storage location without its project is refused here rather than
   * sent. The backend answers that combination with a 400 naming the
   * mismatch, and the round trip buys nothing: a location belongs to
   * exactly one project, so a caller that knows the location and not the
   * project is asking about a scope it has not established.
   *
   * @param params - Scope (`projectId`, `storageLocationId`) and paging.
   * @returns A {@link PagedLowStockMaterials} page.
   * @throws {ApiError} When `storageLocationId` is given without
   *   `projectId`, on non-2xx HTTP responses, or when the response carries
   *   no page envelope to read the total from.
   */
  async getLowStock(
    params: LowStockParams = {}
  ): Promise<PagedLowStockMaterials> {
    if (
      params.storageLocationId !== undefined &&
      params.projectId === undefined
    ) {
      throw new ApiError(
        'A storage location can only be asked about within its project.',
        400
      );
    }
    const query: Record<string, string | number> = {};
    if (params.projectId !== undefined) query.projectId = params.projectId;
    if (params.storageLocationId !== undefined)
      query.storageLocationId = params.storageLocationId;
    if (params.pageNo !== undefined) query.pageNo = params.pageNo;
    if (params.pageSize !== undefined) query.pageSize = params.pageSize;
    const data = await api.get<Raw>('/materials/web/low-stock', query);
    return safeParseLowStockPage(data);
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
   * @returns The {@link MaterialWithStock}.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getWithStock(id: number): Promise<MaterialWithStock> {
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

  /**
   * Fetches the per-storage-location threshold overrides for a material.
   *
   * `GET /materials/web/{materialId}/location-thresholds` →
   * `MaterialLocationThresholdDto[]`.
   *
   * @param materialId - Surrogate ID of the material.
   * @returns An array of {@link MaterialLocationThreshold} objects.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getLocationThresholds(
    materialId: number
  ): Promise<MaterialLocationThreshold[]> {
    const data = await api.get<Raw>(
      `/materials/web/${materialId}/location-thresholds`
    );
    return safeParseLocationThresholds(data);
  },

  /**
   * Creates or updates the threshold override for one storage location.
   * The backend returns the full override row so the mutation hook can
   * patch caches directly.
   *
   * `PUT /materials/web/{materialId}/location-thresholds/{storageLocationId}`
   * → `MaterialLocationThresholdDto`.
   *
   * @param materialId - Surrogate ID of the material.
   * @param storageLocationId - Surrogate ID of the storage location.
   * @param dto - Threshold fields to set; only set fields are sent.
   * @returns The upserted {@link MaterialLocationThreshold}.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async upsertLocationThreshold(
    materialId: number,
    storageLocationId: number,
    dto: MaterialLocationThresholdUpsert
  ): Promise<MaterialLocationThreshold> {
    const data = await api.put<Raw>(
      `/materials/web/${materialId}/location-thresholds/${storageLocationId}`,
      materialLocationThresholdToJson(dto)
    );
    return safeParseLocationThreshold(data);
  },

  /**
   * Deletes the threshold override for one storage location, reverting it
   * to the material-level defaults. The backend returns only an
   * acknowledgement.
   *
   * `DELETE /materials/web/{materialId}/location-thresholds/{storageLocationId}`
   * → `ApiResponse` (ack only).
   *
   * @param materialId - Surrogate ID of the material.
   * @param storageLocationId - Surrogate ID of the storage location.
   * @throws {ApiError} On non-2xx HTTP responses.
   */
  async deleteLocationThreshold(
    materialId: number,
    storageLocationId: number
  ): Promise<void> {
    await api.delete(
      `/materials/web/${materialId}/location-thresholds/${storageLocationId}`
    );
  },
};
