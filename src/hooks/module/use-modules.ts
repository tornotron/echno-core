/**
 * @module use-modules
 *
 * Query hooks for the module registry.
 */

import { useQuery } from '@tanstack/react-query';
import { moduleService } from '../../services/module-service';
import { shouldRetry } from '../../lib/query/retry';
import { staticQueryOptions } from '../../lib/query/options';
import { moduleKeys } from './keys';

/**
 * Fetches the modules enabled and entitled for the current org.
 *
 * Uses the **static** query profile (`staleTime` 10 min, `gcTime` 30 min):
 * the enabled set changes rarely within a session, and this is read on
 * every nav render and route guard check.
 *
 * The query key is `moduleKeys.enabled()` so data prefetched at auth
 * bootstrap (see `useModulesPrefetch` in echno-web) is reused without a
 * network round-trip.
 *
 * @returns A TanStack `UseQueryResult` wrapping `ModuleDescriptor[]`.
 */
export function useEnabledModules() {
  return useQuery({
    queryKey: moduleKeys.enabled(),
    queryFn: () => moduleService.listEnabled(),
    ...staticQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * Fetches every module the backend knows about, regardless of whether it is
 * enabled or entitled for the current org. Used by admin/settings surfaces
 * that need the full registry rather than just the usable subset.
 *
 * Uses the **static** query profile (`staleTime` 10 min, `gcTime` 30 min).
 *
 * @returns A TanStack `UseQueryResult` wrapping `ModuleDescriptor[]`.
 */
export function useInstalledModules() {
  return useQuery({
    queryKey: moduleKeys.installed(),
    queryFn: () => moduleService.listInstalled(),
    ...staticQueryOptions,
    retry: shouldRetry,
  });
}
