/**
 * @module use-spatial-mutations
 *
 * Mutation hooks for a project's site structure. Each one takes the project
 * id up front and invalidates that project's spatial prefix on success, so
 * the tree and any open node refetch together.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { spatialService } from '../../services/spatial-service';
import {
  CreateSpatialNodeRequest,
  MoveSpatialNodeRequest,
  SpatialImportRequest,
  UpdateSpatialNodeRequest,
} from '../../types/spatial/spatial';
import { spatialKeys } from './keys';

function useInvalidateProject(projectId: number) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: spatialKeys.project(projectId) });
}

/** Adds a node. Mutate with the {@link CreateSpatialNodeRequest}. */
export function useCreateSpatialNode(projectId: number) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (req: CreateSpatialNodeRequest) =>
      spatialService.createNode(projectId, req),
    onSuccess: invalidate,
  });
}

/** Renames or re-labels a node. Mutate with `{ nodeId, data }`. */
export function useUpdateSpatialNode(projectId: number) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: ({
      nodeId,
      data,
    }: {
      nodeId: string;
      data: UpdateSpatialNodeRequest;
    }) => spatialService.updateNode(projectId, nodeId, data),
    onSuccess: invalidate,
  });
}

/** Re-parents a node. Mutate with `{ nodeId, data }`. */
export function useMoveSpatialNode(projectId: number) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: ({
      nodeId,
      data,
    }: {
      nodeId: string;
      data: MoveSpatialNodeRequest;
    }) => spatialService.moveNode(projectId, nodeId, data),
    onSuccess: invalidate,
  });
}

/** Archives a node and its subtree. Mutate with the node id. */
export function useArchiveSpatialNode(projectId: number) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (nodeId: string) =>
      spatialService.archiveNode(projectId, nodeId),
    onSuccess: invalidate,
  });
}

/** Restores an archived node and its subtree. Mutate with the node id. */
export function useRestoreSpatialNode(projectId: number) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (nodeId: string) =>
      spatialService.restoreNode(projectId, nodeId),
    onSuccess: invalidate,
  });
}

/** Bulk-imports rows. Mutate with the {@link SpatialImportRequest}. */
export function useImportSpatialRows(projectId: number) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (req: SpatialImportRequest) =>
      spatialService.importRows(projectId, req),
    onSuccess: invalidate,
  });
}
