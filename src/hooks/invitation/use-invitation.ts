/**
 * @module use-invitation
 *
 * Query hooks for fetching and validating invitation data against the
 * `project-invite-code-controller` backend.
 *
 * Exports:
 * - `useInvitationsByOrganization(organizationId?)` — list invitations for an org.
 * - `useValidateInviteCode(userId?, inviteCode?, enabled?)` — one-off validation.
 */

import { useQuery } from '@tanstack/react-query';
import { invitationService } from '../../services/invitation-service';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import { invitationKeys } from './keys';

/**
 * Fetches all invite codes for an organization.
 *
 * Uses the **standard** query profile (`staleTime` 60 s, `gcTime` 5 min).
 * The query is disabled until `organizationId` is truthy.
 *
 * @param organizationId - Organization ID to scope the invite-code query.
 * @returns A TanStack `UseQueryResult` wrapping `Invitation[]`.
 */
export function useInvitationsByOrganization(organizationId?: number) {
  return useQuery({
    queryKey: invitationKeys.byOrganization(organizationId),
    queryFn: () => {
      if (!organizationId) throw new Error('Organization ID is required');
      return invitationService.getByOrganization(organizationId);
    },
    enabled: !!organizationId,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * Validates an invite code for a user. Results are never cached — validation
 * must be fresh on each call.
 *
 * The query is disabled until both `userId` and `inviteCode` are provided
 * (and `enabled` is `true`).
 *
 * @param userId - User ID to validate the code for.
 * @param inviteCode - Invite code to validate.
 * @param enabled - Gate for enabling the query (default `true`).
 * @returns A TanStack `UseQueryResult` wrapping `ValidateInviteCodeResponse`.
 */
export function useValidateInviteCode(
  userId?: number,
  inviteCode?: string,
  enabled = true
) {
  return useQuery({
    queryKey: invitationKeys.validate(userId, inviteCode),
    queryFn: () => {
      if (!userId) throw new Error('User ID is required');
      if (!inviteCode) throw new Error('Invite code is required');
      return invitationService.validateCode(userId, inviteCode);
    },
    enabled: enabled && !!userId && !!inviteCode,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}
