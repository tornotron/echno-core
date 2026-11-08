/**
 * @module use-observations
 *
 * Query and mutation hooks for observations: the pending queue, one
 * observation and its evidence, recording a human observation, the review
 * decision, and the bulk decision on many.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ObservationListParams,
  observationService,
} from '../../services/observation-service';
import type {
  CreateObservationRequest,
  Observation,
  ReviewBatchRequest,
  ReviewObservationRequest,
} from '../../types/inspection';
import { ObservationOutcomeKind } from '../../types/inspection';
import { standardQueryOptions } from '../../lib/query/options';
import { shouldRetry } from '../../lib/query/retry';
import {
  inspectionEventKeys,
  inspectionKeys,
  ncrKeys,
  observationKeys,
} from './keys';

/**
 * One page of observations, filtered. Pass `reviewStatus: 'pending'` for the
 * review queue. Disabled until a project or an inspection is named, so it
 * is safe to call before a route param arrives; `keepPreviousData` keeps
 * the current page visible while the next loads.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 *
 * @param params - Filters and paging.
 * @returns A TanStack `UseQueryResult` wrapping `PagedObservations`.
 */
export function useObservations(params: ObservationListParams = {}) {
  return useQuery({
    queryKey: observationKeys.list(params),
    queryFn: () => observationService.list(params),
    enabled: params.projectId !== undefined || !!params.inspectionId,
    placeholderData: keepPreviousData,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * One observation by id. Disabled until the id resolves.
 *
 * @param id - UUID of the observation.
 * @param options - `includeRetiredRegions` also loads the regions a review
 *   replaced or removed (the "show history" view), under its own key.
 * @returns A TanStack `UseQueryResult` wrapping `Observation`.
 */
export function useObservation(
  id?: string,
  options: { includeRetiredRegions?: boolean } = {}
) {
  const includeRetiredRegions = options.includeRetiredRegions === true;
  return useQuery({
    queryKey: includeRetiredRegions
      ? observationKeys.detailWithRetiredRegions(id ?? '')
      : observationKeys.detail(id ?? ''),
    queryFn: () =>
      includeRetiredRegions
        ? observationService.getById(id as string, { includeRetiredRegions })
        : observationService.getById(id as string),
    enabled: !!id,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * The attachments an observation cites as evidence. Disabled until the id
 * resolves.
 *
 * @param id - UUID of the observation.
 * @returns A TanStack `UseQueryResult` wrapping `Attachment[]`.
 */
export function useObservationEvidence(id?: string) {
  return useQuery({
    queryKey: observationKeys.evidence(id ?? ''),
    queryFn: () => observationService.getEvidence(id as string),
    enabled: !!id,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * What an observation change touches. The row is its own, but a decision
 * can set a check item, create a defect or confirm an inspection, and every
 * one of those writes to the event log; where the outcome created a defect
 * the NCR lists may have moved too.
 */
function useObservationInvalidation() {
  const queryClient = useQueryClient();
  return (observation: Observation) => {
    queryClient.invalidateQueries({ queryKey: observationKeys.all });
    queryClient.invalidateQueries({ queryKey: inspectionEventKeys.all });
    if (observation.inspectionId) {
      queryClient.invalidateQueries({
        queryKey: inspectionKeys.detail(observation.inspectionId),
      });
    }
    if (
      observation.outcomeKind === ObservationOutcomeKind.INSPECTION &&
      observation.outcomeRef
    ) {
      queryClient.invalidateQueries({
        queryKey: inspectionKeys.detail(observation.outcomeRef),
      });
      queryClient.invalidateQueries({ queryKey: inspectionKeys.lists() });
    }
    if (
      observation.outcomeKind === ObservationOutcomeKind.DEFECT ||
      observation.outcomeKind === ObservationOutcomeKind.NCR
    ) {
      queryClient.invalidateQueries({ queryKey: ncrKeys.lists() });
    }
    if (
      observation.outcomeKind === ObservationOutcomeKind.NCR &&
      observation.outcomeRef
    ) {
      queryClient.invalidateQueries({
        queryKey: ncrKeys.detail(observation.outcomeRef),
      });
    }
  };
}

/**
 * Records a human observation.
 *
 * `POST /inspections/web/observations`. On success invalidates the
 * observation lists, the event log and the inspection it was filed under.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function takes a
 *   `CreateObservationRequest`.
 */
export function useCreateObservation() {
  const invalidate = useObservationInvalidation();
  return useMutation({
    mutationFn: (req: CreateObservationRequest) => observationService.create(req),
    onSuccess: (observation) => invalidate(observation),
  });
}

/**
 * Decides on a pending observation.
 *
 * `POST /inspections/web/observations/{id}/review`. On success invalidates
 * the observations, the event log, the inspection and, where the outcome
 * made a defect, the NCR lists. A second decision is refused by the backend
 * with 409; the mutation surfaces that as an `ApiError` with that status.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function takes
 *   `{ id, req }`.
 */
export function useReviewObservation() {
  const invalidate = useObservationInvalidation();
  return useMutation({
    mutationFn: ({ id, req }: { id: string; req: ReviewObservationRequest }) =>
      observationService.review(id, req),
    onSuccess: (observation) => invalidate(observation),
  });
}

/**
 * Accepts with no outcome, or rejects with one reason and one note, many
 * pending observations at once: the grid's bulk bar.
 *
 * `POST /inspections/web/observations/review-batch`. The result carries one
 * status per id, so a partial success is still a success here; read
 * `results` for the ones that were refused. On success invalidates the
 * observations, the event log and the inspections (a bulk decision creates
 * no defect or NCR, so those lists are left alone).
 *
 * @returns A TanStack `UseMutationResult` whose mutate function takes a
 *   `ReviewBatchRequest` and resolves to a `ReviewBatchResult`.
 */
export function useReviewObservationBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: ReviewBatchRequest) => observationService.reviewBatch(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: observationKeys.all });
      queryClient.invalidateQueries({ queryKey: inspectionEventKeys.all });
      queryClient.invalidateQueries({ queryKey: inspectionKeys.all });
    },
  });
}
