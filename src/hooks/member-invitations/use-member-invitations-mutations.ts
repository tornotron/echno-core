/**
 * @module use-member-invitations-mutations
 *
 * Mutation hooks for invitations by link. Each invalidates the domain prefix
 * on success, so every list page and open detail refetch together.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { memberInvitationsService } from '../../services/member-invitations-service';
import type { CreateMemberInvitationRequest } from '../../types/member-invitations/member-invitations';
import { memberInvitationsKeys } from './keys';

function useInvalidateMemberInvitations() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: memberInvitationsKeys.all });
}

/** Invites a person. Mutate with a {@link CreateMemberInvitationRequest}. */
export function useCreateMemberInvitation() {
  const invalidate = useInvalidateMemberInvitations();
  return useMutation({
    mutationFn: (request: CreateMemberInvitationRequest) => memberInvitationsService.create(request),
    onSuccess: invalidate,
  });
}

/**
 * Sends an invitation's link again, or renews an expired one. Mutate with the
 * invitation id.
 */
export function useResendMemberInvitation() {
  const invalidate = useInvalidateMemberInvitations();
  return useMutation({
    mutationFn: (id: string) => memberInvitationsService.resend(id),
    onSuccess: invalidate,
  });
}

/** Stops an invitation's link working. Mutate with the invitation id. */
export function useRevokeMemberInvitation() {
  const invalidate = useInvalidateMemberInvitations();
  return useMutation({
    mutationFn: (id: string) => memberInvitationsService.revoke(id),
    onSuccess: invalidate,
  });
}
