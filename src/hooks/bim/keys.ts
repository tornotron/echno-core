/**
 * TanStack Query key factory for the BIM module.
 *
 * Key shapes:
 * - `['bim']` — namespace root; invalidation prefix.
 * - `['bim', 'project']` — every project's model list; invalidation prefix.
 * - `['bim', 'project', projectId, 'models']` — a project's models.
 * - `['bim', 'model', modelId]` — one model; prefix for its versions, elements and tiles.
 * - `['bim', 'model', modelId, 'version', versionId]` — one version.
 * - `['bim', 'model', modelId, 'version', versionId, 'tiles' | 'proposal' | 'jobs']`
 * - `['bim', 'model', modelId, 'elements', params]` — a page of elements.
 * - `['bim', 'model', modelId, 'element-by-guid', globalId, storeyGlobalId]`
 * - `['bim', 'element', elementId]` — one element by id.
 * - `['bim', 'job', jobId]` — one job, polled while active.
 */
export const bimKeys = {
  all: ['bim'] as const,
  projects: () => [...bimKeys.all, 'project'] as const,
  projectModels: (projectId: number) =>
    [...bimKeys.projects(), projectId, 'models'] as const,
  model: (modelId: string) => [...bimKeys.all, 'model', modelId] as const,
  version: (modelId: string, versionId: string) =>
    [...bimKeys.model(modelId), 'version', versionId] as const,
  versionJobs: (modelId: string, versionId: string) =>
    [...bimKeys.version(modelId, versionId), 'jobs'] as const,
  tiles: (modelId: string, versionId: string) =>
    [...bimKeys.version(modelId, versionId), 'tiles'] as const,
  proposal: (modelId: string, versionId: string) =>
    [...bimKeys.version(modelId, versionId), 'proposal'] as const,
  elements: (modelId: string, params: Record<string, unknown> = {}) =>
    [...bimKeys.model(modelId), 'elements', params] as const,
  elementByGlobalId: (modelId: string, globalId: string, storeyGlobalId?: string) =>
    [...bimKeys.model(modelId), 'element-by-guid', globalId, storeyGlobalId ?? ''] as const,
  element: (elementId: string) => [...bimKeys.all, 'element', elementId] as const,
  job: (jobId: string) => [...bimKeys.all, 'job', jobId] as const,
};
