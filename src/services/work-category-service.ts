/**
 * @module work-category-service
 *
 * Typed client for the work-category backend endpoints under
 * `/category/web`. Wraps `api.*` calls and parses raw JSON into strongly-
 * typed {@link WorkCategory} domain objects.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */
import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  WorkCategory,
  parseWorkCategory,
  CreateWorkCategoryRequest,
  createWorkCategoryToJson,
} from '../types/work-category';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

/**
 * Backend response shape audit:
 *
 *   GET    /category/web        → CategoryDto[]       (full)
 *   GET    /category/web/{id}   → CategoryDto         (full)
 *   POST   /category/web        → CategorySimpleDto   (partial — optional scalars may be absent)
 *   DELETE /category/web/{id}   → ApiResponse         (ack only)
 *
 * `WorkCategory` is a flat domain type (no nested arrays). Direct
 * `setQueryData` is safe for both the full and partial response shapes;
 * `mergePreservingNested` would degenerate to a plain overwrite here.
 * The mutation hooks issue a follow-up detail invalidation after a POST so
 * the next observer fetches the canonical `CategoryDto` even if the
 * `CategorySimpleDto` response omitted optional scalar fields.
 *
 * No PATCH endpoint exists for this domain.
 */

/**
 * Parses a single category payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link WorkCategory}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseWorkCategory(data: ApiResponse): WorkCategory {
  try {
    return parseWorkCategory(data);
  } catch (error) {
    logger.error('Failed to parse work category data:', error);
    throw new ApiError(
      'Failed to process work category data. Please try again.',
      422
    );
  }
}

/**
 * Parses an array of category payloads. Logs a contract-violation warning
 * and throws if the backend returns a non-array, since downstream consumers
 * assume an iterable shape.
 *
 * @param data - The raw JSON array from the backend.
 * @returns An array of parsed {@link WorkCategory} objects.
 * @throws {ApiError} When the payload is not an array or any item fails
 *   parsing (HTTP 422).
 */
function safeParseWorkCategories(data: ApiResponse[]): WorkCategory[] {
  if (!Array.isArray(data)) {
    const dataType = data === null ? 'null' : typeof data;
    let preview: string;
    try {
      const stringified = JSON.stringify(data);
      preview =
        stringified.length > 200
          ? stringified.slice(0, 200) + '...'
          : stringified;
    } catch {
      preview = String(data).slice(0, 200);
    }
    logger.warn(
      'safeParseWorkCategories: API contract violation - expected array but received ' +
        `${dataType}. Preview: ${preview}. parseWorkCategory will not be called.`
    );
    throw new ApiError(
      `Expected array from API but received ${dataType}. Preview: ${preview}`,
      422
    );
  }
  try {
    return data.map((item) => parseWorkCategory(item));
  } catch (error) {
    logger.error('Failed to parse work categories data:', error);
    throw new ApiError(
      'Failed to process work categories data. Please try again.',
      422
    );
  }
}

/**
 * Thin wrapper around the backend work-category REST endpoints.
 */
export const workCategoryService = {
  /**
   * Fetches every work category.
   *
   * `GET /category/web` → `CategoryDto[]` (full).
   *
   * @returns A resolved array of {@link WorkCategory} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getAll(): Promise<WorkCategory[]> {
    const data = await api.get<ApiResponse[]>('/category/web');
    return safeParseWorkCategories(data);
  },

  /**
   * Fetches a single work category by ID.
   *
   * `GET /category/web/{id}` → `CategoryDto` (full).
   *
   * @param id - Surrogate ID of the work category.
   * @returns The resolved {@link WorkCategory}.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getById(id: number): Promise<WorkCategory> {
    const data = await api.get<ApiResponse>(`/category/web/${id}`);
    return safeParseWorkCategory(data);
  },

  /**
   * Creates a new work category.
   *
   * `POST /category/web` → `CategorySimpleDto` (partial — optional scalar
   * fields like `description`, `icon`, and `image` may be absent on the
   * response even when supplied in the request).
   *
   * @param dto - The create request payload.
   * @returns The newly created {@link WorkCategory}. Optional scalar fields
   *   may be undefined; mutation hooks invalidate the detail key after a
   *   successful create so the next observer pulls the canonical
   *   `CategoryDto`.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async create(dto: CreateWorkCategoryRequest): Promise<WorkCategory> {
    const data = await api.post<ApiResponse>(
      '/category/web',
      createWorkCategoryToJson(dto)
    );
    return safeParseWorkCategory(data);
  },

  /**
   * Deletes a work category by ID.
   *
   * `DELETE /category/web/{id}` → `ApiResponse` (ack only — no body to parse).
   *
   * @param id - Surrogate ID of the work category to delete.
   * @returns A void promise that resolves on a successful ack.
   * @throws {ApiError} On non-2xx response.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/category/web/${id}`);
  },
};
