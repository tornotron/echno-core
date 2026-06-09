/**
 * @module use-invitation
 *
 * Query hooks for fetching invitation (project invite code) data.
 *
 * Note: both hooks route to stale backend paths. An `integrate-module` pass
 * is required to realign service endpoints before either will succeed in
 * production.
 */

import { useQuery } from '@tanstack/react-query';
import { invitationService } from '../../services/invitation-service';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import { invitationKeys } from './invitation-keys';

/**
 * Fetches all invite codes scoped to a project (or organization per spec).
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min,
 * `refetchOnWindowFocus` in production only).
 * The query is disabled until `projectId` is truthy.
 *
 * @deprecated Service path is stale — the live spec endpoint is
 *   `GET /invitation/web/organizationId/{orgId}`. An `integrate-module` pass
 *   is needed to realign the service and rename the parameter to `organizationId`.
 *
 * @param projectId - ID of the project (effectively the organization) to scope
 *   the invite-code query.
 * @returns A TanStack `UseQueryResult` wrapping `Invitation[]`.
 */
export function useInvitationsByProject(projectId?: number) {
  return useQuery({
    queryKey: invitationKeys.byProject(projectId),
    queryFn: () => {
      if (!projectId) throw new Error('Project ID is required');
      return invitationService.getByProject(projectId);
    },
    enabled: !!projectId,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * Fetches a single invite code by ID.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min,
 * `refetchOnWindowFocus` in production only).
 * The query is disabled until `id` is truthy.
 *
 * @deprecated The backend exposes no GET-by-id endpoint for invite codes.
 *   This hook will 404 in production. Kept for the
 *   `invitations/[id]/page.tsx` consumer until the backend integration is
 *   rewired or the consumer is updated.
 *
 * @param id - Surrogate ID of the invite code.
 * @returns A TanStack `UseQueryResult` wrapping {@link Invitation}.
 */
export function useInvitationById(id?: number) {
  return useQuery({
    queryKey: invitationKeys.detail(id),
    queryFn: () => {
      if (!id) throw new Error('Invitation ID is required');
      return invitationService.getById(id);
    },
    enabled: !!id,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}
