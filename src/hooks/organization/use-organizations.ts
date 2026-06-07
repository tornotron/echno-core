/**
 * hooks/organization/use-organizations.ts
 *
 * Organization-related query hooks.
 */

import { useQuery } from '@tanstack/react-query';
import { organizationService } from '../../services/organization-service';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import { organizationKeys } from './organization-keys';

/**
 * Hook to fetch all organizations for the current user.
 *
 * Note: writes to `organizationKeys.all` not `lists()` because
 * `use-organization-prefetch.ts` seeds the cache at `organizationKeys.all`
 * on auth bootstrap. Keeps the prefetched data accessible to this hook.
 */
export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.all,
    queryFn: () => organizationService.getAll(),
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * Hook to fetch a single organization by ID.
 */
export function useOrganization(id: number) {
  return useQuery({
    queryKey: organizationKeys.detail(id),
    queryFn: () => organizationService.getById(id),
    enabled: !!id,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}
