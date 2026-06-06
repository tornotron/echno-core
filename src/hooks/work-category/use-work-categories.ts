import { useQuery } from '@tanstack/react-query';
import { workCategoryService } from '../../services/work-category-service';
import { shouldRetry } from '../../lib/query/retry';
import { staticQueryOptions } from '../../lib/query/options';
import { workCategoryKeys } from './work-category-keys';

/**
 * Hook to fetch all work categories.
 *
 * Work categories are reference data with low volatility — uses the
 * `staticQueryOptions` profile (staleTime 10 min, gcTime 30 min, no
 * window-focus refetch).
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
 * Hook to fetch a single work category by ID.
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
