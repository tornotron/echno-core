import { useQuery } from '@tanstack/react-query';
import { invitationService } from '../../services/invitation-service';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import { invitationKeys } from './invitation-keys';

/**
 * Hook to fetch invitation list scoped by id.
 *
 * FIXME: legacy `byProject(id)` semantics; backend endpoint is actually
 * organization-scoped (`/invitation/web/organizationId/{orgId}`). The
 * service still routes to the stale `/api/v1/project/web/invite-codes`
 * path which does not exist on the current backend per the live spec.
 * An `integrate-module` skill run is needed to realign service + types
 * + consumers.
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
 * FIXME: `invitationService.getById` calls a non-existent backend endpoint
 * (`/api/v1/project/web/invite-codes/{id}` — no such path in the live spec).
 * The hook will throw on any actual fetch. Kept exported for the
 * `/workforce/employees/invitations/[id]/page.tsx` consumer until the
 * backend integration is rewired or the consumer is updated.
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
