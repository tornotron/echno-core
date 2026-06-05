/**
 * @module hooks/user/user-keys
 *
 * TanStack Query key factory for the User domain.
 *
 * Key shapes:
 * - `['user']` — namespace root **and** the singleton query key for the
 *   current authenticated user. This deliberately violates the Milestone 1B
 *   "`all` = invalidation prefix only" convention: there is only one
 *   current user at a time, and existing call sites in `UserPrefetcher`,
 *   `profile-edit-form`, and cross-module invalidations from
 *   `useUpdateEmployee*` depend on this shape.
 * - `['user', 'list']` — placeholder for the unwired `readAllUsers`
 *   endpoint. Not consumed today.
 * - `['user', 'detail', id]` — placeholder for the unwired per-id
 *   user-fetch endpoint. Not consumed today.
 * - `['user', 'employees']` — every {@link Employee} membership for the
 *   current user; consumed by `useUserEmployees`.
 * - `['user', userId, 'organizations']` — placeholder for the unwired
 *   `readAllOrganizationsForCurrentUser_1` endpoint.
 *
 * @see {@link useUser} canonical consumer of the singleton key.
 * @see {@link useUserEmployees} canonical consumer of `employees()`.
 */

export const userKeys = {
  all: ['user'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  detail: (id: number) => [...userKeys.all, 'detail', id] as const,
  employees: () => [...userKeys.all, 'employees'] as const,
  organizationsForUser: (userId: number) =>
    [...userKeys.all, userId, 'organizations'] as const,
};
