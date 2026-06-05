/**
 * @module hooks/organization/organization-keys
 *
 * TanStack Query key factory for the Organization domain.
 *
 * Key shapes:
 * - `['organizations']` — namespace root **and** the list cache key for
 *   `useOrganizations`. Deliberately diverges from the project-wide
 *   "`all` = invalidation-prefix only" convention because
 *   `use-organization-prefetch.ts` seeds at `organizationKeys.all` on auth
 *   bootstrap; renaming would touch every prefetch and provider call site.
 * - `['organizations', 'list']` — placeholder; declared for symmetry with
 *   other modules. Not consumed today.
 * - `['organizations', 'detail', id]` — single organization.
 *
 * @see {@link useOrganizations} canonical consumer of the list shape.
 * @see {@link useOrganization} canonical consumer of `detail(id)`.
 */

export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  detail: (id: number) => [...organizationKeys.all, 'detail', id] as const,
};
