/**
 * @module finance-cost-category-service
 *
 * Typed client for the finance cost-category endpoints
 * (`/finance/cost-categories/web`, resolved against the `/api/v1` base).
 *
 * A cost category groups project spend for budgeting and cost control and may
 * optionally bind to a chart-of-accounts expense account.
 *
 * Endpoint audit (response DTO label → classification):
 * - `GET  /finance/cost-categories/web[?activeOnly]`   → `CostCategoryDto[]` (query)
 * - `GET  /finance/cost-categories/web/{id}`           → `CostCategoryDto`   (query)
 * - `POST /finance/cost-categories/web`                → `CostCategoryDto`   (full)
 * - `PUT  /finance/cost-categories/web/{id}`           → `CostCategoryDto`   (full)
 * - `POST /finance/cost-categories/web/{id}/deactivate`→ `CostCategoryDto`   (full)
 * - `POST /finance/cost-categories/web/seed-defaults`  → `{ created: number }`
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  CostCategory,
  parseCostCategory,
  CreateCostCategoryRequest,
  createCostCategoryToJson,
  UpdateCostCategoryRequest,
  updateCostCategoryToJson,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/finance/cost-categories/web';

/** Result of seeding the default cost categories. */
export interface SeedCostCategoriesResult {
  /** Number of default cost categories created. */
  created: number;
}

/** Safely parse a cost category, converting parse failures into a 422 ApiError. */
function safeParseCostCategory(data: ApiResponse): CostCategory {
  try {
    return parseCostCategory(data);
  } catch (error) {
    logger.error('Failed to parse cost-category data:', error);
    throw new ApiError(
      'Failed to process cost-category data. Please try again.',
      422
    );
  }
}

/** Safely parse a cost-category array. */
function safeParseCostCategories(data: ApiResponse[]): CostCategory[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseCostCategory(item));
  } catch (error) {
    logger.error('Failed to parse cost-categories data:', error);
    throw new ApiError(
      'Failed to process cost-categories data. Please try again.',
      422
    );
  }
}

/**
 * Finance Cost-Category Service — project-budgeting cost categories.
 */
export const financeCostCategoryService = {
  /**
   * Lists cost categories.
   *
   * `GET /finance/cost-categories/web[?activeOnly]`
   *
   * @param activeOnly - When true, restrict to active categories.
   * @returns The {@link CostCategory} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async list(activeOnly?: boolean): Promise<CostCategory[]> {
    const params = activeOnly === undefined ? undefined : { activeOnly };
    const data = await api.get<ApiResponse[]>(BASE, params);
    return safeParseCostCategories(data);
  },

  /**
   * Fetches a single cost category by id.
   *
   * `GET /finance/cost-categories/web/{id}`
   *
   * @param id - UUID of the cost category.
   * @returns The {@link CostCategory}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<CostCategory> {
    const data = await api.get<ApiResponse>(`${BASE}/${id}`);
    return safeParseCostCategory(data);
  },

  /**
   * Creates a cost category.
   *
   * `POST /finance/cost-categories/web` → `CostCategoryDto` (full).
   *
   * @param dto - Cost-category fields ({@link CreateCostCategoryRequest}).
   * @returns The created {@link CostCategory}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async create(dto: CreateCostCategoryRequest): Promise<CostCategory> {
    const data = await api.post<ApiResponse>(BASE, createCostCategoryToJson(dto));
    return safeParseCostCategory(data);
  },

  /**
   * Updates a cost category (full replacement).
   *
   * `PUT /finance/cost-categories/web/{id}` → `CostCategoryDto` (full).
   *
   * @param id - UUID of the cost category.
   * @param dto - Updated fields ({@link UpdateCostCategoryRequest}).
   * @returns The updated {@link CostCategory}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async update(
    id: string,
    dto: UpdateCostCategoryRequest
  ): Promise<CostCategory> {
    const data = await api.put<ApiResponse>(
      `${BASE}/${id}`,
      updateCostCategoryToJson(dto)
    );
    return safeParseCostCategory(data);
  },

  /**
   * Deactivates a cost category.
   *
   * `POST /finance/cost-categories/web/{id}/deactivate` → `CostCategoryDto`
   * (full).
   *
   * @param id - UUID of the cost category.
   * @returns The updated (deactivated) {@link CostCategory}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async deactivate(id: string): Promise<CostCategory> {
    const data = await api.post<ApiResponse>(`${BASE}/${id}/deactivate`, {});
    return safeParseCostCategory(data);
  },

  /**
   * Seeds the built-in default cost categories for the organisation.
   *
   * `POST /finance/cost-categories/web/seed-defaults` → `{ created: number }`.
   *
   * @returns The number of default cost categories created.
   * @throws {ApiError} On non-2xx responses.
   */
  async seedDefaults(): Promise<SeedCostCategoriesResult> {
    const data = await api.post<ApiResponse>(`${BASE}/seed-defaults`, {});
    return { created: Number(data?.created ?? 0) };
  },
};
