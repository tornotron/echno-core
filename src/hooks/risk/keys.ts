/**
 * TanStack Query key factory for the risk register.
 *
 * Key shapes:
 * - `['risks']`: namespace root; the invalidation prefix.
 * - `['risks', 'project', projectId]`: one project's register.
 * - `['risks', 'project', projectId, riskId]`: one risk.
 */
export const riskKeys = {
  all: ['risks'] as const,
  project: (projectId: number) => [...riskKeys.all, 'project', projectId] as const,
  detail: (projectId: number, riskId: string) => [...riskKeys.project(projectId), riskId] as const,
};
