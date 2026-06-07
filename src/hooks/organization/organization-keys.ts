/**
 * hooks/organization/organization-keys.ts
 *
 * React Query key factory for the Organization domain.
 *
 * `detail(id)` migrated during Milestone 7 from the pre-existing
 * `['organizations', id]` shape to the canonical `['organizations', 'detail', id]`
 * shape (Milestone 1B convention).
 */

export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  detail: (id: number) => [...organizationKeys.all, 'detail', id] as const,
};
