/**
 * @module types/finance/cost-category
 *
 * The {@link CostCategory} entity (a project-budgeting cost category, backend
 * `CostCategoryDto`) and its parser {@link parseCostCategory}, plus the
 * {@link CreateCostCategoryRequest} / {@link UpdateCostCategoryRequest} write
 * payloads and their serializers.
 *
 * A cost category groups project spend for budgeting and cost control and may
 * optionally bind to a chart-of-accounts expense account (the `expenseAccount*`
 * fields) so committed / spent amounts roll up against the general ledger.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  nullableBoolean,
  nullableString,
} from '../../lib/validation/backend-schema';

const CostCategoryResponseSchema = z.object({
  id: z.string().nullish(),
  name: nullableString,
  code: nullableString,
  expenseAccountId: nullableString,
  expenseAccountCode: nullableString,
  active: nullableBoolean,
});

/** A project-budgeting cost category. */
export interface CostCategory {
  /** UUID primary key. */
  id: string;
  /** Category name. */
  name: string;
  /** Optional human-facing category code. */
  code?: string | null;
  /** UUID of the bound expense account, if any. */
  expenseAccountId?: string | null;
  /** Human-facing code of the bound expense account, if any. */
  expenseAccountCode?: string | null;
  /** Whether the category is active. */
  active: boolean;
}

/**
 * Parses a raw cost-category payload into a typed {@link CostCategory}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `CostCategory`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseCostCategory(json: unknown): CostCategory {
  const raw = CostCategoryResponseSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseCostCategory.id'),
    name: raw.name ?? '',
    code: raw.code ?? null,
    expenseAccountId: raw.expenseAccountId ?? null,
    expenseAccountCode: raw.expenseAccountCode ?? null,
    active: raw.active ?? true,
  };
}

/** Fields for creating a cost category. */
export interface CreateCostCategoryRequest {
  /** Category name. Required. */
  name: string;
  /** Optional category code. */
  code?: string | null;
  /** UUID of the expense account to bind. */
  expenseAccountId?: string | null;
}

/**
 * Serializes a {@link CreateCostCategoryRequest} into the backend request body,
 * emitting only the fields that are set.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function createCostCategoryToJson(
  dto: CreateCostCategoryRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = { name: dto.name };
  if (dto.code !== undefined) json.code = dto.code;
  if (dto.expenseAccountId !== undefined)
    json.expenseAccountId = dto.expenseAccountId;
  return json;
}

/** Fields for updating a cost category (full replacement). */
export interface UpdateCostCategoryRequest {
  /** Category name. Required. */
  name: string;
  /** Optional category code. */
  code?: string | null;
  /** UUID of the expense account to bind. */
  expenseAccountId?: string | null;
  /** Whether the category is active. Required. */
  active: boolean;
}

/**
 * Serializes an {@link UpdateCostCategoryRequest} into the backend request body.
 *
 * @param dto - The update request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function updateCostCategoryToJson(
  dto: UpdateCostCategoryRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    name: dto.name,
    active: dto.active,
  };
  if (dto.code !== undefined) json.code = dto.code;
  if (dto.expenseAccountId !== undefined)
    json.expenseAccountId = dto.expenseAccountId;
  return json;
}
