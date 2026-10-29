/**
 * @module access-service
 *
 * Typed client for the access matrix: the signed-in member's own access
 * (echno-backend `CurrentUserAccessControllerWeb`) and the Roles &
 * Permissions screen's reads and writes (`AccessAdminControllerWeb`).
 *
 * Endpoint audit (echno-backend `docs/openapi.json`; not yet on the live spec,
 * since the access work deploys only once the migration is complete):
 *
 * | Method | Path | Response | Classification |
 * | --- | --- | --- | --- |
 * | GET | `/access/web/current-user-access` | `CurrentUserAccessDto` | full (read) |
 * | GET | `/access/web/catalog` | `AccessCatalogDto` | full (read) |
 * | GET | `/access/web/roles` | `AccessRoleDto[]` | full (read) |
 * | POST | `/access/web/roles` | `AccessRoleDto` | full |
 * | PUT | `/access/web/roles/{roleId}` | `AccessRoleDto` | full |
 * | PUT | `/access/web/roles/{roleId}/grants` | `AccessRoleDto` | full |
 * | PUT | `/access/web/roles/{roleId}/grantable-roles` | `AccessRoleDto` | full |
 * | DELETE | `/access/web/roles/{roleId}` | 204 | ack |
 * | GET | `/access/web/groups` | `AccessGroupDto[]` | full (read) |
 * | POST | `/access/web/groups` | `AccessGroupDto` | full |
 * | PUT | `/access/web/groups/{groupId}` | `AccessGroupDto` | full |
 * | PUT | `/access/web/groups/{groupId}/members` | `AccessGroupDto` | full |
 * | PUT | `/access/web/groups/{groupId}/roles` | `AccessGroupDto` | full |
 * | PUT | `/access/web/groups/{groupId}/grants` | `AccessGroupDto` | full |
 * | DELETE | `/access/web/groups/{groupId}` | 204 | ack |
 * | GET | `/access/web/users` | `AccessUserDto[]` | full (read) |
 * | PUT | `/access/web/users/{employeeId}/roles` | `AccessUserDto` | full |
 * | PUT | `/access/web/users/{employeeId}/grants` | `AccessUserDto` | full |
 *
 * Every write needs the matching `access:*` permission and answers 403 with a
 * message when the caller may not make it (for example, giving a grant they
 * do not hold). Creating or renaming to a taken name answers 409; deleting a
 * starting role answers 422. The `PUT …/grants`, `…/roles` and `…/members`
 * calls replace the whole list; locked grants stay whether sent or not.
 *
 * All functions throw {@link ApiError} on non-2xx responses or parse failures.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { CurrentUserAccess, parseCurrentUserAccess } from '../types/access/current-user-access';
import {
  AccessCatalog,
  AccessGrantRequest,
  AccessGroup,
  AccessGroupRequest,
  AccessRole,
  AccessRoleRequest,
  AccessUser,
  parseAccessCatalog,
  parseAccessGroup,
  parseAccessRole,
  parseAccessUser,
} from '../types/access/access-admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function safeParseCurrentUserAccess(data: ApiResponse): CurrentUserAccess {
  try {
    return parseCurrentUserAccess(data);
  } catch (error) {
    logger.error('Failed to parse current user access:', error);
    throw new ApiError('Failed to process access data. Please try again.', 422);
  }
}

/** Parses with `parse`, turning a failure into a 422 {@link ApiError} named after `what`. */
function safeParse<T>(parse: (json: unknown) => T, data: ApiResponse, what: string): T {
  try {
    return parse(data);
  } catch (error) {
    logger.error(`Failed to parse ${what}:`, error);
    throw new ApiError(`Failed to process ${what}. Please try again.`, 422);
  }
}

function safeParseList<T>(parse: (json: unknown) => T, data: ApiResponse, what: string): T[] {
  if (!Array.isArray(data)) {
    logger.error(`Expected a list of ${what}, got:`, data);
    throw new ApiError(`Failed to process ${what}. Please try again.`, 422);
  }
  return data.map((item) => safeParse(parse, item, what));
}

const role = (data: ApiResponse) => safeParse(parseAccessRole, data, 'role');
const group = (data: ApiResponse) => safeParse(parseAccessGroup, data, 'department or group');
const user = (data: ApiResponse) => safeParse(parseAccessUser, data, "person's access");

export const accessService = {
  /**
   * Fetches what the signed-in member may do in their current organization.
   *
   * `GET /access/web/current-user-access` → `CurrentUserAccessDto`
   *
   * @returns The caller's {@link CurrentUserAccess}.
   * @throws {ApiError} 403 if the caller is not an active member of the
   *   current organization; on other non-2xx responses or parse failure.
   */
  async getCurrentUserAccess(): Promise<CurrentUserAccess> {
    const data = await api.get<ApiResponse>('/access/web/current-user-access');
    return safeParseCurrentUserAccess(data);
  },

  // ── Catalog ────────────────────────────────────────────────────────────

  /**
   * Fetches the sections, areas and actions the matrix shows, and the scopes
   * a grant can take.
   *
   * `GET /access/web/catalog` → `AccessCatalogDto`
   *
   * @throws {ApiError} 403 if the caller may not view roles and permissions.
   */
  async getCatalog(): Promise<AccessCatalog> {
    const data = await api.get<ApiResponse>('/access/web/catalog');
    return safeParse(parseAccessCatalog, data, 'access catalog');
  },

  // ── Roles ──────────────────────────────────────────────────────────────

  /**
   * Fetches the organization's roles, the baseline role first.
   *
   * `GET /access/web/roles` → `AccessRoleDto[]`
   */
  async getRoles(): Promise<AccessRole[]> {
    const data = await api.get<ApiResponse>('/access/web/roles');
    return safeParseList(parseAccessRole, data, 'roles');
  },

  /**
   * Creates a role with no grants.
   *
   * `POST /access/web/roles` → `AccessRoleDto`
   *
   * @throws {ApiError} 409 if a role with that name exists.
   */
  async createRole(body: AccessRoleRequest): Promise<AccessRole> {
    return role(await api.post<ApiResponse>('/access/web/roles', body));
  },

  /**
   * Changes a role's name, subtitle and description. The slug stays.
   *
   * `PUT /access/web/roles/{roleId}` → `AccessRoleDto`
   */
  async updateRole(roleId: string, body: AccessRoleRequest): Promise<AccessRole> {
    return role(await api.put<ApiResponse>(`/access/web/roles/${roleId}`, body));
  },

  /**
   * Replaces a role's grants. Locked grants stay whether sent or not.
   *
   * `PUT /access/web/roles/{roleId}/grants` → `AccessRoleDto`
   *
   * @throws {ApiError} 400 if a permission or scope is unknown; 403 if the
   *   caller does not hold a grant they gave or took.
   */
  async setRoleGrants(roleId: string, grants: AccessGrantRequest[]): Promise<AccessRole> {
    return role(await api.put<ApiResponse>(`/access/web/roles/${roleId}/grants`, { grants }));
  },

  /**
   * Replaces the roles a role's holders may assign to others.
   *
   * `PUT /access/web/roles/{roleId}/grantable-roles` → `AccessRoleDto`
   *
   * @throws {ApiError} 400 if the baseline role is listed.
   */
  async setRoleGrantableRoles(roleId: string, roleIds: string[]): Promise<AccessRole> {
    return role(await api.put<ApiResponse>(`/access/web/roles/${roleId}/grantable-roles`, { roleIds }));
  },

  /**
   * Deletes a role the organization made. Its holders lose it.
   *
   * `DELETE /access/web/roles/{roleId}` → 204
   *
   * @throws {ApiError} 422 for a starting role.
   */
  async deleteRole(roleId: string): Promise<void> {
    await api.delete(`/access/web/roles/${roleId}`);
  },

  // ── Departments and groups ─────────────────────────────────────────────

  /**
   * Fetches the organization's departments and groups.
   *
   * `GET /access/web/groups` → `AccessGroupDto[]`
   */
  async getGroups(): Promise<AccessGroup[]> {
    const data = await api.get<ApiResponse>('/access/web/groups');
    return safeParseList(parseAccessGroup, data, 'departments and groups');
  },

  /**
   * Creates a department or group with no members, roles or grants.
   *
   * `POST /access/web/groups` → `AccessGroupDto`
   *
   * @throws {ApiError} 409 if one with that name exists.
   */
  async createGroup(body: AccessGroupRequest): Promise<AccessGroup> {
    return group(await api.post<ApiResponse>('/access/web/groups', body));
  },

  /**
   * Changes a department or group's name, kind and description.
   *
   * `PUT /access/web/groups/{groupId}` → `AccessGroupDto`
   */
  async updateGroup(groupId: string, body: AccessGroupRequest): Promise<AccessGroup> {
    return group(await api.put<ApiResponse>(`/access/web/groups/${groupId}`, body));
  },

  /**
   * Replaces a department or group's members.
   *
   * `PUT /access/web/groups/{groupId}/members` → `AccessGroupDto`
   *
   * @throws {ApiError} 403 if the caller could not give what the group holds.
   */
  async setGroupMembers(groupId: string, employeeIds: number[]): Promise<AccessGroup> {
    return group(await api.put<ApiResponse>(`/access/web/groups/${groupId}/members`, { employeeIds }));
  },

  /**
   * Replaces the roles a department or group gives its members.
   *
   * `PUT /access/web/groups/{groupId}/roles` → `AccessGroupDto`
   */
  async setGroupRoles(groupId: string, roleIds: string[]): Promise<AccessGroup> {
    return group(await api.put<ApiResponse>(`/access/web/groups/${groupId}/roles`, { roleIds }));
  },

  /**
   * Replaces what a department or group grants its members.
   *
   * `PUT /access/web/groups/{groupId}/grants` → `AccessGroupDto`
   */
  async setGroupGrants(groupId: string, grants: AccessGrantRequest[]): Promise<AccessGroup> {
    return group(await api.put<ApiResponse>(`/access/web/groups/${groupId}/grants`, { grants }));
  },

  /**
   * Deletes a department or group. Its members lose what it gave them.
   *
   * `DELETE /access/web/groups/{groupId}` → 204
   */
  async deleteGroup(groupId: string): Promise<void> {
    await api.delete(`/access/web/groups/${groupId}`);
  },

  // ── People ─────────────────────────────────────────────────────────────

  /**
   * Fetches every employee with the roles, groups and grants given to them
   * directly.
   *
   * `GET /access/web/users` → `AccessUserDto[]`
   */
  async getUsers(): Promise<AccessUser[]> {
    const data = await api.get<ApiResponse>('/access/web/users');
    return safeParseList(parseAccessUser, data, "people's access");
  },

  /**
   * Replaces the roles assigned to a person directly.
   *
   * `PUT /access/web/users/{employeeId}/roles` → `AccessUserDto`
   */
  async setUserRoles(employeeId: number, roleIds: string[]): Promise<AccessUser> {
    return user(await api.put<ApiResponse>(`/access/web/users/${employeeId}/roles`, { roleIds }));
  },

  /**
   * Replaces a person's grants of their own.
   *
   * `PUT /access/web/users/{employeeId}/grants` → `AccessUserDto`
   */
  async setUserGrants(employeeId: number, grants: AccessGrantRequest[]): Promise<AccessUser> {
    return user(await api.put<ApiResponse>(`/access/web/users/${employeeId}/grants`, { grants }));
  },
};
