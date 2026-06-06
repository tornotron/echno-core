/**
 * hooks/work-category/work-category-keys.ts
 *
 * React Query key factory for work categories.
 */

export const workCategoryKeys = {
  all: ['work-categories'] as const,
  lists: () => [...workCategoryKeys.all, 'list'] as const,
  detail: (id: number) => [...workCategoryKeys.all, 'detail', id] as const,
};
