/**
 * TanStack Query key factory for the Access domain.
 *
 * Key shapes:
 * - `['access']` — namespace root; used as an invalidation prefix.
 * - `['access', 'current-user']` — what the signed-in member may do in their
 *   current organization. Invalidate it when callers change their own roles
 *   or grants.
 * - `['access', 'catalog']` — the areas, actions and scopes the matrix shows.
 * - `['access', 'roles']`, `['access', 'groups']`, `['access', 'users']` — the
 *   Roles & Permissions screen's three lists. Each holds the whole list; the
 *   endpoints are not paged.
 *
 * @see {@link useCurrentUserAccess}
 */
export const accessKeys = {
  all: ['access'] as const,
  currentUser: () => [...accessKeys.all, 'current-user'] as const,
  catalog: () => [...accessKeys.all, 'catalog'] as const,
  roles: () => [...accessKeys.all, 'roles'] as const,
  groups: () => [...accessKeys.all, 'groups'] as const,
  users: () => [...accessKeys.all, 'users'] as const,
};
