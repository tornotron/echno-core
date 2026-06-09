/**
 * hooks/invitation/invitation-keys.ts
 *
 * React Query key factory for invitation (project invite code) queries.
 *
 * NOTE on naming drift: the local code uses `byProject(projectId)` while the
 * actual backend endpoints (post-Milestone 7 audit 2026-06-02) are
 * organization-scoped under `/api/v1/invitation/web/organizationId/{orgId}`.
 * The service paths in `invitation-service.ts` still point at the legacy
 * `/api/v1/project/web/invite-codes/*` paths which no longer exist on the
 * backend. Until the integrate-module skill is run on this submodule to
 * realign the service + types + consumers, the `byProject(id)` shape is
 * effectively a misnamed `byOrganization(id)`.
 */

export const invitationKeys = {
  all: ['invitations'] as const,
  lists: () => [...invitationKeys.all, 'list'] as const,
  byProject: (projectId?: number) =>
    [...invitationKeys.all, 'project', projectId] as const,
  detail: (id?: number) => [...invitationKeys.all, 'detail', id] as const,
};
