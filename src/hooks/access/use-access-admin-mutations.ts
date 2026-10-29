/**
 * @module use-access-admin-mutations
 *
 * Mutation hooks for the Roles & Permissions screen.
 *
 * Cache discipline: every write except the two deletes returns the full
 * record, which replaces its row in the list cache. A write also changes
 * what the other lists show, because membership is read from both sides (a
 * role's `memberIds` and a person's `roleIds`), so those lists are
 * invalidated. Any write that can change what someone holds invalidates the
 * caller's own access too, since the caller may be that someone.
 *
 * Toast notifications are intentionally absent — callers supply onSuccess /
 * onError feedback appropriate to their UI context.
 */

import { QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { accessService } from '../../services/access-service';
import { logger } from '../../lib/logger';
import {
  AccessGrantRequest,
  AccessGroup,
  AccessGroupRequest,
  AccessRole,
  AccessRoleRequest,
  AccessUser,
} from '../../types/access/access-admin';
import { accessKeys } from './keys';

const appendRow =
  <T>(row: T) =>
  (old: T[] | undefined) =>
    old ? [...old, row] : [row];

function replaceRole(queryClient: QueryClient, updated: AccessRole) {
  queryClient.setQueryData<AccessRole[]>(accessKeys.roles(), (old) =>
    old?.map((r) => (r.id === updated.id ? updated : r))
  );
}

function replaceGroup(queryClient: QueryClient, updated: AccessGroup) {
  queryClient.setQueryData<AccessGroup[]>(accessKeys.groups(), (old) =>
    old?.map((g) => (g.id === updated.id ? updated : g))
  );
}

function replaceUser(queryClient: QueryClient, updated: AccessUser) {
  queryClient.setQueryData<AccessUser[]>(accessKeys.users(), (old) =>
    old?.map((u) => (u.employeeId === updated.employeeId ? updated : u))
  );
}

const invalidate = (queryClient: QueryClient, ...keys: ReadonlyArray<readonly unknown[]>) =>
  Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

// ── Roles ────────────────────────────────────────────────────────────────

/**
 * Creates a role with no grants.
 *
 * On success, appends the new role to the roles list. It holds nothing yet,
 * so no one's access changes.
 *
 * @returns A mutation whose function accepts an {@link AccessRoleRequest}.
 */
export const useCreateAccessRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AccessRoleRequest) => accessService.createRole(body),
    onSuccess: (created) => {
      // POST /access/web/roles → AccessRoleDto (full)
      queryClient.setQueryData(accessKeys.roles(), appendRow(created));
    },
    onError: (error) => logger.error('Failed to create role:', error),
  });
};

/**
 * Changes a role's name, subtitle and description.
 *
 * On success, replaces the role in the roles list.
 *
 * @returns A mutation whose function accepts `{ roleId, body }`.
 */
export const useUpdateAccessRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, body }: { roleId: string; body: AccessRoleRequest }) =>
      accessService.updateRole(roleId, body),
    onSuccess: (updated) => {
      // PUT /access/web/roles/{roleId} → AccessRoleDto (full)
      replaceRole(queryClient, updated);
    },
    onError: (error) => logger.error('Failed to update role:', error),
  });
};

/**
 * Replaces a role's grants: one cell of the roles matrix, or the role
 * editor's save. Send the whole list; locked grants stay either way.
 *
 * On success, replaces the role and invalidates the caller's own access.
 *
 * @returns A mutation whose function accepts `{ roleId, grants }`.
 */
export const useSetAccessRoleGrants = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, grants }: { roleId: string; grants: AccessGrantRequest[] }) =>
      accessService.setRoleGrants(roleId, grants),
    onSuccess: (updated) => {
      // PUT /access/web/roles/{roleId}/grants → AccessRoleDto (full)
      replaceRole(queryClient, updated);
      return invalidate(queryClient, accessKeys.currentUser());
    },
    onError: (error) => logger.error("Failed to update role's grants:", error),
  });
};

/**
 * Replaces the roles a role's holders may assign to others.
 *
 * On success, replaces the role and invalidates the caller's own access.
 *
 * @returns A mutation whose function accepts `{ roleId, roleIds }`.
 */
export const useSetAccessRoleGrantableRoles = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, roleIds }: { roleId: string; roleIds: string[] }) =>
      accessService.setRoleGrantableRoles(roleId, roleIds),
    onSuccess: (updated) => {
      // PUT /access/web/roles/{roleId}/grantable-roles → AccessRoleDto (full)
      replaceRole(queryClient, updated);
      return invalidate(queryClient, accessKeys.currentUser());
    },
    onError: (error) => logger.error('Failed to update assignable roles:', error),
  });
};

/**
 * Deletes a role the organization made.
 *
 * On success, removes it from the roles list and invalidates the groups and
 * people lists (which name it) and the caller's own access.
 *
 * @returns A mutation whose function accepts the role id.
 */
export const useDeleteAccessRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => accessService.deleteRole(roleId),
    onSuccess: (_void, roleId) => {
      // DELETE /access/web/roles/{roleId} → 204 (ack)
      queryClient.setQueryData<AccessRole[]>(accessKeys.roles(), (old) => old?.filter((r) => r.id !== roleId));
      return invalidate(queryClient, accessKeys.groups(), accessKeys.users(), accessKeys.currentUser());
    },
    onError: (error) => logger.error('Failed to delete role:', error),
  });
};

// ── Departments and groups ───────────────────────────────────────────────

/**
 * Creates a department or group with no members, roles or grants.
 *
 * On success, appends it to the groups list.
 *
 * @returns A mutation whose function accepts an {@link AccessGroupRequest}.
 */
export const useCreateAccessGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AccessGroupRequest) => accessService.createGroup(body),
    onSuccess: (created) => {
      // POST /access/web/groups → AccessGroupDto (full)
      queryClient.setQueryData(accessKeys.groups(), appendRow(created));
    },
    onError: (error) => logger.error('Failed to create department or group:', error),
  });
};

/**
 * Changes a department or group's name, kind and description.
 *
 * On success, replaces it in the groups list.
 *
 * @returns A mutation whose function accepts `{ groupId, body }`.
 */
export const useUpdateAccessGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, body }: { groupId: string; body: AccessGroupRequest }) =>
      accessService.updateGroup(groupId, body),
    onSuccess: (updated) => {
      // PUT /access/web/groups/{groupId} → AccessGroupDto (full)
      replaceGroup(queryClient, updated);
    },
    onError: (error) => logger.error('Failed to update department or group:', error),
  });
};

/**
 * Replaces a department or group's members.
 *
 * On success, replaces it and invalidates the people list (each person's
 * `groupIds`) and the caller's own access.
 *
 * @returns A mutation whose function accepts `{ groupId, employeeIds }`.
 */
export const useSetAccessGroupMembers = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, employeeIds }: { groupId: string; employeeIds: number[] }) =>
      accessService.setGroupMembers(groupId, employeeIds),
    onSuccess: (updated) => {
      // PUT /access/web/groups/{groupId}/members → AccessGroupDto (full)
      replaceGroup(queryClient, updated);
      return invalidate(queryClient, accessKeys.users(), accessKeys.currentUser());
    },
    onError: (error) => logger.error('Failed to update members:', error),
  });
};

/**
 * Replaces the roles a department or group gives its members.
 *
 * On success, replaces it and invalidates the caller's own access.
 *
 * @returns A mutation whose function accepts `{ groupId, roleIds }`.
 */
export const useSetAccessGroupRoles = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, roleIds }: { groupId: string; roleIds: string[] }) =>
      accessService.setGroupRoles(groupId, roleIds),
    onSuccess: (updated) => {
      // PUT /access/web/groups/{groupId}/roles → AccessGroupDto (full)
      replaceGroup(queryClient, updated);
      return invalidate(queryClient, accessKeys.currentUser());
    },
    onError: (error) => logger.error("Failed to update the group's roles:", error),
  });
};

/**
 * Replaces what a department or group grants its members.
 *
 * On success, replaces it and invalidates the caller's own access.
 *
 * @returns A mutation whose function accepts `{ groupId, grants }`.
 */
export const useSetAccessGroupGrants = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, grants }: { groupId: string; grants: AccessGrantRequest[] }) =>
      accessService.setGroupGrants(groupId, grants),
    onSuccess: (updated) => {
      // PUT /access/web/groups/{groupId}/grants → AccessGroupDto (full)
      replaceGroup(queryClient, updated);
      return invalidate(queryClient, accessKeys.currentUser());
    },
    onError: (error) => logger.error("Failed to update the group's grants:", error),
  });
};

/**
 * Deletes a department or group.
 *
 * On success, removes it from the groups list and invalidates the people
 * list and the caller's own access.
 *
 * @returns A mutation whose function accepts the group id.
 */
export const useDeleteAccessGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => accessService.deleteGroup(groupId),
    onSuccess: (_void, groupId) => {
      // DELETE /access/web/groups/{groupId} → 204 (ack)
      queryClient.setQueryData<AccessGroup[]>(accessKeys.groups(), (old) => old?.filter((g) => g.id !== groupId));
      return invalidate(queryClient, accessKeys.users(), accessKeys.currentUser());
    },
    onError: (error) => logger.error('Failed to delete department or group:', error),
  });
};

// ── People ───────────────────────────────────────────────────────────────

/**
 * Replaces the roles assigned to a person directly.
 *
 * On success, replaces the person and invalidates the roles list (each
 * role's `memberIds`) and the caller's own access.
 *
 * @returns A mutation whose function accepts `{ employeeId, roleIds }`.
 */
export const useSetAccessUserRoles = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, roleIds }: { employeeId: number; roleIds: string[] }) =>
      accessService.setUserRoles(employeeId, roleIds),
    onSuccess: (updated) => {
      // PUT /access/web/users/{employeeId}/roles → AccessUserDto (full)
      replaceUser(queryClient, updated);
      return invalidate(queryClient, accessKeys.roles(), accessKeys.currentUser());
    },
    onError: (error) => logger.error("Failed to update the person's roles:", error),
  });
};

/**
 * Replaces a person's grants of their own.
 *
 * On success, replaces the person and invalidates the caller's own access.
 *
 * @returns A mutation whose function accepts `{ employeeId, grants }`.
 */
export const useSetAccessUserGrants = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, grants }: { employeeId: number; grants: AccessGrantRequest[] }) =>
      accessService.setUserGrants(employeeId, grants),
    onSuccess: (updated) => {
      // PUT /access/web/users/{employeeId}/grants → AccessUserDto (full)
      replaceUser(queryClient, updated);
      return invalidate(queryClient, accessKeys.currentUser());
    },
    onError: (error) => logger.error("Failed to update the person's grants:", error),
  });
};
