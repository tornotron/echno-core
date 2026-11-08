/**
 * @module use-member-invitations
 *
 * Query hooks for invitations by link to join the organization.
 */

import { useQuery } from '@tanstack/react-query';
import { memberInvitationsService } from '../../services/member-invitations-service';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import type { MemberInvitationListParams } from '../../types/member-invitations/member-invitations';
import { memberInvitationsKeys } from './keys';

/**
 * Fetches one page of the organization's invitations, newest first.
 *
 * Uses the **standard** profile: a link the provider has just sent, or an
 * invitation someone has just accepted, shows within a minute or on focus.
 *
 * @param params - Optional zero-based `pageNo` and `pageSize`.
 * @returns A TanStack `UseQueryResult` wrapping `MemberInvitation[]`.
 */
export function useMemberInvitations(params: MemberInvitationListParams = {}) {
  return useQuery({
    queryKey: memberInvitationsKeys.list(params),
    queryFn: () => memberInvitationsService.list(params),
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * Fetches one invitation; disabled until an id is known.
 *
 * @returns A TanStack `UseQueryResult` wrapping a `MemberInvitation`.
 */
export function useMemberInvitation(id: string | undefined) {
  return useQuery({
    queryKey: memberInvitationsKeys.detail(id ?? ''),
    queryFn: () => memberInvitationsService.get(id as string),
    enabled: Boolean(id),
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}
