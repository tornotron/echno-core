/**
 * @module use-risks
 *
 * Query hooks for a project's risk register.
 */

import { useQuery } from '@tanstack/react-query';
import { riskService } from '../../services/risk-service';
import { shouldRetry } from '../../lib/query/retry';
import { riskKeys } from './keys';

/** The project's register; disabled until a project id is known. */
export function useRisks(projectId: number | undefined) {
  return useQuery({
    queryKey: riskKeys.project(projectId ?? 0),
    queryFn: () => riskService.list(projectId as number),
    enabled: Boolean(projectId),
    retry: shouldRetry,
  });
}

/** One risk; disabled until both ids are known. */
export function useRisk(projectId: number | undefined, riskId: string | undefined) {
  return useQuery({
    queryKey: riskKeys.detail(projectId ?? 0, riskId ?? ''),
    queryFn: () => riskService.get(projectId as number, riskId as string),
    enabled: Boolean(projectId) && Boolean(riskId),
    retry: shouldRetry,
  });
}
