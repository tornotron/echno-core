/**
 * TanStack Query key factory for the Access domain.
 *
 * Key shapes:
 * - `['access']` — namespace root; used as an invalidation prefix.
 * - `['access', 'current-user']` — what the signed-in member may do in their
 *   current organization. Invalidate it when callers change their own roles
 *   or grants.
 *
 * @see {@link useCurrentUserAccess}
 */
export const accessKeys = {
  all: ['access'] as const,
  currentUser: () => [...accessKeys.all, 'current-user'] as const,
};
