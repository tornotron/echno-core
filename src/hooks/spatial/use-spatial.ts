/**
 * @module use-spatial
 *
 * Query hooks for a project's site structure.
 */

import { useQuery } from '@tanstack/react-query';
import { spatialService } from '../../services/spatial-service';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import { spatialKeys } from './keys';

/**
 * Fetches the nested `Building > Floor > Zone > Element` tree of a project.
 * Disabled until `projectId` is known.
 *
 * @param projectId - The project, or `undefined` while it is still loading.
 * @param includeArchived - Also return archived nodes (default false).
 */
export function useSpatialTree(
  projectId: number | undefined,
  includeArchived = false
) {
  return useQuery({
    queryKey: spatialKeys.tree(projectId ?? 0, includeArchived),
    queryFn: () => spatialService.getTree(projectId as number, includeArchived),
    enabled: projectId !== undefined,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * Fetches one node with its breadcrumb. Disabled until both ids are known.
 */
export function useSpatialNode(
  projectId: number | undefined,
  nodeId: string | undefined
) {
  return useQuery({
    queryKey: spatialKeys.node(projectId ?? 0, nodeId ?? ''),
    queryFn: () =>
      spatialService.getNode(projectId as number, nodeId as string),
    enabled: projectId !== undefined && !!nodeId,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}
