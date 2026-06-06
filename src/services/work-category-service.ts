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
 * Safely parse work category data with error handling.
 * @throws {ApiError} when parsing fails
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
 * Safely parse work category array with error handling.
 * @throws {ApiError} when parsing fails
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
 * workCategoryService
 *
 * Thin wrapper around the backend work category REST endpoints.
 */
export const workCategoryService = {
  /**
   * Fetch all work categories.
   */
  async getAll(): Promise<WorkCategory[]> {
    const data = await api.get<ApiResponse[]>('/category/web');
    return safeParseWorkCategories(data);
  },

  /**
   * Fetch a single work category by id.
   */
  async getById(id: number): Promise<WorkCategory> {
    const data = await api.get<ApiResponse>(`/category/web/${id}`);
    return safeParseWorkCategory(data);
  },

  /**
   * Create a new work category.
   */
  async create(dto: CreateWorkCategoryRequest): Promise<WorkCategory> {
    const data = await api.post<ApiResponse>(
      '/category/web',
      createWorkCategoryToJson(dto)
    );
    return safeParseWorkCategory(data);
  },

  /**
   * Delete a work category by id.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/category/web/${id}`);
  },
};
