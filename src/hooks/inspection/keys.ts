/**
 * @module inspection-keys
 *
 * TanStack Query key factories for the reinspection and event-log surfaces of
 * the inspection domain, plus the roots of the NCR and inspection namespaces
 * the mutations here invalidate.
 *
 * `reinspectionKeys` shapes:
 * - `['reinspections']` — namespace root, invalidation prefix only.
 * - `['reinspections', 'ncr', ncrId]` — attempts on one NCR (consumed by {@link useReinspectionsByNcr}).
 * - `['reinspections', 'detail', id]` — one attempt (consumed by {@link useReinspection}).
 *
 * `inspectionEventKeys` shapes:
 * - `['inspection-events']` — namespace root, invalidation prefix only.
 * - `['inspection-events', 'inspection', inspectionId, params]` — one page of an inspection's timeline.
 * - `['inspection-events', 'ncr', ncrId, params]` — one page of an NCR's timeline.
 * - `['inspection-events', 'query', params]` — one page of the project-wide query.
 *
 * `ncrKeys` and `inspectionKeys` carry the `['ncrs']` and `['inspections']`
 * roots with the `detail` shape the console's own NCR and inspection hooks
 * use (`['ncrs', 'detail', id]`, `['inspections', 'detail', id]`), so a
 * reinspection outcome can refresh the NCR it moved and the inspection it
 * cloned without this package owning those query hooks yet. Keep the shapes
 * in step if either side changes.
 */
import type { InspectionEventPageParams, InspectionEventQueryParams } from '../../services/inspection-event-service';

export const reinspectionKeys = {
  /** Invalidation prefix only. */
  all: ['reinspections'] as const,
  /** Every attempt on one NCR. */
  byNcr: (ncrId: string) => [...reinspectionKeys.all, 'ncr', ncrId] as const,
  /** One attempt. */
  detail: (id: string) => [...reinspectionKeys.all, 'detail', id] as const,
};

export const inspectionEventKeys = {
  /** Invalidation prefix only. */
  all: ['inspection-events'] as const,
  /** Invalidation prefix for every page of one inspection's timeline. */
  byInspectionAll: (inspectionId: string) =>
    [...inspectionEventKeys.all, 'inspection', inspectionId] as const,
  /** One page of an inspection's timeline. */
  byInspection: (inspectionId: string, params: InspectionEventPageParams) =>
    [...inspectionEventKeys.byInspectionAll(inspectionId), params] as const,
  /** Invalidation prefix for every page of one NCR's timeline. */
  byNcrAll: (ncrId: string) =>
    [...inspectionEventKeys.all, 'ncr', ncrId] as const,
  /** One page of an NCR's timeline. */
  byNcr: (ncrId: string, params: InspectionEventPageParams) =>
    [...inspectionEventKeys.byNcrAll(ncrId), params] as const,
  /** Invalidation prefix for every page of the project-wide query. */
  queries: () => [...inspectionEventKeys.all, 'query'] as const,
  /** One page of the project-wide query. */
  query: (params: InspectionEventQueryParams) =>
    [...inspectionEventKeys.queries(), params] as const,
};

/** The NCR namespace, as the console's NCR hooks key it. */
export const ncrKeys = {
  /** Invalidation prefix only. */
  all: ['ncrs'] as const,
  /** Every NCR list, filtered or not. */
  lists: () => [...ncrKeys.all, 'list'] as const,
  /** One NCR. */
  detail: (id: string) => [...ncrKeys.all, 'detail', id] as const,
};

/** The inspection namespace, as the console's inspection hooks key it. */
export const inspectionKeys = {
  /** Invalidation prefix only. */
  all: ['inspections'] as const,
  /** Every inspection list, filtered or not. */
  lists: () => [...inspectionKeys.all, 'list'] as const,
  /** One inspection. */
  detail: (id: string) => [...inspectionKeys.all, 'detail', id] as const,
};
