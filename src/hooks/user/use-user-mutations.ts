/**
 * @module hooks/user/use-user-mutations
 *
 * Mutation hooks for the current authenticated user.
 *
 * All three mutations target the same `PATCH /user/web/{id}` endpoint
 * (JSON, multipart, and silent organization-switch variants). The backend
 * returns the full `UserDto`, so every `onSuccess` patches the singleton
 * {@link userKeys.all} cache directly with the response and runs **zero
 * invalidations** — the response is the canonical user.
 *
 * Toast notifications are intentionally absent — callers supply onSuccess /
 * onError feedback appropriate to their UI context.
 *
 * @see {@link userKeys} key factory (singleton-key convention for the current user).
 * @see {@link userService} HTTP wire layer.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../../services/user-service';
import { User } from '../../types/user/user';
import { UserFiles } from '../../types/user/user-files';
import { UpdateUserRequest } from '../../types/user/user-update';
import { logger } from '../../lib/logger';
import { userKeys } from './keys';

/**
 * Updates the current user's profile (JSON-only payload, no attachments).
 *
 * Backend response: `UserDto` (full).
 *
 * On success: patches `userKeys.all` cache with the server response.
 * No invalidations — the response is the canonical user.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; data: UpdateUserRequest }`.
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserRequest }) =>
      userService.updateCurrentUser(id, data),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData<User>(userKeys.all, updatedUser);
    },
    onError: (error) => {
      logger.error('Failed to update user profile:', error);
    },
  });
}

/**
 * Updates the current user's profile and uploads attachments (profile
 * picture, CV) in a single multipart request.
 *
 * Backend response: `UserDto` (full — includes newly-created attachments).
 *
 * On success: patches `userKeys.all`; `User.cv` and `User.profilePicture`
 * reflect the new uploads without a refetch.
 * No invalidations.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; data: UpdateUserRequest; files: UserFiles }`.
 */
export function useUpdateUserWithFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
      files,
    }: {
      id: number;
      data: UpdateUserRequest;
      files: UserFiles;
    }) => userService.updateCurrentUserWithFiles(id, data, files),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData<User>(userKeys.all, updatedUser);
    },
    onError: (error) => {
      logger.error('Failed to update user profile with files:', error);
    },
  });
}

/**
 * Switches the current user's `defaultOrganizationId`.
 *
 * Backend response: `UserDto` (full).
 *
 * Silent mutation — no success toast — because the organization switcher
 * may fire on background sync to mirror state across devices.
 *
 * Optimistic update:
 * - `onMutate` cancels in-flight queries for `userKeys.all`, snapshots
 *   `previousUser`, and writes the optimistic
 *   `{ ...previousUser, defaultOrganizationId }` so UI scope flips immediately.
 *
 * Rollback:
 * - `onError` restores `previousUser` to `userKeys.all`.
 *
 * On success: reconciles the optimistic value with the server response.
 * No invalidations.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; organizationId: number | null }`.
 */
export function useUpdateUserOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      organizationId,
    }: {
      id: number;
      organizationId: number | null;
    }) => userService.updateUserOrganization(id, organizationId),
    onMutate: async ({ organizationId }) => {
      await queryClient.cancelQueries({ queryKey: userKeys.all });
      const previousUser = queryClient.getQueryData<User>(userKeys.all);

      if (previousUser) {
        queryClient.setQueryData<User>(userKeys.all, {
          ...previousUser,
          defaultOrganizationId: organizationId ?? undefined,
        });
      }

      return { previousUser };
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData<User>(userKeys.all, updatedUser);
    },
    onError: (error, _variables, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(userKeys.all, context.previousUser);
      }
      logger.error('Failed to update user organization preference:', error);
    },
  });
}
