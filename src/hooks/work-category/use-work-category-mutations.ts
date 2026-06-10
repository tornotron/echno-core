/**
 * @module use-work-category-mutations
 *
 * TanStack mutation hooks for the work-category domain. Read-side hooks
 * live in {@link useWorkCategories} and {@link useWorkCategory}.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workCategoryService } from '../../services/work-category-service';
import { CreateWorkCategoryRequest, WorkCategory } from '../../types/work-category';
import { logger } from '../../lib/logger';
import { workCategoryKeys } from './keys';

/**
 * Creates a new work category.
 *
 * Backend response: `CategorySimpleDto` (partial — `WorkCategory` is a flat
 * type with no nested arrays, so the partial shape only loses optional
 * scalars like `description`, `icon`, and `image`).
 *
 * On success:
 * - `setQueryData(workCategoryKeys.detail(newCategory.id), newCategory)` —
 *   seeds the detail cache with the (possibly partial) response so an
 *   immediate read returns a value rather than triggering a fetch.
 * - `setQueryData(workCategoryKeys.lists(), append)` — appends the new
 *   category to the cached list, avoiding a full list refetch.
 * - `invalidateQueries(workCategoryKeys.detail(newCategory.id))` — kept so
 *   the next observer of the detail key pulls the canonical `CategoryDto`,
 *   reconciling any optional scalar fields the partial response omitted.
 *
 * Errors are logged via {@link logger}; the mutation result still surfaces
 * the error to the caller via `onError`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   a {@link CreateWorkCategoryRequest}.
 */
export function useCreateWorkCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateWorkCategoryRequest) =>
      workCategoryService.create(dto),
    onSuccess: (newCategory) => {
      // POST /category/web → CategorySimpleDto (partial). WorkCategory is a
      // flat type (id, name, description?, icon?, image?), so the partial
      // response may omit optional scalar fields. Seed detail + append to
      // the list, then invalidate detail so the next observer pulls the
      // canonical CategoryDto.
      queryClient.setQueryData(
        workCategoryKeys.detail(newCategory.id),
        newCategory
      );
      queryClient.setQueryData<WorkCategory[]>(
        workCategoryKeys.lists(),
        (old) => (old ? [...old, newCategory] : [newCategory])
      );
      queryClient.invalidateQueries({
        queryKey: workCategoryKeys.detail(newCategory.id),
      });
    },
    onError: (error) => {
      logger.error('Failed to create work category:', error);
    },
  });
}

/**
 * Deletes a work category by ID.
 *
 * Backend response: `ApiResponse` (ack only).
 *
 * On success:
 * - `removeQueries(workCategoryKeys.detail(id))` — evicts the detail entry
 *   since the entity no longer exists and any refetch would 404.
 * - `setQueryData(workCategoryKeys.lists(), filter)` — drops the deleted
 *   category from the cached list without a network round-trip.
 *
 * No invalidations are kept: with the entity gone, every consequence of the
 * delete is local-cache cleanup.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   the numeric ID of the category to delete.
 */
export function useDeleteWorkCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: workCategoryService.delete,
    onSuccess: (_data, id) => {
      // DELETE /category/web/{id} → ApiResponse (ack).
      // Evict detail + filter from list cache.
      queryClient.removeQueries({ queryKey: workCategoryKeys.detail(id) });
      queryClient.setQueryData<WorkCategory[]>(
        workCategoryKeys.lists(),
        (old) => old?.filter((c) => c.id !== id)
      );
    },
    onError: (error) => {
      logger.error('Failed to delete work category:', error);
    },
  });
}
