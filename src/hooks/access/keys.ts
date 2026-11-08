/**
 * TanStack Query key factory for the Access domain.
 *
 * Key shapes:
 * - `['access']`: namespace root; used as an invalidation prefix.
 * - `['access', 'current-user']`: what the signed-in member may do in their
 *   current organization.
 * - `['access', 'catalog']`: the areas, actions and scopes the matrix shows.
 * - `['access', 'roles']`, `['access', 'users']`: the Roles & Permissions
 *   screen's two lists. Each holds the whole list; the endpoints are not
 *   paged.
 * - `['access', 'roles', roleId]`, `['access', 'users', employeeId]`: one
 *   role or person, nested under its list so invalidating the list refreshes
 *   the open details panel too.
 *
 * @see {@link useCurrentUserAccess}
 */
export const accessKeys = {
  all: ['access'] as const,
  currentUser: () => [...accessKeys.all, 'current-user'] as const,
  catalog: () => [...accessKeys.all, 'catalog'] as const,
  roles: () => [...accessKeys.all, 'roles'] as const,
  role: (roleId: string) => [...accessKeys.roles(), roleId] as const,
  users: () => [...accessKeys.all, 'users'] as const,
  user: (employeeId: number) => [...accessKeys.users(), employeeId] as const,
};
