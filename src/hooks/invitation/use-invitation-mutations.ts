/**
 * @module use-invitation-mutations
 *
 * Mutation hooks for generating and validating invitation codes against the
 * `project-invite-code-controller` backend.
 *
 * Hooks are UI-agnostic: they apply cache discipline and log errors, but do not
 * surface toasts. Consumers attach user-facing feedback at the call site.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invitationService } from '../../services/invitation-service';
import { GenerateInviteCodeRequest } from '../../types/invitation';
import { logger } from '../../lib/logger';
import { invitationKeys } from './keys';
import { userKeys } from '../user/keys';
import { employeeKeys } from '../employee/keys';

/**
 * Generates a new employee invite code for an organization.
 *
 * On success, invalidates the organization's invitation list so it refetches
 * with the newly created code.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts
 *   `{ organizationId, request }`.
 */
export function useGenerateInviteCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      organizationId,
      request,
    }: {
      organizationId: number;
      request: GenerateInviteCodeRequest;
    }) => invitationService.generateCode(organizationId, request),
    onSuccess: (_invitation, variables) => {
      queryClient.invalidateQueries({
        queryKey: invitationKeys.byOrganization(variables.organizationId),
      });
    },
    onError: (error) => {
      logger.error('Failed to generate invite code:', error);
    },
  });
}

/**
 * Validates an invite code for a user; a valid code joins the organization.
 *
 * On a valid result, invalidates user and employee caches (joining changes the
 * user's identity context and adds an employee record).
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts
 *   `{ userId, inviteCode }`.
 */
export function useValidateInviteCodeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      inviteCode,
    }: {
      userId: number;
      inviteCode: string;
    }) => invitationService.validateCode(userId, inviteCode),
    onSuccess: (result) => {
      if (result.valid) {
        queryClient.invalidateQueries({ queryKey: userKeys.all });
        queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
        queryClient.invalidateQueries({ queryKey: invitationKeys.all });
      }
    },
    onError: (error) => {
      logger.error('Failed to validate invite code:', error);
    },
  });
}

/**
 * Resends an invitation by generating a new code with the same details. A thin
 * convenience wrapper around {@link invitationService.generateCode}.
 *
 * @returns A TanStack `UseMutationResult` whose mutate function accepts
 *   `{ organizationId, request }`.
 */
export function useResendInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      organizationId,
      request,
    }: {
      organizationId: number;
      request: GenerateInviteCodeRequest;
    }) => invitationService.generateCode(organizationId, request),
    onSuccess: (_invitation, variables) => {
      queryClient.invalidateQueries({
        queryKey: invitationKeys.byOrganization(variables.organizationId),
      });
    },
    onError: (error) => {
      logger.error('Failed to resend invitation:', error);
    },
  });
}
