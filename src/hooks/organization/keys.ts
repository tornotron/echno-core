/**
 * TanStack Query key factory for the Organization domain.
 *
 * Key shapes:
 * - `['organizations']` — namespace root; used both as an invalidation prefix
 *   and as the list query key for `useOrganizations` (preserves data prefetched
 *   at auth bootstrap — see `useOrganizations` for details).
 * - `['organizations', 'list']` — explicit list key; reserved for future
 *   paginated or filtered list queries.
 * - `['organizations', 'detail', id]` — single organization detail.
 *
 * @see {@link useOrganizations}
 * @see {@link useOrganization}
 */
export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  detail: (id: number) => [...organizationKeys.all, 'detail', id] as const,
};
