/**
 * @module work-category-keys
 *
 * TanStack Query key factory for the work-category domain.
 *
 * Key shapes:
 * - `['work-categories']` — namespace root, invalidation prefix only; never
 *   used as a query key directly.
 * - `['work-categories', 'list']` — the full collection (one cache entry
 *   shared by {@link useWorkCategories}).
 * - `['work-categories', 'detail', id]` — a single category by id, consumed
 *   by {@link useWorkCategory}.
 */
export const workCategoryKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['work-categories'] as const,

  /** Query key for the full work-category list. */
  lists: () => [...workCategoryKeys.all, 'list'] as const,

  /** Query key for a single work category by ID. */
  detail: (id: number) => [...workCategoryKeys.all, 'detail', id] as const,
};
