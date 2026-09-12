/**
 * TanStack Query key factory for a project's site structure.
 *
 * Key shapes:
 * - `['spatial']` — namespace root; invalidation prefix.
 * - `['spatial', 'tree', projectId, includeArchived]` — the nested tree.
 * - `['spatial', 'node', projectId, nodeId]` — one node with its breadcrumb.
 *
 * Every mutation invalidates `spatialKeys.project(projectId)`, the prefix
 * both shapes share, so a rename or archive refreshes the tree and any
 * open node in one sweep.
 */
export const spatialKeys = {
  all: ['spatial'] as const,
  project: (projectId: number) => [...spatialKeys.all, projectId] as const,
  tree: (projectId: number, includeArchived = false) =>
    [...spatialKeys.project(projectId), 'tree', includeArchived] as const,
  node: (projectId: number, nodeId: string) =>
    [...spatialKeys.project(projectId), 'node', nodeId] as const,
};
