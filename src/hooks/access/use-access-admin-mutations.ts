/**
 * @module use-access-admin-mutations
 *
 * Mutation hooks for the Roles & Permissions screen: roles, their grants and
 * grantable roles, and the roles each person holds.
 *
 * Cache discipline: every write answers with no body, so each hook
 * invalidates what the write changed and the screen reads it again.
 * Invalidating `accessKeys.roles()` or `accessKeys.users()` also refreshes
 * the one role or person under it.
 *
 * - A role edit refreshes the roles.
 * - A person's roles appear on both tabs (their `roles`, and each role's
 *   `assignments`), so that write refreshes both lists.
 * - A role's grants refresh the caller's own access too. The caller never
 *   changes their own roles or a role they hold, but the baseline is the
 *   exception: everyone holds it, the caller included.
 *
 * Toast notifications are intentionally absent: callers supply onSuccess /
 * onError feedback appropriate to their UI context.
 */

import { QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { accessService } from '../../services/access-service';
import { logger } from '../../lib/logger';
import {
  AccessGrantRequest,
  AccessRoleRequest,
  AccessUserRoleRequest,
} from '../../types/access/access-admin';
import { accessKeys } from './keys';

const invalidate = (queryClient: QueryClient, ...keys: ReadonlyArray<readonly unknown[]>) =>
  Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

// ── Roles ────────────────────────────────────────────────────────────────

/**
 * Creates a role with no grants.
 *
 * On success, refreshes the roles: the new one is listed, and the roles that
 * may now assign it list it as grantable.
 *
 * @returns A mutation whose function accepts an {@link AccessRoleRequest} and
 *   resolves to the new role's `id` and `slug`.
 */
export const useCreateAccessRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AccessRoleRequest) => accessService.createRole(body),
    onSuccess: () => invalidate(queryClient, accessKeys.roles()),
    onError: (error) => logger.error('Failed to create role:', error),
  });
};

/**
 * Renames a role and replaces its subtitle and description.
 *
 * On success, refreshes the roles.
 *
 * @returns A mutation whose function accepts `{ roleId, body }`.
 */
export const useUpdateAccessRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, body }: { roleId: string; body: AccessRoleRequest }) =>
      accessService.updateRole(roleId, body),
    onSuccess: () => invalidate(queryClient, accessKeys.roles()),
    onError: (error) => logger.error('Failed to update role:', error),
  });
};

/**
 * Replaces a role's grants: the Module Permissions save. Send the whole set,
 * including grants the role keeps on actions the catalog no longer marks
 * enforced.
 *
 * On success, refreshes the roles and the caller's own access.
 *
 * @returns A mutation whose function accepts `{ roleId, grants }`.
 */
export const useSetAccessRoleGrants = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, grants }: { roleId: string; grants: AccessGrantRequest[] }) =>
      accessService.setRoleGrants(roleId, grants),
    onSuccess: () => invalidate(queryClient, accessKeys.roles(), accessKeys.currentUser()),
    onError: (error) => logger.error("Failed to update role's grants:", error),
  });
};

/**
 * Replaces the roles a role's holders may assign to others.
 *
 * On success, refreshes the roles.
 *
 * @returns A mutation whose function accepts `{ roleId, roleIds }`.
 */
export const useSetAccessRoleGrantableRoles = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, roleIds }: { roleId: string; roleIds: string[] }) =>
      accessService.setRoleGrantableRoles(roleId, roleIds),
    onSuccess: () => invalidate(queryClient, accessKeys.roles()),
    onError: (error) => logger.error("Failed to update role's grantable roles:", error),
  });
};

/**
 * Deletes a role nobody holds.
 *
 * On success, drops the deleted role's own query (reading it again would
 * answer 404) and refreshes the roles, whose grantable lists named it, and
 * the people.
 *
 * @returns A mutation whose function accepts the role id.
 */
export const useDeleteAccessRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => accessService.deleteRole(roleId),
    onSuccess: (_data, roleId) => {
      queryClient.removeQueries({ queryKey: accessKeys.role(roleId), exact: true });
      return invalidate(queryClient, accessKeys.roles(), accessKeys.users());
    },
    onError: (error) => logger.error('Failed to delete role:', error),
  });
};

// ── People ───────────────────────────────────────────────────────────────

/**
 * Replaces the roles a person holds: the Users tab's save, and adding or
 * removing someone from a role's Assigned Users (send their current roles
 * with that one added or taken out).
 *
 * On success, refreshes the people and the roles, whose assignments read
 * the same rows from the other side.
 *
 * @returns A mutation whose function accepts `{ employeeId, roles }`.
 */
export const useSetAccessUserRoles = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, roles }: { employeeId: number; roles: AccessUserRoleRequest[] }) =>
      accessService.setUserRoles(employeeId, roles),
    onSuccess: () => invalidate(queryClient, accessKeys.users(), accessKeys.roles()),
    onError: (error) => logger.error("Failed to update person's roles:", error),
  });
};
