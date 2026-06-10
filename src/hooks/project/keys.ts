/**
 * @module project-keys
 *
 * TanStack Query key factory for the project domain.
 *
 * Key shapes:
 * - `['projects']` — namespace root. **Invalidation prefix only**; query
 *   consumers use `lists()` or `detail(id)` directly.
 * - `['projects', 'list']` — main project list (returned by
 *   {@link useProjects}).
 * - `['projects', 'list', filters]` — filtered list variant.
 * - `['projects', 'detail']` — discriminator segment (never used as a query
 *   key on its own; included so `detail(id)` can be invalidated via prefix).
 * - `['projects', 'detail', id]` — single project detail.
 * - `['projects', 'organization', orgId]` — projects under one organization.
 * - `['projects', 'employee', employeeId]` — projects an employee belongs to.
 * - `['projects', 'members', projectId]` — standalone member list for a
 *   project (returned by `useEmployeesByProject`).
 *
 * The `members` shape lives under the `projects` namespace because the
 * data is owned by the project module even though it carries `Employee[]`.
 * Mutations use the `isProjectListCache` predicate to patch every
 * `Project[]` list cache in one pass while skipping `detail` and `members`
 * entries that share the root but carry different shapes.
 */
export const projectKeys = {
  /** Invalidation prefix for the entire project namespace. */
  all: ['projects'] as const,

  /** Main project list query key. */
  lists: () => [...projectKeys.all, 'list'] as const,

  /** Filtered list variant. */
  list: (filters?: Record<string, unknown>) =>
    [...projectKeys.lists(), filters] as const,

  /** Detail discriminator prefix (used for bulk invalidation of detail entries). */
  details: () => [...projectKeys.all, 'detail'] as const,

  /** Single project detail query key. */
  detail: (id: number) => [...projectKeys.details(), id] as const,

  /** Projects scoped to a single organization. */
  byOrganization: (orgId: number) =>
    [...projectKeys.all, 'organization', orgId] as const,

  /** Projects an employee is a member of. */
  byEmployee: (employeeId: number) =>
    [...projectKeys.all, 'employee', employeeId] as const,

  /** Standalone member list for a single project. */
  members: (projectId: number) =>
    [...projectKeys.all, 'members', projectId] as const,
};
