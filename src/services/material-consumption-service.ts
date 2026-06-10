/**
 * @module material-consumption-service
 *
 * Typed client for the material-consumption backend endpoints under
 * `/material-consumptions/web`. Wraps `api.*` calls and parses raw JSON
 * into strongly-typed {@link MaterialConsumption} domain objects.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */
import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  MaterialConsumption,
  ConsumptionType,
  parseMaterialConsumption,
  CreateMaterialConsumptionRequest,
  createMaterialConsumptionToJson,
} from '../types/materials';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * Backend response shape audit:
 *
 *   POST   /material-consumptions/web                                  → MaterialConsumptionDto    (full)
 *   GET    /material-consumptions/web                                  → MaterialConsumptionDto[]  (full list)
 *   GET    /material-consumptions/web/all?pageNo&pageSize              → PageMaterialConsumptionDto (paginated; flattened to MaterialConsumptionDto[])
 *   GET    /material-consumptions/web/{id}                             → MaterialConsumptionDto    (full)
 *   GET    /material-consumptions/web/material/{materialId}            → MaterialConsumptionDto[]  (full; filtered server-side by material)
 *   GET    /material-consumptions/web/type/{type}                      → MaterialConsumptionDto[]  (full; filtered server-side by ConsumptionType)
 *   GET    /material-consumptions/web/task/{taskId}                    → MaterialConsumptionDto[]  (full; filtered server-side by task)
 *   GET    /material-consumptions/web/date-range?startDate&endDate     → MaterialConsumptionDto[]  (full; filtered server-side by date range)
 *
 * Consumption is an append-only ledger — the backend exposes no update or
 * delete endpoint, only create plus the read variants above. The five
 * filtered list endpoints (`material/`, `type/`, `task/`, `date-range`,
 * plus the unpaginated and paginated lists) apply server-side filters
 * that the mutation hook cannot replay locally; the create flow therefore
 * invalidates the whole namespace rather than patching individual list
 * caches — see {@link useCreateConsumption} for the cache strategy.
 */

/**
 * Parses a single consumption payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link MaterialConsumption}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseMaterialConsumption(data: Raw): MaterialConsumption {
  try {
    return parseMaterialConsumption(data);
  } catch (error) {
    logger.error('Failed to parse material consumption:', error);
    throw new ApiError('Failed to process consumption data.', 422);
  }
}

/**
 * Parses an array of consumption payloads. Accepts either a raw array
 * (returned by the unpaginated and filtered list endpoints) or a paged
 * envelope `{ content: MaterialConsumptionDto[], ... }` (returned by
 * `GET /material-consumptions/web/all`). Yields `[]` for an empty input.
 *
 * @param data - The raw JSON array or paged envelope from the backend.
 * @returns An array of parsed {@link MaterialConsumption} objects.
 * @throws {ApiError} When any item fails parsing (HTTP 422).
 */
function safeParseMaterialConsumptions(data: Raw): MaterialConsumption[] {
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : [];
  if (items.length === 0) return [];
  try {
    return items.map((item: Raw) => parseMaterialConsumption(item));
  } catch (error) {
    logger.error('Failed to parse material consumptions:', error);
    throw new ApiError('Failed to process consumptions data.', 422);
  }
}

export const materialConsumptionService = {
  /**
   * Records a new consumption event.
   *
   * `POST /material-consumptions/web` → `MaterialConsumptionDto` (full).
   *
   * @param dto - The consumption event to record.
   * @returns The created {@link MaterialConsumption} as returned by the
   *   backend.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async create(
    dto: CreateMaterialConsumptionRequest
  ): Promise<MaterialConsumption> {
    const data = await api.post<Raw>(
      '/material-consumptions/web',
      createMaterialConsumptionToJson(dto)
    );
    return safeParseMaterialConsumption(data);
  },

  /**
   * Fetches every consumption event (unpaginated).
   *
   * `GET /material-consumptions/web` → `MaterialConsumptionDto[]` (full).
   *
   * @returns An array of {@link MaterialConsumption} objects.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getAll(): Promise<MaterialConsumption[]> {
    const data = await api.get<Raw[]>('/material-consumptions/web');
    return safeParseMaterialConsumptions(data);
  },

  /**
   * Fetches a page of consumption events. The paginated envelope is
   * flattened to a plain {@link MaterialConsumption} array so consumers
   * share a single response shape with {@link getAll}.
   *
   * `GET /material-consumptions/web/all?pageNo&pageSize` →
   * `PageMaterialConsumptionDto` (flattened to `MaterialConsumptionDto[]`).
   *
   * @param pageNo - Zero-based page number. Defaults to `0`.
   * @param pageSize - Number of events per page. Defaults to `10`.
   * @returns An array of {@link MaterialConsumption} objects for the page.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getAllPaginated(
    pageNo = 0,
    pageSize = 10
  ): Promise<MaterialConsumption[]> {
    const data = await api.get<Raw>('/material-consumptions/web/all', {
      pageNo,
      pageSize,
    });
    return safeParseMaterialConsumptions(data);
  },

  /**
   * Fetches a single consumption event by ID.
   *
   * `GET /material-consumptions/web/{id}` → `MaterialConsumptionDto` (full).
   *
   * @param id - Surrogate ID of the consumption event.
   * @returns The {@link MaterialConsumption}.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getById(id: number): Promise<MaterialConsumption> {
    const data = await api.get<Raw>(`/material-consumptions/web/${id}`);
    return safeParseMaterialConsumption(data);
  },

  /**
   * Fetches every consumption event recorded against the given material.
   *
   * `GET /material-consumptions/web/material/{materialId}` →
   * `MaterialConsumptionDto[]` (full).
   *
   * @param materialId - Surrogate ID of the {@link Material}.
   * @returns The matching {@link MaterialConsumption} array.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getByMaterial(materialId: number): Promise<MaterialConsumption[]> {
    const data = await api.get<Raw[]>(
      `/material-consumptions/web/material/${materialId}`
    );
    return safeParseMaterialConsumptions(data);
  },

  /**
   * Fetches every consumption event of the given mechanism
   * (`USED_FROM_STOCK` or `TRANSFERRED`).
   *
   * `GET /material-consumptions/web/type/{type}` →
   * `MaterialConsumptionDto[]` (full).
   *
   * @param type - The {@link ConsumptionType} to filter by.
   * @returns The matching {@link MaterialConsumption} array.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getByType(type: ConsumptionType): Promise<MaterialConsumption[]> {
    const data = await api.get<Raw[]>(
      `/material-consumptions/web/type/${type}`
    );
    return safeParseMaterialConsumptions(data);
  },

  /**
   * Fetches every consumption event allocated to the given task.
   *
   * `GET /material-consumptions/web/task/{taskId}` →
   * `MaterialConsumptionDto[]` (full).
   *
   * @param taskId - Surrogate ID of the task.
   * @returns The matching {@link MaterialConsumption} array.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getByTask(taskId: number): Promise<MaterialConsumption[]> {
    const data = await api.get<Raw[]>(
      `/material-consumptions/web/task/${taskId}`
    );
    return safeParseMaterialConsumptions(data);
  },

  /**
   * Fetches every consumption event whose `consumptionDate` falls inside
   * the given inclusive date range.
   *
   * `GET /material-consumptions/web/date-range?startDate&endDate` →
   * `MaterialConsumptionDto[]` (full).
   *
   * @param startDate - ISO 8601 start date (inclusive).
   * @param endDate - ISO 8601 end date (inclusive).
   * @returns The matching {@link MaterialConsumption} array.
   * @throws {ApiError} On non-2xx HTTP responses or parser failure.
   */
  async getByDateRange(
    startDate: string,
    endDate: string
  ): Promise<MaterialConsumption[]> {
    const data = await api.get<Raw[]>('/material-consumptions/web/date-range', {
      startDate,
      endDate,
    });
    return safeParseMaterialConsumptions(data);
  },
};
