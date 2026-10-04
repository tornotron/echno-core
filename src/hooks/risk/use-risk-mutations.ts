/**
 * @module use-risk-mutations
 *
 * Mutation hooks for a project's risk register. Each one invalidates the
 * project's register, so the list re-reads with the server's R-numbers and
 * scores.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { riskService } from '../../services/risk-service';
import type { RiskRequest } from '../../types/risk/risk';
import { riskKeys } from './keys';

function useInvalidateRegister(projectId: number) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: riskKeys.project(projectId) });
}

/** Records a risk. Mutate with the request. */
export function useCreateRisk(projectId: number) {
  const invalidate = useInvalidateRegister(projectId);
  return useMutation({
    mutationFn: (req: RiskRequest) => riskService.create(projectId, req),
    onSuccess: invalidate,
  });
}

/** Changes a risk. Mutate with `{ riskId, request }`. */
export function useUpdateRisk(projectId: number) {
  const invalidate = useInvalidateRegister(projectId);
  return useMutation({
    mutationFn: ({ riskId, request }: { riskId: string; request: RiskRequest }) =>
      riskService.update(projectId, riskId, request),
    onSuccess: invalidate,
  });
}

/** Removes a risk. Mutate with its id. */
export function useDeleteRisk(projectId: number) {
  const invalidate = useInvalidateRegister(projectId);
  return useMutation({
    mutationFn: (riskId: string) => riskService.delete(projectId, riskId),
    onSuccess: invalidate,
  });
}

/** Imports risks. Mutate with the list; resolves to the risks added. */
export function useImportRisks(projectId: number) {
  const invalidate = useInvalidateRegister(projectId);
  return useMutation({
    mutationFn: (risks: RiskRequest[]) => riskService.importRisks(projectId, risks),
    onSuccess: invalidate,
  });
}
