/**
 * @module use-inspection-events
 *
 * Query hooks for the inspection event log. Read-only; the mutations that
 * write events live with the rows they change and invalidate
 * `inspectionEventKeys.all` when they do.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  inspectionEventService,
  type InspectionEventPageParams,
  type InspectionEventQueryParams,
} from '../../services/inspection-event-service';
import { standardQueryOptions } from '../../lib/query/options';
import { shouldRetry } from '../../lib/query/retry';
import { inspectionEventKeys } from './keys';

/**
 * One page of an inspection's timeline, oldest first, covering the
 * inspection and everything that hangs off it. Disabled until the id
 * resolves; `keepPreviousData` keeps the current page visible while the
 * next loads.
 *
 * @param inspectionId - UUID of the inspection.
 * @param params - Zero-based `page` and `size`.
 * @returns A TanStack `UseQueryResult` wrapping `PagedInspectionEvents`.
 */
export function useInspectionEvents(
  inspectionId?: string,
  params: InspectionEventPageParams = {}
) {
  return useQuery({
    queryKey: inspectionEventKeys.byInspection(inspectionId ?? '', params),
    queryFn: () =>
      inspectionEventService.getByInspection(inspectionId as string, params),
    enabled: !!inspectionId,
    placeholderData: keepPreviousData,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * One page of an NCR's timeline, oldest first. Disabled until the id
 * resolves.
 *
 * @param ncrId - UUID of the report.
 * @param params - Zero-based `page` and `size`.
 * @returns A TanStack `UseQueryResult` wrapping `PagedInspectionEvents`.
 */
export function useNcrEvents(
  ncrId?: string,
  params: InspectionEventPageParams = {}
) {
  return useQuery({
    queryKey: inspectionEventKeys.byNcr(ncrId ?? '', params),
    queryFn: () => inspectionEventService.getByNcr(ncrId as string, params),
    enabled: !!ncrId,
    placeholderData: keepPreviousData,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * One page of the project-wide event query.
 *
 * @param params - Filters and paging.
 * @returns A TanStack `UseQueryResult` wrapping `PagedInspectionEvents`.
 */
export function useInspectionEventQuery(
  params: InspectionEventQueryParams = {}
) {
  return useQuery({
    queryKey: inspectionEventKeys.query(params),
    queryFn: () => inspectionEventService.query(params),
    placeholderData: keepPreviousData,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}
