/**
 * @module wbs-element-keys
 *
 * TanStack Query key factory for the WBS-element domain. Every key
 * is scoped to a single project — the WBS namespace has no
 * cross-project list.
 *
 * Key shapes:
 * - `['wbs-elements']` — namespace root; never used as a query key
 *   directly. Avoid invalidating against this prefix, as it would
 *   blast every project's WBS caches simultaneously.
 * - `['wbs-elements', 'project', projectId]` — the flat list of every
 *   element in one project, consumed by {@link useWbsElements}. Also
 *   the **prefix** of every other key in this factory (tree, leaves,
 *   detail) — see the mutation hooks for why exact-match writes /
 *   invalidations are used to avoid prefix-blasting.
 * - `['wbs-elements', 'project', projectId, 'tree']` — the
 *   hierarchical view, consumed by {@link useWbsTree}.
 * - `['wbs-elements', 'project', projectId, 'leaves']` — the
 *   leaf-only view, consumed by {@link useWbsLeaves}.
 * - `['wbs-elements', 'project', projectId, elementId]` — a single
 *   element by ID, consumed by {@link useWbsElement}.
 */

export const wbsElementKeys = {
  /** Namespace root — never use as a query key directly. */
  all: ['wbs-elements'] as const,

  /**
   * Query key for the flat list of every element in one project, and
   * the prefix of every more-specific key below.
   */
  byProject: (projectId: number) =>
    [...wbsElementKeys.all, 'project', projectId] as const,

  /** Query key for the project's WBS as a hierarchy with embedded `children`. */
  tree: (projectId: number) =>
    [...wbsElementKeys.byProject(projectId), 'tree'] as const,

  /** Query key for the leaves-only filter of the project's WBS. */
  leaves: (projectId: number) =>
    [...wbsElementKeys.byProject(projectId), 'leaves'] as const,

  /** Query key for a single element by ID, scoped to its project. */
  detail: (projectId: number, elementId: number) =>
    [...wbsElementKeys.byProject(projectId), elementId] as const,
};
