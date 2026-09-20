/**
 * @module use-organizations
 *
 * Query hooks for fetching organization data.
 */

import { useQuery } from '@tanstack/react-query';
import { organizationService } from '../../services/organization-service';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import { organizationKeys } from './keys';

/**
 * Fetches all organizations visible to the current user.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min,
 * `refetchOnWindowFocus` in production only).
 *
 * The query key is `organizationKeys.all` (`['organizations']`) rather than
 * `lists()` so that data prefetched at `organizationKeys.all` on auth
 * bootstrap remains accessible without a network round-trip.
 *
 * @returns A TanStack `UseQueryResult` wrapping `Organization[]`.
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
 * Fetches the organizations visible to the current user without their
 * contents (`GET /organization/web/summary`).
 *
 * This is the list to read for the organization picker, the membership
 * check on first run, and any name lookup by id: the full `Organization`
 * carries every project with its team, tasks and attachments, and none of
 * those callers read them. A screen that counts `employees` or `projects`
 * or renders the logo attachment keeps {@link useOrganizations}.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min,
 * `refetchOnWindowFocus` in production only). Keyed at
 * `organizationKeys.summaries()`, under the namespace root, so the
 * mutations' `organizationKeys.all` invalidations reach it.
 *
 * @returns A TanStack `UseQueryResult` wrapping `OrganizationSummary[]`.
 */
export function useOrganizationSummaries() {
  return useQuery({
    queryKey: organizationKeys.summaries(),
    queryFn: () => organizationService.getAllSummaries(),
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * Fetches a single organization by ID.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min,
 * `refetchOnWindowFocus` in production only).
 * The query is disabled until `id` is truthy.
 *
 * @param id - Surrogate ID of the organization.
 * @returns A TanStack `UseQueryResult` wrapping {@link Organization}.
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
