/**
 * @module use-reinspections
 *
 * Query and mutation hooks for reinspection attempts.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reinspectionService } from '../../services/reinspection-service';
import type {
  Reinspection,
  ReinspectionOutcomeRequest,
  ScheduleReinspectionRequest,
} from '../../types/inspection';
import { standardQueryOptions } from '../../lib/query/options';
import { shouldRetry } from '../../lib/query/retry';
import {
  inspectionEventKeys,
  inspectionKeys,
  ncrKeys,
  reinspectionKeys,
} from './keys';

/**
 * Every attempt on one NCR, in sequence order. Disabled until the id
 * resolves, so it is safe to call before a route param arrives.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 *
 * @param ncrId - UUID of the report.
 * @returns A TanStack `UseQueryResult` wrapping `Reinspection[]`.
 */
export function useReinspectionsByNcr(ncrId?: string) {
  return useQuery({
    queryKey: reinspectionKeys.byNcr(ncrId ?? ''),
    queryFn: () => reinspectionService.getByNcr(ncrId as string),
    enabled: !!ncrId,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * One attempt by id. Disabled until the id resolves.
 *
 * @param id - UUID of the attempt.
 * @returns A TanStack `UseQueryResult` wrapping `Reinspection`.
 */
export function useReinspection(id?: string) {
  return useQuery({
    queryKey: reinspectionKeys.detail(id ?? ''),
    queryFn: () => reinspectionService.getById(id as string),
    enabled: !!id,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * What a reinspection change touches. An attempt is a row of its own, but
 * scheduling one creates an inspection and recording its outcome moves the
 * NCR (or defect), and both write to the event log; every one of those
 * caches is stale afterwards.
 */
function useReinspectionInvalidation() {
  const queryClient = useQueryClient();
  return (attempt: Reinspection) => {
    queryClient.invalidateQueries({ queryKey: reinspectionKeys.all });
    queryClient.invalidateQueries({ queryKey: inspectionEventKeys.all });
    queryClient.invalidateQueries({ queryKey: inspectionKeys.lists() });
    queryClient.invalidateQueries({
      queryKey: inspectionKeys.detail(attempt.originalInspectionId),
    });
    queryClient.invalidateQueries({
      queryKey: inspectionKeys.detail(attempt.reinspectionInspectionId),
    });
    queryClient.invalidateQueries({ queryKey: ncrKeys.lists() });
    if (attempt.ncrId) {
      queryClient.invalidateQueries({
        queryKey: ncrKeys.detail(attempt.ncrId),
      });
    }
  };
}

/**
 * Schedules a re-check of an NCR's corrective work.
 *
 * `POST /ncrs/web/{ncrId}/reinspections`. On success invalidates the
 * attempts, the event log, the NCR and both inspections (a new one now
 * exists, so the inspection lists are stale too).
 *
 * @returns A TanStack `UseMutationResult` whose mutate function takes
 *   `{ ncrId, req? }`.
 */
export function useScheduleReinspectionForNcr() {
  const invalidate = useReinspectionInvalidation();
  return useMutation({
    mutationFn: ({
      ncrId,
      req,
    }: {
      ncrId: string;
      req?: ScheduleReinspectionRequest;
    }) => reinspectionService.scheduleForNcr(ncrId, req),
    onSuccess: (attempt) => invalidate(attempt),
  });
}

/**
 * Schedules a re-check of a resolved defect that has no NCR.
 *
 * `POST /inspections/web/defects/{defectId}/reinspections`. Same
 * invalidation as the NCR path.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function takes
 *   `{ defectId, req? }`.
 */
export function useScheduleReinspectionForDefect() {
  const invalidate = useReinspectionInvalidation();
  return useMutation({
    mutationFn: ({
      defectId,
      req,
    }: {
      defectId: string;
      req?: ScheduleReinspectionRequest;
    }) => reinspectionService.scheduleForDefect(defectId, req),
    onSuccess: (attempt) => invalidate(attempt),
  });
}

/**
 * Records what a re-check found.
 *
 * `POST /inspections/web/reinspections/{id}/outcome`. A `failed` outcome
 * moves the NCR to `rejected` server-side, so the NCR detail is invalidated
 * along with the attempts and the event log.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function takes
 *   `{ id, req }`.
 */
export function useRecordReinspectionOutcome() {
  const invalidate = useReinspectionInvalidation();
  return useMutation({
    mutationFn: ({ id, req }: { id: string; req: ReinspectionOutcomeRequest }) =>
      reinspectionService.recordOutcome(id, req),
    onSuccess: (attempt) => invalidate(attempt),
  });
}
