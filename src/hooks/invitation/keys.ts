/**
 * TanStack Query key factory for the Invitation domain.
 *
 * Key shapes:
 * - `['invitations']` — namespace root (invalidation prefix only).
 * - `['invitations', 'organization', organizationId]` — invite codes scoped to
 *   an organization.
 * - `['invitations', 'validate', userId, inviteCode]` — one-off validation result.
 *
 * @see {@link useInvitationsByOrganization}
 * @see {@link useValidateInviteCode}
 */
export const invitationKeys = {
  all: ['invitations'] as const,
  byOrganization: (organizationId?: number) =>
    [...invitationKeys.all, 'organization', organizationId] as const,
  validate: (userId?: number, inviteCode?: string) =>
    [...invitationKeys.all, 'validate', userId, inviteCode] as const,
};
