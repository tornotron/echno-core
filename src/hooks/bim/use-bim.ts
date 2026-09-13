/**
 * @module use-bim
 *
 * Query hooks for the BIM module. Every hook is disabled until its ids are
 * known, so a page can call them before the route params resolve.
 */

import { useQuery } from '@tanstack/react-query';
import { bimService } from '../../services/bim-service';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import {
  BimElementListParams,
  BimImportJob,
  isBimJobActive,
} from '../../types/bim/bim';
import { bimKeys } from './keys';

/** Poll interval for an active import job, in milliseconds. */
export const BIM_JOB_POLL_INTERVAL_MS = 3000;

/** A project's models, versions newest first. */
export function useBimModels(projectId: number | undefined) {
  return useQuery({
    queryKey: bimKeys.projectModels(projectId ?? 0),
    queryFn: () => bimService.listModels(projectId as number),
    enabled: projectId !== undefined,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/** One model with its versions. */
export function useBimModel(modelId: string | undefined) {
  return useQuery({
    queryKey: bimKeys.model(modelId ?? ''),
    queryFn: () => bimService.getModel(modelId as string),
    enabled: !!modelId,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/** One version of a model. */
export function useBimModelVersion(
  modelId: string | undefined,
  versionId: string | undefined
) {
  return useQuery({
    queryKey: bimKeys.version(modelId ?? '', versionId ?? ''),
    queryFn: () => bimService.getVersion(modelId as string, versionId as string),
    enabled: !!modelId && !!versionId,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/** Every import job of a version, latest first. */
export function useBimImportJobs(
  modelId: string | undefined,
  versionId: string | undefined
) {
  return useQuery({
    queryKey: bimKeys.versionJobs(modelId ?? '', versionId ?? ''),
    queryFn: () => bimService.listJobs(modelId as string, versionId as string),
    enabled: !!modelId && !!versionId,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * Decides whether a job query keeps polling: the interval while the job is
 * QUEUED or RUNNING, `false` once it is DONE or FAILED (or not loaded yet).
 */
export function bimJobRefetchInterval(
  job: BimImportJob | undefined,
  intervalMs: number = BIM_JOB_POLL_INTERVAL_MS
): number | false {
  return job && isBimJobActive(job.status) ? intervalMs : false;
}

/**
 * One import job, polled every {@link BIM_JOB_POLL_INTERVAL_MS} while it is
 * QUEUED or RUNNING and left alone once it is DONE or FAILED.
 */
export function useBimImportJob(
  jobId: string | undefined,
  intervalMs: number = BIM_JOB_POLL_INTERVAL_MS
) {
  return useQuery({
    queryKey: bimKeys.job(jobId ?? ''),
    queryFn: () => bimService.getJob(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => bimJobRefetchInterval(query.state.data, intervalMs),
    staleTime: 0,
    retry: shouldRetry,
  });
}

/** A page of a model's elements, optionally one storey's. */
export function useBimElements(
  modelId: string | undefined,
  params: BimElementListParams = {}
) {
  return useQuery({
    queryKey: bimKeys.elements(modelId ?? '', params as Record<string, unknown>),
    queryFn: () => bimService.listElements(modelId as string, params),
    enabled: !!modelId,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/** One element by its row id. */
export function useBimElement(elementId: string | undefined) {
  return useQuery({
    queryKey: bimKeys.element(elementId ?? ''),
    queryFn: () => bimService.getElement(elementId as string),
    enabled: !!elementId,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * One element by its IFC GlobalId, the id a picked mesh carries. Resolves to
 * `undefined` (not an error) when the model has no such element. Pass the
 * storey when known to keep the search to one tile's worth of rows.
 */
export function useBimElementByGlobalId(
  modelId: string | undefined,
  globalId: string | undefined,
  storeyGlobalId?: string
) {
  return useQuery({
    queryKey: bimKeys.elementByGlobalId(modelId ?? '', globalId ?? '', storeyGlobalId),
    queryFn: async () =>
      (await bimService.findElementByGlobalId(
        modelId as string,
        globalId as string,
        storeyGlobalId
      )) ?? null,
    enabled: !!modelId && !!globalId,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * The presigned tile urls of a version. Considered stale a minute before the
 * urls expire so a re-render after a long session fetches fresh ones.
 */
export function useBimTiles(
  modelId: string | undefined,
  versionId: string | undefined
) {
  return useQuery({
    queryKey: bimKeys.tiles(modelId ?? '', versionId ?? ''),
    queryFn: () => bimService.getTiles(modelId as string, versionId as string),
    enabled: !!modelId && !!versionId,
    staleTime: (query) => {
      const expires = query.state.data?.expiresInSeconds ?? 0;
      return Math.max(0, (expires - 60) * 1000);
    },
    retry: shouldRetry,
  });
}

/** The hierarchy proposal of a version, pending or confirmed. */
export function useBimHierarchyProposal(
  modelId: string | undefined,
  versionId: string | undefined
) {
  return useQuery({
    queryKey: bimKeys.proposal(modelId ?? '', versionId ?? ''),
    queryFn: () =>
      bimService.getHierarchyProposal(modelId as string, versionId as string),
    enabled: !!modelId && !!versionId,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}
