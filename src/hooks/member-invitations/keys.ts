/**
 * TanStack Query key factory for invitations by link.
 *
 * Key shapes:
 * - `['member-invitations']`: namespace root; the invalidation prefix.
 * - `['member-invitations', 'list', params]`: one page of the list.
 * - `['member-invitations', 'detail', id]`: one invitation.
 *
 * The root is not the invite-code root (`['invitations']`, `invitationKeys`),
 * so invalidating one never refetches the other while both are exported.
 * Every mutation invalidates `memberInvitationsKeys.all`, so a create, resend
 * or revoke refreshes every list page and any open detail in one sweep.
 */
import type { MemberInvitationListParams } from '../../types/member-invitations/member-invitations';

export const memberInvitationsKeys = {
  all: ['member-invitations'] as const,
  lists: () => [...memberInvitationsKeys.all, 'list'] as const,
  list: (params: MemberInvitationListParams = {}) =>
    [...memberInvitationsKeys.lists(), params] as const,
  details: () => [...memberInvitationsKeys.all, 'detail'] as const,
  detail: (id: string) => [...memberInvitationsKeys.details(), id] as const,
};
