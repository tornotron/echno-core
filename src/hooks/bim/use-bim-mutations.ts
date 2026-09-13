/**
 * @module use-bim-mutations
 *
 * Mutation hooks for the BIM module. Each invalidates the prefix it changed:
 * the project's model list on create, the model and the project's model list
 * on any version or hierarchy change (the list carries the nested versions and
 * status the web renders), the project's spatial tree on a confirmed hierarchy.
 *
 * `bimKeys.model(id)` does not nest under the project list, so every
 * model-level hook takes an optional `projectId`; without it the whole
 * `['bim', 'project']` prefix is invalidated instead.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bimService } from '../../services/bim-service';
import { spatialKeys } from '../spatial/keys';
import {
  ConfirmBimHierarchyRequest,
  CreateBimModelRequest,
  MergeBimElementRequest,
  PresignBimSourceRequest,
} from '../../types/bim/bim';
import { bimKeys } from './keys';

/** Invalidates a model and the list of the project it belongs to. */
function invalidateModel(
  queryClient: ReturnType<typeof useQueryClient>,
  modelId: string,
  projectId?: number
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: bimKeys.model(modelId) }),
    queryClient.invalidateQueries({
      queryKey: projectId === undefined ? bimKeys.projects() : bimKeys.projectModels(projectId),
    }),
  ]).then(() => undefined);
}

/** Registers a model on a project. Mutate with the {@link CreateBimModelRequest}. */
export function useCreateBimModel(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateBimModelRequest) => bimService.createModel(projectId, req),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: bimKeys.projectModels(projectId) }),
  });
}

/** Creates the next version and returns its presigned PUT. Mutate with the request. */
export function usePresignBimSource(modelId: string, projectId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: PresignBimSourceRequest) => bimService.presignSource(modelId, req),
    onSuccess: () => invalidateModel(queryClient, modelId, projectId),
  });
}

/** Confirms the PUT landed. Mutate with `{ versionId }`. */
export function useRegisterBimSource(modelId: string, projectId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId }: { versionId: string }) =>
      bimService.registerSource(modelId, versionId),
    onSuccess: () => invalidateModel(queryClient, modelId, projectId),
  });
}

/** Queues the worker import of a version. Mutate with `{ versionId }`. */
export function useEnqueueBimImport(modelId: string, projectId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId }: { versionId: string }) =>
      bimService.enqueueImport(modelId, versionId),
    onSuccess: (job) => {
      queryClient.setQueryData(bimKeys.job(job.id), job);
      return invalidateModel(queryClient, modelId, projectId);
    },
  });
}

/** Regenerates the hierarchy proposal of a version. Mutate with `{ versionId }`. */
export function useRegenerateBimHierarchyProposal(modelId: string, projectId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId }: { versionId: string }) =>
      bimService.regenerateHierarchyProposal(modelId, versionId),
    onSuccess: (proposal, { versionId }) => {
      queryClient.setQueryData(bimKeys.proposal(modelId, versionId), proposal);
      return invalidateModel(queryClient, modelId, projectId);
    },
  });
}

/**
 * Confirms the proposal into the project's site structure. Mutate with
 * `{ versionId, data }`. Invalidates the project's spatial tree as well as
 * the model, since the confirm creates nodes there.
 */
export function useConfirmBimHierarchy(modelId: string, projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      versionId,
      data,
    }: {
      versionId: string;
      data?: ConfirmBimHierarchyRequest;
    }) => bimService.confirmHierarchy(modelId, versionId, data),
    onSuccess: (proposal, { versionId }) => {
      queryClient.setQueryData(bimKeys.proposal(modelId, versionId), proposal);
      return Promise.all([
        invalidateModel(queryClient, modelId, projectId),
        queryClient.invalidateQueries({ queryKey: spatialKeys.project(projectId) }),
      ]);
    },
  });
}

/** Merges a retired element into its replacement. Mutate with `{ elementId, data }`. */
export function useMergeBimElement(modelId: string, projectId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ elementId, data }: { elementId: string; data: MergeBimElementRequest }) =>
      bimService.mergeElement(elementId, data),
    onSuccess: (element, { elementId, data }) => {
      queryClient.setQueryData(bimKeys.element(elementId), element);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: bimKeys.element(data.intoElementId) }),
        invalidateModel(queryClient, modelId, projectId),
      ]);
    },
  });
}
