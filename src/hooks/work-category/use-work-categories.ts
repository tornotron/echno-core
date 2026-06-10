/**
 * @module use-work-categories
 *
 * TanStack Query hooks for reading work categories. Mutations live in
 * {@link useCreateWorkCategory} and {@link useDeleteWorkCategory}.
 */
import { useQuery } from '@tanstack/react-query';
import { workCategoryService } from '../../services/work-category-service';
import { shouldRetry } from '../../lib/query/retry';
import { staticQueryOptions } from '../../lib/query/options';
import { workCategoryKeys } from './keys';

/**
 * Fetches every work category.
 *
 * Uses the **static** query profile (`staleTime` 10 min, `gcTime` 30 min) —
 * work categories are low-volatility reference data so cached entries serve
 * most renders without a network round-trip. Retries follow {@link shouldRetry}.
 *
 * @returns A TanStack `UseQueryResult` wrapping `WorkCategory[]`.
 */
export function useWorkCategories() {
  return useQuery({
    queryKey: workCategoryKeys.lists(),
    queryFn: () => workCategoryService.getAll(),
    ...staticQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * Fetches a single work category by ID.
 *
 * Uses the **static** query profile (`staleTime` 10 min, `gcTime` 30 min).
 * The query is disabled until `id` is truthy.
 *
 * @param id - Surrogate ID of the work category. Pass `undefined` to defer
 *   the query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping a single `WorkCategory`.
 */
export function useWorkCategory(id?: number) {
  return useQuery({
    queryKey: workCategoryKeys.detail(id ?? 0),
    queryFn: () => {
      if (!id) {
        throw new Error('Work category ID is required');
      }
      return workCategoryService.getById(id);
    },
    enabled: !!id,
    ...staticQueryOptions,
    retry: shouldRetry,
  });
}
