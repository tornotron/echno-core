/**
 * @module use-vision
 *
 * Query hooks for the Computer Vision domain. Every endpoint answers 404
 * while the module is switched off and 402 or 403 without it, and none of
 * those is retried; pass `enabled: false` until the module is known to be
 * in the enabled list, so a page without it sends nothing.
 */

import { useQuery } from '@tanstack/react-query';
import { visionService } from '../../services/vision-service';
import { standardQueryOptions, staticQueryOptions } from '../../lib/query/options';
import { shouldRetry } from '../../lib/query/retry';
import { visionKeys } from './keys';

/**
 * Every model family with its versions: the model, version and class
 * filters of the observation queue read from this.
 *
 * Uses the **static** query profile: the registry changes when a version is
 * registered or activated, which is rare within a session.
 */
export function useVisionModels(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: visionKeys.models(),
    queryFn: () => visionService.listModels(),
    enabled: options.enabled ?? true,
    ...staticQueryOptions,
    retry: shouldRetry,
  });
}

/** One version of a model family; disabled until both are known. */
export function useVisionModelVersion(
  key: string | undefined,
  version: string | undefined,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: visionKeys.modelVersion(key ?? '', version ?? ''),
    queryFn: () => visionService.getModelVersion(key as string, version as string),
    enabled: (options.enabled ?? true) && Boolean(key) && Boolean(version),
    ...staticQueryOptions,
    retry: shouldRetry,
  });
}

/** The organization's inference settings. */
export function useVisionSettings(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: visionKeys.settings(),
    queryFn: () => visionService.getSettings(),
    enabled: options.enabled ?? true,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}
