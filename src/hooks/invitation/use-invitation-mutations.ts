import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invitationService } from '../../services/invitation-service';
import { GenerateInviteCodeRequest, Invitation } from '../../types/invitation';
import { logger } from '../../lib/logger';
import { invitationKeys } from './invitation-keys';
import { userKeys } from '../user/user-keys';
import { employeeKeys } from '../employee/employee-keys';

/**
 * MODULE-LEVEL FIXME (audited 2026-06-02):
 *
 * `services/invitation-service.ts` routes every call to the legacy
 * `/api/v1/project/web/invite-codes/*` path family which no longer exists on
 * the backend. The live spec exposes invitation endpoints under
 * `/api/v1/invitation/web/...` (organization-scoped, project-invite-code
 * controller).
 *
 * Required follow-up:
 *   1. Run the integrate-module skill on the invitation module to realign
 *      service paths, request DTOs, and the `Invitation.projectId` field
 *      (likely needs renaming to `organizationId` per spec).
 *   2. Add `useValidateInviteCode` (POST /invitation/web/validate/userId/{userId}
 *      → OrganizationDto — sibling response, returns the joined org).
 *   3. Add `usePatchInviteCode` (PATCH /invitation/web/{inviteCodeId} →
 *      ProjectInviteCodeDto).
 *   4. Remove `useDeleteInviteCode` and `useJoinWithInviteCode` once their
 *      stale paths are confirmed obsolete (no replacement endpoints exist).
 *
 * Until the integrate-module skill runs, the only mutation expected to
 * function is `useGenerateInviteCode`. The cache discipline applied below
 * assumes a full `ProjectInviteCodeDto` response per spec.
 */

export function useGenerateInviteCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: GenerateInviteCodeRequest) =>
      invitationService.generateCode(dto),
    onSuccess: (invitation) => {
      // POST /invitation/web/generateCode/... → ProjectInviteCodeDto (full
      // per spec). Seed detail + append to the per-project list cache.
      // (Per-project semantics is legacy naming for what the backend treats
      // as per-organization — see module-level FIXME.)
      queryClient.setQueryData(
        invitationKeys.detail(invitation.id),
        invitation
      );
      queryClient.setQueryData<Invitation[]>(
        invitationKeys.byProject(invitation.projectId),
        (old) => (old ? [...old, invitation] : undefined)
      );
    },
    onError: (error) => {
      logger.error('Failed to generate invite code:', error);
    },
  });
}

/**
 * Backend has no DELETE endpoint for invite codes per the live OpenAPI spec
 * (audited 2026-06-02). The legacy `/api/v1/project/web/invite-codes/{id}`
 * path called by the service does not exist on the current backend.
 *
 * Fails fast with a clear message until the backend either adds the endpoint
 * or the consumer is updated to use a status transition.
 */
export function useDeleteInviteCode() {
  return useMutation({
    mutationFn: async (_id: number): Promise<void> => {
      throw new Error(
        'Delete is not supported by the backend (no DELETE /invitation/web/{id} endpoint). Coordinate with the backend team to add the endpoint or use a status transition.'
      );
    },
  });
}

/**
 * The legacy `/api/v1/project/web/invite-codes/join` endpoint this hook
 * targets does not exist on the current backend. The closest endpoint is
 * `POST /invitation/web/validate/userId/{userId}` which returns an
 * `OrganizationDto` (the org the user joins via the code).
 *
 * Fails fast until the integrate-module skill realigns the flow as
 * `useValidateInviteCode` + downstream org/employee cache updates.
 */
export function useJoinWithInviteCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inviteCode: _inviteCode,
    }: {
      inviteCode: string;
    }): Promise<void> => {
      throw new Error(
        'Join via invite code is not currently wired to the backend. The legacy /project/web/invite-codes/join endpoint does not exist; use the spec endpoint POST /invitation/web/validate/userId/{userId} which returns the joined Organization. Coordinate with the integrate-module skill to wire this flow.'
      );
    },
    onSuccess: () => {
      // Reachable only if mutationFn stops throwing in the future.
      // Cross-namespace: joining adds an employee record for the user and
      // changes the user's identity context.
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.employees() });
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
    onError: (error) => {
      logger.error('Failed to join with invite code:', error);
    },
  });
}
