/**
 * @module task-keys
 *
 * TanStack Query key factory for the task domain.
 *
 * Key shapes:
 * - `['tasks']` — namespace root. **Invalidation prefix only**; query
 *   consumers use `lists()`, `detail(id)`, or `byProject(projectId)`
 *   directly.
 * - `['tasks', 'list']` — main task list (returned by {@link useTasks}).
 * - `['tasks', id]` — single task detail. The numeric second segment is
 *   the discriminator that distinguishes detail entries from list-style
 *   caches; the `isTaskListCache` predicate in
 *   `use-task-mutations.ts` relies on `typeof key[1] !== 'number'` to
 *   skip detail entries when patching every list cache in one pass.
 * - `['tasks', 'project', projectId]` — tasks scoped to one project
 *   (returned by `useTasksByProject`).
 */
export const taskKeys = {
  /** Invalidation prefix for the entire task namespace. */
  all: ['tasks'] as const,

  /** Main task list query key. */
  lists: () => [...taskKeys.all, 'list'] as const,

  /**
   * Single task detail query key. The numeric segment doubles as the
   * detail discriminator — see the module-level note above.
   */
  detail: (id: number) => [...taskKeys.all, id] as const,

  /** Tasks scoped to one project. */
  byProject: (projectId: number) =>
    [...taskKeys.all, 'project', projectId] as const,
};
