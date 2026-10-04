/**
 * @module types/work-category/work-subcategory
 *
 * A sub-category under a work category, such as Excavation under
 * Earthwork: what the task form's second dropdown offers once a category is
 * chosen. Each organization holds the standard list, seeded by the backend.
 *
 * A task keeps its sub-category as text (`Task.subCategory`), because the
 * form also takes one typed in by hand, so this list is the set of
 * suggestions and nothing more.
 */
import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { nullableString, opaque } from '../../lib/validation/backend-schema';

const WorkSubcategoryResponseSchema = z.object({
  id: opaque,
  categoryId: opaque,
  name: nullableString,
  description: nullableString,
});

/** One sub-category of a work category. */
export interface WorkSubcategory {
  /** Surrogate identifier. */
  id: number;

  /** The work category it sits under. */
  categoryId: number;

  /** Name shown in the dropdown and saved on a task when chosen. */
  name: string;

  /** What the sub-category covers. */
  description?: string;
}

/**
 * Parses one sub-category payload.
 *
 * @throws {TypeError} If `id` or `categoryId` is missing or not a positive integer.
 */
export function parseWorkSubcategory(json: unknown): WorkSubcategory {
  const raw = WorkSubcategoryResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseWorkSubcategory.id'),
    categoryId: parsePositiveInt(raw.categoryId, 'parseWorkSubcategory.categoryId'),
    name: raw.name ?? '',
    description: raw.description ?? undefined,
  };
}
