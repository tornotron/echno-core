/**
 * TanStack Query key factory for the Invitation domain.
 *
 * Key shapes:
 * - `['invitations']` — namespace root (invalidation prefix only; never used
 *   as a direct query key).
 * - `['invitations', 'list']` — explicit list key; reserved for future
 *   paginated or filtered list queries.
 * - `['invitations', 'project', projectId]` — invite codes scoped to a project.
 *   Note: the naming reflects legacy service semantics; the live spec endpoint
 *   is organization-scoped. This key shape will be renamed to `byOrganization`
 *   after service paths are realigned.
 * - `['invitations', 'detail', id]` — single invite code detail.
 *
 * @see {@link useInvitationsByProject}
 * @see {@link useInvitationById}
 */
export const invitationKeys = {
  all: ['invitations'] as const,
  lists: () => [...invitationKeys.all, 'list'] as const,
  byProject: (projectId?: number) =>
    [...invitationKeys.all, 'project', projectId] as const,
  detail: (id?: number) => [...invitationKeys.all, 'detail', id] as const,
};
