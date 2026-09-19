/**
 * @module use-toolbox-talks-mutations
 *
 * Mutation hooks for the Toolbox Talks domain. Each invalidates the
 * domain prefix on success, so every list page and open detail refetch
 * together.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toolboxTalksService } from '../../services/toolbox-talks-service';
import {
  CreateToolboxTalksRequest,
  UpdateToolboxTalksRequest,
} from '../../types/toolbox-talks/toolbox-talks';
import { toolboxTalksKeys } from './keys';

function useInvalidateToolboxTalks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: toolboxTalksKeys.all });
}

/** Creates a record. Mutate with the {@link CreateToolboxTalksRequest}. */
export function useCreateToolboxTalks() {
  const invalidate = useInvalidateToolboxTalks();
  return useMutation({
    mutationFn: (req: CreateToolboxTalksRequest) => toolboxTalksService.create(req),
    onSuccess: invalidate,
  });
}

/** Updates a record. Mutate with `{ id, data }`. */
export function useUpdateToolboxTalks() {
  const invalidate = useInvalidateToolboxTalks();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateToolboxTalksRequest }) =>
      toolboxTalksService.update(id, data),
    onSuccess: invalidate,
  });
}
