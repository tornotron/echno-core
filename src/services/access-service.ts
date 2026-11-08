/**
 * @module access-service
 *
 * Typed client for the access matrix: the signed-in member's own access
 * (echno-backend `CurrentUserAccessControllerWeb`), what the Roles &
 * Permissions screen reads (`AccessAdminControllerWeb`) and what it writes
 * (`AccessAdminWriteControllerWeb`). Roles and Users only; there are no
 * groups.
 *
 * | Method | Path | Request | Response |
 * | --- | --- | --- | --- |
 * | GET | `/access/web/current-user-access` | none | `CurrentUserAccessDto` |
 * | GET | `/access/web/catalog` | none | `AccessCatalogDto` |
 * | GET | `/access/web/roles` | none | `AccessRoleDto[]` |
 * | GET | `/access/web/roles/{roleId}` | none | `AccessRoleDto` |
 * | GET | `/access/web/users` | none | `AccessUserDto[]` |
 * | GET | `/access/web/users/{employeeId}` | none | `AccessUserDto` |
 * | POST | `/access/web/roles` | `AccessRoleRequest` | 201 `AccessRoleCreatedDto` |
 * | PUT | `/access/web/roles/{roleId}` | `AccessRoleRequest` | 204 |
 * | PUT | `/access/web/roles/{roleId}/grants` | `AccessGrantsRequest` | 204 |
 * | PUT | `/access/web/roles/{roleId}/grantable-roles` | `AccessRoleIdsRequest` | 204 |
 * | DELETE | `/access/web/roles/{roleId}` | none | 204 |
 * | PUT | `/access/web/users/{employeeId}/roles` | `AccessUserRolesRequest` | 204 |
 *
 * Reads need `access:read` and writes `access:edit`; the current user's own
 * access needs only membership. A write answers with no body, so the screen
 * reads the role or person again (the mutation hooks do that by
 * invalidation). Every `PUT` replaces the whole set it names.
 *
 * Refusals the screen should expect from a write: 400 for an unknown or
 * unenforced permission, a narrower scope on an area that is not scope
 * aware, or a project on an organization-wide-only role; 403 for a role the
 * caller may not assign, a grant the caller does not hold, the caller's own
 * roles or a role they hold, or a baseline grant edit without
 * `access:edit-employee-role`; 404 for a role or person of another
 * organization; 409 for a name already taken; 422 for a system role, or for
 * deleting a role somebody holds.
 *
 * All functions throw {@link ApiError} on non-2xx responses or parse failures.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { CurrentUserAccess, parseCurrentUserAccess } from '../types/access/current-user-access';
import {
  AccessCatalog,
  AccessGrantRequest,
  AccessRole,
  AccessRoleCreated,
  AccessRoleRequest,
  AccessUser,
  AccessUserRoleRequest,
  parseAccessCatalog,
  parseAccessRole,
  parseAccessRoleCreated,
  parseAccessUser,
} from '../types/access/access-admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

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
    return safeParse(parseCurrentUserAccess, data, 'access data');
  },

  /**
   * Fetches the sections, areas and actions the matrix shows, each action
   * with whether a guard enforces it, and the scopes a grant can take.
   *
   * `GET /access/web/catalog` → `AccessCatalogDto`
   *
   * @throws {ApiError} 403 if the caller may not read roles and permissions.
   */
  async getCatalog(): Promise<AccessCatalog> {
    const data = await api.get<ApiResponse>('/access/web/catalog');
    return safeParse(parseAccessCatalog, data, 'access catalog');
  },

  /**
   * Fetches the organization's roles, the baseline role first, then by name.
   *
   * `GET /access/web/roles` → `AccessRoleDto[]`
   */
  async getRoles(): Promise<AccessRole[]> {
    const data = await api.get<ApiResponse>('/access/web/roles');
    return safeParseList(parseAccessRole, data, 'roles');
  },

  /**
   * Fetches one role, for the role's details panel.
   *
   * `GET /access/web/roles/{roleId}` → `AccessRoleDto`
   *
   * @throws {ApiError} 404 for a role of another organization.
   */
  async getRole(roleId: string): Promise<AccessRole> {
    const data = await api.get<ApiResponse>(`/access/web/roles/${roleId}`);
    return safeParse(parseAccessRole, data, 'role');
  },

  /**
   * Fetches every employee with the roles and grants given to them directly,
   * by name.
   *
   * `GET /access/web/users` → `AccessUserDto[]`
   */
  async getUsers(): Promise<AccessUser[]> {
    const data = await api.get<ApiResponse>('/access/web/users');
    return safeParseList(parseAccessUser, data, "people's access");
  },

  /**
   * Fetches one person's roles and grants.
   *
   * `GET /access/web/users/{employeeId}` → `AccessUserDto`
   *
   * @throws {ApiError} 404 for a person of another organization.
   */
  async getUser(employeeId: number): Promise<AccessUser> {
    const data = await api.get<ApiResponse>(`/access/web/users/${employeeId}`);
    return safeParse(parseAccessUser, data, "person's access");
  },

  /**
   * Creates a role with no grants. The caller's roles that already assign
   * others, and System Admin, may assign it from then on.
   *
   * `POST /access/web/roles` → 201 `AccessRoleCreatedDto`
   *
   * @throws {ApiError} 409 if the name is taken, ignoring case.
   */
  async createRole(body: AccessRoleRequest): Promise<AccessRoleCreated> {
    const data = await api.post<ApiResponse>('/access/web/roles', body);
    return safeParse(parseAccessRoleCreated, data, 'new role');
  },

  /**
   * Renames a role and replaces its subtitle and description; an absent one
   * is cleared.
   *
   * `PUT /access/web/roles/{roleId}` → 204
   *
   * @throws {ApiError} 409 if the name is taken; 422 for a system role.
   */
  async updateRole(roleId: string, body: AccessRoleRequest): Promise<void> {
    await api.put(`/access/web/roles/${roleId}`, body);
  },

  /**
   * Replaces a role's grants with `grants`. Any action brings `read` on the
   * same area at the same scope, so `read` need not be listed. Send back
   * every grant the role keeps: one on an action the catalog no longer marks
   * enforced is accepted as it is, but cannot be added.
   *
   * `PUT /access/web/roles/{roleId}/grants` → 204
   */
  async setRoleGrants(roleId: string, grants: AccessGrantRequest[]): Promise<void> {
    await api.put(`/access/web/roles/${roleId}/grants`, { grants });
  },

  /**
   * Replaces the roles a role's holders may assign to others.
   *
   * `PUT /access/web/roles/{roleId}/grantable-roles` → 204
   */
  async setRoleGrantableRoles(roleId: string, roleIds: string[]): Promise<void> {
    await api.put(`/access/web/roles/${roleId}/grantable-roles`, { roleIds });
  },

  /**
   * Deletes a role nobody holds. A deleted starting role stays deleted.
   *
   * `DELETE /access/web/roles/{roleId}` → 204
   *
   * @throws {ApiError} 422 for a system role, a role somebody holds, or one
   *   that stands in for an old role.
   */
  async deleteRole(roleId: string): Promise<void> {
    await api.delete(`/access/web/roles/${roleId}`);
  },

  /**
   * Replaces the roles a person holds. Send the whole set: adding someone to
   * a role from the role's panel means sending their current roles plus that
   * one. The baseline role is never listed.
   *
   * `PUT /access/web/users/{employeeId}/roles` → 204
   *
   * @throws {ApiError} 403 for the caller's own roles; 400 if it would leave
   *   the organization with no active System Admin.
   */
  async setUserRoles(employeeId: number, roles: AccessUserRoleRequest[]): Promise<void> {
    await api.put(`/access/web/users/${employeeId}/roles`, { roles });
  },
};
