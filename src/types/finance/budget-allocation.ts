/**
 * @module types/finance/budget-allocation
 *
 * The {@link BudgetAllocation} entity (a per-project, per-cost-category budget
 * line, backend `BudgetAllocationDto`) and its parser
 * {@link parseBudgetAllocation}, plus the {@link UpsertBudgetAllocationRequest}
 * write payload and its serializer.
 *
 * An allocation records how much of a project's budget is set aside for one
 * cost category. The project is keyed by its numeric surrogate id; the cost
 * category by its UUID.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  money,
  nullableString,
  numericId,
} from '../../lib/validation/backend-schema';

const BudgetAllocationResponseSchema = z.object({
  id: z.string().nullish(),
  projectId: numericId,
  costCategoryId: z.string().nullish(),
  costCategoryName: nullableString,
  allocatedAmount: money,
});

/** A per-project, per-cost-category budget allocation. */
export interface BudgetAllocation {
  /** UUID primary key. */
  id: string;
  /** Project the allocation belongs to. */
  projectId: number;
  /** UUID of the allocated cost category. */
  costCategoryId: string;
  /** Name of the allocated cost category. */
  costCategoryName: string;
  /** Amount allocated to the category. */
  allocatedAmount: number;
}

/**
 * Parses a raw budget-allocation payload into a typed {@link BudgetAllocation}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `BudgetAllocation`.
 * @throws {TypeError} If `id` / `costCategoryId` is missing or not a non-empty string.
 */
export function parseBudgetAllocation(json: unknown): BudgetAllocation {
  const raw = BudgetAllocationResponseSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseBudgetAllocation.id'),
    projectId: raw.projectId,
    costCategoryId: parseUuid(
      raw.costCategoryId,
      'parseBudgetAllocation.costCategoryId'
    ),
    costCategoryName: raw.costCategoryName ?? '',
    allocatedAmount: raw.allocatedAmount ?? 0,
  };
}

/** Fields for creating or updating a budget allocation. */
export interface UpsertBudgetAllocationRequest {
  /** Amount to allocate to the cost category. */
  allocatedAmount: number;
}

/**
 * Serializes an {@link UpsertBudgetAllocationRequest} into the backend request
 * body.
 *
 * @param dto - The upsert request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function upsertBudgetAllocationToJson(
  dto: UpsertBudgetAllocationRequest
): Record<string, unknown> {
  return { allocatedAmount: dto.allocatedAmount };
}
