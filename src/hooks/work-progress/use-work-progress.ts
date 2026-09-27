/**
 * @module use-work-progress
 *
 * Query hooks for the Work Progress module.
 */

import { useQuery } from '@tanstack/react-query';
import { workProgressService } from '../../services/work-progress-service';
import { shouldRetry } from '../../lib/query/retry';
import type { ProgressInspectionListParams } from '../../types/work-progress/work-progress';
import { workProgressKeys } from './keys';

/** One page of progress inspections, keyed on the list params. */
export function useProgressInspections(
  params: ProgressInspectionListParams = {},
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: workProgressKeys.list(params),
    queryFn: () => workProgressService.list(params),
    enabled: options.enabled ?? true,
    retry: shouldRetry,
  });
}

/** One record; disabled until an id is known. */
export function useProgressInspection(id: string | undefined) {
  return useQuery({
    queryKey: workProgressKeys.detail(id ?? ''),
    queryFn: () => workProgressService.get(id as string),
    enabled: Boolean(id),
    retry: shouldRetry,
  });
}

/** A record's registered evidence; disabled until an id is known. */
export function useProgressInspectionEvidence(id: string | undefined) {
  return useQuery({
    queryKey: workProgressKeys.evidence(id ?? ''),
    queryFn: () => workProgressService.getEvidence(id as string),
    enabled: Boolean(id),
    retry: shouldRetry,
  });
}
