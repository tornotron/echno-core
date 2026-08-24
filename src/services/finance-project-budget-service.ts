/**
 * @module finance-project-budget-service
 *
 * Typed client for the per-project budgeting and cost-control endpoints
 * (`/finance/projects/{projectId}/budget/web` and
 * `/finance/projects/{projectId}/cost-control/web`, resolved against the
 * `/api/v1` base).
 *
 * The budget endpoints manage a project's per-cost-category
 * {@link BudgetAllocation} lines; the cost-control endpoint returns the derived
 * {@link ProjectCostControl} report (allocated vs committed vs spent).
 *
 * Endpoint audit (response DTO label → classification):
 * - `GET    /finance/projects/{projectId}/budget/web`                  → `BudgetAllocationDto[]` (query)
 * - `PUT    /finance/projects/{projectId}/budget/web/{costCategoryId}` → `BudgetAllocationDto`   (full)
 * - `DELETE /finance/projects/{projectId}/budget/web/{costCategoryId}` → `204 No Content` (void)
 * - `GET    /finance/projects/{projectId}/cost-control/web`            → `ProjectCostControlDto` (query)
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  BudgetAllocation,
  parseBudgetAllocation,
  UpsertBudgetAllocationRequest,
  upsertBudgetAllocationToJson,
  ProjectCostControl,
  parseProjectCostControl,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const budgetBase = (projectId: number) =>
  `/finance/projects/${projectId}/budget/web`;

const costControlBase = (projectId: number) =>
  `/finance/projects/${projectId}/cost-control/web`;

/** Safely parse an allocation, converting parse failures into a 422 ApiError. */
function safeParseAllocation(data: ApiResponse): BudgetAllocation {
  try {
    return parseBudgetAllocation(data);
  } catch (error) {
    logger.error('Failed to parse budget-allocation data:', error);
    throw new ApiError(
      'Failed to process budget-allocation data. Please try again.',
      422
    );
  }
}

/** Safely parse a budget-allocation array. */
function safeParseAllocations(data: ApiResponse[]): BudgetAllocation[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseBudgetAllocation(item));
  } catch (error) {
    logger.error('Failed to parse budget-allocations data:', error);
    throw new ApiError(
      'Failed to process budget-allocations data. Please try again.',
      422
    );
  }
}

/**
 * Finance Project-Budget Service — project budget allocations and the derived
 * cost-control report.
 */
export const financeProjectBudgetService = {
  /**
   * Lists the budget allocations for a project.
   *
   * `GET /finance/projects/{projectId}/budget/web`
   *
   * @param projectId - Numeric id of the project.
   * @returns The {@link BudgetAllocation} records (one per allocated category).
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async getBudget(projectId: number): Promise<BudgetAllocation[]> {
    const data = await api.get<ApiResponse[]>(budgetBase(projectId));
    return safeParseAllocations(data);
  },

  /**
   * Creates or updates a project's allocation for a cost category.
   *
   * `PUT /finance/projects/{projectId}/budget/web/{costCategoryId}` →
   * `BudgetAllocationDto` (full).
   *
   * @param projectId - Numeric id of the project.
   * @param costCategoryId - UUID of the cost category to allocate to.
   * @param dto - The allocated amount ({@link UpsertBudgetAllocationRequest}).
   * @returns The upserted {@link BudgetAllocation}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async upsertAllocation(
    projectId: number,
    costCategoryId: string,
    dto: UpsertBudgetAllocationRequest
  ): Promise<BudgetAllocation> {
    const data = await api.put<ApiResponse>(
      `${budgetBase(projectId)}/${encodeURIComponent(costCategoryId)}`,
      upsertBudgetAllocationToJson(dto)
    );
    return safeParseAllocation(data);
  },

  /**
   * Deletes a project's allocation for a cost category.
   *
   * `DELETE /finance/projects/{projectId}/budget/web/{costCategoryId}` →
   * `204 No Content`.
   *
   * @param projectId - Numeric id of the project.
   * @param costCategoryId - UUID of the cost category whose allocation is removed.
   * @throws {ApiError} On non-2xx responses.
   */
  async deleteAllocation(
    projectId: number,
    costCategoryId: string
  ): Promise<void> {
    await api.delete<void>(
      `${budgetBase(projectId)}/${encodeURIComponent(costCategoryId)}`
    );
  },

  /**
   * Fetches the cost-control report for a project.
   *
   * `GET /finance/projects/{projectId}/cost-control/web` →
   * `ProjectCostControlDto`.
   *
   * @param projectId - Numeric id of the project.
   * @returns The {@link ProjectCostControl} report (per-category rows + totals).
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getCostControl(projectId: number): Promise<ProjectCostControl> {
    const data = await api.get<ApiResponse>(costControlBase(projectId));
    try {
      return parseProjectCostControl(data);
    } catch (error) {
      logger.error('Failed to parse project cost-control data:', error);
      throw new ApiError(
        'Failed to process project cost-control data. Please try again.',
        422
      );
    }
  },
};
