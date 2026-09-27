/**
 * @module use-wbs-mutations
 *
 * Mutation hooks for a project's schedule. Each invalidates the domain
 * prefix on success, so every open schedule refetches.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { wbsService } from '../../services/wbs-service';
import type {
  CreateWbsActivityRequest,
  CreateWbsDependencyRequest,
  UpdateWbsActivityRequest,
} from '../../types/wbs/wbs';
import { wbsKeys } from './keys';

function useInvalidateWbs() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: wbsKeys.all });
}

/** Adds an activity. Mutate with `{ projectId, data }`. */
export function useCreateWbsActivity() {
  const invalidate = useInvalidateWbs();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: CreateWbsActivityRequest }) =>
      wbsService.createActivity(projectId, data),
    onSuccess: invalidate,
  });
}

/** Changes an activity. Mutate with `{ projectId, elementId, data }`. */
export function useUpdateWbsActivity() {
  const invalidate = useInvalidateWbs();
  return useMutation({
    mutationFn: ({
      projectId,
      elementId,
      data,
    }: {
      projectId: number;
      elementId: number;
      data: UpdateWbsActivityRequest;
    }) => wbsService.updateActivity(projectId, elementId, data),
    onSuccess: invalidate,
  });
}

/** Deletes an activity. Mutate with `{ projectId, elementId }`. */
export function useDeleteWbsActivity() {
  const invalidate = useInvalidateWbs();
  return useMutation({
    mutationFn: ({ projectId, elementId }: { projectId: number; elementId: number }) =>
      wbsService.deleteActivity(projectId, elementId),
    onSuccess: invalidate,
  });
}

/** Links two activities. Mutate with `{ projectId, data }`. */
export function useAddWbsDependency() {
  const invalidate = useInvalidateWbs();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: CreateWbsDependencyRequest }) =>
      wbsService.addDependency(projectId, data),
    onSuccess: invalidate,
  });
}

/** Removes a link. Mutate with `{ projectId, dependencyId }`. */
export function useRemoveWbsDependency() {
  const invalidate = useInvalidateWbs();
  return useMutation({
    mutationFn: ({ projectId, dependencyId }: { projectId: number; dependencyId: number }) =>
      wbsService.removeDependency(projectId, dependencyId),
    onSuccess: invalidate,
  });
}
